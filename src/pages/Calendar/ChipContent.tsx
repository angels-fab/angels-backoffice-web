import Box from '@mui/material/Box'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import type { RealCat } from './catMeta'

/**
 * 달력 일정 칩 내용 — 종일·멀티데이 포함 **항상 한 줄**.
 *  구분(아이콘) → 시간 → 장소-목적(말줄임) → 해당자 원형 칩
 *  해당자는 우측 끝으로 밀지 않고 제목 바로 옆(약 5~6px)에 붙인다.
 *  (제목 flex: 0 1 auto → 짧으면 그대로, 길면 제목만 말줄임하고 해당자는 항상 보임)
 */
const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  work: WorkIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  etc: MoreHorizIcon,
}

const MAX_PARTICIPANTS = 4
const AVATAR = 20

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

function Circle({ text, color, overlap }: { text: string; color: string; overlap?: boolean }) {
  return (
    <Box
      sx={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: '50%',
        bgcolor: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        flex: 'none',
        border: '1px solid rgba(255,255,255,.3)',
        ...(overlap ? { ml: '-5px' } : null),
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
  const iconSx = { fontSize: 16, color: catColor, flex: 'none', ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
      <Icon sx={iconSx} />
      {time && (
        <Box component="span" sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
          {time}
        </Box>
      )}
      <Box
        component="span"
        sx={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 }}
      >
        {title}
      </Box>
      {participants.length > 0 && (
        <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', pl: '1px' }}>
          {shown.map((p, i) => (
            <Circle key={i} text={p.initials} color={p.color} overlap={i > 0} />
          ))}
          {rest > 0 && <Circle text={`+${rest}`} color="#5F6A7A" overlap={shown.length > 0} />}
        </Box>
      )}
    </Box>
  )
}
