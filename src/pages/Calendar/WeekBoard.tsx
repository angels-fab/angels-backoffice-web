import { useMemo } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import type { CalEvent } from '@/types'
import { CAT_META } from './catMeta'
import { given, memberById, membersForEvent, eventContent, eventParticipants, splitPlacePurpose, type TeamMember } from './members'
import ChipContent from './ChipContent'
import ChipTooltip, { type EventDetail } from './ChipTooltip'

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
  showWeekends: boolean
}

/**
 * 요일 글자색 — 달력 관례(일=빨강·토=파랑)는 유지하되 색은 **글자용** 토큰을 쓴다.
 * 구 하드코딩 #E0726B/#6AA0E8 은 채움색 계열이라 라이트 표면에서 대비가 얕았다
 * (채움은 accent, 글자는 accentText — tokens.ts 규칙). 평일은 상속 유지.
 */
function dowColor(t: Theme, dow: number): string {
  return dow === 0 ? t.palette.accentText.red : dow === 6 ? t.palette.accentText.blue : 'inherit'
}

function Chip({ ev }: { ev: CalEvent }) {
  const color = CAT_META[ev.cat].color
  const time = ev.allDay ? '' : ev.start.slice(11, 16)
  const content = eventContent(ev.title, ev.cat) || ev.title
  const { place, purpose } = splitPlacePurpose(content)
  const detail: EventDetail = {
    catLabel: CAT_META[ev.cat].label,
    catColor: color,
    time,
    purpose: purpose || content,
    place,
    members: eventParticipants(ev.title),
  }
  return (
    <ChipTooltip detail={detail}>
      <Box
        sx={{
          p: '2px 7px 2px 8px',
          borderRadius: `${radius.chip}px`,
          borderLeft: `3px solid ${color}`,
          bgcolor: alpha(color, 0.18),
          fontSize: typescale.small.size,
          color: 'text.primary',
          lineHeight: 1.5,
          minWidth: 0,
        }}
      >
        <ChipContent
          participants={eventParticipants(ev.title).map((n) => ({ initials: given(n), color: memberById(n).color }))}
          catKey={ev.cat}
          catColor={color}
          time={time}
          title={content}
        />
      </Box>
    </ChipTooltip>
  )
}

const CELL = {
  borderRight: '1px solid',
  borderBottom: '1px solid',
  borderColor: 'divider',
} as const

/** 주간 — 팀원(행) × 요일(열) 스위밍레인 보드. FullCalendar로는 표현 불가해 직접 구현. */
export default function WeekBoard({ weekStart, members, events, todayKey, showWeekends }: WeekBoardProps) {
  const days = useMemo(() => {
    const all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    return showWeekends ? all : all.filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
  }, [weekStart, showWeekends])

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
        borderRadius: `${radius.card}px`,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: `158px repeat(${days.length}, minmax(0, 1fr))` }}>
        {/* 헤더 행 */}
        <Box
          sx={{
            ...CELL,
            p: '12px 14px',
            fontSize: typescale.caption.size,
            fontWeight: weight.bold,
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
              <Box component="span" sx={(t) => ({ fontSize: typescale.caption.size, fontWeight: weight.semibold, color: dowColor(t, dow) })}>
                {DOW[dow]}
              </Box>
              <Box
                component="span"
                sx={
                  isToday
                    ? {
                        fontSize: typescale.body.size,
                        fontWeight: weight.bold,
                        color: 'common.white',
                        bgcolor: 'primary.main',
                        width: 22,
                        height: 22,
                        borderRadius: radius.circle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : { fontSize: typescale.emphasis.size, fontWeight: weight.bold, color: 'text.secondary' }
                }
              >
                {d.getDate()}
              </Box>
            </Box>
          )
        })}

        {/* 팀원 행들 */}
        {members.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', p: 4, textAlign: 'center', color: 'text.disabled', fontSize: typescale.body.size }}>
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
                  borderRadius: radius.circle,
                  bgcolor: m.color,
                  color: 'common.white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: typescale.small.size,
                  fontWeight: weight.bold,
                  flex: 'none',
                  letterSpacing: '-0.02em',
                }}
              >
                {given(m.name)}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, minWidth: 0 }}>
                <Box component="span" sx={{ fontSize: typescale.body.size, fontWeight: weight.semibold, color: 'text.primary' }}>
                  {m.name}
                </Box>
                {m.role && (
                  <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled' }}>
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
                    bgcolor: isToday ? alpha(accent.blue, 0.06) : 'transparent',
                  }}
                >
                  {cellEvents.map((ev) => (
                    <Chip key={ev.id + ev.date} ev={ev} />
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
