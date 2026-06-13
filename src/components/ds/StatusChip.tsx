import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'

/** 의미 상태 — 색 매핑의 단일 기준 */
export type StatusKind = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'purple' | 'teal'

export interface StatusChipProps {
  /** 상태 종류. 색을 결정한다. */
  status: StatusKind
  /** 표시 텍스트 */
  label: string
  /** 선택형(클릭 토글) 칩일 때 선택 여부 — 채워진 스타일 */
  selected?: boolean
  icon?: ReactNode
  onClick?: () => void
  size?: 'small' | 'medium'
}

const COLOR: Record<StatusKind, (t: import('@mui/material/styles').Theme) => string> = {
  success: (t) => t.palette.accent.green,
  info: (t) => t.palette.accent.blue,
  warning: (t) => t.palette.accent.amber,
  error: (t) => t.palette.accent.red,
  purple: (t) => t.palette.accent.purple,
  teal: (t) => t.palette.accent.teal,
  neutral: (t) => t.palette.text.secondary,
}

/**
 * StatusChip — 상태/분류를 일관된 색 규칙으로 표시하는 칩.
 *
 * 색은 status로만 결정(하드코딩 금지). 옅은 배경 + 같은 색 테두리/글자.
 * selected=true면 채워진 스타일(필터 토글 등).
 *
 * @example
 * <StatusChip status="success" label="국내" />
 * <StatusChip status="info" label="해외" selected onClick={toggle} />
 */
export default function StatusChip({
  status,
  label,
  selected,
  icon,
  onClick,
  size = 'small',
}: StatusChipProps) {
  return (
    <Chip
      label={label}
      icon={icon as never}
      onClick={onClick}
      size={size}
      variant="outlined"
      sx={(t) => {
        const c = COLOR[status](t)
        return {
          color: selected ? t.palette.common.white : c,
          bgcolor: selected ? c : alpha(c, 0.12),
          borderColor: selected ? c : alpha(c, 0.32),
          '& .MuiChip-icon': { color: 'inherit', fontSize: 16 },
          ...(onClick && {
            cursor: 'pointer',
            '&:hover': { bgcolor: selected ? c : alpha(c, 0.2) },
          }),
        }
      }}
    />
  )
}
