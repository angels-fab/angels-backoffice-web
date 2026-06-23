import Box from '@mui/material/Box'
import GroupsIcon from '@mui/icons-material/Groups'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import type { RealCat } from './catMeta'

/**
 * 달력 일정 칩 내용 — 4가지 시안(임시).
 *  A  = 이름동그라미 + 구분아이콘 + 제목
 *  A1 = 아바타(사진) + 구분아이콘 + 제목
 *  D  = 이름동그라미 + 구분아이콘 + 시간 + 제목
 *  D1 = 아바타(사진) + 구분아이콘 + 시간 + 제목
 * (사용자 비교용. 결정 후 한 가지로 정리/원복 예정)
 */
export type ChipVariant = 'A' | 'A1' | 'D' | 'D1'

const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip: FlightIcon,
  etc: MoreHorizIcon,
}

export interface ChipContentProps {
  variant: ChipVariant
  memberColor: string
  initials: string
  avatarUrl: string
  catKey: RealCat
  catColor: string
  time?: string
  title: string
}

export default function ChipContent({
  variant,
  memberColor,
  initials,
  avatarUrl,
  catKey,
  catColor,
  time,
  title,
}: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  const showAvatar = variant === 'A1' || variant === 'D1'
  const showTime = (variant === 'D' || variant === 'D1') && !!time
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden' }}>
      {showAvatar ? (
        <Box
          component="img"
          src={avatarUrl}
          alt=""
          sx={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
        />
      ) : (
        <Box
          sx={{
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
      )}
      <Icon sx={{ fontSize: 13, color: catColor, flex: 'none' }} />
      {showTime && (
        <Box component="span" sx={{ fontSize: 11, color: 'text.secondary', flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
          {time}
        </Box>
      )}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Box>
    </Box>
  )
}
