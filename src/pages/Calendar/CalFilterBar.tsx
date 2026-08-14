import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import { type TeamMember } from './members'
import type { RealCat } from './catMeta'
import { TintChip, PillChip } from '@/components/FilterChip'
import { iconSize, typescale, weight } from '@/theme/tokens'

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

// 팀원/종류 각각 한 줄 — 줄바꿈 없이 가로 스크롤(사용자 지시 2026-08-09).
// '팀원'·'종류' 라벨은 삭제했다: 알약(사람)과 틴트칩(종류)의 모양이 이미 갈래를 말해 주고,
// 모바일에서 툴바가 여섯 줄까지 늘어나 달력이 화면 밖으로 밀리던 게 더 큰 문제였다.
const ROW = { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } as const

// 모바일 칩 띠 오른쪽 끝 페이드 — "칩이 더 있는지 가늠이 안 된다"(2026-08-15) → 끝을 흐려
// 이어짐을 암시한다. 다 보여도 마지막 칩 가장자리만 살짝 옅어지는 정도라 비용이 없다.
const FADE_MASK = 'linear-gradient(to right, #000 0, #000 calc(100% - 18px), transparent)'

// 스크롤 되는 칩 띠 — 스크롤바는 감춘다(모바일은 손가락, PC는 넘칠 일이 드물다)
const STRIP = {
  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', flexWrap: 'nowrap',
  overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  '& > *': { flexShrink: 0 },
} as const

// 팀원 선택 칩 — 공용 PillChip. 선택=색 배경+흰 글자 / 미선택=옅은 배경+테두리.
function MemberPill({ m, on, onToggle }: { m: TeamMember; on: boolean; onToggle: (additive: boolean) => void }) {
  return (
    <PillChip
      label={m.name}
      color={m.color}
      on={on}
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
 * 달력 상단 가로 필터 바 — **한 줄**: 왼쪽 해당자(알약) | 구분선 | 오른쪽 일정 종류(아이콘 칩).
 * (2026-08-15 사용자 지시 — 칩필터는 거의 안 쓰므로 두 줄 몫의 세로를 달력에 돌려준다.
 *  해당자 옆에 종류를 바로 붙이면 밸런스가 안 맞아 가운데 구분선으로 두 무리를 가른다.)
 * 일반 클릭=단일선택(재클릭 시 해제/전체) / Shift+클릭=추가선택(PC).
 */
export default function CalFilterBar({ members, onToggleMember, cats, onToggleCat }: CalFilterBarProps) {
  return (
    <Box
      // 박스 경량화(캘린더 UI 점검 #9) — 테두리 카드였던 것을 투명 스트립으로: 달력이 위로 올라와 시원해짐
      sx={{
        containerType: 'inline-size',
        ...ROW,
        mb: 1.75, px: '2px', userSelect: 'none',
      }}
    >
      {/* 해당자(팀원) — 왼쪽 무리. PC(shell+)는 내용 폭만 차지해 구분선이 바로 옆에 붙는다
          (2026-08-15 사용자 지시). 모바일은 절반씩 나눠 양쪽 다 가로 스크롤. */}
      <Box sx={{ ...STRIP, gap: 0.75, flex: { xs: 1, shell: '0 0 auto' }, maskImage: { xs: FADE_MASK, shell: 'none' } }}>
        {members.map(({ member, on }) => (
          <MemberPill key={member.id} m={member} on={on} onToggle={(add) => onToggleMember(member.id, add)} />
        ))}
      </Box>

      {/* 구분선 — 두 칩 무리의 경계. divider 토큰은 "너무 흐릿"(사용자) → 잉크 30% */}
      <Box sx={(th) => ({ width: '1px', alignSelf: 'stretch', my: '3px', bgcolor: alpha(th.palette.text.primary, 0.3), flex: 'none' })} />

      {/* 일정 종류 — 오른쪽 무리 (0건 종류는 상위에서 숨김 처리) */}
      <Box sx={{ ...STRIP, gap: '6px', maskImage: { xs: FADE_MASK, shell: 'none' } }}>
        {cats.map((c) => (
          <CatChip
            key={c.id}
            icon={CAT_ICON[c.id]} label={c.label} color={c.color} count={c.count} on={c.on}
            rotate={c.id === 'trip_intl'}
            onToggle={(add) => onToggleCat(c.id, add)}
          />
        ))}
      </Box>
    </Box>
  )
}
