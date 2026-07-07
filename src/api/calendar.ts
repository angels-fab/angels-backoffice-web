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
  /** 반복 시리즈 그룹 id(빈 문자열=단독). materialize 모델: 같은 series_id = 한 반복의 발생일별 개별 행 */
  seriesId: string
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
  series_id: string
}

// 비반복 일정은 과거·미래 전부 로드(DB에서 이미 전체 행을 받음 — 과거 일정 소실 방지).
// 반복 일정만 미래 전개 상한이 필요(무한 반복 방지). 과거는 반복 시작일(s0)이 자연 하한.
const WINDOW_FUTURE_DAYS = 366

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
    recurring: r.repeat !== 'none' || !!r.series_id,
    seriesId: r.series_id || '',
  }
}

/** 반복 발생일 목록(yyyy-MM-dd). monthly는 그 달에 없는 일자(31일 등) 건너뜀. cap로 폭주 방지. */
function occurrenceDates(s0: string, repeat: 'daily' | 'weekly' | 'monthly', until: string, cap: number): string[] {
  const out: string[] = []
  if (repeat === 'monthly') {
    const day = Number(s0.slice(8, 10))
    let [y, m] = [Number(s0.slice(0, 4)), Number(s0.slice(5, 7))]
    for (let i = 0; i < 600 && out.length < cap; i++) {
      // 그 달에 해당 일자가 없으면(2/30·2/31·4/31 등) 말일로 앵커 — '매월 31일/말일'도 달마다 1건씩 생성
      const lastDay = new Date(y, m, 0).getDate()
      const occ = iso(new Date(y, m - 1, Math.min(day, lastDay)))
      if (occ > until) break
      if (occ >= s0) out.push(occ)
      m += 1
      if (m > 12) { m = 1; y += 1 }
    }
  } else {
    const step = repeat === 'daily' ? 1 : 7
    for (let occ = s0, i = 0; occ <= until && i < 4000 && out.length < cap; occ = addDays(occ, step), i++) out.push(occ)
  }
  return out
}

/** 시작일 기준 n개월 후 — 목표 월에 그 일자가 없으면 말일로 클램프(Date 오버플로로 다음 달로 넘어가지 않게) */
const monthsLater = (s: string, n: number): string => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  const last = new Date(y, m - 1 + n + 1, 0).getDate()
  return iso(new Date(y, m - 1 + n, Math.min(d, last)))
}

