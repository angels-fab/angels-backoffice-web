import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { EmptyState, LoadingState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { hexA } from '@/utils/color'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import { catTextColor, toneOfColor } from '@/pages/Calendar/catMeta'
import { FAB_EVENTS } from '@/constants/events'
import type { CalEvent } from '@/types'
import { HomeCard, HomeRow, HomeMeta } from './HomeCard'


/** 유형 배지 — 캘린더 카테고리 색 또는 행사 자체 색을 그대로 쓴다 */
function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: typescale.small.size,
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

/** 카드에 보여줄 줄 수 — 나머지는 '캘린더'로. 읽을 거리를 줄이는 게 목적이다(2026-08-05 간소화) */
const ROWS = 3

/**
 * 홈 '오늘·이번 주' — 오늘 일정과 앞으로 7일을 **한 카드**로.
 *
 * 종전에는 '오늘 일정'과 '다가오는 일정'이 따로였는데, 둘을 나눠 읽을 이유가 없다는 판단으로 합쳤다
 * (사용자: 일일이 읽지 않는다 → 카드 수와 줄 수를 줄인다). 행사(FAB_EVENTS)도 같은 줄기에 섞는다.
 * 개수는 위쪽 요약 숫자(HomeKpi)가 담당하므로 여기서는 가장 임박한 3건만 보여준다.
 */
export default function ScheduleSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.cal.ready)
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()
  const todayMid = new Date(today + 'T00:00:00')

  // 오늘 — 종일 먼저, 그다음 시간순
  const todayList = events
    .filter((e) => e.date === today)
    .sort((a, b) => {
      const aAll = a.time === '종일'
      const bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    })
    .map((e, i) => ({ key: `t-${e.id}-${i}`, when: e.time === '종일' ? '종일' : e.time.slice(0, 5), today: true, title: e.title, badge: <CatBadge cat={e.cat} /> }))

  // 앞으로 7일 — 같은 일정이 여러 날에 걸치면 가장 이른 날 하나만(id dedupe)
  const seen = new Set<string>()
  const soon = events
    .map((e) => ({ ...e, d: new Date(e.date + 'T00:00:00') }))
    .map((e) => ({ ...e, diff: Math.round((e.d.getTime() - todayMid.getTime()) / 86400000) }))
    .filter((e) => e.diff >= 1 && e.diff <= 7)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .map((e) => ({ key: e.id, d: e.d, title: e.title, badge: <CatBadge cat={e.cat} /> }))
  const soonEvents = FAB_EVENTS
    .map((ev) => ({ ...ev, d: new Date(ev.start + 'T00:00:00') }))
    .map((ev) => ({ ...ev, diff: Math.round((ev.d.getTime() - todayMid.getTime()) / 86400000) }))
    .filter((ev) => ev.diff >= 1 && ev.diff <= 7)
    // 행사는 자기 강조색(accent)과 구분(kind)을 그대로 보여 캘린더 일정과 섞여도 출처가 읽힌다
    .map((ev) => ({ key: `ev-${ev.id}`, d: ev.d, title: ev.title, badge: <TypeBadge label={ev.kind} color={accent[ev.accent ?? 'blue']} /> }))

  const upcoming = [...soon, ...soonEvents]
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((e) => ({
      key: e.key,
      when: `${String(e.d.getMonth() + 1).padStart(2, '0')}/${String(e.d.getDate()).padStart(2, '0')}`,
      today: false,
      title: e.title,
      badge: e.badge,
    }))

  const list = [...todayList, ...upcoming].slice(0, ROWS)
  const total = todayList.length + upcoming.length

  return (
    <HomeCard title="오늘·이번 주" count={`${total}건`} actionLabel="캘린더" onAction={() => navigate('/calendar')}>
      {!ready ? (
        <LoadingState size="md" />
      ) : list.length === 0 ? (
        <EmptyState size="sm" title="예정된 일정이 없습니다" />
      ) : (
        list.map((e) => (
          <HomeRow
            key={e.key}
            lead={<HomeMeta mono color={e.today ? 'primary.main' : undefined}>{e.today ? e.when : e.when}</HomeMeta>}
            title={e.title}
            trail={e.badge}
          />
        ))
      )}
    </HomeCard>
  )
}
