import { STAGE, STAGE_ORDER } from './stageMeta'
import type { ScheduleItem, TlMonth } from '@/types'

/** 간트 타임라인 기준 연도 (eqSlice 로더와 동일) */
export const TL_BASE_YEAR = 2026

/**
 * 간트 그리드 단일 너비 상수 — 헤더·바·격자선·드래그·리사이즈가 **모두 이 값**을 기준으로 한다.
 * (월/반월 너비를 여기 한 곳에서만 정의 — CSS·계산 로직에 너비 값 중복 금지)
 */
export const MONTH_WIDTH = 56 // 한 달 px (모든 월 동일·고정)
export const HALF_MONTH_WIDTH = MONTH_WIDTH / 2 // 반월(0.5개월) px = 드래그/리사이즈 스냅 단위

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

/** 표시용: 'yyyy-MM-dd' → "2027.10" (전반) / "2027.10.5" (후반·15일 이상). 드래그 툴팁 안내용 */
export function fmtStartMonth(start: string): string {
  const m = (start || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return start
  return `${+m[1]}.${+m[2]}${+m[3] >= 15 ? '.5' : ''}`
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
 * 한 일정(start + stages) → TL_BASE_YEAR 기준 절대 반월 칸 배열.
 * 앞쪽 빈칸(startHalf개) + 단계 순서대로 코드 채움. 단계가 전혀 없으면 null.
 * buildTimelines·itemTimelineForMonths의 공통 셀 생성 로직(중복 계산 금지).
 */
function itemCells(
  start: string,
  stages: Record<string, string> | undefined,
): { cells: string[]; startHalf: number } | null {
  const sh = startToHalf(start)
  if (sh == null || sh < 0) return null
  const cells: string[] = new Array(sh).fill('')
  PHASE_LABELS.forEach((label, i) => {
    const len = Math.max(0, Math.round(Number(stages?.[label] || 0) * 2))
    for (let j = 0; j < len; j++) cells.push(PHASE_CODES[i])
  })
  return cells.length > sh ? { cells, startHalf: sh } : null
}

/** months 축의 시작 월이 TL_BASE_YEAR 기준 몇 번째 반월인지 */
function monthsOffsetHalf(months: TlMonth[]): number {
  if (!months.length) return 0
  const y = parseInt(months[0].year, 10)
  const mo = parseInt(months[0].month, 10)
  return ((y - TL_BASE_YEAR) * 12 + (mo - 1)) * 2
}

/**
 * 도입 일정(start + stages) → 공유 months 축 + 코드별 timeline(반월 칸 배열).
 * eqSlice 로더와 동일 규칙 — 이동(STEP15)·리사이즈(STEP16) 후 타임라인 재파생의 단일 창구.
 */
export function buildTimelines(
  items: Pick<ScheduleItem, 'code' | 'start' | 'stages'>[],
): { months: TlMonth[]; byCode: Record<string, string[]> } {
  const rawMap: Record<string, string[]> = {}
  let firstHalf = Infinity
  let lastHalf = -1
  for (const it of items) {
    if (!it.code) continue
    const r = itemCells(it.start, it.stages)
    if (!r) continue
    rawMap[it.code] = r.cells
    if (r.startHalf < firstHalf) firstHalf = r.startHalf
    if (r.cells.length - 1 > lastHalf) lastHalf = r.cells.length - 1
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

/**
 * 단일 일정의 timeline을 **현재 months 축에 정렬**해 반환(축 재계산 없음).
 * 리사이즈 드래그 중 실시간 미리보기용 — 축이 흔들리지 않게 현재 창에 맞춰 자른다.
 */
export function itemTimelineForMonths(
  start: string,
  stages: Record<string, string> | undefined,
  months: TlMonth[],
): string[] {
  const width = months.length * 2
  const r = itemCells(start, stages)
  if (!r) return new Array(width).fill('')
  const off = monthsOffsetHalf(months)
  const padded = r.cells.concat(new Array(Math.max(0, off + width - r.cells.length)).fill(''))
  return padded.slice(off, off + width)
}
