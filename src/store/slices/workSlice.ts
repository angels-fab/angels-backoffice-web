import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { getWorks } from '@/api/sheets'
import { nowStamp } from '@/utils/date'
import type { WorkItem } from '@/types'

// 읽기는 백엔드 getWorks(헤더명→객체)에 위임 — 열 위치에 비의존. 클라이언트는 id만 부여.
export const loadWorkData = createAsyncThunk('work/load', async (): Promise<WorkItem[]> => {
  const rows = await getWorks()
  return rows.map((r, idx) => ({ id: idx + 1, ...r }))
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
