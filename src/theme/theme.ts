import type * as React from 'react'
import { alpha, createTheme, type Theme } from '@mui/material/styles'
import { accent, accentTextDark, accentTextLight, darkPalette, hoverShadow, lightPalette, radius, shadow, control } from './tokens'

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
    /** 채움(fill) 전용 강조색 — 점·솔리드칩·아이콘·프로그레스·보더 */
    accent: {
      blue: string
      green: string
      amber: string
      red: string
      purple: string
      teal: string
    }
    /** 글자(text) 전용 강조색 — 현재 테마 배경에서 4.5:1을 만족하는 값. accent를 글자로 쓰지 말 것 */
    accentText: Palette['accent']
  }
  interface PaletteOptions {
    accent?: Palette['accent']
    accentText?: Palette['accent']
  }
  /** 셸(사이드바↔하단탭) 분기점 768 — P1 확정(D2 2계층). theme.breakpoints.down('shell') */
  interface BreakpointOverrides {
    shell: true
  }
  /** 커스텀 타이포 variant 'small'(12px) — 정본 사다리의 표 본문·메타 슬롯 */
  interface TypographyVariants {
    small: React.CSSProperties
  }
  interface TypographyVariantsOptions {
    small?: React.CSSProperties
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    small: true
  }
}

type Mode = 'light' | 'dark'

function buildTheme(mode: Mode): Theme {
  const p = mode === 'dark' ? darkPalette : lightPalette
  // 글자로도 쓰이는 의미색(버튼·링크·상태 텍스트) — 현재 테마 배경에서 4.5:1을 만족하는 값
  const semantic = mode === 'dark' ? accentTextDark : accentTextLight
  // 모든 인터랙티브 요소가 공유하는 Focus Ring (ThemeProvider에서 관리)
  const focusRing = `0 0 0 3px ${alpha(accent.blue, mode === 'dark' ? 0.4 : 0.3)}`

  return createTheme({
    breakpoints: {
      // 2계층 반응형(P1·D2): 콘텐츠 열수 = sm 600/md 900(MUI 기본 유지),
      // 셸(사이드바↔하단탭·페이지 모드) = shell 768. 문자열 '(max-width:768px)' 산재 금지.
      values: { xs: 0, sm: 600, shell: 768, md: 900, lg: 1200, xl: 1536 },
    },
    palette: {
      mode,
      // 채움 위 라벨색(getContrastText·contained 버튼)을 흰/검 중 자동 선택할 때의 기준.
      // MUI 기본 3은 WCAG 본문 기준(4.5)에 못 미쳐 흰 라벨이 2.1~3.6:1로 깔렸다 → 4.5로 올려 자동으로 검은 라벨 선택.
      contrastThreshold: 4.5,
      // MUI 의미색의 main은 "텍스트로도" 쓰인다(text 버튼·링크·아이콘 색) → 글자용 값으로 배선.
      // 채움 버튼의 라벨색은 MUI가 contrastText를 자동 계산하므로 안전하다.
      // 칩·점 등 순수 채움은 palette.accent(원색)를 그대로 쓴다 — fill/text 2계층 유지.
      primary: { main: semantic.blue },
      success: { main: semantic.green },
      warning: { main: semantic.amber },
      error: { main: semantic.red },
      info: { main: semantic.blue },
      accent,
      // 글자용 강조색은 테마가 자동 선택 — 컴포넌트에서 mode 분기 금지
      accentText: mode === 'dark' ? accentTextDark : accentTextLight,
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
      // 본문 글꼴 Pretendard(jsdelivr dynamic-subset, index.html 로드). 숫자/관리번호는 각 컴포넌트에서 monospace 유지.
      fontFamily:
        "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif",
      // 정본 사다리 8단(P1·D1, tokens.typescale) ↔ variant 매핑:
      //   display 28/800=h1 · pageTitle 22/800=h2 · sectionTitle 18/700=h3 · cardTitle 16/700=h4
      //   emphasis 14/600=subtitle1 · body 13=body2 · small 12=small(커스텀) · caption 11=caption.
      // 페이지에서 sx fontSize 숫자 금지 — 항상 variant 사용.
      h1: { fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h2: { fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.3 },
      h3: { fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.35 },
      // 카드 제목 16/700 (P1 정규화: 600→700, 제목 3단 위계 고정)
      h4: { fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.4 },
      subtitle1: { fontSize: '0.875rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 500, color: p.textSecondary },
      body1: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.55 },
      body2: { fontSize: '0.8125rem', fontWeight: 400, lineHeight: 1.55, color: p.textSecondary },
      // 정본 사다리 'small'(12px) — 표 본문·메타 전용 커스텀 variant
      small: { fontSize: '0.75rem', fontWeight: 400, lineHeight: 1.5, color: p.textSecondary },
      button: { textTransform: 'none', fontWeight: 600 },
      caption: { fontSize: '0.6875rem', fontWeight: 500, color: p.textSecondary },
    },
    components: {
      MuiTypography: {
        defaultProps: {
          // 커스텀 variant 'small'의 렌더 태그 지정(기본 매핑 유지 + small=span)
          variantMapping: {
            h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
            subtitle1: 'h6', subtitle2: 'h6', body1: 'p', body2: 'p',
            small: 'span', caption: 'span', overline: 'span',
          },
        },
      },
      MuiDialog: {
        // Dialog 규격(P1·B#6): 배경은 MuiPaper 오버라이드(paper색·보더) 상속,
        // 반경만 modal(16)로 통일 — 개별 radius 하드코딩 금지.
        styleOverrides: {
          paper: { borderRadius: radius.modal },
        },
      },
      MuiTextField: {
        // 화면밀도(P1·D1): 컨트롤 전면 조밀 확정 — size small이 기본
        defaultProps: { size: 'small' },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${p.border}`,
            borderRadius: radius.card,
            // 라이트는 그림자가 깊이를 만든다(다크는 표면 밝기가 담당하므로 상시 그림자 없음)
            ...(mode === 'light' && { boxShadow: shadow.sm }),
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
            ...(mode === 'light' && { boxShadow: shadow.sm }),
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
          // 헤더·툴바에서 검색창과 나란히 서는 경우가 많아 같은 높이로 맞춘다.
          // MUI 기본은 Button(small) 30px · TextField(small) 37px라 7px 어긋나 짝이 안 맞아 보였다.
          sizeSmall: { minHeight: control.height },
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
      MuiInputBase: {
        styleOverrides: {
          // 모바일 입력 16px — iOS 사파리 포커스 자동 확대(줌) 방지. 데스크톱 밀도는 그대로.
          input: { '@media (max-width:768px)': { fontSize: 16 } },
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
