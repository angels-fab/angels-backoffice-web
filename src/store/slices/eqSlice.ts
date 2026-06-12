import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { cell, fetchSheet, SHEET_NAME_EQ, SHEET_NAME_TL } from '@/api/sheets'
import { nowStamp } from '@/utils/date'
import type { EqGroup, EqRawItem, TlMonth } from '@/types'

function baseName(n: string): string {
  const m = n.match(/^([^(]+)\s*\(/)
  return m ? m[1].trim() : n.trim()
}

interface EqPayload {
  raw: EqRawItem[]
  groups: EqGroup[]
  months: TlMonth[]
}

export const loadEqData = createAsyncThunk('eq/load', async (): Promise<EqPayload> => {
  // 장비 총괄표 + 장비타임라인 동시 로드
  const [rows, tlResult] = await Promise.all([
    fetchSheet(SHEET_NAME_EQ),
    fetchSheet(SHEET_NAME_TL).catch(e => {
      console.warn('타임라인 로드 실패', e)
      return []
    }),
  ])

  // 타임라인 파싱 — '장비타임라인'(거울 시트) 구조:
  // '연번'으로 시작하는 헤더 행을 찾고, 그 위 행=연도(병합), 헤더 행=월(한 달=반월 2칸, G열부터),
  // 헤더 아래 보조숫자 행을 건너뛴 다음부터 장비 행(관리번호 r[1] 기준)
  const TL_COL0 = 6 // 타임라인 그리드 시작 열 (G열)
  let hRow = -1
  for (let i = 0; i < Math.min(tlResult.length, 8); i++) {
    if (String(tlResult[i]?.[0] ?? '').trim().startsWith('연번')) { hRow = i; break }
  }
  let months: TlMonth[] = []
  const tlMap: Record<string, string[]> = {}
  if (hRow >= 1) {
    const yearRow = tlResult[hRow - 1] || []
    const tlMonthRow = tlResult[hRow] || []
    const rawMonths: TlMonth[] = []
    let curYear = ''
    for (let c = TL_COL0; c < tlMonthRow.length; c += 2) {
      const y = String(yearRow[c] ?? '').trim()
      if (/\d{4}년/.test(y)) curYear = y // 연도는 병합 셀이라 등장할 때만 갱신
      const m = String(tlMonthRow[c] ?? '').trim()
      if (!/^\d+월$/.test(m)) break
      rawMonths.push({ year: curYear, month: m })
    }

    const rawMap: Record<string, string[]> = {}
    tlResult.slice(hRow + 2).forEach(r => {
      const code = String(r[1] ?? '').trim()
      if (code) rawMap[code] = r.slice(TL_COL0, TL_COL0 + rawMonths.length * 2).map(c => String(c ?? '').trim())
    })

    // 일정이 하나라도 있는 구간만 남기기 (앞쪽 2026년 등 빈 달 제거)
    let firstHalf = Infinity
    let lastHalf = -1
    Object.values(rawMap).forEach(cells => {
      cells.forEach((v, i) => {
        if (v) {
          if (i < firstHalf) firstHalf = i
          if (i > lastHalf) lastHalf = i
        }
      })
    })
    if (lastHalf >= 0) {
      const m0 = Math.floor(firstHalf / 2)
      const m1 = Math.floor(lastHalf / 2)
      months = rawMonths.slice(m0, m1 + 1)
      Object.entries(rawMap).forEach(([code, cells]) => {
        tlMap[code] = cells.slice(m0 * 2, (m1 + 1) * 2)
      })
    }
  }

  // 헤더 행 찾기 (연번)
  let dataStart = 0
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if (String(rows[i][0]).trim() === '연번') {
      dataStart = i + 1
      break
    }
  }

  const raw: EqRawItem[] = rows
    .slice(dataStart)
    .filter(r => r[0] !== '' && r[0] !== null && !isNaN(Number(String(r[0]).trim())) && String(r[0]).trim() !== '')
    .map(r => {
      const g = (i: number) => cell(r, i)
      const price = r[15] ? Number(String(r[15]).replace(/,/g, '') || 0) : 0
      return {
        num: g(0), code: g(1), name: g(2), cat: g(3), use: g(4), type: g(5),
        bid: g(6), fund: g(7), mgr: g(8), status: g(9), start: g(10),
        assetNo: g(11), nfec: g(12), maker: g(13), model: g(14), price,
        installDate: g(16), installLoc: g(17), state: g(18), mgr2: g(19),
        vendor: g(20), contact: g(21), note: g(22),
        timeline: tlMap[g(1)] || [],
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

  return { raw, groups: Object.values(grouped), months }
})

interface EqState {
  raw: EqRawItem[]
  groups: EqGroup[]
  months: TlMonth[]
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
  ready: false,
  loading: false,
  error: false,
  updatedAt: null,
}

const eqSlice = createSlice({
  name: 'eq',
  initialState,
  reducers: {},
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
        state.ready = true
        state.loading = false
        state.updatedAt = nowStamp()
      })
      .addCase(loadEqData.rejected, state => {
        state.raw = []
        state.groups = []
        state.ready = true
        state.loading = false
        state.error = true
        state.updatedAt = null
      })
  },
})

export default eqSlice.reducer
