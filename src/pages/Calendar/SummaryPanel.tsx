import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { AppCard, StatusChip, EmptyState } from '@/components/ds'
import { todaySeoul } from '@/utils/date'
import type { CalEvent } from '@/types'
import { CAT_META } from './catMeta'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
type GroupKey = 'today' | 'week' | 'upcoming'
type Tone = 'info' | 'success' | 'amber'

interface WithMeta extends CalEvent {
  d: Date
  diff: number
}

function DDayBadge({ diff }: { diff: number }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0, fontSize: 11, fontWeight: 700, px: 0.75, py: '2px', borderRadius: '8px',
        color: diff <= 2 ? 'warning.main' : 'text.secondary', bgcolor: 'background.elevated',
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
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(e) } }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1, py: 1, cursor: 'pointer',
        borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
        '&:hover': { bgcolor: 'background.elevated' }, borderRadius: 1, px: 0.5,
      }}
    >
      <Box component="span" sx={{ flexShrink: 0, minWidth: 52, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: leftColor || 'text.secondary' }}>{left}</Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</Typography>
      {dday != null && <DDayBadge diff={dday} />}
      <StatusChip status={meta.status} label={meta.label.split('/')[0]} />
    </Box>
  )
}

function KpiCard({ label, value, tone, selected, onClick }: { label: string; value: number; tone: Tone; selected: boolean; onClick: () => void }) {
  return (
    <AppCard
      interactive
      onClick={onClick}
      ariaLabel={`${label} 일정 ${value}건`}
      padding={14}
      sx={(t) => {
        const c = tone === 'info' ? t.palette.accent.blue : tone === 'success' ? t.palette.accent.green : t.palette.accent.amber
        return {
          ...(selected ? { borderColor: c, bgcolor: alpha(c, 0.12) } : {}),
          '&:hover': { borderColor: c, bgcolor: alpha(c, selected ? 0.16 : 0.07) },
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: { xs: 26, sm: 32 }, fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
        <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary' }}>건</Typography>
      </Box>
      <Typography sx={{ textAlign: 'center', mt: 0.5, fontSize: 13, fontWeight: 600, color: 'text.secondary' }}>{label}</Typography>
    </AppCard>
  )
}

export interface SummaryPanelProps {
  events: CalEvent[]
  onPick: (e: CalEvent) => void
}

/**
 * 일정 요약 — 상단 KPI 카드(오늘/이번주/다가오는). 카드 선택 시 해당 일정 목록을 아래에 표시.
 */
export default function SummaryPanel({ events, onPick }: SummaryPanelProps) {
  const today = todaySeoul()
  const [sel, setSel] = useState<GroupKey>('today')

  const { todayList, weekList, future } = useMemo(() => {
    const todayMid = new Date(today + 'T00:00:00')
    const dow = todayMid.getDay()
    const weekEnd = new Date(todayMid.getTime() + (6 - dow) * 86400000)
    const withMeta = (e: CalEvent): WithMeta => {
      const d = new Date(e.date + 'T00:00:00')
      return { ...e, d, diff: Math.round((d.getTime() - todayMid.getTime()) / 86400000) }
    }
    const dedupe = (arr: WithMeta[]) => {
      const seen = new Set<string>()
      return arr.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    }
    const timeSort = (a: WithMeta, b: WithMeta) => {
      const aAll = a.time === '종일', bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    }
    const all = events.map(withMeta)
    const todayList = dedupe(all.filter((e) => e.date === today).sort(timeSort))
    const weekList = dedupe(all.filter((e) => e.diff >= 0 && e.d <= weekEnd).sort((a, b) => a.d.getTime() - b.d.getTime() || timeSort(a, b)))
    const future = dedupe(all.filter((e) => e.diff >= 1).sort((a, b) => a.d.getTime() - b.d.getTime()))
    return { todayList, weekList, future }
  }, [events, today])

  const list = sel === 'today' ? todayList : sel === 'week' ? weekList : future

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, '& > *': { minWidth: 0 } }}>
        <KpiCard label="오늘" value={todayList.length} tone="info" selected={sel === 'today'} onClick={() => setSel('today')} />
        <KpiCard label="이번주" value={weekList.length} tone="success" selected={sel === 'week'} onClick={() => setSel('week')} />
        <KpiCard label="다가오는" value={future.length} tone="amber" selected={sel === 'upcoming'} onClick={() => setSel('upcoming')} />
      </Box>

      <AppCard padding={0}>
        {list.length === 0 ? (
          <EmptyState size="sm" title={sel === 'today' ? '오늘 일정이 없습니다' : sel === 'week' ? '이번주 일정이 없습니다' : '다가오는 일정이 없습니다'} />
        ) : (
          <Box sx={{ maxHeight: 280, overflowY: 'auto', p: 1.5 }}>
            {list.map((e, i) => (
              <EventRow
                key={`${e.id}-${i}`}
                e={e}
                left={sel === 'today'
                  ? (e.time === '종일' ? '종일' : e.time.slice(0, 5))
                  : `${String(e.d.getMonth() + 1).padStart(2, '0')}/${String(e.d.getDate()).padStart(2, '0')}(${DOW[e.d.getDay()]})`}
                leftColor={sel === 'today' ? 'primary.main' : undefined}
                dday={sel === 'today' ? undefined : e.diff}
                onPick={onPick}
              />
            ))}
          </Box>
        )}
      </AppCard>
    </Box>
  )
}
