import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchWorkComments } from '@/api/workComments'
import type { WorkComment } from '@/api/workComments'

/**
 * 업무카드 코멘트 (개선요청 68, A안) — 전역으로 두는 이유는 **건수**다.
 *
 * 카드마다 말풍선 옆에 건수를 보여 줘야 하는데, 카드가 150장을 넘는다. 카드별로 불러오면
 * 화면 한 번에 요청이 수백 건이 된다. RLS 가 이미 볼 수 있는 것만 주므로 한 번에 받아
 * 업무번호로 나눠 쓴다(pageNotesSlice 와 같은 판단).
 */
export const loadWorkComments = createAsyncThunk('workComments/load', fetchWorkComments)

interface State {
  items: WorkComment[]
  ready: boolean
  loading: boolean
  error: boolean
}

const initialState: State = { items: [], ready: false, loading: false, error: false }

const slice = createSlice({
  name: 'workComments',
  initialState,
  reducers: {
    /** 로그아웃·계정 전환 시 비운다 — 비공개 업무의 코멘트가 다음 사람 화면에 남으면 유출이다 */
    resetWorkComments() {
      return initialState
    },
    /** 등록 직후 낙관 반영 — 서버 왕복을 기다리지 않고 글타래 끝에 붙인다 */
    addWorkComment(state, action: { payload: WorkComment; type: string }) {
      state.items.push(action.payload)
    },
    /** 행째 삭제 낙관 반영 — 답글 없는 코멘트만 이 길로 온다(답글 달린 것은 아래 소프트 삭제) */
    removeWorkComment(state, action: { payload: number; type: string }) {
      state.items = state.items.filter((c) => c.id !== action.payload)
    },
    /** 소프트 삭제 낙관 반영 — 답글이 달린 코멘트는 자리만 남긴다("삭제된 코멘트입니다") */
    markWorkCommentDeleted(state, action: { payload: number; type: string }) {
      const it = state.items.find((c) => c.id === action.payload)
      if (it) { it.deleted = true; it.content = '' }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWorkComments.pending, (state) => {
        state.loading = true
        state.error = false
      })
      .addCase(loadWorkComments.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
      })
      .addCase(loadWorkComments.rejected, (state) => {
        // 목록을 비우지 않는다 — 일시적 실패로 코멘트가 사라지면 지워진 줄 안다(pageNotesSlice 와 동일)
        state.ready = true
        state.loading = false
        state.error = true
      })
  },
})

export const { resetWorkComments, addWorkComment, removeWorkComment, markWorkCommentDeleted } = slice.actions
export default slice.reducer
