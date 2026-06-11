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
  // 헤더 이름이 여러 후보일 수 있어 폴백 목록으로 탐색, 없으면 고정 열 위치 사용
  const colAny = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const i = head.indexOf(n)
      if (i >= 0) return i
    }
    return fallbackIdx
  }
  const ci = {
    num: col('번호'), cat: col('구분'), task: col('업무'), dept: col('관련부서'),
    mat: col('관련자료'), start: col('시작일자'), time: col('시간'), loc: col('장소'),
    mgr: col('담당자'), end: col('완료일자'),
    // J열(진행중): '회의'/'공유여부' 등 어떤 이름이어도, 없으면 9번(J) 고정
    share: colAny(['회의', '공유여부', '진행중', '공유'], 9),
    // K열(Remind): 없으면 10번(K) 고정
    remind: colAny(['Remind', 'remind', '리마인드'], 10),
    // L열(센터장): 'Check'/'센터장 Check' 등, 없으면 11번(L) 고정
    chief: colAny(['Check', '센터장 Check', '센터장', '센터장체크', 'check'], 11),
    // M열(링크): 없으면 12번(M) 고정
    link: colAny(['링크', '관련링크', 'link'], 12),
  }
  // 체크박스 값: 불리언 true/문자 'TRUE'/'1'/'Y'/'예' 모두 인식
  const isChk = (v: unknown) => {
    if (v === true) return true
    const s = String(v == null ? '' : v).trim().toUpperCase()
    return s === 'TRUE' || s === '1' || s === 'Y' || s === '예' || s === 'O' || s === '✓'
  }

  return rows
    .slice(hIdx + 1)
    .filter(r => cell(r, ci.task) !== '') // 업무 내용 있는 행만
    .map((r, idx) => ({
      id: idx + 1,
      num: cell(r, ci.num), cat: cell(r, ci.cat), task: cell(r, ci.task), dept: cell(r, ci.dept),
      mat: cell(r, ci.mat), start: cell(r, ci.start), time: cell(r, ci.time), loc: cell(r, ci.loc),
      mgr: cell(r, ci.mgr), end: cell(r, ci.end),
      link: cell(r, ci.link), // M열: 관련 링크 (URL)
      share: isChk(r[ci.share]), // J열 체크 → 진행중 업무
      remind: isChk(r[ci.remind]), // K열 체크 → Remind
      chief: isChk(r[ci.chief]), // L열 체크 → 센터장 Check
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
