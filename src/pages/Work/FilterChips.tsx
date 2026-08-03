import Box from '@mui/material/Box'
import type { Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { statusTextColor, type StatusKind } from '@/components/ds'
import { TintChip, PillChip } from '@/components/FilterChip'
import { iconSize, typescale } from '@/theme/tokens'

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
export function CatFilterChip({ label, count, on, kind, icon, onToggle }: ChipBaseProps & { kind: StatusKind; icon?: ReactNode }) {
  return (
    <TintChip
      on={on}
      color={(t: Theme) => kindHex(t, kind)}
      ariaLabel={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      onToggle={onToggle}
      hover
      sx={{ p: '4px 10px' }}
    >
      {/*
        아이콘이 분류 색을 나른다 — 카드 구분칩과 같은 규칙. 꺼짐은 채움이 없으므로 함께 dim.
        색은 채움용 kindHex(accent)가 아니라 글자용 statusTextColor(accentText) — 아이콘이 정보를
        나르므로 3:1 을 지켜야 하는데 accent 는 라이트 틴트 위에서 2.01~2.70 으로 미달한다.
      */}
      {icon && (
        <Box sx={{ display: 'flex', color: (t: Theme) => (on ? statusTextColor(t, kind) : t.palette.text.disabled), '& svg': { display: 'block', fontSize: iconSize.caption } }}>{icon}</Box>
      )}
      {/*
        아이콘이 있으면 글자는 중립 — 색을 나르는 일을 아이콘이 맡는다(카드 구분칩과 동일 규칙).
        아이콘이 없을 때만 종전대로 켜짐 = 카드 구분칩과 같은 글자색(같은 구분임을 색으로 잇는다).
      */}
      <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight, color: (t: Theme) => (on ? (icon ? t.palette.text.primary : statusTextColor(t, kind)) : t.palette.text.secondary) }}>{label}</Box>
      <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.secondary' }}>{count}</Box>
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
