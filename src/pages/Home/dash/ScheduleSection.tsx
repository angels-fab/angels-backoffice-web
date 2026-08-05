import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, SectionHeader, EmptyState, LoadingState, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { useUnseenItems, MENU_LABEL } from '@/layouts/useNavBadges'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { hexA } from '@/utils/color'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import { catTextColor, toneOfColor } from '@/pages/Calendar/catMeta'
import { FAB_EVENTS } from '@/constants/events'
import type { CalEvent } from '@/types'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

/** 유형 배지 — 캘린더 카테고리 색 또는 행사 자체 색을 그대로 쓴다 */
function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: typescale.caption.size,
        fontWeight: weight.semibold,
        px: 0.75,
        py: '2px',
        borderRadius: `${radius.chip}px`,
        // 글자는 채움색(accent)이 아니라 글자용 값 — 14% 틴트 면 위에서 accent 는 2.83:1 로 무너진다
        color: (th) => catTextColor(th, toneOfColor(color)),
        bgcolor: hexA(color, 0.14),
        border: `1px solid ${hexA(color, 0.32)}`,
      }}
    >
      {label}
    </Box>
  )
}

/** 캘린더 카테고리 배지 — 라벨·색을 카테고리 표에서 찾아 넘긴다 */
function CatBadge({ cat }: { cat: CalEvent['cat'] }) {
  const c = CAL_CAT_MAP[cat]
  return <TypeBadge label={c?.label || '기타'} color={c?.color || accent.blue} />
}

/** subLeft = 날짜 아래 시간(있을 때만) — 종일·행사는 비운다 */
function ScheduleRow({ left, subLeft, title, right, leftColor }: { left: string; subLeft?: string; title: string; right?: ReactNode; leftColor?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box
        sx={{
          flexShrink: 0,
          minWidth: 64,
          fontSize: typescale.small.size,
          fontWeight: weight.bold,
          fontFamily: 'monospace',
          color: leftColor || 'text.secondary',
          lineHeight: 1.35,
        }}
      >
        {left}
        {subLeft && (
          <Box component="span" sx={{ display: 'block', fontWeight: weight.medium, color: 'text.disabled' }}>
            {subLeft}
          </Box>
        )}
      </Box>
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: typescale.emphasis.size, fontWeight: weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {right}
    </Box>
  )
}

/** 출처별 칩 색 — 알림 센터와 같은 의미 계열(공지=파랑·업무=초록·개선=앰버) */
const MENU_KIND: Record<string, StatusKind> = { notice: 'info', work: 'success', improve: 'warning' }

