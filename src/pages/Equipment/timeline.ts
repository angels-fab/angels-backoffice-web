import { STAGE, STAGE_ORDER } from './stageMeta'
import type { ScheduleItem, TlMonth } from '@/types'

/** 간트 타임라인 기준 연도 (eqSlice 로더와 동일) */
export const TL_BASE_YEAR = 2026

const PHASE_CODES = STAGE_ORDER // ['사','공','평','협','제','설']
const PHASE_LABELS = STAGE_ORDER.map((c) => STAGE[c].label) // ['사전규격', …, '장비설치']

/** 'yyyy-MM-dd' → TL_BASE_YEAR 기준 반월 인덱스 (시트 규칙: 14일 이하=전반0, 15일 이상=후반1). 못 읽으면 null */
export function startToHalf(start: string): number | null {
  const m = (start || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const day = +m[3]
  return ((y - TL_BASE_YEAR) * 12 + (mo - 1)) * 2 + (day <= 14 ? 0 : 1)
}

/** 반월 인덱스 → 'yyyy-MM-dd' (전반=1일, 후반=15일). 음수는 0으로 클램프 */
export function halfToStart(half: number): string {
  const h = Math.max(0, Math.round(half))
  const monthIdx = Math.floor(h / 2)
  const y = TL_BASE_YEAR + Math.floor(monthIdx / 12)
  const mo = (monthIdx % 12) + 1
  const day = h % 2 === 0 ? 1 : 15
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 시작년월을 deltaHalves 반월만큼 이동한 새 'yyyy-MM-dd' (단계 길이는 불변) */
export function shiftStart(start: string, deltaHalves: number): string {
  const h = startToHalf(start)
  if (h == null) return start
  return halfToStart(h + deltaHalves)
}

/** 드래그 픽셀 이동량 → 반월 단위 스냅(정수). halfPx = 반월 한 칸의 픽셀 폭 */
export function calcHalfDelta(px: number, halfPx: number): number {
  if (!halfPx || !isFinite(halfPx)) return 0
  return Math.round(px / halfPx)
}

/**
 * 도입 일정(start + stages) → 공유 months 축 + 코드별 timeline(반월 칸 배열).
 * eqSlice 로더와 동일 규칙 — 드래그(이동)·STEP16(리사이즈) 후 타임라인 재파생의 단일 창구.
 */
export function buildTimelines(
  items: Pick<ScheduleItem, 'code' | 'start' | 'stages'>[],
): { months: TlMonth[]; byCode: Record<string, string[]> } {
  const rawMap: Record<string, string[]> = {}
  let firstHalf = Infinity
  let lastHalf = -1
  for (const it of items) {
    const sh = startToHalf(it.start)
    if (!it.code || sh == null || sh < 0) continue
    const cells: string[] = new Array(sh).fill('')
    PHASE_LABELS.forEach((label, i) => {
      const len = Math.max(0, Math.round(Number(it.stages?.[label] || 0) * 2))
      for (let j = 0; j < len; j++) cells.push(PHASE_CODES[i])
    })
    if (cells.length > sh) {
      rawMap[it.code] = cells
      if (sh < firstHalf) firstHalf = sh
      if (cells.length - 1 > lastHalf) lastHalf = cells.length - 1
    }
  }
  const months: TlMonth[] = []
  const byCode: Record<string, string[]> = {}
  if (lastHalf >= 0) {
    const m0 = Math.max(0, Math.floor(firstHalf / 2) - 1)
    const m1 = Math.floor(lastHalf / 2) + 1
    for (let mi = m0; mi <= m1; mi++) {
      months.push({ year: TL_BASE_YEAR + Math.floor(mi / 12) + '년', month: ((mi % 12) + 1) + '월' })
    }
    const width = (m1 + 1) * 2
    for (const [code, cells] of Object.entries(rawMap)) {
      const padded = cells.concat(new Array(Math.max(0, width - cells.length)).fill(''))
      byCode[code] = padded.slice(m0 * 2, width)
    }
  }
  return { months, byCode }
}
