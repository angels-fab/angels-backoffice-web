import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, SectionHeader, EmptyState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { hexA } from '@/utils/color'
import { todaySeoul } from '@/utils/date'
import { accent } from '@/theme/tokens'
import type { CalEvent } from '@/types'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** 일정 유형 배지 (캘린더 카테고리 색) */
function TypeBadge({ cat }: { cat: CalEvent['cat'] }) {
  const c = CAL_CAT_MAP[cat]
  const color = c?.color || accent.blue
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 600,
        px: 0.75,
        py: '2px',
        borderRadius: '8px',
        color,
        bgcolor: hexA(color, 0.14),
        border: `1px solid ${hexA(color, 0.32)}`,
      }}
    >
      {c?.label || '기타'}
    </Box>
  )
}

function ScheduleRow({ left, title, right, leftColor }: { left: string; title: string; right?: ReactNode; leftColor?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box
        component="span"
        sx={{
          flexShrink: 0,
          minWidth: 64,
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'monospace',
          color: leftColor || 'text.secondary',
        }}
      >
        {left}
      </Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {right}
    </Box>
  )
}

/**
 * Section 2 — 오늘 일정(중요도 최상) + 다가오는 일정(7일).
 * 캘린더 이벤트에는 담당자 필드가 없어 시간·유형·장소로 표시한다.
 */
export default function ScheduleSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.cal.ready)
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()
  const todayMid = new Date(today + 'T00:00:00')

  // 오늘 일정 — 종일 먼저, 그다음 시간순
  const todayList = events
    .filter((e) => e.date === today)
    .sort((a, b) => {
      const aAll = a.time === '종일'
      const bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    })

  // 다가오는 일정 — 향후 1~7일, id 기준 dedupe(가장 이른 날짜), 날짜순 5건
  const seen = new Set<string>()
  const upcoming = events
    .map((e) => ({ ...e, d: new Date(e.date + 'T00:00:00') }))
    .map((e) => ({ ...e, diff: Math.round((e.d.getTime() - todayMid.getTime()) / 86400000) }))
    .filter((e) => e.diff >= 1 && e.diff <= 7)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .slice(0, 5)

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: 2 }}>
      {/* 오늘 일정 */}
      <AppCard>
        <SectionHeader title="오늘 일정" count={`${todayList.length}건`} actionLabel="캘린더" onAction={() => navigate('/calendar')} />
        {!ready ? (
          <Typography variant="body2">불러오는 중…</Typography>
        ) : todayList.length === 0 ? (
          <EmptyState size="sm" title="오늘 예정된 일정이 없습니다" />
        ) : (
          <Box>
            {todayList.map((e, i) => (
              <ScheduleRow
                key={`${e.id}-${i}`}
                left={e.time === '종일' ? '종일' : e.time.slice(0, 5)}
                leftColor="primary.main"
                title={e.title}
                right={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {e.loc && (
                      <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>
                        {e.loc}
                      </Typography>
                    )}
                    <TypeBadge cat={e.cat} />
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </AppCard>

      {/* 다가오는 일정 */}
      <AppCard>
        <SectionHeader title="다가오는 일정" description="향후 7일" />
        {!ready ? (
          <Typography variant="body2">불러오는 중…</Typography>
        ) : upcoming.length === 0 ? (
          <EmptyState size="sm" title="다가오는 일정이 없습니다" />
        ) : (
          <Box>
            {upcoming.map((e, i) => (
              <ScheduleRow
                key={`${e.id}-${i}`}
                left={`${String(e.d.getMonth() + 1).padStart(2, '0')}/${String(e.d.getDate()).padStart(2, '0')}(${DOW[e.d.getDay()]})`}
                title={e.title}
                right={
                  <Box
                    component="span"
                    sx={{
                      flexShrink: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      px: 0.75,
                      py: '2px',
                      borderRadius: '8px',
                      color: e.diff <= 2 ? 'warning.main' : 'text.secondary',
                      bgcolor: 'background.elevated',
                    }}
                  >
                    {`D-${e.diff}`}
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </AppCard>
    </Box>
  )
}
