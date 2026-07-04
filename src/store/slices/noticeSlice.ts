import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { getNotices } from '@/api/notices'
import { nowStamp } from '@/utils/date'
import type { Notice } from '@/types'

// 공지 목록 — Supabase(notices 테이블). 연번 내림차순·isNew 판정은 API 레이어가 수행.
// (시트 헤더 자동탐지·체크박스 다형 인식 로직은 고정 스키마 전환으로 소멸)
export const loadNoticeData = createAsyncThunk('notice/load', async (): Promise<Notice[]> => getNotices())

interface NoticeState {
  items: Notice[]
  /** 로드 완료 여부 (성공·실패 무관 — 미리보기 로딩 표시용) */
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: NoticeState = {
  items: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const noticeSlice = createSlice({
  name: 'notice',
  initialState,
  reducers: {
    // 조회수: 펼칠 때 세션 내에서만 증가 (원본의 n.views++ 동작 대응)
    bumpNoticeViews(state, action: PayloadAction<number>) {
      const n = state.items.find(x => x.id === action.payload)
      if (n) n.views++
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadNoticeData.pending, state => {
        state.loading = true
        state.error = false
      })
      .addCase(loadNoticeData.fulfilled, (state, action) => {
        state.items = action.payload
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadNoticeData.rejected, state => {
        // 재로딩 실패 시 직전 목록 유지 — 화면이 통째로 비지 않도록
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export const { bumpNoticeViews } = noticeSlice.actions
export default noticeSlice.reducer