export async function fetchCalendarEvents(): Promise<CalRawEvent[]> {
  const { data, error } = await supabase.from('calendar_events').select('*').order('start_at', { ascending: true })
  if (error) throw new Error(error.message || '일정을 불러오지 못했습니다')
  const today = iso(new Date())
  const winEnd = addDays(today, WINDOW_FUTURE_DAYS)
  const out: CalRawEvent[] = []
  for (const r of (data || []) as CalTableRow[]) {
    const s0 = r.start_at.slice(0, 10)
    // materialize 모델: 단독(repeat=none)·시리즈 발생행(series_id 있음)은 개별 행 그대로 반환.
    // 레거시 시리즈(repeat!='none' & series_id 없음)만 발생일 전개(현재 그런 행 0건, 하위호환용).
    if (r.repeat === 'none' || r.series_id) {
      out.push(toRaw(r, s0))
      continue
    }
    const until = r.repeat_until && r.repeat_until < winEnd ? r.repeat_until : winEnd
    for (const occ of occurrenceDates(s0, r.repeat, until, 4000)) out.push(toRaw(r, occ, occ))
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

/** 반복 수정/삭제 범위 — 이 일정만 / 이 일정 및 이후 / 모든 일정 */
export type CalScope = 'one' | 'following' | 'all'

const genSeriesId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export async function addCalEvent(p: CalWriteInput): Promise<{ note?: string }> {
  // 단독 일정 — 한 행 삽입
  if (!p.repeat || p.repeat === 'none') {
    const { error } = await supabase.from('calendar_events').insert({ ...toPatch(p), series_id: '', created_by: p.createdBy || '' })
    if (error) throw new Error(error.message || '일정 추가에 실패했습니다')
    return {}
  }
  // 반복 — 발생일별 개별 행으로 펼쳐 저장(series_id로 묶음). 종료일 비우면 6개월, 상한 400건.
  const s0 = p.start.slice(0, 10)
  const until = p.repeatUntil || monthsLater(s0, 6)
  const dates = occurrenceDates(s0, p.repeat, until, 400)
  if (!dates.length) throw new Error('반복 발생일이 없습니다 (시작일·종료일을 확인해주세요)')
  const sid = genSeriesId()
  const st = p.start.slice(10) // 'THH:mm' 또는 ''(종일)
  const et = p.end.slice(10)
  const rows = dates.map((d) => ({
    title: p.title, loc: p.loc || '', all_day: p.allDay,
    start_at: `${d}${st}`, end_at: `${d}${et}`,
    repeat: 'none', repeat_until: '', series_id: sid, created_by: p.createdBy || '',
  }))
  const { error } = await supabase.from('calendar_events').insert(rows)
  if (error) throw new Error(error.message || '반복 일정 추가에 실패했습니다')
  const truncated = dates.length >= 400 && dates[dates.length - 1] < until
  return {
    note: truncated
      ? `반복 일정 ${rows.length}건 생성 — 상한(400건)에 걸려 ${dates[dates.length - 1]}까지만 만들었어요. 이후 기간은 추가로 등록해주세요`
      : `반복 일정 ${rows.length}건을 만들었어요`,
  }
}

/** 인스턴스 id에서 행 id 추출(레거시 `행id:발생일` 대응 — materialize 행은 숫자 id 그대로) */
export const seriesIdOf = (id: string) => Number(String(id).split(':')[0])

/** 시리즈 발생행(개별 행) 조회 — following이면 기준일(occDate) 이후만 */
async function seriesRows(seriesId: string, fromDate?: string): Promise<{ id: number; start_at: string }[]> {
  let q = supabase.from('calendar_events').select('id, start_at').eq('series_id', seriesId)
  if (fromDate) q = q.gte('start_at', fromDate)
  const { data, error } = await q
  if (error) throw new Error(error.message || '반복 시리즈 조회에 실패했습니다')
  return (data || []) as { id: number; start_at: string }[]
}

/** 수정 — scope로 이 일정만/이후/전체 선택. one·단독은 해당 행만, 이후/전체는 각 행 날짜 보존하고 제목·장소·시간 갱신 */
export async function updateCalEvent(
  p: CalWriteInput & { id: string; scope?: CalScope; seriesId?: string; occDate?: string },
): Promise<{ note?: string }> {
  const scope = p.scope || 'one'
  if (scope === 'one' || !p.seriesId) {
    const { error } = await supabase.from('calendar_events').update(toPatch(p)).eq('id', seriesIdOf(p.id))
    if (error) throw new Error(error.message || '일정 수정에 실패했습니다')
    return {}
  }
  if (scope === 'following' && !p.occDate) throw new Error('기준 발생일이 없어 이후 수정을 진행할 수 없습니다')
  const rows = await seriesRows(p.seriesId, scope === 'following' ? p.occDate : undefined)
  const st = p.start.slice(10)
  const et = p.end.slice(10)
  const dayDelta = diffDays(p.start.slice(0, 10), p.end.slice(0, 10)) // 다중일 스팬(종료-시작 일수) 보존
  const results = await Promise.allSettled(rows.map((row) => {
    const d = row.start_at.slice(0, 10) // 각 발생일 보존
    const endD = dayDelta > 0 ? addDays(d, dayDelta) : d
    return supabase.from('calendar_events').update({
      title: p.title, loc: p.loc || '', all_day: p.allDay,
      start_at: `${d}${st}`, end_at: `${endD}${et}`,
    }).eq('id', row.id).then((r) => { if (r.error) throw new Error(r.error.message) })
  }))
  const failed = results.filter((r) => r.status === 'rejected').length
  if (rows.length && failed === rows.length) throw new Error('반복 일정 수정에 실패했습니다')
  const n = rows.length - failed
  return { note: failed ? `${n}건 반영, ${failed}건 실패` : `반복 일정 ${n}건에 반영했어요` }
}

/** 삭제 — scope로 이 일정만/이후/전체 선택 */
export async function deleteCalEvent(
  p: { id: string; scope?: CalScope; seriesId?: string; occDate?: string },
): Promise<{ note?: string }> {
  const scope = p.scope || 'one'
  if (scope === 'one' || !p.seriesId) {
    const { error } = await supabase.from('calendar_events').delete().eq('id', seriesIdOf(p.id))
    if (error) throw new Error(error.message || '일정 삭제에 실패했습니다')
    return {}
  }
  if (scope === 'following' && !p.occDate) throw new Error('기준 발생일이 없어 이후 삭제를 진행할 수 없습니다')
  let q = supabase.from('calendar_events').delete().eq('series_id', p.seriesId)
  if (scope === 'following') q = q.gte('start_at', p.occDate as string)
  const { error } = await q
  if (error) throw new Error(error.message || '반복 일정 삭제에 실패했습니다')
  return { note: scope === 'all' ? '반복 일정 전체를 삭제했어요' : '이 일정 및 이후를 삭제했어요' }
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
