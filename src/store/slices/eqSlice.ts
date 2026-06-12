import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { cell, fetchSheet, SHEET_NAME_EQ, SHEET_NAME_SCHEDULE } from '@/api/sheets'
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
  // 장비 총괄표 + 장비도입일정(타임라인 원천 데이터) 동시 로드
  const [rows, schedResult] = await Promise.all([
    fetchSheet(SHEET_NAME_EQ),
    fetchSheet(SHEET_NAME_SCHEDULE).catch(e => {
      console.warn('도입일정 로드 실패', e)
      return []
    }),
  ])

  // 타임라인 계산 — '장비도입일정' 시트에서 직접:
  // B관리번호 / F시작년월 / G~L = 사·공·평·협·제·설 단계별 기간(개월, 0.5 단위)
  // 한 달 = 반월 2칸. 시작일이 15일 이후면 그 달의 후반 칸부터 시작 (시트 수식과 동일 규칙)
  const TL_PHASES = ['사', '공', '평', '협', '제', '설']
  const TL_BASE_YEAR = 2026
  let schedStart = -1
  for (let i = 0; i < Math.min(schedResult.length, 8); i++) {
    if (String(schedResult[i]?.[0] ?? '').trim().startsWith('연번')) { schedStart = i + 1; break }
  }
  let months: TlMonth[] = []
  const tlMap: Record<string, string[]> = {}
  if (schedStart > 0) {
    const rawMap: Record<string, string[]> = {}
    let firstHalf = Infinity
    let lastHalf = -1
    schedResult.slice(schedStart).forEach(r => {
      const code = String(r[1] ?? '').trim()
      const d = new Date(String(r[5] ?? ''))
      if (!code || isNaN(d.getTime())) return
      // 시트의 날짜는 KST 기준 — UTC로 직렬화된 값을 +9시간 보정해 연·월·일 추출
      const k = new Date(d.getTime() + 9 * 3600 * 1000)
      const startHalf =
        ((k.getUTCFullYear() - TL_BASE_YEAR) * 12 + k.getUTCMonth()) * 2 + (k.getUTCDate() <= 14 ? 0 : 1)
      if (startHalf < 0) return
      const cells: string[] = new Array(startHalf).fill('')
      TL_PHASES.forEach((ch, pi) => {
        const halfLen = Math.max(0, Math.round(Number(r[6 + pi] || 0) * 2))
        for (let j = 0; j < halfLen; j++) cells.push(ch)
      })
      if (cells.length > startHalf) {
        rawMap[code] = cells
        if (startHalf < firstHalf) firstHalf = startHalf
        if (cells.length - 1 > lastHalf) lastHalf = cells.length - 1
      }
    })

    // 일정이 있는 구간만 남기고 월 헤더 생성
    if (lastHalf >= 0) {
      const m0 = Math.floor(firstHalf / 2)
      const m1 = Math.floor(lastHalf / 2)
      for (let mi = m0; mi <= m1; mi++) {
        months.push({ year: TL_BASE_YEAR + Math.floor(mi / 12) + '년', month: (mi % 12) + 1 + '월' })
      }
      const width = (m1 + 1) * 2
      Object.entries(rawMap).forEach(([code, cells]) => {
        const padded = cells.concat(new Array(Math.max(0, width - cells.length)).fill(''))
        tlMap[code] = padded.slice(m0 * 2, width)
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
      // 열 배치 (2026-06 시트 개편 후): A연번 B관리번호 C장비명 D분류 E용도 F구매구분
      // G입찰방법 H재원 I담당자 J시작년월 K자산번호 L NFEC M제조사 N모델명 O도입금액
      // P설치일자 Q설치장소 R업체명 S엔지니어 T연락처 U상태 (비고 열은 없어짐)
      const price = r[14] ? Number(String(r[14]).replace(/,/g, '') || 0) : 0
      return {
        num: g(0), code: g(1), name: g(2), cat: g(3), use: g(4), type: g(5),
        bid: g(6), fund: g(7), mgr: g(8), status: g(20), start: g(9),
        assetNo: g(10), nfec: g(11), maker: g(12), model: g(13), price,
        installDate: g(15), installLoc: g(16), state: g(20), mgr2: g(18),
        vendor: g(17), contact: g(19), note: g(21),
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
