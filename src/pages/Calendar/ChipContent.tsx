import Box from '@mui/material/Box'
import GroupsIcon from '@mui/icons-material/Groups'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import type { RealCat } from './catMeta'

/**
 * 달력 일정 칩 — 2줄 구조.
 *  1줄: 구분(아이콘) · 시간 · 담당자(이름 동그라미, 우측)
 *  2줄: 일정 내용(제목)
 */
const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  etc: MoreHorizIcon,
}

export interface ChipContentProps {
  memberColor: string
  initials: string
  catKey: RealCat
  catColor: string
  time?: string
  title: string
}

export default function ChipContent({ memberColor, initials, catKey, catColor, time, title }: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
      {/* 1줄 — 구분 · 시간 · 담당자 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
        <Icon sx={{ fontSize: 13, color: catColor, flex: 'none', ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }} />
        {time && (
          <Box component="span" sx={{ fontSize: 10.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
            {time}
          </Box>
        )}
        <Box
          sx={{
            ml: 'auto',
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: memberColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '-0.5px',
            flex: 'none',
          }}
        >
          {initials}
        </Box>
      </Box>

      {/* 2줄 — 일정 내용 */}
      <Box
        component="span"
        sx={{ fontSize: 11.5, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
      >
        {title}
      </Box>
    </Box>
  )
}
