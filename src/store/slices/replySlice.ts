import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { fetchReplies } from '@/api/improve'
import type { ReplyRow } from '@/api/sheets'
import { nowStamp } from '@/utils/date'

/** 포털개선요청 답글 — 전체 한 번 로드 후 요청번호별 그룹화는 컴포넌트에서. 삭제(삭제여부=TRUE)는 서버에서 제외됨. */
export const loadReplies = createAsyncThunk('reply/load', async (): Promise<ReplyRow[]> => {
  return fetchReplies()
})

interface ReplyState {
  items: ReplyRow[]
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: ReplyState = {
  items: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const replySlice = createSlice({
  name: 'reply',
  initialState,
  reducers: {
    // 낙관적 업데이트 — 등록/수정/삭제 성공 직후 즉시 반영(재조회 없이 칩·목록 갱신)
    addReply(state, action: PayloadAction<ReplyRow>) {
      state.items.push(action.payload)
    },
    patchReply(state, action: PayloadAction<{ id: string; content: string; edited: string }>) {
      const r = state.items.find((x) => x.id === action.payload.id)
      if (r) {
        r.content = action.payload.content
        r.edited = action.payload.edited
      }
    },
    removeReply(state, action: PayloadAction<string>) {
      state.items = state.items.filter((x) => x.id !== action.payload)
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadReplies.pending, (state) => {
        state.loading = true
        state.error = false
      })
      .addCase(loadReplies.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadReplies.rejected, (state) => {
        state.items = []
        state.ready = true
        state.loading = false
        state.error = true
      })
  },
})

export const { addReply, patchReply, removeReply } = replySlice.actions
export default replySlice.reducer
