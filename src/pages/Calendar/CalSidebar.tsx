import type { ChangeEvent } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import SearchIcon from '@mui/icons-material/Search'
import CheckIcon from '@mui/icons-material/Check'
import { given, type TeamMember } from './members'
import type { RealCat } from './catMeta'

export interface SidebarMember {
  member: TeamMember
  on: boolean
}
export interface SidebarCat {
  id: RealCat
  label: string
  color: string
  count: number
  on: boolean
}

export interface CalSidebarProps {
  search: string
  onSearch: (v: string) => void
  members: SidebarMember[]
  onToggleMember: (id: string) => void
  cats: SidebarCat[]
  onToggleCat: (id: RealCat) => void
}

function Avatar({ m, on = true, size = 28, fs = 12 }: { m: TeamMember; on?: boolean; size?: number; fs?: number }) {
  if (m.photo) {
    // 사진 아바타 — 선택 시 컬러, 해제 시 흑백
    return (
      <Box
        component="img"
        src={m.photo}
        alt={m.name}
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flex: 'none',
          filter: on ? 'none' : 'grayscale(100%)',
          transition: 'filter .15s',
        }}
      />
    )
  }
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: m.color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fs,
        fontWeight: 700,
        flex: 'none',
        letterSpacing: '-0.02em',
      }}
    >
      {given(m.name)}
    </Box>
  )
}

const SECTION_LABEL = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  color: 'text.disabled',
  mb: 1,
} as const

/** 좌측 필터 패널 — 검색 + 팀원 토글 + 일정 종류 토글(건수). 시안을 앱 다크 토큰으로. */
export default function CalSidebar({
  search,
  onSearch,
  members,
  onToggleMember,
  cats,
  onToggleCat,
}: CalSidebarProps) {
  return (
    <Box
      sx={(t) => ({
        width: 248,
        flex: 'none',
        alignSelf: 'flex-start',
        bgcolor: 'background.paper',
        border: `1px solid ${t.palette.divider}`,
        borderRadius: '12px',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        overflow: 'hidden',
      })}
    >
      {/* 검색 */}
      <Box sx={{ p: '14px 14px 10px' }}>
        <Box sx={{ position: 'relative' }}>
          <SearchIcon
            sx={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: 'text.disabled' }}
          />
          <Box
            component="input"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearch(e.target.value)}
            placeholder="팀원 검색"
            sx={(t) => ({
              width: '100%',
              height: 36,
              border: `1px solid ${t.palette.divider}`,
              borderRadius: '9px',
              p: '0 12px 0 31px',
              fontSize: 13,
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

      {/* 팀원 */}
      <Box sx={{ p: '4px 14px 8px' }}>
        <Box sx={SECTION_LABEL}>팀원</Box>
        {members.map(({ member, on }) => (
          <Box
            key={member.id}
            role="button"
            tabIndex={0}
            onClick={() => onToggleMember(member.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleMember(member.id)
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.1,
              p: '7px 8px',
              borderRadius: '9px',
              cursor: 'pointer',
              // 사진 아바타 멤버는 흑백 처리로 off를 표현(행은 흐리게 하지 않음)
              opacity: on || member.photo ? 1 : 0.45,
              transition: 'background .12s, opacity .12s',
              '&:hover': { bgcolor: 'background.elevated' },
            }}
          >
            <Box
              sx={{
                width: 17,
                height: 17,
                borderRadius: '5px',
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: on ? member.color : 'transparent',
                border: on ? `1px solid ${member.color}` : '1.5px solid',
                borderColor: on ? member.color : 'text.disabled',
              }}
            >
              {on && <CheckIcon sx={{ fontSize: 12, color: '#fff' }} />}
            </Box>
            <Avatar m={member} on={on} />
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
              <Box component="span" sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                {member.name}
              </Box>
              {member.role && (
                <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
                  {member.role}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={(t) => ({ height: '1px', bgcolor: t.palette.divider, mx: '14px', my: '6px' })} />

      {/* 일정 종류 */}
      <Box sx={{ p: '4px 14px 16px' }}>
        <Box sx={SECTION_LABEL}>일정 종류</Box>
        {cats.map((c) => (
          <Box
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onToggleCat(c.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleCat(c.id)
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              p: '7px 8px',
              borderRadius: '9px',
              cursor: 'pointer',
              opacity: c.on ? 1 : 0.5,
              transition: 'background .12s, opacity .12s',
              '&:hover': { bgcolor: 'background.elevated' },
            }}
          >
            <Box
              sx={{
                width: 13,
                height: 13,
                borderRadius: '4px',
                flex: 'none',
                bgcolor: c.on ? c.color : 'transparent',
                border: c.on ? 'none' : '1.5px solid',
                borderColor: c.on ? 'transparent' : 'text.disabled',
                boxShadow: c.on ? `inset 0 0 0 1px ${alpha('#000', 0.04)}` : 'none',
              }}
            />
            <Box component="span" sx={{ fontSize: 13, fontWeight: 500, color: 'text.secondary', flex: 1 }}>
              {c.label}
            </Box>
            <Box component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
              {c.count}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
