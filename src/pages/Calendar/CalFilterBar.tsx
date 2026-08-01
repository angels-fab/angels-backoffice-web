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
import { iconSize, radius, typescale, weight } from '@/theme/tokens'

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

// 라벨은 줄 왼쪽에 절대배치 — 두 줄(팀원·종류)의 라벨 x좌표와 첫 칩 시작 x좌표를 일치시킨다.
const LABEL = {
  fontSize: typescale.caption.size, fontWeight: weight.bold, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none',
  position: 'absolute', left: 0, top: '6px', margin: 0,
} as const

// 팀원/종류 한 줄 — 라벨을 절대배치하고 그만큼(27px) 들여써 칩이 넘쳐도 같은 들여쓰기로 줄바꿈(행잉 인덴트)
const ROW = { display: 'flex', alignItems: 'flex-start', gap: 0, position: 'relative', pl: '27px', minWidth: 0 } as const

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
      <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, color: on ? 'text.primary' : 'text.secondary' }}>{label.split('/')[0]}</Box>
      <Box component="span" sx={{ fontSize: typescale.small.size, color: 'text.secondary' }}>{count}</Box>
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
      // 박스 경량화(캘린더 UI 점검 #9) — 테두리 카드였던 것을 투명 스트립으로: 달력이 위로 올라와 시원해짐
      sx={{
        containerType: 'inline-size',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px',
        mb: 1.75, px: '2px', userSelect: 'none',
      }}
    >
      {/* 팀원 */}
      <Box sx={ROW}>
        <Box component="span" sx={LABEL}>팀원</Box>
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
                borderRadius: `${radius.chip}px`, fontSize: typescale.small.size, fontWeight: weight.bold, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none', userSelect: 'none',
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
        {/* 두 줄 사이 구분선 — 2줄 고정 레이아웃으로 바뀌며 숨김 처리된 상태(display:none) */}
        <Box sx={(t) => ({ display: 'none', width: '1px', height: 20, bgcolor: t.palette.divider, flex: 'none' })} />
      </Box>

      {/* 일정 종류 (0건 종류는 상위에서 숨김 처리) */}
      <Box sx={ROW}>
        <Box component="span" sx={LABEL}>종류</Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', minWidth: 0 }}>
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
