import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchPageNotes, fetchPageNoteReplies } from '@/api/pageNotes'
import type { PageNote, PageNoteReply } from '@/api/pageNotes'
import { nowStamp } from '@/utils/date'

/**
 * 일반메모 — 종전에는 쪽지 레이어 안의 지역 상태였는데, **업무카드 안에 박아 넣는 메모**가
 * 생기면서 소비자가 셋(쪽지 레이어·상단바 건수 배지·업무카드)이 됐다.
 * 세 곳이 각자 불러오면 같은 것을 세 번 받고 갱신 시점도 갈리므로 전역으로 올린다.
 *
 * 답글도 함께 담는다 — 목록과 답글이 따로 갱신되면 답글만 있고 메모는 없는 순간이 생긴다.
 * RLS 가 '내 것 + 공유받은 것'만 주므로 화면에서 다시 거를 필요는 없다(경로·대상만 고른다).
 */
export const loadPageNotes = createAsyncThunk('pageNotes/load', async () => {
  const [notes, replies] = await Promise.all([fetchPageNotes(), fetchPageNoteReplies()])
  return { notes, replies }
})

interface PageNotesState {
  items: PageNote[]
  replies: PageNoteReply[]
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: PageNotesState = {
  items: [],
  replies: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const pageNotesSlice = createSlice({
  name: 'pageNotes',
  initialState,
  reducers: {
    /**
     * 로그아웃·계정 전환 시 비운다 — **개인 메모라 남으면 유출이다**(적대적 리뷰 확인).
     *
     * 로그아웃은 새로고침을 하지 않고 store 는 탭 수명 내내 살아 있다. 비우지 않으면
     * 같은 탭에서 다음 사람이 로그인했을 때 앞사람의 비공개 메모가 그대로 화면에 남고,
     * ready 가 true 라 다시 불러오지도 않는다. 개인 설정(userSettings)이 같은 이유로
     * reset 을 갖고 있다 — 같은 규칙을 따른다.
     */
    resetPageNotes() {
      return initialState
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPageNotes.pending, (state) => {
        state.loading = true
        state.error = false
      })
      .addCase(loadPageNotes.fulfilled, (state, action) => {
        state.items = action.payload.notes
        state.replies = action.payload.replies
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadPageNotes.rejected, (state) => {
        // 목록을 비우지 않는다 — 일시적 실패로 화면의 메모가 사라지면 지워진 줄 안다
        state.ready = true
        state.loading = false
        state.error = true
      })
  },
})

export const { resetPageNotes } = pageNotesSlice.actions
export default pageNotesSlice.reducer
