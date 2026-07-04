import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchImprovements } from '@/api/improve'
import { nowStamp } from '@/utils/date'
import type { ImprovementItem } from '@/types'

// 읽기는 백엔드 getImprovements(헤더명→객체 + 위치/유형 드롭다운 목록)에 위임. 클라이언트는 id만 부여.
export const loadImproveData = createAsyncThunk('improve/load', async () => {
  const { items, locOptions, typeOptions } = await fetchImprovements()
  return { items: items.map((r, idx) => ({ id: idx + 1, ...r })) as ImprovementItem[], locOptions, typeOptions }
})

interface ImproveState {
  items: ImprovementItem[]
  /** 개선위치 드롭다운 목록(시트 데이터 확인) */
  locOptions: string[]
  /** 유형 드롭다운 목록(시트 데이터 확인) */
  typeOptions: string[]
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: ImproveState = {
  items: [],
  locOptions: [],
  typeOptions: [],
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
        state.items = action.payload.items
        state.locOptions = action.payload.locOptions
        state.typeOptions = action.payload.typeOptions
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
