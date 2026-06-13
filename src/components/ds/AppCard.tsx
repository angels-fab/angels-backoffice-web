import Paper from '@mui/material/Paper'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { hoverShadow, layout } from '@/theme/tokens'

export interface AppCardProps {
  children: ReactNode
  /** 내부 padding(px). 기본 24 (레이아웃 규칙). */
  padding?: number
  /** hover 시 살짝 떠오르는 인터랙션. 클릭 가능한 카드에 사용. */
  interactive?: boolean
  /** 클릭 핸들러. 지정하면 자동으로 interactive 처리. */
  onClick?: () => void
  sx?: SxProps<Theme>
}

/**
 * AppCard — 모든 카드/패널의 기본 표면.
 *
 * 디자인 규칙:
 * - 배경 background.paper, 테두리 divider, 반경 theme.shape.
 * - **왼쪽 컬러 보더(색 줄) 금지** (프로젝트 규칙).
 * - 내부 padding 기본 24px로 통일.
 *
 * @example
 * <AppCard>
 *   <Typography variant="h4">제목</Typography>
 * </AppCard>
 *
 * @example 클릭 가능한 카드
 * <AppCard interactive onClick={() => nav('/equipment')}>...</AppCard>
 */
export default function AppCard({
  children,
  padding = layout.cardPadding,
  interactive,
  onClick,
  sx,
}: AppCardProps) {
  const clickable = interactive || !!onClick
  return (
    <Paper
      onClick={onClick}
      sx={{
        p: `${padding}px`,
        bgcolor: 'background.paper',
        transition: 'border-color .15s, transform .15s, box-shadow .15s',
        ...(clickable && {
          cursor: 'pointer',
          '&:hover': {
            // 명세 Hover 규칙: translateY(-2px) + 매우 약한 그림자(glow 금지)
            borderColor: 'background.elevated',
            bgcolor: 'background.elevated',
            transform: 'translateY(-2px)',
            boxShadow: hoverShadow,
          },
        }),
        ...sx,
      }}
    >
      {children}
    </Paper>
  )
}
