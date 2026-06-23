import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchCalendarEvents } from '@/api/sheets'
import { nowStamp } from '@/utils/date'
import type { CalEvent } from '@/types'

// 일정 제목 키워드 → 분류 (캘린더에는 분류 개념이 없어 제목으로 판별)
function evCat(title: string): CalEvent['cat'] {
  if (/회의|미팅|보고|위원회/.test(title)) return 'meeting'
  if (/교육|세미나|워크숍|강의/.test(title)) return 'edu'
  if (/채용|면접|공고/.test(title)) return 'recruit'
  if (/출장|실사|방문/.test(title)) return /국외|해외/.test(title) ? 'trip_intl' : 'trip_dom'
  return 'etc'
}

const DAY = 24 * 3600 * 1000
const dstr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const loadCalEvents = createAsyncThunk('cal/load', async (): Promise<CalEvent[]> => {
  const raw = await fetchCalendarEvents()
  const out: CalEvent[] = []
  raw.forEach(ev => {
    const s = new Date(ev.start)
    if (isNaN(s.getTime())) return
    // 종일 일정의 끝은 '다음 날 0시'(미포함)라서 하루 빼면 실제 마지막 날
    const e = new Date(new Date(ev.end).getTime() - (ev.allDay ? DAY : 0))
    const sTime = ev.start.slice(11)
    const eTime = ev.end.slice(11)
    const time = ev.allDay ? '종일' : sTime + (eTime !== sTime ? '-' + eTime : '')
    const cat = evCat(ev.title)
    // 여러 날짜에 걸친 일정은 날짜마다 한 칸씩 (최대 60일 안전장치).
    // 수정/삭제는 원본 이벤트 기준이라 id·start·end·allDay·recurring을 모든 칸에 그대로 싣는다.
    let t = new Date(s.getFullYear(), s.getMonth(), s.getDate())
    for (let i = 0; i < 60 && t <= e; i++) {
      out.push({
        date: dstr(t), title: ev.title, cat, time, loc: ev.loc,
        id: ev.id, start: ev.start, end: ev.end, allDay: ev.allDay, recurring: ev.recurring,
      })
      t = new Date(t.getTime() + DAY)
    }
  })
  return out
})

interface CalState {
  events: CalEvent[]
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: CalState = {
  events: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const calSlice = createSlice({
  name: 'cal',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadCalEvents.pending, state => {
        state.loading = true
        state.error = false
      })
      .addCase(loadCalEvents.fulfilled, (state, action) => {
        state.events = action.payload
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadCalEvents.rejected, state => {
        state.events = []
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export default calSlice.reducer
