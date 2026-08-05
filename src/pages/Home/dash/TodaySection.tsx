import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { todaySeoul } from '@/utils/date'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import { CAT_META } from '@/pages/Calendar/catMeta'
import type { RealCat } from '@/pages/Calendar/catMeta'
import { CAT_ICON } from '@/pages/Calendar/ChipContent'
import { eventContent, eventMembers, given, memberById } from '@/pages/Calendar/members'
import type { CalEvent } from '@/types'
import { HomeCard } from './HomeCard'

/**
 * 홈 첫 카드 '오늘 일정' (2026-08-06 재정리).
 *
 * 앞선 '다가오는 일정'(2주 달력 + 남은 시간)은 한 카드에 담긴 정보가 많아 한눈에 안 읽혔다
 * (사용자 지적). 달력을 빼고 **오늘 것만** 한 줄씩 세운다 — 카드 하나에 한 가지 질문만 답한다.
 *
 * 한 줄 = 시각 · 종류 아이콘 · 제목 · 해당자 칩. 업무일정 화면의 일정 칩과 같은 표기라
 * 두 화면을 오갈 때 같은 것으로 읽힌다. 아직 안 끝난 첫 일정만 파랗게 세우고 남은 시간을 붙인다.
 *
 * 남은 시간은 1분 단위로만 갱신하고(초 카운트다운 없음) 사라질 때 타이머를 정리한다.
 */

/** 카드에 세울 최대 줄 수 — 넘치면 'N건 더'로 접고 캘린더로 보낸다 */
const ROWS = 5
/** 남은 시간 갱신 주기 — 분 단위 */
const TICK_MS = 60_000

const isAllDay = (e: CalEvent) => e.allDay || e.time === '종일'

/** 일정의 시작 시각 — 종일이면 그날 0시. 브라우저 시간대가 KST 라는 전제는 기존 화면과 동일하다 */
function startOf(e: CalEvent, dateKey: string): Date {
  if (isAllDay(e)) return new Date(dateKey + 'T00:00:00')
  return new Date(`${dateKey}T${e.time.slice(0, 5)}:00`)
}

/** 일정의 종료 시각 — 없으면 시작 + 1시간(진행 중 판정용 근사) */
function endOf(e: CalEvent, dateKey: string): Date {
  if (isAllDay(e)) return new Date(dateKey + 'T23:59:59')
  const parts = e.time.split('-')
  if (parts[1]) return new Date(`${dateKey}T${parts[1].slice(0, 5)}:00`)
  return new Date(startOf(e, dateKey).getTime() + 3600_000)
}

