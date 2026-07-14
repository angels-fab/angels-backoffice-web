import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { typescale } from '@/theme/tokens'

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
  /** 클릭 — 이벤트를 전달(shiftKey 등 수정키 판별용) */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  /** 마우스다운 — Shift+클릭 시 텍스트 선택 방지 등 */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  size?: 'small' | 'medium'
  /** status 매핑 대신 쓸 고정 색(담당자 고유색 등) — 알파 공식(약한 채움→호버→선택 솔리드)은 동일 적용 */
  customColor?: string
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
  onMouseDown,
  size = 'small',
  customColor,
}: StatusChipProps) {
  return (
    <Chip
      label={label}
      icon={icon as never}
      onClick={onClick}
      onMouseDown={onMouseDown}
      size={size}
      variant="outlined"
      sx={(t) => {
        const c = customColor ?? COLOR[status](t)
        return {
          // MUI Chip 기본 라벨은 13px(body) → 본문·ManagerChip과 같은 12px(칩=라벨 크기)로 통일.
          fontSize: typescale.small.size,
          color: selected ? t.palette.common.white : c,
          bgcolor: selected ? c : alpha(c, 0.12),
          borderColor: selected ? c : alpha(c, 0.32),
          '& .MuiChip-icon': { color: 'inherit', fontSize: 16 },
          // lineHeight:1 통일 + 글자 0.5px 하향 — 다른 칩과 동일 규격으로 한글 정중앙(실측)
          '& .MuiChip-label': { lineHeight: 1, transform: 'translateY(0.5px)' },
          ...(onClick && {
            cursor: 'pointer',
            // 선택 > 호버 — 선택 칩은 호버에도 솔리드 유지, 미선택 칩만 같은 색으로 조금 더 선명하게
            '&:hover': { bgcolor: selected ? c : alpha(c, 0.2), borderColor: selected ? c : alpha(c, 0.5) },
          }),
        }
      }}
    />
  )
}
