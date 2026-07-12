import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'

export interface CardGridProps {
  children: ReactNode
  /** 데스크톱 열 수. 기본 3. (모바일 1열 / 태블릿 2열은 고정) */
  columns?: number
  /**
   * auto-fill 모드의 최소 카드 폭(px). 지정하면 columns 대신 반응형 auto-fill 사용.
   * 예: minColWidth={280} → 폭에 맞춰 자동 칸 수.
   */
  minColWidth?: number
  /** 칸 간격(px). 기본 16 (KPI↔KPI / Card↔Card 규칙). */
  gap?: number
  sx?: SxProps<Theme>
}

/**
 * CardGrid — KPI·카드 묶음을 위한 반응형 그리드.
 *
 * 간격 16px 통일. 반응형: Mobile 1열 · Tablet 2열 · Desktop columns열.
 * minColWidth를 주면 auto-fill(폭 기준 자동 칸 수)로 동작.
 *
 * @example KPI 4개
 * <CardGrid columns={4}><KpiCard …/>…</CardGrid>
 *
 * @example 폭 기준 자동
 * <CardGrid minColWidth={290}>{cards}</CardGrid>
 */
export default function CardGrid({
  children,
  columns = 3,
  minColWidth,
  gap = layout.cardGap,
  sx,
}: CardGridProps) {
  const gridTemplateColumns = minColWidth
    ? `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`
    : {
        xs: '1fr',
        sm: 'repeat(2, 1fr)',
        md: `repeat(${columns}, 1fr)`,
      }
  return (
    <Box
      sx={mergeSx({
        display: 'grid',
        gridTemplateColumns,
        gap: `${gap}px`,
      }, sx)}
    >
      {children}
    </Box>
  )
}
