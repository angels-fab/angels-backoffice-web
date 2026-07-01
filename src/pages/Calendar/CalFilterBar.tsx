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
import SelectAllIcon from '@mui/icons-material/SelectAll'
import LibraryAddCheckIcon from '@mui/icons-material/LibraryAddCheck'
import type { SvgIconComponent } from '@mui/icons-material'
import { type TeamMember } from './members'
import type { RealCat } from './catMeta'

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
  /** 종류 '전체' 상태(selCats 비어있음) */
  allCatsOn: boolean
  onSelectAllCats: () => void
  /** '전체' 칩 건수(현재 표시 범위 총계) */
  totalCount: number
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
const ALL_COLOR = '#7d8899' // '전체' 칩 중립색

// 클릭/키보드에서 additive(추가선택) 여부 — Shift 또는 모바일 복수모드
const isAdditive = (e: { shiftKey?: boolean }, multi: boolean) => !!e.shiftKey || multi

// 팀원 선택 칩 — 알약형 둥근 사각형(이름 표시). 선택=색 배경+흰 글자 / 미선택=옅은 배경+테두리.
function MemberPill({ m, on, multi, onToggle }: { m: TeamMember; on: boolean; multi: boolean; onToggle: (additive: boolean) => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${m.name}${on ? '' : ' (해제됨)'}`}
      aria-pressed={on}
      title={m.name}
      onClick={(e) => onToggle(isAdditive(e, multi))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(isAdditive(e, multi))
        }
      }}
      sx={{
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        px: '8px',
        borderRadius: '10px',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        border: '1px solid',
        transition: 'background .15s, color .15s, border-color .15s',
        ...(on
          ? { bgcolor: m.color, color: '#fff', borderColor: m.color }
          : { bgcolor: alpha(m.color, 0.1), color: 'text.secondary', borderColor: alpha(m.color, 0.3) }),
        '&:hover': on ? { filter: 'brightness(1.08)' } : { bgcolor: alpha(m.color, 0.2), borderColor: alpha(m.color, 0.5) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      {m.name}
    </Box>
  )
}

// 종류 칩 (아이콘+이름+건수) — on이면 강조, 아니면 dim
function CatChip({ icon: Icon, label, color, count, on, rotate, onClick }: {
  icon: SvgIconComponent; label: string; color: string; count: number; on: boolean; rotate?: boolean
  onClick: (e: { shiftKey?: boolean }) => void
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${label} ${count}건${on ? '' : ' (해제됨)'}`}
      aria-pressed={on}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e) } }}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', p: '4px 9px', borderRadius: '999px',
        bgcolor: alpha(color, on ? 0.16 : 0.06), cursor: 'pointer', whiteSpace: 'nowrap',
        opacity: on ? 1 : 0.45, transition: 'opacity .15s, background .15s',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Icon sx={{ fontSize: 13, color, ...(rotate ? { transform: 'rotate(45deg)' } : {}) }} />
      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{label.split('/')[0]}</Box>
      <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>{count}</Box>
    </Box>
  )
}

/**
 * 달력 상단 가로 필터 바 — 팀원(알약 토글) + 일정 종류(아이콘 칩, 맨 앞 '전체').
 * 일반 클릭=단일선택 / Shift·복수모드=추가선택. 검색은 상단 툴바로 이동.
 */
export default function CalFilterBar({
  members, onToggleMember, cats, onToggleCat, allCatsOn, onSelectAllCats, totalCount, multiSelect, onToggleMulti,
}: CalFilterBarProps) {
  return (
    <Box
      className="cal-fb"
      sx={(t) => ({
        mb: 2,
        p: '10px 14px',
        bgcolor: 'background.paper',
        border: `1px solid ${t.palette.divider}`,
        borderRadius: '12px',
      })}
    >
      {/* 팀원 */}
      <Box className="cal-fb__team">
        <Box component="span" className="cal-fb__teamlbl" sx={LABEL}>팀원</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {members.map(({ member, on }) => (
            <MemberPill key={member.id} m={member} on={on} multi={multiSelect} onToggle={(add) => onToggleMember(member.id, add)} />
          ))}
        </Box>
        {/* 복수선택 토글(Shift 대체·모바일용). 활성 시 강조 */}
        <Tooltip title="여러 개 선택 (Shift+클릭과 동일)" placement="top" arrow>
          <Box
            role="button"
            tabIndex={0}
            aria-label="복수선택 모드"
            aria-pressed={multiSelect}
            onClick={onToggleMulti}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleMulti() } }}
            sx={(t) => ({
              ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', height: 26, px: '8px',
              borderRadius: '8px', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', flex: 'none',
              border: '1px solid',
              ...(multiSelect
                ? { bgcolor: alpha(t.palette.primary.main, 0.16), color: 'primary.main', borderColor: t.palette.primary.main }
                : { bgcolor: 'transparent', color: 'text.disabled', borderColor: t.palette.divider }),
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            })}
          >
            <LibraryAddCheckIcon sx={{ fontSize: 15 }} /> 복수선택
          </Box>
        </Tooltip>
        <Box className="cal-fb__sep" sx={(t) => ({ width: '1px', height: 20, bgcolor: t.palette.divider, flex: 'none' })} />
      </Box>

      {/* 일정 종류 */}
      <Box className="cal-fb__cats">
        <Box component="span" className="cal-fb__catlbl" sx={LABEL}>종류</Box>
        <Box className="cal-fb__chips">
          {/* '전체' 칩 — 선택 시 개별 해제(selCats=[]) */}
          <CatChip
            icon={SelectAllIcon} label="전체" color={ALL_COLOR} count={totalCount} on={allCatsOn}
            onClick={() => onSelectAllCats()}
          />
          {cats.map((c) => (
            <CatChip
              key={c.id}
              icon={CAT_ICON[c.id]} label={c.label} color={c.color} count={c.count} on={c.on}
              rotate={c.id === 'trip_intl'}
              onClick={(e) => onToggleCat(c.id, isAdditive(e, multiSelect))}
            />
          ))}
        </Box>
      </Box>
    </Box>
  )
}
