import type { CSSProperties } from 'react'

// 구분(카테고리)별 색상 — 값이 무엇이든 해시로 일관된 색 부여
const WORK_CAT_PALETTE: CSSProperties[] = [
  { background: 'rgba(84,145,218,.15)', color: '#5491DA', borderColor: 'rgba(84,145,218,.3)' },
  { background: 'rgba(214,162,62,.15)', color: '#D6A23E', borderColor: 'rgba(214,162,62,.3)' },
  { background: 'rgba(70,183,190,.15)', color: '#46B7BE', borderColor: 'rgba(70,183,190,.3)' },
  { background: 'rgba(169,138,224,.15)', color: '#A98AE0', borderColor: 'rgba(169,138,224,.3)' },
  { background: 'rgba(77,161,103,.15)', color: '#4DA167', borderColor: 'rgba(77,161,103,.3)' },
  { background: 'rgba(224,91,84,.15)', color: '#E05B54', borderColor: 'rgba(224,91,84,.3)' },
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
