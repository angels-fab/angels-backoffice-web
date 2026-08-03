import { accent } from '@/theme/tokens'

/** '#RGB' · '#RRGGBB' → [r,g,b] */
function rgbOf(hex: string): [number, number, number] {
  let h = String(hex || accent.blue).replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** #RRGGBB → rgba(r,g,b,a) */
export function hexA(hex: string, a: number): string {
  // 빈 값이 들어오면 기본 강조색으로 — 구 하드코딩 '#5491DA' 가 accent.blue 와 같은 값이었다
  const [r, g, b] = rgbOf(hex)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * `fg` 를 알파 `a` 로 `bg` 위에 **미리 합성**한 불투명 색.
 *
 * 왜 필요한가: 반투명 채움은 뒤에 무엇이 오느냐에 따라 결과가 달라진다. 업무 카드처럼
 * 상태 톤이 깔린 면 위에서는 칩 틴트에 카드 색이 섞여 대비가 무너지고(3.77:1 실측)
 * 칩 색까지 왜곡된다(파란 칩이 청록으로). 표면 위에 미리 합성해 두면 어디에 놓이든 같다.
 *
 * ★ CSS color-mix() 로도 되지만 쓰지 않는다 — getComputedStyle 이 `color(srgb 0.87 …)`
 *   형식으로 돌려주는데, 대비 감사 도구(scripts/contrast-audit.js)가 그 숫자를 0~255 로
 *   오인해 측정이 통째로 망가진다. 여기서 합성하면 계산값이 평범한 rgb() 로 남는다.
 */
export function flatten(fg: string, a: number, bg: string): string {
  const [fr, fg_, fb] = rgbOf(fg)
  const [br, bg_, bb] = rgbOf(bg)
  const mix = (f: number, b: number) => Math.round(f * a + b * (1 - a))
  return `rgb(${mix(fr, br)},${mix(fg_, bg_)},${mix(fb, bb)})`
}
