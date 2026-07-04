import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { StatusKind } from '@/components/ds'

/**
 * 업무현황 구분·담당자 필터 칩 — 업무일정(CalFilterBar)과 동일한 디자인 언어.
 * - 빈 선택 = 전체: 모든 칩이 '선택된 모습'(on)으로 표시된다.
 * - 담당자 = 팀원 알약(MemberPill)과 동일: on=고유색 솔리드+흰 글자 / off=옅은 배경+테두리,
 *   on 호버는 brightness만 올려 선택된 모습 유지(미선택 모습으로 돌아가지 않음).
 * - 구분 = 종류 칩(CatChip)과 동일: on=틴트 배경 / off=더 옅게 + 전체 dim(opacity .45).
 */

const preventShiftSelect = (e: React.MouseEvent) => { if (e.shiftKey) e.preventDefault() }

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
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      aria-pressed={on}
      onMouseDown={preventShiftSelect}
      onClick={(e) => onToggle(!!e.shiftKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(!!e.shiftKey) } }}
      sx={(t) => {
        const color = kindHex(t, kind)
        return {
          display: 'inline-flex', alignItems: 'center', gap: '5px', p: '4px 10px', borderRadius: '999px',
          bgcolor: alpha(color, on ? 0.16 : 0.06), cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
          opacity: on ? 1 : 0.45, transition: 'opacity .15s, background .15s',
          '&:hover': on ? { bgcolor: alpha(color, 0.22) } : { opacity: 0.7 },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        }
      }}
    >
      <Box component="span" sx={(t) => ({ width: 7, height: 7, borderRadius: '50%', bgcolor: kindHex(t, kind), flex: 'none' })} />
      <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{label}</Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>{count}</Box>
    </Box>
  )
}

/** 담당자 필터 칩 — 업무일정 팀원 알약(MemberPill) 스타일 + 건수 */
export function MgrFilterChip({ label, count, on, color, onToggle }: ChipBaseProps & { color: string }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      aria-pressed={on}
      title={label}
      onMouseDown={preventShiftSelect}
      onClick={(e) => onToggle(!!e.shiftKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(!!e.shiftKey) } }}
      sx={{
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        px: '8px',
        borderRadius: '10px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        border: '1px solid',
        transition: 'background .15s, color .15s, border-color .15s',
        ...(on
          ? { bgcolor: color, color: '#fff', borderColor: color }
          : { bgcolor: alpha(color, 0.1), color: 'text.secondary', borderColor: alpha(color, 0.3) }),
        // 선택 칩 호버 = 밝기만 상승(선택된 모습 유지 — 미선택 모습으로 회귀 금지)
        '&:hover': on ? { filter: 'brightness(1.08)' } : { bgcolor: alpha(color, 0.2), borderColor: alpha(color, 0.5) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      {label}
      <Box component="span" sx={{ fontSize: 11, fontWeight: 700, opacity: on ? 0.85 : 0.6 }}>{count}</Box>
    </Box>
  )
}
