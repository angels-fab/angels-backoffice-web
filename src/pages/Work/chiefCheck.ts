import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

/**
 * '부서장 확인' 보라 정본 — 카드의 Check 칩(StatusChip purple)과 KPI의 보라 요소가 **같은 값**을 쓰게 한다.
 *
 * 예전엔 KPI만 손으로 박은 hex(#29233a·#c5adf0 …)라 같은 '부서장 확인'인데 카드와 KPI의 보라가
 * 서로 달랐다(사용자 지적 2026-07-26). 값은 StatusChip 미선택 칩과 동일(.18/.6/accentText).
 */
export const chiefPurple = {
  fill: (t: Theme) => alpha(t.palette.accent.purple, 0.18),
  fillStrong: (t: Theme) => alpha(t.palette.accent.purple, 0.3),
  border: (t: Theme) => alpha(t.palette.accent.purple, 0.6),
  text: (t: Theme) => t.palette.accentText.purple,
}
