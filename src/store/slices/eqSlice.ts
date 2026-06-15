import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { cell, fetchSheet, SHEET_NAME_EQ, SHEET_NAME_SCHEDULE } from '@/api/sheets'
import { fmtDate, nowStamp } from '@/utils/date'
import { buildTimelines, shiftStart } from '@/pages/Equipment/timeline'
import type { EqGroup, EqRawItem, ScheduleItem, TlMonth } from '@/types'

function baseName(n: string): string {
  const m = n.match(/^([^(]+)\s*\(/)
  return m ? m[1].trim() : n.trim()
}

interface EqPayload {
  raw: EqRawItem[]
  groups: EqGroup[]
  months: TlMonth[]
  /** 장비도입관리 시트 행 1:1 (CRUD·도입관리 페이지 표시 단위) */
  schedule: ScheduleItem[]
}

// 헤더 셀 정규화 — 공백·'(자동)' 꼬리를 떼고 이름으로 비교 (열 위치가 바뀌어도 이름으로 찾기 위함)
const normH = (v: unknown) => String(v ?? '').replace(/\s+/g, '').replace(/\(자동\)/g, '')

export const loadEqData = createAsyncThunk('eq/load', async (): Promise<EqPayload> => {
  // 장비운영관리(목록·예산·상태) + 장비도입관리(타임라인 원천) 동시 로드
  const [rows, schedResult] = await Promise.all([
    fetchSheet(SHEET_NAME_EQ),
    fetchSheet(SHEET_NAME_SCHEDULE).catch(e => {
      console.warn('장비도입관리 로드 실패', e)
      return []
    }),
  ])

  // 타임라인 계산 — '장비도입관리' 시트에서 직접:
  // 관리번호·시작년월·단계별 기간(개월, 0.5 단위) 열을 헤더 이름으로 찾는다
  // 한 달 = 반월 2칸. 시작일이 15일 이후면 그 달의 후반 칸부터 시작 (시트 수식과 동일 규칙)
  const TL_BASE_YEAR = 2026
  let schedHead = -1
  for (let i = 0; i < Math.min(schedResult.length, 8); i++) {
    if (normH(schedResult[i]?.[0]) === '연번') { schedHead = i; break }
  }
  let months: TlMonth[] = []
  const tlMap: Record<string, string[]> = {}
  const schedule: ScheduleItem[] = []
  if (schedHead >= 0) {
    const sHeads = (schedResult[schedHead] || []).map(normH)
    const scol = (name: string) => sHeads.indexOf(name)
    const cCode = scol('관리번호')
    const cStart = scol('시작년월')
    // 단계 헤더명 ↔ 간트 약어
    const PHASES: [string, string][] = [
      ['사전규격', '사'], ['구매공고', '공'], ['기술평가', '평'],
      ['기술협상', '협'], ['장비제작', '제'], ['장비설치', '설'],
    ]
    const phaseCols = PHASES.map(([h]) => scol(h))
    const rawMap: Record<string, string[]> = {}
    let firstHalf = Infinity
    let lastHalf = -1
    schedResult.slice(schedHead + 1).forEach(r => {
      const code = cCode >= 0 ? String(r[cCode] ?? '').trim() : ''
      const d = new Date(String(cStart >= 0 ? r[cStart] ?? '' : ''))
      if (!code || isNaN(d.getTime())) return
      // 시트의 날짜는 KST 기준 — UTC로 직렬화된 값을 +9시간 보정해 연·월·일 추출
      const k = new Date(d.getTime() + 9 * 3600 * 1000)
      const startHalf =
        ((k.getUTCFullYear() - TL_BASE_YEAR) * 12 + k.getUTCMonth()) * 2 + (k.getUTCDate() <= 14 ? 0 : 1)
      if (startHalf < 0) return
      const cells: string[] = new Array(startHalf).fill('')
      PHASES.forEach(([, ch], pi) => {
        const ci = phaseCols[pi]
        const halfLen = ci < 0 ? 0 : Math.max(0, Math.round(Number(r[ci] || 0) * 2))
        for (let j = 0; j < halfLen; j++) cells.push(ch)
      })
      if (cells.length > startHalf) {
        rawMap[code] = cells
        if (startHalf < firstHalf) firstHalf = startHalf
        if (cells.length - 1 > lastHalf) lastHalf = cells.length - 1
      }
    })

    // 일정이 있는 구간 앞뒤로 한 달씩 여유를 두고 월 헤더 생성
    if (lastHalf >= 0) {
      const m0 = Math.max(0, Math.floor(firstHalf / 2) - 1)
      const m1 = Math.floor(lastHalf / 2) + 1
      for (let mi = m0; mi <= m1; mi++) {
        months.push({ year: TL_BASE_YEAR + Math.floor(mi / 12) + '년', month: (mi % 12) + 1 + '월' })
      }
      const width = (m1 + 1) * 2
      Object.entries(rawMap).forEach(([code, cells]) => {
        const padded = cells.concat(new Array(Math.max(0, width - cells.length)).fill(''))
        tlMap[code] = padded.slice(m0 * 2, width)
      })
    }

    // 도입관리 시트 행 1:1 → ScheduleItem (헤더명 기반). 단계 소요기간·메타 포함.
    const cSeq = scol('연번'), cName = scol('장비명'), cMgr = scol('담당자')
    const cStatus = scol('진행상태'), cDur = scol('총소요기간'), cCat = scol('구분')
    const cMethod = scol('도입방법'), cPrice = scol('도입금액')
    const sg = (r: (string | number | null | undefined)[], i: number) => (i < 0 ? '' : String(r[i] ?? '').trim())
    schedResult.slice(schedHead + 1).forEach(r => {
      const code = cCode >= 0 ? String(r[cCode] ?? '').trim() : ''
      const name = sg(r, cName)
      if (!code && !name) return // 빈 행 제외
      const priceRaw = cPrice >= 0 ? r[cPrice] : ''
      schedule.push({
        seq: sg(r, cSeq), code, name, mgr: sg(r, cMgr), status: sg(r, cStatus),
        start: fmtDate(sg(r, cStart)),
        stages: {
          사전규격: sg(r, phaseCols[0]), 구매공고: sg(r, phaseCols[1]), 기술평가: sg(r, phaseCols[2]),
          기술협상: sg(r, phaseCols[3]), 장비제작: sg(r, phaseCols[4]), 장비설치: sg(r, phaseCols[5]),
        },
        duration: sg(r, cDur), cat: sg(r, cCat), method: sg(r, cMethod),
        price: priceRaw ? Number(String(priceRaw).replace(/,/g, '') || 0) : 0,
        timeline: tlMap[code] || [],
      })
    })
  }

  // ── '장비운영관리' 파싱 — 2단 헤더(그룹행 + 세부행)를 병합해 이름으로 열을 찾는다 ──
  // 예: 그룹행 "구매" 아래 세부행 "구분/입찰 방법/재원/담당자" → 세부행 이름이 우선
  let eqHead = -1
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (normH(rows[i]?.[0]) === '연번') { eqHead = i; break }
  }
  const topH = eqHead >= 0 ? rows[eqHead] : []
  const hasSub = eqHead >= 0 && rows[eqHead + 1] != null && normH(rows[eqHead + 1][0]) === ''
  const subH = hasSub ? rows[eqHead + 1] : []
  const heads: string[] = []
  for (let c = 0; c < Math.max(topH.length, subH.length); c++) {
    heads.push(normH(subH[c]) || normH(topH[c]))
  }
  const hcol = (...names: string[]) => {
    for (const n of names) {
      const i = heads.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }
  const CI = {
    num: hcol('연번'), code: hcol('관리번호'), name: hcol('장비명'), cat: hcol('분류'),
    use: hcol('용도'), type: hcol('구분', '구매구분'), bid: hcol('입찰방법'), fund: hcol('재원'),
    mgr: hcol('담당자'), start: hcol('시작년월'), assetNo: hcol('자산번호'), nfec: hcol('NFEC번호'),
    maker: hcol('제조사'), model: hcol('모델명'), price: hcol('도입금액'), installDate: hcol('설치일자'),
    installLoc: hcol('설치장소'), vendor: hcol('업체명'), mgr2: hcol('엔지니어'), contact: hcol('연락처'),
    state: hcol('상태'), note: hcol('비고'),
  }
  const dataStart = eqHead < 0 ? 0 : eqHead + (hasSub ? 2 : 1)

  const raw: EqRawItem[] = rows
    .slice(dataStart)
    .filter(r => r[0] !== '' && r[0] !== null && !isNaN(Number(String(r[0]).trim())) && String(r[0]).trim() !== '')
    .map(r => {
      const g = (i: number) => cell(r, i)
      const priceRaw = CI.price >= 0 ? r[CI.price] : ''
      const price = priceRaw ? Number(String(priceRaw).replace(/,/g, '') || 0) : 0
      return {
        num: g(CI.num), code: g(CI.code), name: g(CI.name), cat: g(CI.cat), use: g(CI.use), type: g(CI.type),
        bid: g(CI.bid), fund: g(CI.fund), mgr: g(CI.mgr), status: g(CI.state), start: g(CI.start),
        assetNo: g(CI.assetNo), nfec: g(CI.nfec), maker: g(CI.maker), model: g(CI.model), price,
        installDate: g(CI.installDate), installLoc: g(CI.installLoc), state: g(CI.state), mgr2: g(CI.mgr2),
        vendor: g(CI.vendor), contact: g(CI.contact), note: g(CI.note),
        timeline: tlMap[g(CI.code)] || [],
      }
    })

  // ── 장비명 기준 그룹핑 ──
  const grouped: Record<string, EqGroup> = {}
  raw.forEach(eq => {
    const base = baseName(eq.name)
    const hasVariant = eq.name.includes('(') && eq.name !== base
    if (!grouped[base]) {
      grouped[base] = {
        name: base, cat: eq.cat, use: eq.use, type: eq.type, mgr: eq.mgr,
        bid: eq.bid, fund: eq.fund, maker: eq.maker, model: eq.model,
        state: eq.state,
        installLoc: eq.installLoc, vendor: eq.vendor, contact: eq.contact, note: eq.note,
        codes: [], prices: [], price: 0, count: 0, variants: [], hasVariant: false,
        timeline: eq.timeline,
      }
    }
    const grp = grouped[base]
    grp.count++
    if (eq.code) grp.codes.push(eq.code)
    grp.prices.push(eq.price || 0)
    grp.price = grp.prices.reduce((a, b) => a + b, 0)
    if (hasVariant) {
      grp.hasVariant = true
      grp.variants.push(eq)
    }
    // 그룹 대표 타임라인은 첫 항목 것 사용
    if (!grp.timeline || !grp.timeline.length) grp.timeline = eq.timeline
  })

  return { raw, groups: Object.values(grouped), months, schedule }
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

const eqSlice = createSlice({
  name: 'eq',
  initialState,
  reducers: {
    // STEP15 — 도입 일정 전체 이동: start를 deltaHalves(반월)만큼 옮기고 타임라인 재파생.
    // 단계 길이(stages)는 불변. months 축과 schedule·raw timeline을 buildTimelines로 일괄 갱신.
    shiftScheduleStart(state, action: PayloadAction<{ code: string; deltaHalves: number }>) {
      const { code, deltaHalves } = action.payload
      if (!code || !deltaHalves) return
      const item = state.schedule.find(s => s.code === code)
      if (!item) return
      item.start = shiftStart(item.start, deltaHalves)
      const { months, byCode } = buildTimelines(state.schedule)
      state.months = months
      state.schedule.forEach(s => { s.timeline = byCode[s.code] ?? [] })
      state.raw.forEach(r => { r.timeline = byCode[r.code] ?? [] })
    },
    // STEP16 — 단계 길이 리사이즈: 특정 단계(stage 라벨)의 개월을 deltaHalves(반월)만큼 변경.
    // 최소 0.5개월(1반월), 음수 불가. 타임라인은 buildTimelines로 재파생(이동과 동일 경로).
    resizeScheduleStage(state, action: PayloadAction<{ code: string; stage: string; deltaHalves: number }>) {
      const { code, stage, deltaHalves } = action.payload
      if (!code || !stage || !deltaHalves) return
      const item = state.schedule.find(s => s.code === code)
      if (!item) return
      const curHalf = Math.max(0, Math.round(Number(item.stages?.[stage] || 0) * 2))
      const nextHalf = Math.max(1, curHalf + deltaHalves) // 최소 0.5개월
      if (nextHalf === curHalf) return
      item.stages = { ...item.stages, [stage]: String(nextHalf / 2) }
      const { months, byCode } = buildTimelines(state.schedule)
      state.months = months
      state.schedule.forEach(s => { s.timeline = byCode[s.code] ?? [] })
      state.raw.forEach(r => { r.timeline = byCode[r.code] ?? [] })
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

export const { shiftScheduleStart, resizeScheduleStage } = eqSlice.actions
export default eqSlice.reducer
