import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { CalEvent } from '@/types'
import { CAT_META } from './catMeta'
import { cleanTitle, given, membersForEvent, type TeamMember } from './members'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export interface WeekBoardProps {
  weekStart: Date
  members: TeamMember[]
  /** 카테고리 활성 필터를 이미 통과한 '일자별' 일정 목록 */
  events: CalEvent[]
  todayKey: string
  onSelect: (ev: CalEvent) => void
}

function dowColor(dow: number): string {
  return dow === 0 ? '#E0726B' : dow === 6 ? '#6AA0E8' : 'inherit'
}

function Chip({ ev, onSelect }: { ev: CalEvent; onSelect: (e: CalEvent) => void }) {
  const color = CAT_META[ev.cat].color
  const startTime = ev.allDay ? '' : ev.start.slice(11, 16)
  const text = (startTime ? startTime + ' ' : '') + cleanTitle(ev.title)
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(ev)
        }
      }}
      title={ev.title}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        p: '2px 7px',
        borderRadius: '6px',
        bgcolor: alpha(color, 0.18),
        fontSize: 12,
        color: 'text.primary',
        cursor: 'pointer',
        lineHeight: 1.5,
        minWidth: 0,
        transition: 'filter .12s',
        '&:hover': { filter: 'brightness(1.12)' },
      }}
    >
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flex: 'none' }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {text}
      </Box>
    </Box>
  )
}

const CELL = {
  borderRight: '1px solid',
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const

/** 주간 — 팀원(행) × 요일(열) 스위밍레인 보드. FullCalendar로는 표현 불가해 직접 구현. */
export default function WeekBoard({ weekStart, members, events, todayKey, onSelect }: WeekBoardProps) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // (memberId|dateKey) → events
  const byCell = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const ev of events) {
      const mems = membersForEvent(ev.title)
      for (const mid of mems) {
        const k = mid + '|' + ev.date
        const arr = map.get(k)
        if (arr) arr.push(ev)
        else map.set(k, [ev])
      }
    }
    const timeOf = (e: CalEvent) => (e.allDay ? '' : e.start.slice(11, 16))
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return timeOf(a).localeCompare(timeOf(b))
      })
    }
    return map
  }, [events])

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '158px repeat(7, minmax(0, 1fr))' }}>
        {/* 헤더 행 */}
        <Box
          sx={{
            ...CELL,
            p: '12px 14px',
            fontSize: 11,
            fontWeight: 700,
            color: 'text.disabled',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          팀원
        </Box>
        {days.map((d, i) => {
          const isToday = keyOf(d) === todayKey
          const dow = d.getDay()
          return (
            <Box
              key={'h' + i}
              sx={{
                ...CELL,
                p: '9px 8px 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                bgcolor: isToday ? 'background.elevated' : 'transparent',
              }}
            >
              <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: dowColor(dow) }}>
                {DOW[dow]}
              </Box>
              <Box
                component="span"
                sx={
                  isToday
                    ? {
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff',
                        bgcolor: 'primary.main',
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : { fontSize: 14, fontWeight: 700, color: 'text.secondary' }
                }
              >
                {d.getDate()}
              </Box>
            </Box>
          )
        })}

        {/* 팀원 행들 */}
        {members.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>
            표시할 팀원이 없습니다
          </Box>
        )}
        {members.map((m) => (
          <Box key={m.id} sx={{ display: 'contents' }}>
            <Box
              sx={{
                ...CELL,
                display: 'flex',
                alignItems: 'center',
                gap: 1.1,
                p: '8px 12px',
                bgcolor: 'background.default',
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: m.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flex: 'none',
                  letterSpacing: '-0.02em',
                }}
              >
                {given(m.name)}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                <Box component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.primary' }}>
                  {m.name}
                </Box>
                {m.role && (
                  <Box component="span" sx={{ fontSize: 10.5, color: 'text.disabled' }}>
                    {m.role}
                  </Box>
                )}
              </Box>
            </Box>
            {days.map((d, i) => {
              const isToday = keyOf(d) === todayKey
              const cellEvents = byCell.get(m.id + '|' + keyOf(d)) || []
              return (
                <Box
                  key={m.id + 'c' + i}
                  sx={{
                    ...CELL,
                    minHeight: 66,
                    p: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    bgcolor: isToday ? alpha('#5491DA', 0.06) : 'transparent',
                  }}
                >
                  {cellEvents.map((ev) => (
                    <Chip key={ev.id + ev.date} ev={ev} onSelect={onSelect} />
                  ))}
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
