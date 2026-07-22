import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { fetchMilestones, type MilestoneRow } from '@/api/milestones'

// 마일스톤(팹 구축~개소 실행계획) — 읽기는 Supabase, 상태 변경은 낙관적 패치 후 실패 시 롤백.
export const loadMilestones = createAsyncThunk('milestone/load', () => fetchMilestones())

interface MilestoneState {
  items: MilestoneRow[]
  ready: boolean
  loading: boolean
  error: boolean
}

const initialState: MilestoneState = { items: [], ready: false, loading: false, error: false }

const milestoneSlice = createSlice({
  name: 'milestone',
  initialState,
  reducers: {
    /** 낙관적 부분갱신(상태·담당자·완료일) — 실패 시 이전 값으로 같은 액션으로 롤백 */
    patchMilestone(state, action: PayloadAction<{ id: number } & Partial<MilestoneRow>>) {
      const { id, ...patch } = action.payload
      const it = state.items.find((x) => x.id === id)
      if (it) Object.assign(it, patch)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMilestones.pending, (state) => {
        state.loading = true
        state.error = false
      })
      .addCase(loadMilestones.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
      })
      .addCase(loadMilestones.rejected, (state) => {
        state.items = []
        state.ready = true
        state.loading = false
        state.error = true
      })
  },
})

export const { patchMilestone } = milestoneSlice.actions
export default milestoneSlice.reducer
