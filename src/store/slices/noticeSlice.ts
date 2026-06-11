import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { cell, fetchSheet, SHEET_NAME_NOTICE } from '@/api/sheets'
import { fmtDate, nowStamp, todaySeoul } from '@/utils/date'
import type { Notice } from '@/types'

// 최근 7일 이내면 NEW (내일 날짜까지 허용 — 시간대 여유분)
function isNoticeNew(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return false
  const today = new Date(todaySeoul() + 'T00:00:00')
  const diff = (today.getTime() - d.getTime()) / 86400000
  return diff >= -1 && diff <= 7
}

export const loadNoticeData = createAsyncThunk('notice/load', async (): Promise<Notice[]> => {
  const rows = await fetchSheet(SHEET_NAME_NOTICE)

  // 헤더 행 찾기 ('제목' + '내용' 포함된 행)
  let hIdx = -1
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const r = (rows[i] || []).map(c => String(c || '').trim())
    if (r.includes('제목') && r.includes('내용')) {
      hIdx = i
      break
    }
  }
  if (hIdx < 0) throw new Error('헤더(제목/내용)를 찾지 못함')

  const head = rows[hIdx].map(c => String(c || '').trim())
  // 헤더 이름이 여러 후보일 수 있어 폴백 목록으로 탐색, 없으면 고정 열 위치 사용
  const colAny = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const i = head.indexOf(n)
      if (i >= 0) return i
    }
    return fallbackIdx
  }
  const ci = {
    num: colAny(['연번', '번호', 'No', 'no'], 0),
    cat: colAny(['업무', '구분', '분류'], 1),
    dept: colAny(['부서', '관련부서'], 2),
    deptMgr: colAny(['부서담당자', '담당자'], 3),
    title: colAny(['제목'], 4),
    body: colAny(['내용', '본문'], 5),
    ref: colAny(['관련자료', '첨부', '링크'], 6),
    reply: colAny(['회신일자', '게시일', '작성일', '등록일'], 7),
    start: colAny(['시작일자'], 8),
    stime: colAny(['시작시간'], 9),
    end: colAny(['종료일자'], 10),
    author: colAny(['게시자', '작성자'], 11),
    target: colAny(['해당자', '대상'], 12),
    views: colAny(['조회수', '조회'], 13),
  }

  const list = rows
    .slice(hIdx + 1)
    .filter(r => cell(r, ci.title) !== '') // 제목 있는 행만
    .map((r, idx): Notice => {
      const replyDate = fmtDate(cell(r, ci.reply))
      const startDate = fmtDate(cell(r, ci.start))
      const endDate = fmtDate(cell(r, ci.end))
      return {
        id: idx + 1,
        num: cell(r, ci.num) || String(idx + 1),
        cat: cell(r, ci.cat) || '공지',
        dept: cell(r, ci.dept),
        deptMgr: cell(r, ci.deptMgr),
        title: cell(r, ci.title),
        body: cell(r, ci.body),
        ref: cell(r, ci.ref),
        date: startDate || replyDate, // 닫힌 줄 표시 = 작성일(시작일자 I열)
        reply: replyDate, // 펼침 표시 = 회신일자(H열)
        start: startDate,
        stime: cell(r, ci.stime),
        end: endDate,
        author: cell(r, ci.author),
        target: cell(r, ci.target),
        views: Number(cell(r, ci.views).replace(/[^0-9]/g, '')) || 0,
        isNew: isNoticeNew(startDate || replyDate),
      }
    })

  // 연번 최신순 정렬 (번호 큰 것이 위, 1번이 맨 아래)
  list.sort((a, b) => {
    const na = Number(a.num)
    const nb = Number(b.num)
    if (!isNaN(na) && !isNaN(nb)) return nb - na
    return String(b.date).localeCompare(String(a.date))
  })
  return list
})

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
