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
  const col = (n: string) => head.indexOf(n)
  const ci = {
    num: col('번호'), cat: col('구분'), task: col('업무'), dept: col('관련부서'),
    mat: col('관련자료'), start: col('시작일자'), time: col('시간'), loc: col('장소'),
    mgr: col('담당자'), share: col('공유여부'), remind: col('Remind'), end: col('완료일자'),
  }

  return rows
    .slice(hIdx + 1)
    .filter(r => cell(r, ci.task) !== '') // 업무 내용 있는 행만
    .map((r, idx) => ({
      id: idx + 1,
      num: cell(r, ci.num), cat: cell(r, ci.cat), task: cell(r, ci.task), dept: cell(r, ci.dept),
      mat: cell(r, ci.mat), start: cell(r, ci.start), time: cell(r, ci.time), loc: cell(r, ci.loc),
      mgr: cell(r, ci.mgr), end: cell(r, ci.end),
      link: cell(r, 11), // L열: 관련 링크 (URL)
      share: cell(r, ci.share) === '1', // J열: 1 → 진행중 업무
      remind: cell(r, ci.remind) === '1', // K열: 1 → 지난 업무 최상단 고정
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
