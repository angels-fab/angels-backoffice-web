import type { ChangeEvent } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import { given, type TeamMember } from './members'
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
  search: string
  onSearch: (v: string) => void
  members: FilterMember[]
  onToggleMember: (id: string) => void
  cats: FilterCat[]
  onToggleCat: (id: RealCat) => void
}

const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  work: WorkIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  etc: MoreHorizIcon,
}

const LABEL = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none' } as const

function MemberAvatar({ m, on }: { m: TeamMember; on: boolean }) {
  const common = {
    width: 25,
    height: 25,
    borderRadius: '50%',
    flex: 'none',
    filter: on ? 'none' : 'grayscale(100%)',
    opacity: on ? 1 : 0.45,
    transition: 'filter .15s, opacity .15s',
  } as const
  if (m.photo) {
    return <Box component="img" src={m.photo} alt={m.name} sx={{ ...common, objectFit: 'cover' }} />
  }
  return (
    <Box
      sx={{
        ...common,
        bgcolor: m.color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '-0.5px',
      }}
    >
      {given(m.name)}
    </Box>
  )
}

/** 달력 상단 가로 필터 바 — 팀원(아바타 토글) + 일정 종류(아이콘 칩) + 검색. 좌측 사이드바 대체. */
export default function CalFilterBar({ search, onSearch, members, onToggleMember, cats, onToggleCat }: CalFilterBarProps) {
  return (
    <Box
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1.5,
        mb: 2,
        p: '10px 14px',
        bgcolor: 'background.paper',
        border: `1px solid ${t.palette.divider}`,
        borderRadius: '12px',
      })}
    >
      {/* 팀원 */}
      <Box component="span" sx={LABEL}>팀원</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {members.map(({ member, on }) => (
          <Box
            key={member.id}
            role="button"
            tabIndex={0}
            aria-label={`${member.name}${on ? '' : ' (해제됨)'}`}
            title={member.name}
            onClick={() => onToggleMember(member.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleMember(member.id)
              }
            }}
            sx={{ display: 'inline-flex', cursor: 'pointer' }}
          >
            <MemberAvatar m={member} on={on} />
          </Box>
        ))}
      </Box>

      <Box sx={(t) => ({ width: '1px', height: 20, bgcolor: t.palette.divider, flex: 'none' })} />

      {/* 일정 종류 */}
      <Box component="span" sx={LABEL}>종류</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
        {cats.map((c) => {
          const Icon = CAT_ICON[c.id]
          return (
            <Box
              key={c.id}
              role="button"
              tabIndex={0}
              aria-label={`${c.label} ${c.count}건${c.on ? '' : ' (해제됨)'}`}
              onClick={() => onToggleCat(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onToggleCat(c.id)
                }
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                p: '4px 9px',
                borderRadius: '999px',
                bgcolor: alpha(c.color, c.on ? 0.16 : 0.06),
                cursor: 'pointer',
                opacity: c.on ? 1 : 0.45,
                transition: 'opacity .15s, background .15s',
              }}
            >
              <Icon sx={{ fontSize: 13, color: c.color, ...(c.id === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }} />
              <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>{c.label.split('/')[0]}</Box>
              <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>{c.count}</Box>
            </Box>
          )
        })}
      </Box>

      {/* 검색 */}
      <Box sx={{ position: 'relative', ml: { sm: 'auto' } }}>
        <SearchIcon sx={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'text.disabled' }} />
        <Box
          component="input"
          value={search}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
          placeholder="검색 (팀원·구분·내용)"
          sx={(t) => ({
            width: 150,
            height: 32,
            border: `1px solid ${t.palette.divider}`,
            borderRadius: '8px',
            p: '0 10px 0 28px',
            fontSize: 12,
            fontFamily: 'inherit',
            color: 'text.primary',
            bgcolor: 'background.default',
            outline: 'none',
            '&::placeholder': { color: t.palette.text.disabled },
            '&:focus': { borderColor: t.palette.primary.main },
          })}
        />
      </Box>
    </Box>
  )
}
