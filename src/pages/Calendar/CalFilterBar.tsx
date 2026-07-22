import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck'
import type { SvgIconComponent } from '@mui/icons-material'
import { type TeamMember } from './members'
import type { RealCat } from './catMeta'
import { TintChip, PillChip } from '@/components/FilterChip'
import { iconSize, radius } from '@/theme/tokens'

export interface FilterMember {
  member: TeamMember
  on: boolean
}
export interface FilterCat {
  id: RealCat
  label: string
  color: string
  count: number
  on: boolean
}

export interface CalFilterBarProps {
  members: FilterMember[]
  onToggleMember: (id: string, additive: boolean) => void
  cats: FilterCat[]
  onToggleCat: (id: RealCat, additive: boolean) => void
  /** 복수선택 버튼 노출 여부 — 모바일에서만(PC는 Shift+클릭) */
  showMulti: boolean
  /** 모바일 복수선택 모드(Shift 대체) */
  multiSelect: boolean
  onToggleMulti: () => void
}

const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  work: WorkIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  leave: BeachAccessIcon,
  etc: MoreHorizIcon,
}

const LABEL = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none' } as const

// 팀원 선택 칩 — 공용 PillChip. 선택=색 배경+흰 글자 / 미선택=옅은 배경+테두리.
function MemberPill({ m, on, multi, onToggle }: { m: TeamMember; on: boolean; multi: boolean; onToggle: (additive: boolean) => void }) {
  return (
    <PillChip
      label={m.name}
      color={m.color}
      on={on}
      multi={multi}
      ariaLabel={`${m.name}${on ? '' : ' (해제됨)'}`}
      onToggle={onToggle}
    />
  )
}

// 종류 칩 (아이콘+이름+건수) — 공용 TintChip. on이면 강조, 아니면 dim.
// hover: 팀원 알약과 동일하게 반응(클릭 가능함을 전달 — 캘린더 UI 점검 #8)
function CatChip({ icon: Icon, label, color, count, on, rotate, onToggle }: {
  icon: SvgIconComponent; label: string; color: string; count: number; on: boolean; rotate?: boolean
  onToggle: (additive: boolean) => void
}) {
  return (
    <TintChip
      on={on}
      color={color}
      hover
      ariaLabel={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      onToggle={onToggle}
      sx={{ p: '4px 9px' }}
    >
      <Icon sx={{ fontSize: iconSize.caption, color, ...(rotate ? { transform: 'rotate(45deg)' } : {}) }} />
      <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{label.split('/')[0]}</Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>{count}</Box>
    </TintChip>
  )
}

/**
 * 달력 상단 가로 필터 바 — 팀원(알약 토글) + 일정 종류(아이콘 칩).
 * 일반 클릭=단일선택(재클릭 시 해제/전체) / Shift+클릭(PC)·복수모드(모바일)=추가선택. 검색은 상단 툴바.
 */
export default function CalFilterBar({
  members, onToggleMember, cats, onToggleCat, showMulti, multiSelect, onToggleMulti,
}: CalFilterBarProps) {
  // PC에서는 Shift+클릭만 추가선택(복수 버튼 없음) → multi는 모바일에서만 유효
  const effMulti = showMulti && multiSelect
  return (
    <Box
      className="cal-fb"
      // 박스 경량화(캘린더 UI 점검 #9) — 테두리 카드였던 것을 투명 스트립으로: 달력이 위로 올라와 시원해짐
      sx={{ mb: 1.75, px: '2px', userSelect: 'none' }}
    >
      {/* 팀원 */}
      <Box className="cal-fb__team">
        <Box component="span" className="cal-fb__teamlbl" sx={LABEL}>팀원</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {members.map(({ member, on }) => (
            <MemberPill key={member.id} m={member} on={on} multi={effMulti} onToggle={(add) => onToggleMember(member.id, add)} />
          ))}
        </Box>
        {/* 복수선택 토글 — 모바일 전용(Shift 대체). PC는 미노출. */}
        {showMulti && (
          <Tooltip title="여러 개 선택" placement="top" arrow>
            <Box
              role="button"
              tabIndex={0}
              aria-label="복수선택 모드"
              aria-pressed={multiSelect}
              onClick={onToggleMulti}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleMulti() } }}
              sx={(t) => ({
                ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 26, px: '8px',
                borderRadius: `${radius.chip}px`, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none', userSelect: 'none',
                border: '1px solid',
                ...(multiSelect
                  ? { bgcolor: alpha(t.palette.primary.main, 0.16), color: 'primary.main', borderColor: t.palette.primary.main }
                  : { bgcolor: 'transparent', color: 'text.disabled', borderColor: t.palette.divider }),
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
              })}
            >
              <LibraryAddCheckIcon sx={{ fontSize: iconSize.body }} /> 복수선택
            </Box>
          </Tooltip>
        )}
        <Box className="cal-fb__sep" sx={(t) => ({ width: '1px', height: 20, bgcolor: t.palette.divider, flex: 'none' })} />
      </Box>

      {/* 일정 종류 (0건 종류는 상위에서 숨김 처리) */}
      <Box className="cal-fb__cats">
        <Box component="span" className="cal-fb__catlbl" sx={LABEL}>종류</Box>
        <Box className="cal-fb__chips">
          {cats.map((c) => (
            <CatChip
              key={c.id}
              icon={CAT_ICON[c.id]} label={c.label} color={c.color} count={c.count} on={c.on}
              rotate={c.id === 'trip_intl'}
              onToggle={(add) => onToggleCat(c.id, add || effMulti)}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
