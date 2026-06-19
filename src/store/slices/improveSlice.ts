import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchImprovements } from '@/api/sheets'
import { nowStamp } from '@/utils/date'
import type { ImprovementItem } from '@/types'

// 읽기는 백엔드 getImprovements(헤더명→객체)에 위임. 클라이언트는 id만 부여.
export const loadImproveData = createAsyncThunk('improve/load', async (): Promise<ImprovementItem[]> => {
  const rows = await fetchImprovements()
  return rows.map((r, idx) => ({ id: idx + 1, ...r }))
})

interface ImproveState {
  items: ImprovementItem[]
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: ImproveState = {
  items: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const improveSlice = createSlice({
  name: 'improve',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadImproveData.pending, (state) => {
        state.loading = true
        state.error = false
      })
      .addCase(loadImproveData.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadImproveData.rejected, (state) => {
        state.items = []
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export default improveSlice.reducer
