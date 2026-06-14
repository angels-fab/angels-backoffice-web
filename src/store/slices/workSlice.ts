import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { cell, fetchSheet, SHEET_NAME_WORK } from '@/api/sheets'
import { nowStamp } from '@/utils/date'
import type { WorkItem } from '@/types'

export const loadWorkData = createAsyncThunk('work/load', async (): Promise<WorkItem[]> => {
  const rows = await fetchSheet(SHEET_NAME_WORK)

  // 헤더 행 찾기 (구분 + 업무 포함된 행)
  let hIdx = -1
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const r = (rows[i] || []).map(c => String(c || '').trim())
    if (r.includes('구분') && r.includes('업무')) {
      hIdx = i
      break
    }
  }
  if (hIdx < 0) throw new Error('헤더(구분/업무)를 찾지 못함')

  const head = rows[hIdx].map(c => String(c || '').trim())
  // 헤더 이름으로 열을 찾되(위치가 바뀌어도 동작), 못 찾으면 폴백 열 위치 사용
  const colAny = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const i = head.indexOf(n)
      if (i >= 0) return i
    }
    return fallbackIdx
  }
  const ci = {
    num: colAny(['번호', '연번', 'No'], 0),
    cat: colAny(['구분', '분류'], 1),
    task: colAny(['업무', '업무명', '제목'], 2),
    dept: colAny(['관련부서', '부서'], 3),
    mat: colAny(['관련자료', '자료'], 4),
    // 발의일자(구 '시작일자')
    start: colAny(['발의일자', '시작일자', '발의', '등록일자'], 5),
    // 예정일 — 회의 등 업무일정 날짜
    plan: colAny(['예정일', '예정일자', '일정'], 6),
    time: colAny(['시간'], 7),
    loc: colAny(['장소'], 8),
    mgr: colAny(['담당자'], 9),
    // 상태 — 진행중/보류/완료 (정식 상태 열)
    status: colAny(['상태', '진행상태', '업무상태'], 10),
    end: colAny(['완료일자', '완료일'], 11),
    remind: colAny(['Remind', 'remind', '리마인드'], 12),
    // 검토 필요(구 '센터장 검토' / '센터장 Check')
    chief: colAny(['검토 필요', '검토필요', '센터장 검토', '센터장검토', '센터장 Check', '센터장', 'Check', 'check'], 13),
    link: colAny(['링크', '관련링크', 'link'], 14),
  }
  // 체크박스 값: 불리언 true/문자 'TRUE'/'1'/'Y'/'예' 모두 인식
  const isChk = (v: unknown) => {
    if (v === true) return true
    const s = String(v == null ? '' : v).trim().toUpperCase()
    return s === 'TRUE' || s === '1' || s === 'Y' || s === '예' || s === 'O' || s === '✓'
  }

  return rows
    .slice(hIdx + 1)
    .filter(r => cell(r, ci.task) !== '') // 업무 내용 있는 행만
    .map((r, idx) => ({
      id: idx + 1,
      num: cell(r, ci.num), cat: cell(r, ci.cat), task: cell(r, ci.task), dept: cell(r, ci.dept),
      mat: cell(r, ci.mat), start: cell(r, ci.start), plan: cell(r, ci.plan),
      time: cell(r, ci.time), loc: cell(r, ci.loc),
      mgr: cell(r, ci.mgr), status: cell(r, ci.status), end: cell(r, ci.end),
      link: cell(r, ci.link), // 관련 링크 (URL)
      remind: isChk(r[ci.remind]), // Remind 체크
      chief: isChk(r[ci.chief]), // 센터장 검토 체크
    }))
})

interface WorkState {
  items: WorkItem[]
  /** 로드 완료 여부 (성공·실패 무관 — 미리보기 로딩 표시용) */
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: WorkState = {
  items: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const workSlice = createSlice({
  name: 'work',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadWorkData.pending, state => {
        state.loading = true
        state.error = false
      })
      .addCase(loadWorkData.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadWorkData.rejected, state => {
        state.items = []
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export default workSlice.reducer
