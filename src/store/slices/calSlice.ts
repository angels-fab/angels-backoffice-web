import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchCalendarEvents } from '@/api/calendar'
import { nowStamp } from '@/utils/date'
import type { CalEvent } from '@/types'

// 일정 제목 키워드 → 분류 (캘린더에는 분류 개념이 없어 제목으로 판별)
function evCat(title: string): CalEvent['cat'] {
  if (/회의|미팅|보고|위원회/.test(title)) return 'meeting'
  if (/교육|세미나|워크숍|강의/.test(title)) return 'edu'
  if (/출장|실사|방문/.test(title)) return /국외|해외/.test(title) ? 'trip_intl' : 'trip_dom'
  return 'etc' // 채용 등은 기타로(별도 채용 분류 미노출)
}

// 개정 규칙: [업무구분]이 제목 맨 앞. 대괄호 태그 우선 분류, 없으면 위 키워드 폴백.
function classify(title: string): CalEvent['cat'] {
  const m = (title || '').match(/^\s*\[([^\]]+)\]/)
  if (!m) return evCat(title)
  const tag = m[1]
  // 연차/반차/휴가/사가는 제목 앞 구분 태그로만 분류(일반 제목 속 단어로는 분류 안 함)
  if (/연차|반차|휴가|사가/.test(tag)) return 'leave'
  if (/회의|미팅|보고|위원회/.test(tag)) return 'meeting'
  if (/업무/.test(tag)) return 'work'
  if (/교육|세미나|워크숍|강의/.test(tag)) return 'edu'
  if (/출장|실사|방문/.test(tag)) return /국외|해외/.test(title) ? 'trip_intl' : 'trip_dom'
  return 'etc' // [채용] 등은 기타로 통합(별도 채용 필터 제거)
}

const DAY = 24 * 3600 * 1000
const dstr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 원본 일정 1건 → 날짜별 칸 전개(로더·드래그 이동 패치 공용 — 규칙 단일화) */
function expandRawEvent(ev: { id: string; title: string; start: string; end: string; allDay: boolean; loc: string; recurring: boolean }): CalEvent[] {
  const out: CalEvent[] = []
  const s = new Date(ev.start)
  if (isNaN(s.getTime())) return out
  // 종일 일정의 끝은 '다음 날 0시'(미포함)라서 하루 빼면 실제 마지막 날
  const e = new Date(new Date(ev.end).getTime() - (ev.allDay ? DAY : 0))
  const sTime = ev.start.slice(11)
  const eTime = ev.end.slice(11)
  const time = ev.allDay ? '종일' : sTime + (eTime !== sTime ? '-' + eTime : '')
  const cat = classify(ev.title)
  let t = new Date(s.getFullYear(), s.getMonth(), s.getDate())
  for (let i = 0; i < 60 && t <= e; i++) {
    out.push({
      date: dstr(t), title: ev.title, cat, time, loc: ev.loc,
      id: ev.id, start: ev.start, end: ev.end, allDay: ev.allDay, recurring: ev.recurring,
    })
    t = new Date(t.getTime() + DAY)
  }
  return out
}

export const loadCalEvents = createAsyncThunk('cal/load', async (): Promise<CalEvent[]> => {
  // 일시 오류(네트워크·리다이렉트·5xx·파싱) 대비 — 짧은 간격으로 최대 2회 자동 재시도.
  // 원인은 콘솔에 남겨 진단 가능하게 하고, 최종 실패만 rejected로 전달(기존 일정은 리듀서가 유지).
  let lastErr: unknown
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const raw = await fetchCalendarEvents()
      // 여러 날짜에 걸친 일정은 날짜마다 한 칸씩. 수정/삭제는 원본 이벤트 기준이라
      // id·start·end·allDay·recurring을 모든 칸에 그대로 싣는다(expandRawEvent 공용 규칙).
      return raw.flatMap(expandRawEvent)
    } catch (err) {
      lastErr = err
      console.error(`[calendar] 일정 불러오기 실패 (시도 ${attempt + 1}/3)`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('일정 불러오기 실패')
})

interface CalState {
  events: CalEvent[]
  ready: boolean
  loading: boolean
  error: boolean
  /** 마지막 실패 원인(진단용 — 오류 안내에 함께 표시) */
  errorMsg: string | null
  updatedAt: string | null
}

const initialState: CalState = {
  events: [],
  ready: false,
  loading: false,
  error: false,
  errorMsg: null,
  updatedAt: null,
}

const calSlice = createSlice({
  name: 'cal',
  initialState,
  reducers: {
    // 드래그 이동/리사이즈 낙관 반영 — 서버 저장 성공 후 그 일정의 칸들만 새 날짜로 재전개.
    // 이동 직후 전체 재조회가 다음 이동과 경쟁해 화면이 과거 스냅샷으로 되돌아가던 문제의 근본 제거.
    // start/end 계약은 로더 원본(RawCalEvent)과 동일: 종일 end = 다음 날(미포함).
    moveCalEvent(state, action: { payload: { id: string; start: string; end: string } }) {
      const { id, start, end } = action.payload
      const first = state.events.find(e => e.id === id)
      if (!first) return
      state.events = state.events
        .filter(e => e.id !== id)
        .concat(expandRawEvent({
          id, title: first.title, loc: first.loc, allDay: first.allDay, recurring: first.recurring, start, end,
        }))
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadCalEvents.pending, state => {
        state.loading = true
      })
      .addCase(loadCalEvents.fulfilled, (state, action) => {
        state.events = action.payload
        state.ready = true
        state.loading = false
        state.error = false
        state.errorMsg = null
        state.updatedAt = nowStamp()
      })
      .addCase(loadCalEvents.rejected, (state, action) => {
        // 기존에 정상적으로 불러온 일정은 지우지 않는다(빈 화면 방지) — 오류 상태만 표시.
        // updatedAt도 유지해 '마지막으로 불러온' 시각을 알 수 있게 한다.
        state.ready = true
        state.loading = false
        state.error = true
        state.errorMsg = action.error.message || '알 수 없는 오류'
      })
  },
})

export const { moveCalEvent } = calSlice.actions
export default calSlice.reducer
