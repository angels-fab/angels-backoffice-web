import Box from '@mui/material/Box'
import type { Theme } from '@mui/material/styles'
import type { StatusKind } from '@/components/ds'
import { TintChip, PillChip } from '@/components/FilterChip'
import { typescale } from '@/theme/tokens'

/**
 * 업무현황 구분·담당자 필터 칩 — 공용 FilterChip(TintChip/PillChip) 위에 얹은 얇은 래퍼.
 * 상호작용·접근성·틴트배경은 공용 컴포넌트가 담당하고, 여기선 업무현황 고유의 색 산출(kind→hex)과
 * 칩 콘텐츠(라벨·건수)만 넘긴다. 시각은 기존과 동일:
 * - 구분 = 종류 칩(TintChip 틴트 pill, off는 dim). Work 칩은 hover 피드백 유지.
 * - 담당자 = 팀원 알약(PillChip). 건수는 aria에만.
 */

const kindHex = (t: Theme, kind: StatusKind): string =>
  kind === 'success' ? t.palette.accent.green
  : kind === 'info' ? t.palette.accent.blue
  : kind === 'warning' ? t.palette.accent.amber
  : kind === 'error' ? t.palette.accent.red
  : kind === 'purple' ? t.palette.accent.purple
  : kind === 'teal' ? t.palette.accent.teal
  : t.palette.text.secondary

interface ChipBaseProps {
  label: string
  count: number
  on: boolean
  onToggle: (additive: boolean) => void
}

/** 구분 필터 칩 — 업무일정 종류 칩 스타일(틴트 pill + off는 dim) */
export function CatFilterChip({ label, count, on, kind, onToggle }: ChipBaseProps & { kind: StatusKind }) {
  return (
    <TintChip
      on={on}
      color={(t: Theme) => kindHex(t, kind)}
      ariaLabel={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      onToggle={onToggle}
      hover
      sx={{ p: '4px 10px' }}
    >
      <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>{label}</Box>
      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>{count}</Box>
    </TintChip>
  )
}

/** 담당자 필터 칩 — 업무일정 팀원 알약(PillChip) 스타일. 건수는 표시하지 않음(aria에만 유지) */
export function MgrFilterChip({ label, count, on, color, onToggle }: ChipBaseProps & { color: string }) {
  return (
    <PillChip
      label={label}
      color={color}
      on={on}
      ariaLabel={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      onToggle={onToggle}
    />
  )
}