/** 'YYYY-MM-DD' → 오늘/어제/N일 전 (7일 규칙 안에서만 쓴다) */
function relDay(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (isNaN(d.getTime())) return date
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const n = Math.round((t.getTime() - d.getTime()) / 86400000)
  return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`
}

/**
 * 안 본 새 글 — 상단바 알림 센터와 **같은 모집단**(7일 내 글 중 내가 안 본 것, useUnseenItems).
 * 벨은 눌러야 보이고 홈은 열자마자 보이므로, 아침에 한 번 훑는 자리로 홈에도 둔다(사용자 확정 2026-08-05).
 */
function UnseenCard() {
  const navigate = useNavigate()
  const items = useUnseenItems()

  return (
    <AppCard>
      <SectionHeader title="안 본 새 글" count={`${items.length}건`} />
      {items.length === 0 ? (
        <EmptyState size="sm" title="모두 확인했습니다" />
      ) : (
        <Box>
          {items.slice(0, 5).map((it) => (
            <Box
              key={`${it.menu}-${it.num}`}
              onClick={() => navigate(it.to)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 1, cursor: 'pointer',
                borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <StatusChip status={MENU_KIND[it.menu] || 'neutral'} label={MENU_LABEL[it.menu]} />
              <Typography sx={{ flex: 1, minWidth: 0, fontSize: typescale.emphasis.size, fontWeight: weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>{relDay(it.date)}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </AppCard>
  )
}

/**
 * 홈 '오늘' — 오늘 일정 + 안 본 새 글.
 * 하루 단위로 달라지는 것만 위쪽에 모은다(2026-08-05 홈 정리). 다가오는 일정은 아래 UpcomingSection.
 */
export default function ScheduleSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.cal.ready)
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()

  // 오늘 일정 — 종일 먼저, 그다음 시간순
  const todayList = events
    .filter((e) => e.date === today)
    .sort((a, b) => {
      const aAll = a.time === '종일'
      const bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    })

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: 2 }}>
      <AppCard>
        <SectionHeader title="오늘 일정" count={`${todayList.length}건`} actionLabel="캘린더" onAction={() => navigate('/calendar')} />
        {!ready ? (
          <LoadingState size="md" />
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
                    <CatBadge cat={e.cat} />
                  </Box>
                }
              />
            ))}
          </Box>
        )}
      </AppCard>

      <UnseenCard />
    </Box>
  )
}

/**
 * 홈 '다가오는 일정'(향후 7일) — 캘린더 일정 + 행사(FAB_EVENTS)를 한 줄기로.
 * 종전에는 '오늘 일정'과 한 섹션(2열)이었는데, 오늘 칸에 '안 본 새 글'을 넣으면서 분리했다.
 */
export function UpcomingSection() {
  const ready = useAppSelector((s) => s.cal.ready)
  const events = useAppSelector((s) => s.cal.events)
  const todayMid = new Date(todaySeoul() + 'T00:00:00')

  // 행사는 그동안 행사 페이지에만 있어 홈에서 안 보였다(행사 시작일이 이 창에 들면 함께 노출).
  // 창은 두 출처 공통으로 향후 1~7일. 캘린더는 id 기준 dedupe(가장 이른 날짜) 후 날짜순 5건.
  const seen = new Set<string>()
  const calUpcoming = events
    .map((e) => ({ ...e, d: new Date(e.date + 'T00:00:00') }))
    .map((e) => ({ ...e, diff: Math.round((e.d.getTime() - todayMid.getTime()) / 86400000) }))
    .filter((e) => e.diff >= 1 && e.diff <= 7)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .map((e) => ({
      key: e.id,
      d: e.d,
      diff: e.diff,
      title: e.title,
      // 시간 표기 — 종일은 왼쪽 날짜에 붙이지 않고 비운다(날짜만으로 충분)
      time: e.time === '종일' ? '' : e.time.slice(0, 5),
      badge: <CatBadge cat={e.cat} />,
    }))
  const eventUpcoming = FAB_EVENTS
    .map((ev) => ({ ...ev, d: new Date(ev.start + 'T00:00:00') }))
    .map((ev) => ({ ...ev, diff: Math.round((ev.d.getTime() - todayMid.getTime()) / 86400000) }))
    .filter((ev) => ev.diff >= 1 && ev.diff <= 7)
    .map((ev) => ({
      key: `ev-${ev.id}`,
      d: ev.d,
      diff: ev.diff,
      title: ev.title,
      time: '',
      // 행사는 자기 강조색(accent)과 구분(kind)을 그대로 보여 캘린더 일정과 섞여도 출처가 읽힌다
      badge: <TypeBadge label={ev.kind} color={accent[ev.accent ?? 'blue']} />,
    }))
  const upcoming = [...calUpcoming, ...eventUpcoming]
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, 5)

  return (
    <AppCard>
      {!ready ? (
        <LoadingState size="md" />
      ) : upcoming.length === 0 ? (
        <EmptyState size="sm" title="다가오는 일정이 없습니다" />
      ) : (
        <Box>
          {upcoming.map((e) => (
            <ScheduleRow
              key={e.key}
              left={`${String(e.d.getMonth() + 1).padStart(2, '0')}/${String(e.d.getDate()).padStart(2, '0')}(${DOW[e.d.getDay()]})`}
              subLeft={e.time}
              title={e.title}
              right={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                  {e.badge}
                  <Box
                    component="span"
                    sx={{
                      flexShrink: 0,
                      fontSize: typescale.small.size,
                      fontWeight: weight.bold,
                      px: 0.75,
                      py: '2px',
                      borderRadius: `${radius.chip}px`,
                      color: e.diff <= 2 ? 'warning.main' : 'text.secondary',
                      bgcolor: 'background.elevated',
                    }}
                  >
                    {`D-${e.diff}`}
                  </Box>
                </Box>
              }
            />
          ))}
        </Box>
      )}
    </AppCard>
  )
}
