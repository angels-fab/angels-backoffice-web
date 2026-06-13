import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, SectionHeader, StatusChip, EmptyState } from '@/components/ds'
import { todaySeoul } from '@/utils/date'
import type { CalEvent } from '@/types'
import { CAT_META } from './catMeta'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

interface WithMeta extends CalEvent {
  d: Date
  diff: number
}

function StatMini({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ flex: 1, textAlign: 'center', py: 1, borderRadius: 2, bgcolor: 'background.elevated' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
        {label}
      </Typography>
    </Box>
  )
}

function DDayBadge({ diff }: { diff: number }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        px: 0.75,
        py: '2px',
        borderRadius: '8px',
        color: diff <= 2 ? 'warning.main' : 'text.secondary',
        bgcolor: 'background.elevated',
      }}
    >
      {diff === 0 ? 'D-DAY' : `D-${diff}`}
    </Box>
  )
}

function EventRow({ e, left, leftColor, dday, onPick }: { e: CalEvent; left: string; leftColor?: string; dday?: number; onPick: (e: CalEvent) => void }) {
  const meta = CAT_META[e.cat]
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`일정: ${e.title}`}
      onClick={() => onPick(e)}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          onPick(e)
        }
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1,
        cursor: 'pointer',
        borderBottom: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: 'background.elevated' },
        borderRadius: 1,
        px: 0.5,
      }}
    >
      <Box component="span" sx={{ flexShrink: 0, minWidth: 52, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: leftColor || 'text.secondary' }}>
        {left}
      </Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {e.title}
      </Typography>
      {dday != null && <DDayBadge diff={dday} />}
      <StatusChip status={meta.status} label={meta.label.split('/')[0]} />
    </Box>
  )
}

export interface SummaryPanelProps {
  events: CalEvent[]
  onPick: (e: CalEvent) => void
}

/**
 * 일정 요약 패널 — 오늘 / 이번주 / 다가오는(D-Day). 항목 클릭 시 상세 드로어 연동.
 */
export default function SummaryPanel({ events, onPick }: SummaryPanelProps) {
  const today = todaySeoul()
  const todayMid = new Date(today + 'T00:00:00')
  const dow = todayMid.getDay()
  const weekEnd = new Date(todayMid.getTime() + (6 - dow) * 86400000)

  // 오늘 일정(id dedupe, 시간순, 종일 먼저)
  const seenToday = new Set<string>()
  const todayList = events
    .filter((e) => e.date === today)
    .filter((e) => (seenToday.has(e.id) ? false : (seenToday.add(e.id), true)))
    .sort((a, b) => {
      const aAll = a.time === '종일'
      const bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    })

  // 다가오는(오늘 이후) — id 기준 dedupe, 날짜순
  const seen = new Set<string>()
  const future: WithMeta[] = events
    .map((e) => {
      const d = new Date(e.date + 'T00:00:00')
      return { ...e, d, diff: Math.round((d.getTime() - todayMid.getTime()) / 86400000) }
    })
    .filter((e) => e.diff >= 1)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))

  const weekCount = new Set(events.filter((e) => e.date >= today && new Date(e.date + 'T00:00:00') <= weekEnd).map((e) => e.id)).size

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <StatMini label="오늘" value={todayList.length} />
        <StatMini label="이번주" value={weekCount} />
        <StatMini label="다가오는" value={future.length} />
      </Box>

      <AppCard padding={18}>
        <SectionHeader title="오늘 일정" count={`${todayList.length}건`} />
        {todayList.length === 0 ? (
          <EmptyState size="sm" title="오늘 일정이 없습니다" />
        ) : (
          <Box>
            {todayList.map((e, i) => (
              <EventRow key={`${e.id}-${i}`} e={e} left={e.time === '종일' ? '종일' : e.time.slice(0, 5)} leftColor="primary.main" onPick={onPick} />
            ))}
          </Box>
        )}
      </AppCard>

      <AppCard padding={18}>
        <SectionHeader title="다가오는 일정" description="가까운 순" />
        {future.length === 0 ? (
          <EmptyState size="sm" title="다가오는 일정이 없습니다" />
        ) : (
          <Box>
            {future.slice(0, 7).map((e) => (
              <EventRow
                key={e.id}
                e={e}
                left={`${String(e.d.getMonth() + 1).padStart(2, '0')}/${String(e.d.getDate()).padStart(2, '0')}(${DOW[e.d.getDay()]})`}
                dday={e.diff}
                onPick={onPick}
              />
            ))}
          </Box>
        )}
      </AppCard>
    </Box>
  )
}
