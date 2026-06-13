import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'

export interface StatTileProps {
  value: number
  unit?: string
  /** 상태 라벨(StatusChip) */
  label: string
  /** 상태 색 */
  status: StatusKind
  /** 보조 정보(작게) */
  sub?: string
  onClick?: () => void
}

/**
 * StatTile — 업무/장비 상태별 집계 타일. 숫자 + StatusChip 라벨.
 */
export default function StatTile({ value, unit, label, status, sub, onClick }: StatTileProps) {
  return (
    <AppCard padding={18} onClick={onClick}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
          {value}
        </Typography>
        {unit && (
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>
            {unit}
          </Typography>
        )}
      </Box>
      <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <StatusChip status={status} label={label} />
        {sub && (
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            {sub}
          </Typography>
        )}
      </Box>
    </AppCard>
  )
}
