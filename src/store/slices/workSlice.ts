import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { getWorks } from '@/api/works'
import { nowStamp } from '@/utils/date'
import type { WorkItem } from '@/types'

// 읽기는 백엔드 getWorks(헤더명→객체)에 위임 — 열 위치에 비의존. 클라이언트는 id만 부여.
// Apps Script는 간헐적으로 리다이렉트 404·지연을 반환하므로 짧은 간격 최대 2회 자동 재시도.
// 원인은 콘솔에 남기고, 최종 실패 시에도 기존 목록은 리듀서가 유지(빈 화면 방지).
export const loadWorkData = createAsyncThunk('work/load', async (): Promise<WorkItem[]> => {
  let lastErr: unknown
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const rows = await getWorks()
      return rows.map((r, idx) => ({ id: idx + 1, ...r }))
    } catch (err) {
      lastErr = err
      console.error(`[work] 업무 목록 불러오기 실패 (시도 ${attempt + 1}/3)`, err)
      if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('업무 목록 불러오기 실패')
})

interface WorkState {
  /** 살아있는 업무(삭제일시 없음) — 목록·KPI·배지·검색 등 모든 기존 소비처 대상 */
  items: WorkItem[]
  /** 소프트 삭제된 업무(삭제일시 있음) — 휴지통 전용 */
  trashed: WorkItem[]
  /** 로드 완료 여부 (성공·실패 무관 — 미리보기 로딩 표시용) */
  ready: boolean
  loading: boolean
  error: boolean
  /** 마지막 실패 원인(진단용) */
  errorMsg: string | null
  updatedAt: string | null
}

const initialState: WorkState = {
  items: [],
  trashed: [],
  ready: false,
  loading: false,
  error: false,
  errorMsg: null,
  updatedAt: null,
}

/** 상태 드래그/Undo·Redo의 낙관적 반영·롤백용 부분 갱신 */
export interface WorkItemPatch {
  num: string
  patch: Partial<Pick<WorkItem, 'status' | 'remind' | 'chief' | 'end'>>
}

const workSlice = createSlice({
  name: 'work',
  initialState,
  reducers: {
    // 서버 재조회 없이 항목 일부 필드만 로컬 갱신(낙관적 반영/실패 롤백/Undo·Redo)
    patchWorkItems(state, action: PayloadAction<WorkItemPatch[]>) {
      for (const { num, patch } of action.payload) {
        const it = state.items.find((t) => t.num === num)
        if (it) Object.assign(it, patch)
      }
    },
    // 소프트 삭제 낙관 반영 — items → trashed 이동(화면에서 즉시 사라짐). 실패 시 restoreWorkItems로 롤백.
    softDeleteWorkItems(state, action: PayloadAction<{ nums: string[]; deletedAt: string }>) {
      const numSet = new Set(action.payload.nums)
      const moving = state.items.filter((t) => numSet.has(t.num))
      state.items = state.items.filter((t) => !numSet.has(t.num))
      for (const t of moving) t.deletedAt = action.payload.deletedAt
      state.trashed = [...moving, ...state.trashed]
    },
    // 복원(실행 취소·휴지통 복원) 낙관 반영 — trashed → items 이동. orders가 있으면 포털정렬순서도 반영.
    restoreWorkItems(state, action: PayloadAction<{ nums: string[]; orders?: Record<string, number> }>) {
      const numSet = new Set(action.payload.nums)
      const moving = state.trashed.filter((t) => numSet.has(t.num))
      state.trashed = state.trashed.filter((t) => !numSet.has(t.num))
      for (const t of moving) {
        t.deletedAt = ''
        const o = action.payload.orders?.[t.num]
        if (o !== undefined) t.order = String(o)
      }
      state.items = [...state.items, ...moving]
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadWorkData.pending, state => {
        state.loading = true
        state.error = false
      })
      .addCase(loadWorkData.fulfilled, (state, action) => {
        // 삭제일시 기준으로 목록/휴지통 분리 — 기존 소비처(items)는 자동으로 삭제 제외
        state.items = action.payload.filter((t) => !(t.deletedAt || '').trim())
        state.trashed = action.payload.filter((t) => (t.deletedAt || '').trim())
        state.ready = true
        state.loading = false
        state.error = false
        state.errorMsg = null
        state.updatedAt = nowStamp()
      })
      .addCase(loadWorkData.rejected, (state, action) => {
        // 기존에 정상적으로 불러온 목록은 지우지 않는다(빈 화면 방지) — 오류 상태만 표시
        state.ready = true
        state.loading = false
        state.error = true
        state.errorMsg = action.error.message || '알 수 없는 오류'
      })
  },
})

export const { patchWorkItems, softDeleteWorkItems, restoreWorkItems } = workSlice.actions
export default workSlice.reducer
