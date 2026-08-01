import { accent } from '@/theme/tokens'

/** #RRGGBB → rgba(r,g,b,a) */
export function hexA(hex: string, a: number): string {
  // 빈 값이 들어오면 기본 강조색으로 — 구 하드코딩 '#5491DA' 가 accent.blue 와 같은 값이었다
  hex = String(hex || accent.blue).replace('#', '')
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
