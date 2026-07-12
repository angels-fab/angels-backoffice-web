import type { SxProps, Theme } from '@mui/material/styles'

/**
 * focusRingSx — 커스텀 클릭 요소용 공통 포커스 링 (P2, B#4).
 *
 * 테마 focusRing(버튼·입력·칩·검색은 ThemeProvider가 자동 적용)과 동일한 링을
 * Box·div 등 커스텀 인터랙티브 요소에 입힐 때 사용한다.
 * outline 2px 변형·hex 아웃라인·outline:none(링 없음) 손코딩 금지 — 전부 이걸로 수렴.
 *
 * @example
 * <Box role="button" tabIndex={0} sx={{ cursor: 'pointer', ...focusRingSx }} />
 */
export const focusRingSx: SxProps<Theme> = {
  '&:focus-visible': {
    outline: 'none',
    boxShadow: (t: Theme) => `0 0 0 3px ${t.palette.primary.main}66`,
  },
}
