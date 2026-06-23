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
 * 달력 일정 칩.
 *  좌측: 구분(아이콘) · 시간 (1줄) + 일정 내용(2줄, 말줄임)
 *  우측: 참석자 동그라미들(1~2줄까지 채움). 참석자가 많아 내용과 겹치면 내용을 …로 생략.
 */
const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  etc: MoreHorizIcon,
}

const MAX_PARTICIPANTS = 6

export interface Participant {
  initials: string
  color: string
}

export interface ChipContentProps {
  participants: Participant[]
  catKey: RealCat
  catColor: string
  time?: string
  title: string
}

function Circle({ text, color }: { text: string; color: string }) {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        bgcolor: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '-0.5px',
        flex: 'none',
      }}
    >
      {text}
    </Box>
  )
}

export default function ChipContent({ participants, catKey, catColor, time, title }: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  const shown = participants.slice(0, MAX_PARTICIPANTS)
  const rest = participants.length - shown.length
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
      {/* 좌: 구분·시간 / 내용 */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <Icon sx={{ fontSize: 17, color: catColor, flex: 'none', ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }} />
          {time && (
            <Box component="span" sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
              {time}
            </Box>
          )}
        </Box>
        <Box
          component="span"
          sx={{ fontSize: 11.5, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
        >
          {title}
        </Box>
      </Box>

      {/* 우: 참석자 (1~2줄까지 채움) */}
      {participants.length > 0 && (
        <Box
          sx={{
            flex: 'none',
            maxWidth: '52%',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignContent: 'flex-start',
            gap: '2px',
          }}
        >
          {shown.map((p, i) => (
            <Circle key={i} text={p.initials} color={p.color} />
          ))}
          {rest > 0 && <Circle text={`+${rest}`} color="#5F6A7A" />}
        </Box>
      )}
    </Box>
  )
}
