import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import AppCard from './AppCard'

export interface KpiCardProps {
  /** 큰 숫자(강조). 예: 20, "29" */
  value: ReactNode
  /** 숫자 뒤 단위. 예: "종", "대" */
  unit?: string
  /** 설명 라벨. 예: "총 도입장비" */
  label: string
  /** 보조 정보(작게). 예: "29대 운영중" */
  sub?: string
  /** 보조 아이콘(MUI 아이콘). 우상단에 옅게 표시 — 보조 역할. */
  icon?: ReactNode
  /** 강조 색. theme.palette.accent 의 키. 기본 blue. */
  accentColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'teal'
  onClick?: () => void
  sx?: SxProps<Theme>
}

/**
 * KpiCard — 숫자 중심 KPI 표시(명세 4단계).
 *
 * 원칙: 숫자 강조 / 설명 최소화 / 아이콘은 보조 / 시각적 위계 확보.
 *
 * @example
 * <KpiCard value={20} unit="종" label="총 도입장비" sub="29대 운영중" icon={<Memory/>} />
 */
export default function KpiCard({
  value,
  unit,
  label,
  sub,
  icon,
  accentColor = 'blue',
  onClick,
  sx,
}: KpiCardProps) {
  return (
    <AppCard onClick={onClick} sx={mergeSx({ position: 'relative', overflow: 'hidden' }, sx)}>
      {icon && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: (t) => t.palette.accent[accentColor],
            opacity: 0.28,
            fontSize: 28,
            display: 'flex',
            '& svg': { fontSize: 28 },
          }}
        >
          {icon}
        </Box>
      )}
      {/* 숫자 — 위계 최상위 */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography
          component="span"
          sx={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1,
            color: (t) => t.palette.accent[accentColor],
          }}
        >
          {value}
        </Typography>
        {unit && (
          <Typography component="span" sx={{ fontSize: 15, fontWeight: 600, color: 'text.secondary' }}>
            {unit}
          </Typography>
        )}
      </Box>
      {/* 라벨 */}
      <Typography sx={{ mt: 1, fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{label}</Typography>
      {sub && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>
          {sub}
        </Typography>
      )}
    </AppCard>
  )
}
