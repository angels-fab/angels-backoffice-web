import type { CSSProperties } from 'react'

// 구분(카테고리)별 색상 — 값이 무엇이든 해시로 일관된 색 부여
const WORK_CAT_PALETTE: CSSProperties[] = [
  { background: 'rgba(88,166,255,.15)', color: '#58A6FF', borderColor: 'rgba(88,166,255,.3)' },
  { background: 'rgba(240,180,41,.15)', color: '#F0B429', borderColor: 'rgba(240,180,41,.3)' },
  { background: 'rgba(57,208,216,.15)', color: '#39D0D8', borderColor: 'rgba(57,208,216,.3)' },
  { background: 'rgba(188,140,255,.15)', color: '#BC8CFF', borderColor: 'rgba(188,140,255,.3)' },
  { background: 'rgba(63,185,80,.15)', color: '#3FB950', borderColor: 'rgba(63,185,80,.3)' },
  { background: 'rgba(248,81,73,.15)', color: '#F85149', borderColor: 'rgba(248,81,73,.3)' },
]

export function workCatStyle(cat?: string): CSSProperties {
  if (!cat) {
    return {
      background: 'rgba(139,148,158,.12)',
      color: 'var(--text2)',
      borderColor: 'var(--border)',
    }
  }
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0
  return WORK_CAT_PALETTE[h % WORK_CAT_PALETTE.length]
}

// 업무구분 우선순위 (대소문자·공백·,·/ 차이는 무시하고 매칭)
const WORK_CAT_ORDER = [
  '설계적정성검토',
  '국가장비심의위원회',
  '장심위',
  '장비',
  '인사',
  '예산',
  '행정',
  '대응',
  '교육,세미나',
  'MoU',
]

export function normCat(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s,/]/g, '')
}

export function workCatRank(cat: string): number {
  const i = WORK_CAT_ORDER.findIndex(o => normCat(o) === normCat(cat))
  return i < 0 ? 999 : i
}
