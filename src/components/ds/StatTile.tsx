import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import AppCard from './AppCard'
import StatusChip, { type StatusKind } from './StatusChip'

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
  /** 선택 강조(탭처럼 쓸 때) */
  selected?: boolean
}

/**
 * StatTile — 상태별 집계 타일(숫자 + StatusChip 라벨). 대시보드·업무현황 공용.
 */
export default function StatTile({ value, unit, label, status, sub, onClick, selected }: StatTileProps) {
  return (
    <AppCard
      padding={18}
      onClick={onClick}
      sx={selected ? { borderColor: 'primary.main', boxShadow: (t) => `inset 0 0 0 1px ${t.palette.primary.main}` } : undefined}
    >
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
