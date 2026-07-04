import { supabase } from './supabase'

/**
 * 업무일정 API — Supabase 전환(5단계, 마지막 GAS 의존 제거).
 * 반환 계약은 기존 fetchCalendarEvents(구글캘린더 경유)와 동일:
 *  - start/end 'yyyy-MM-ddTHH:mm' (KST), 종일 end는 구글식 '미포함'(마지막 날 +1일) — calSlice가 -1일 보정.
 *  - 반복(lite: 매일/매주/매월 + 종료일)은 여기서 발생일별 인스턴스로 전개(recurring: true).
 * 인스턴스 id = `${행id}:${발생일}` — 수정/삭제 시 ':' 앞 시리즈 id로 복원.
 */

export interface CalRawEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  loc: string
  recurring: boolean
}

interface CalTableRow {
  id: number
  title: string
  loc: string
  all_day: boolean
  start_at: string
  end_at: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  repeat_until: string
}

/** 조회 창 — 기존 백엔드와 동일(-92일 ~ +187일) */
const WINDOW_PAST_DAYS = 92
const WINDOW_FUTURE_DAYS = 187

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (s: string, n: number) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return iso(dt)
}
/** 시작~종료(포함) 일수 차 */
const diffDays = (a: string, b: string) => {
  const [y1, m1, d1] = a.slice(0, 10).split('-').map(Number)
  const [y2, m2, d2] = b.slice(0, 10).split('-').map(Number)
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
}

/** 행 1개 → 계약 형태(비반복). 종일 end는 미포함 규칙으로 +1일 */
const toRaw = (r: CalTableRow, startDate: string, idSuffix = ''): CalRawEvent => {
  const span = diffDays(r.start_at, r.end_at || r.start_at)
  const endDate = addDays(startDate, Math.max(0, span))
  return {
    id: idSuffix ? `${r.id}:${idSuffix}` : String(r.id),
    title: r.title,
    loc: r.loc,
    allDay: r.all_day,
    start: r.all_day ? startDate : `${startDate}${r.start_at.slice(10)}`,
    end: r.all_day ? addDays(endDate, 1) : `${endDate}${(r.end_at || r.start_at).slice(10)}`,
    recurring: r.repeat !== 'none',
  }
}

export async function fetchCalendarEvents(): Promise<CalRawEvent[]> {
  const { data, error } = await supabase.from('calendar_events').select('*').order('start_at', { ascending: true })
  if (error) throw new Error(error.message || '일정을 불러오지 못했습니다')
  const today = iso(new Date())
  const winStart = addDays(today, -WINDOW_PAST_DAYS)
  const winEnd = addDays(today, WINDOW_FUTURE_DAYS)
  const out: CalRawEvent[] = []
  for (const r of (data || []) as CalTableRow[]) {
    const s0 = r.start_at.slice(0, 10)
    if (r.repeat === 'none') {
      const e0 = (r.end_at || r.start_at).slice(0, 10)
      if (e0 >= winStart && s0 <= winEnd) out.push(toRaw(r, s0))
      continue
    }
    // 반복 전개 — 시작일부터 종료일(또는 창 끝)까지 발생일 나열
    const until = r.repeat_until && r.repeat_until < winEnd ? r.repeat_until : winEnd
    if (r.repeat === 'monthly') {
      const day = Number(s0.slice(8, 10))
      let [y, m] = [Number(s0.slice(0, 4)), Number(s0.slice(5, 7))]
      for (let i = 0; i < 400; i++) {
        const probe = new Date(y, m - 1, day)
        const occ = iso(probe)
        if (occ > until) break
        // 그 달에 해당 일자가 없으면(31일 등) 건너뜀
        if (probe.getDate() === day && occ >= s0) {
          if (occ >= winStart) out.push(toRaw(r, occ, occ))
        }
        m += 1
        if (m > 12) { m = 1; y += 1 }
      }
    } else {
      const step = r.repeat === 'daily' ? 1 : 7
      for (let occ = s0, i = 0; occ <= until && i < 2000; occ = addDays(occ, step), i++) {
        if (occ >= winStart) out.push(toRaw(r, occ, occ))
      }
    }
  }
  return out
}

export interface CalWriteInput {
  title: string
  loc?: string
  allDay: boolean
  /** 시작/종료 — 종일 'yyyy-MM-dd'(종료 포함), 시간 'yyyy-MM-ddTHH:mm' */
  start: string
  end: string
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly'
  repeatUntil?: string
  createdBy?: string
}

const toPatch = (p: CalWriteInput) => ({
  title: p.title,
  loc: p.loc || '',
  all_day: p.allDay,
  start_at: p.start,
  end_at: p.end,
  ...(p.repeat !== undefined ? { repeat: p.repeat, repeat_until: p.repeat === 'none' ? '' : p.repeatUntil || '' } : {}),
})

export async function addCalEvent(p: CalWriteInput): Promise<{ note?: string }> {
  const { error } = await supabase.from('calendar_events').insert({ ...toPatch(p), created_by: p.createdBy || '' })
  if (error) throw new Error(error.message || '일정 추가에 실패했습니다')
  return {}
}

/** 인스턴스 id(`행id:발생일`)에서 시리즈 행 id 추출 */
export const seriesIdOf = (id: string) => Number(String(id).split(':')[0])

/** 수정 — 반복 일정은 시리즈 전체에 반영(개별 예외는 미지원, 폼에서 안내) */
export async function updateCalEvent(p: CalWriteInput & { id: string }): Promise<{ note?: string }> {
  const { error } = await supabase.from('calendar_events').update(toPatch(p)).eq('id', seriesIdOf(p.id))
  if (error) throw new Error(error.message || '일정 수정에 실패했습니다')
  return {}
}

export async function deleteCalEvent(p: { id: string }): Promise<{ note?: string }> {
  const { error } = await supabase.from('calendar_events').delete().eq('id', seriesIdOf(p.id))
  if (error) throw new Error(error.message || '일정 삭제에 실패했습니다')
  return {}
}

/** 반복 일정의 시리즈 원본(반복 설정 포함) — 편집 폼 프리필용 */
export async function fetchCalSeries(id: string): Promise<{ repeat: string; repeatUntil: string; start: string; end: string } | null> {
  const { data } = await supabase
    .from('calendar_events')
    .select('repeat, repeat_until, start_at, end_at')
    .eq('id', seriesIdOf(id))
    .maybeSingle()
  if (!data) return null
  return { repeat: data.repeat, repeatUntil: data.repeat_until, start: data.start_at, end: data.end_at }
}
