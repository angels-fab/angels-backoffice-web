import { alpha, createTheme, type Theme } from '@mui/material/styles'
import { accent, darkPalette, hoverShadow, lightPalette, radius } from './tokens'

/**
 * MUI 테마 팩토리. 다크/라이트 모드를 토큰에서 생성한다.
 *
 * 색은 전부 토큰(tokens.ts)에서 가져온다. 컴포넌트는 theme.palette.* 와
 * theme.shape, theme.spacing 만 참조하고 hex를 직접 쓰지 않는다.
 *
 * STEP 2: ThemeProvider/Design Token 재정비.
 * - 배경/표면/테두리/텍스트 토큰 재정의 (SaaS 다크)
 * - 상태색 채도 낮춤 (success/warning/error/info)
 * - Radius 컴포넌트별 분리 (Card 12 / Button 10 / Chip 8 / Input 10)
 * - Focus Ring 통일 (버튼·입력·검색·칩)
 * - Hover 그림자 약하게 (glow 금지)
 */

// 커스텀 팔레트 토큰을 MUI 타입에 추가
declare module '@mui/material/styles' {
  interface TypeBackground {
    /** 사이드바 등 표면 (Surface) */
    sidebar: string
    /** hover 시 떠오르는 표면 / 드로어 헤더 (Hover Surface) */
    elevated: string
  }
  interface Palette {
    accent: {
      blue: string
      green: string
      amber: string
      red: string
      purple: string
      teal: string
    }
  }
  interface PaletteOptions {
    accent?: Palette['accent']
  }
}

type Mode = 'light' | 'dark'

function buildTheme(mode: Mode): Theme {
  const p = mode === 'dark' ? darkPalette : lightPalette
  // 모든 인터랙티브 요소가 공유하는 Focus Ring (ThemeProvider에서 관리)
  const focusRing = `0 0 0 3px ${alpha(accent.blue, mode === 'dark' ? 0.4 : 0.3)}`

  return createTheme({
    palette: {
      mode,
      primary: { main: accent.blue },
      success: { main: accent.green },
      warning: { main: accent.amber },
      error: { main: accent.red },
      info: { main: accent.blue },
      accent,
      divider: p.divider,
      background: {
        default: p.background,
        paper: p.paper,
        sidebar: p.surface,
        elevated: p.hover,
      },
      text: {
        primary: p.text,
        secondary: p.textSecondary,
        disabled: p.textMuted,
      },
    },
    shape: {
      // 기준 반경 = Card 12px
      borderRadius: radius.card,
    },
    typography: {
      fontFamily: "'IBM Plex Sans KR', system-ui, sans-serif",
      // SaaS Admin 위계: 제목은 또렷하게, 본문은 차분하게. 페이지에서 font-size 하드코딩 금지.
      h1: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 },
      h2: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 },
      h3: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
      h4: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 500, color: p.textSecondary },
      body1: { fontSize: '0.875rem', lineHeight: 1.55 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.55, color: p.textSecondary },
      button: { textTransform: 'none', fontWeight: 600 },
      caption: { fontSize: '0.6875rem', color: p.textSecondary },
    },
    components: {
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${p.border}`,
            borderRadius: radius.card,
          },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${p.border}`,
            borderRadius: radius.card,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.button,
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.button,
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: radius.chip,
            fontWeight: 600,
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.input,
            backgroundColor: p.surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: p.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: p.textMuted },
            '&.Mui-focused': { boxShadow: focusRing },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: accent.blue,
              borderWidth: 1,
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: 'none', border: 'none' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: '0.75rem', borderRadius: radius.chip, backgroundColor: p.hover },
          arrow: { color: p.hover },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: p.divider },
        },
      },
    },
  })
}

export const darkTheme = buildTheme('dark')
export const lightTheme = buildTheme('light')

export function getTheme(mode: Mode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme
}

export { hoverShadow }
