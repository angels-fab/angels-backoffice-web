import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { fetchEqData } from '@/api/eq'
import { nowStamp } from '@/utils/date'
import { buildTimelines, shiftStart } from '@/pages/Equipment/timeline'
import type { EqGroup, EqRawItem, ScheduleItem, TlMonth } from '@/types'

function baseName(n: string): string {
  const m = n.match(/^([^(]+)\s*\(/)
  return m ? m[1].trim() : n.trim()
}
// 괄호 안 세부 변형명 추출 — 'Wet-Station(Acid)' → 'Acid', 변형 없으면 ''
function variantOf(n: string): string {
  const m = String(n || '').match(/\(([^)]+)\)/)
  return m ? m[1].trim() : ''
}

const STAGE_KEYS = ['사전규격', '구매공고', '기술평가', '기술협상', '장비제작', '장비설치'] as const

/**
 * 도입배치 그룹핑 — 정규화 장비명 + 도입일정(시작·단계) + 담당자 + 내/외자가 모두 같을 때만 한 행으로 묶는다.
 * (일정이 다른 동종 장비는 절대 합치지 않음.) 로더와 recomputeEq(드래그/리사이즈/Undo)에서 공용 — 단일 로직.
 */
function buildGroups(raw: EqRawItem[], schedule: ScheduleItem[]): EqGroup[] {
  const schedByCode: Record<string, ScheduleItem> = {}
  schedule.forEach(s => { schedByCode[s.code] = s })
  const schedSig = (code: string): string => {
    const s = schedByCode[code]
    if (!s) return '∅' // 도입일정 미입력 — 같은 미입력끼리만(이름·담당자·내외자 동일) 묶임
    return `${s.start}|${STAGE_KEYS.map(k => s.stages?.[k] ?? '0').join(',')}`
  }
  const map = new Map<string, EqGroup>()
  raw.forEach(eq => {
    const base = baseName(eq.name)
    const sc = schedByCode[eq.code]
    const key = `${base}|||${schedSig(eq.code)}|||${eq.mgr}|||${eq.type}`
    let grp = map.get(key)
    if (!grp) {
      grp = {
        name: base, cat: eq.cat, use: eq.use, type: eq.type, mgr: eq.mgr,
        bid: eq.bid, fund: eq.fund, maker: eq.maker, model: eq.model, state: eq.state,
        installLoc: eq.installLoc, vendor: eq.vendor, contact: eq.contact, note: eq.note,
        assetNo: eq.assetNo, nfec: eq.nfec, installDate: eq.installDate, mgr2: eq.mgr2,
        codes: [], prices: [], price: 0, count: 0, variants: [], hasVariant: false,
        timeline: eq.timeline, repCode: eq.code || '',
        start: sc?.start || '', stages: sc?.stages || {}, variantNames: [],
      }
      map.set(key, grp)
    }
    grp.count++
    if (eq.code) {
      grp.codes.push(eq.code)
      if (!grp.repCode) grp.repCode = eq.code
    }
    grp.prices.push(eq.price || 0)
    grp.price = grp.prices.reduce((a, b) => a + b, 0)
    const v = variantOf(eq.name)
    if (v) {
      grp.hasVariant = true
      grp.variants.push(eq)
      if (!grp.variantNames.includes(v)) grp.variantNames.push(v)
    }
    if (!grp.timeline || !grp.timeline.length) grp.timeline = eq.timeline
    if (!grp.start && sc?.start) { grp.start = sc.start; grp.stages = sc.stages }
  })
  return [...map.values()]
}

interface EqPayload {
  raw: EqRawItem[]
  groups: EqGroup[]
  months: TlMonth[]
  /** 장비도입관리 시트 행 1:1 (CRUD·도입관리 페이지 표시 단위) */
  schedule: ScheduleItem[]
}

// 장비 로드 — Supabase 구조화 행(4단계 전환). 시트 원시 덤프 파싱(2단 헤더 병합·연번 필터·
// '(자동)' 헤더 정규화)은 고정 스키마로 소멸. 타임라인·월축은 buildTimelines로 재파생 —
// 드래그/리사이즈 후 recomputeEq와 같은 단일 경로라 로드·편집 표시가 항상 일치한다.
export const loadEqData = createAsyncThunk('eq/load', async (): Promise<EqPayload> => {
  const { eqRows, schedRows } = await fetchEqData()
  const schedule: ScheduleItem[] = schedRows.map((s) => ({ ...s, timeline: [] }))
  const { months, byCode } = buildTimelines(schedule)
  schedule.forEach((s) => { s.timeline = byCode[s.code] ?? [] })
  const raw: EqRawItem[] = eqRows.map((e) => ({ ...e, timeline: byCode[e.code] ?? [] }))
  return { raw, groups: buildGroups(raw, schedule), months, schedule }
})


interface EqState {
  raw: EqRawItem[]
  groups: EqGroup[]
  months: TlMonth[]
  schedule: ScheduleItem[]
  /** 로드 완료 여부 (성공·실패 무관 — 미리보기 로딩 표시용) */
  ready: boolean
  loading: boolean
  error: boolean
  updatedAt: string | null
}

const initialState: EqState = {
  raw: [],
  groups: [],
  months: [],
  schedule: [],
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

// 이동/리사이즈/Undo·Redo 공통 — schedule 변경 후 months 축·schedule·raw timeline·도입배치 그룹 재파생
function recomputeEq(state: EqState) {
  const { months, byCode } = buildTimelines(state.schedule)
  state.months = months
  state.schedule.forEach(s => { s.timeline = byCode[s.code] ?? [] })
  state.raw.forEach(r => { r.timeline = byCode[r.code] ?? [] })
  state.groups = buildGroups(state.raw, state.schedule) // 낙관적 드래그가 그룹 타임라인에도 반영되도록
}

const eqSlice = createSlice({
  name: 'eq',
  initialState,
  reducers: {
    // STEP15 — 도입 일정 전체 이동: 배치 내 모든 code의 start를 deltaHalves(반월)만큼 옮기고 타임라인 재파생.
    // 단계 길이(stages)는 불변. 배치는 같은 일정을 공유하므로 동일 delta를 모든 code에 적용.
    shiftScheduleStart(state, action: PayloadAction<{ codes: string[]; deltaHalves: number }>) {
      const { codes, deltaHalves } = action.payload
      if (!codes?.length || !deltaHalves) return
      codes.forEach(code => {
        const item = state.schedule.find(s => s.code === code)
        if (item) item.start = shiftStart(item.start, deltaHalves)
      })
      recomputeEq(state)
    },
    // STEP16 — 단계 길이 리사이즈: 배치 내 모든 code의 특정 단계 개월을 deltaHalves(반월)만큼 변경.
    // 최소 0.5개월(1반월), 음수 불가. 타임라인은 buildTimelines로 재파생(이동과 동일 경로).
    resizeScheduleStage(state, action: PayloadAction<{ codes: string[]; stage: string; deltaHalves: number }>) {
      const { codes, stage, deltaHalves } = action.payload
      if (!codes?.length || !stage || !deltaHalves) return
      codes.forEach(code => {
        const item = state.schedule.find(s => s.code === code)
        if (!item) return
        const curHalf = Math.max(0, Math.round(Number(item.stages?.[stage] || 0) * 2))
        const nextHalf = Math.max(1, curHalf + deltaHalves) // 최소 0.5개월
        if (nextHalf === curHalf) return
        item.stages = { ...item.stages, [stage]: String(nextHalf / 2) }
      })
      recomputeEq(state)
    },
    // STEP18C — 절대값 설정(Undo/Redo용): 배치 내 모든 code의 start/stage를 지정값으로 직접 설정 후 재파생.
    setScheduleStart(state, action: PayloadAction<{ codes: string[]; start: string }>) {
      action.payload.codes.forEach(code => {
        const item = state.schedule.find(s => s.code === code)
        if (item) item.start = action.payload.start
      })
      recomputeEq(state)
    },
    setScheduleStage(state, action: PayloadAction<{ codes: string[]; stage: string; value: string }>) {
      action.payload.codes.forEach(code => {
        const item = state.schedule.find(s => s.code === code)
        if (item) item.stages = { ...item.stages, [action.payload.stage]: action.payload.value }
      })
      recomputeEq(state)
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadEqData.pending, state => {
        state.loading = true
        state.error = false
      })
      .addCase(loadEqData.fulfilled, (state, action) => {
        state.raw = action.payload.raw
        state.groups = action.payload.groups
        state.months = action.payload.months
        state.schedule = action.payload.schedule
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadEqData.rejected, state => {
        state.raw = []
        state.groups = []
        state.schedule = []
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export const { shiftScheduleStart, resizeScheduleStage, setScheduleStart, setScheduleStage } = eqSlice.actions
export default eqSlice.reducer
