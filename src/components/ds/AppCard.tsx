import Paper from '@mui/material/Paper'
import { mergeSx } from './sxMerge'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'

export interface AppCardProps {
  children: ReactNode
  /** 내부 padding(px). 기본 16 — 긴 설명 카드만 24(cardPaddingLg), 목록 카드는 0. */
  padding?: number
  /** 클릭 가능 카드의 hover 인터랙션(배경 전환+보더 강조). */
  interactive?: boolean
  /** 클릭 핸들러. 지정하면 자동으로 interactive 처리. */
  onClick?: () => void
  /** 클릭 가능한 카드의 스크린리더 라벨 (role=button) */
  ariaLabel?: string
  sx?: SxProps<Theme>
}

/**
 * AppCard — 모든 카드/패널의 기본 표면.
 *
 * 디자인 규칙(사용자 확정 2026-07-13):
 * - 배경 background.paper + 보더 1px divider, 반경 theme.shape.
 * - **왼쪽 컬러 보더(색 줄) 금지** (프로젝트 규칙).
 * - padding: 기본 16 / 긴 설명 카드만 24 / 목록 카드(ListRow 나열)는 0.
 * - hover(클릭 카드만): **배경 elevated 전환 + 보더 강조** — 떠오름·그림자 없음.
 *   정적 카드는 hover 무반응(클릭 신호와의 구분 자체가 표준).
 * - 클릭 가능하면(role=button) 키보드(Enter/Space) 접근성 자동 부여.
 *
 * @example
 * <AppCard>
 *   <Typography variant="h4">제목</Typography>
 * </AppCard>
 *
 * @example 클릭 가능한 카드
 * <AppCard interactive onClick={() => nav('/equipment')} ariaLabel="장비 상세">...</AppCard>
 */
export default function AppCard({
  children,
  padding = layout.cardPadding,
  interactive,
  onClick,
  ariaLabel,
  sx,
}: AppCardProps) {
  const clickable = interactive || !!onClick
  return (
    <Paper
      onClick={onClick}
      {...(clickable && onClick
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': ariaLabel,
            onKeyDown: (e: React.KeyboardEvent) => {
              // 카드 자체에 포커스가 있을 때만(내부 버튼/링크 중복 방지)
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
      sx={mergeSx({
        p: `${padding}px`,
        bgcolor: 'background.paper',
        transition: 'border-color .15s, background-color .15s',
        ...(clickable && {
          cursor: 'pointer',
          // Hover 표준(사용자 확정): 배경 전환 + 보더 강조 — 떠오름·그림자 폐지
          '&:hover': {
            bgcolor: 'background.elevated',
            borderColor: (t: Theme) => alpha(t.palette.primary.main, 0.65),
          },
          '&:focus-visible': {
            outline: 'none',
            boxShadow: (t: Theme) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.4)}`,
          },
        }),
      }, sx)}
    >
      {children}
    </Paper>
  )
}