/** 남은 시간 — 1시간 이내는 분, 그 위는 시간+분. 이미 시작했으면 '진행 중' */
function remainText(e: CalEvent, dateKey: string, now: Date): string {
  const s = startOf(e, dateKey)
  if (now >= s) return '진행 중'
  const min = Math.floor((s.getTime() - now.getTime()) / 60_000)
  if (min < 60) return `${Math.max(min, 0)}분 후`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간 후` : `${h}시간 ${m}분 후`
}

/** 종류 아이콘 — 업무일정 화면의 일정 칩과 같은 아이콘·같은 글자용 색(원색은 틴트 위에서 사라진다) */
function CatIcon({ cat }: { cat: string }) {
  const key = (CAT_META[cat as RealCat] ? cat : 'etc') as RealCat
  const Icon = CAT_ICON[key]
  const tone = CAT_META[key].tone
  return (
    // 종류 글자를 따로 두지 않으므로 이름은 아이콘에 붙여 읽히게 한다
    <Icon
      titleAccess={CAT_META[key].label}
      sx={{
        fontSize: typescale.cardTitle.size, flexShrink: 0,
        color: tone === 'neutral' ? 'text.secondary' : `accentText.${tone}`,
        ...(key === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}),
      }}
    />
  )
}

/** 해당자 칩 — 업무일정 화면의 이름 칩과 같은 모양·같은 색(사람마다 고정색 managerColor) */
function MemberChips({ title, max = 2 }: { title: string; max?: number }) {
  const ids = eventMembers(title)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
      {ids.slice(0, max).map((id) => {
        const m = memberById(id)
        return (
          <Box
            key={id}
            component="span"
            sx={{
              height: 19, display: 'inline-flex', alignItems: 'center', px: '5px',
              borderRadius: `${radius.chip}px`, bgcolor: m.color, color: 'common.white',
              fontSize: typescale.small.size, fontWeight: weight.semibold, lineHeight: 1,
              whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,.28)',
            }}
          >
            {given(m.name)}
          </Box>
        )
      })}
      {ids.length > max && (
        <Box component="span" sx={{ fontSize: typescale.small.size, color: 'text.disabled' }}>+{ids.length - max}</Box>
      )}
    </Box>
  )
}

export default function TodaySection({ events: givenEvents, now: nowProp }: { events?: CalEvent[]; now?: Date } = {}) {
  const navigate = useNavigate()
  const storeReady = useAppSelector((s) => s.cal.ready)
  const storeEvents = useAppSelector((s) => s.cal.events)
  const events = givenEvents ?? storeEvents
  const ready = givenEvents ? true : storeReady

  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (nowProp) return
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [nowProp])
  const now = useMemo(() => nowProp ?? new Date(), [nowProp, tick])
  const today = nowProp
    ? `${nowProp.getFullYear()}-${String(nowProp.getMonth() + 1).padStart(2, '0')}-${String(nowProp.getDate()).padStart(2, '0')}`
    : todaySeoul()

  // 종일 먼저, 그다음 시간순 — 종일은 하루 전체라 맨 위가 자연스럽다
  const list = useMemo(
    () =>
      events
        .filter((e) => e.date === today)
        .sort((a, b) => {
          if (isAllDay(a) !== isAllDay(b)) return isAllDay(a) ? -1 : 1
          return a.time.localeCompare(b.time)
        }),
    [events, today],
  )

  // 남은 시간을 붙일 대상 = 아직 안 끝난 첫 '시간' 일정. 종일은 대상이 아니다(하루 종일이라 셀 게 없다)
  const nextId = list.find((e) => !isAllDay(e) && endOf(e, today) > now)?.id ?? null

  return (
    <HomeCard
      icon={<CalendarMonthIcon sx={{ fontSize: iconSize.header, color: 'accentText.blue' }} />}
      title="오늘 일정"
      stat={{ value: list.length, unit: '건' }}
      actionLabel="캘린더"
      onAction={() => navigate('/calendar')}
    >
      {!ready ? (
        <LoadingState size="md" />
      ) : list.length === 0 ? (
        <EmptyState size="sm" title="오늘 예정된 일정이 없습니다" />
      ) : (
        <Box>
          {list.slice(0, ROWS).map((e, i) => {
            const isNext = e.id === nextId
            return (
              <Box
                key={`${e.id}-${i}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 1,
                  borderTop: i === 0 ? 0 : 1, borderColor: 'divider', minWidth: 0,
                }}
              >
                <Typography
                  sx={{
                    flexShrink: 0, width: 42, fontSize: typescale.small.size, fontVariantNumeric: 'tabular-nums',
                    fontWeight: isNext ? weight.bold : weight.medium,
                    color: isNext ? 'primary.main' : 'text.disabled',
                  }}
                >
                  {isAllDay(e) ? '종일' : e.time.slice(0, 5)}
                </Typography>
                <CatIcon cat={e.cat} />
                <Typography
                  sx={{
                    flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontSize: typescale.emphasis.size,
                    fontWeight: isNext ? weight.bold : typescale.emphasis.weight,
                    color: isNext ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {eventContent(e.title, e.cat)}
                </Typography>
                {/* 남은 시간은 '다음 차례' 한 줄에만 — 모든 줄에 붙이면 다시 읽을 것이 많아진다 */}
                {isNext && (
                  <Typography sx={{ flexShrink: 0, fontSize: typescale.small.size, fontWeight: weight.bold, color: 'primary.main' }}>
                    {remainText(e, today, now)}
                  </Typography>
                )}
                <MemberChips title={e.title} />
              </Box>
            )
          })}
          {list.length > ROWS && (
            <Typography sx={{ mt: 1, fontSize: typescale.small.size, color: 'text.disabled' }}>
              {list.length - ROWS}건 더
            </Typography>
          )}
        </Box>
      )}
    </HomeCard>
  )
}
