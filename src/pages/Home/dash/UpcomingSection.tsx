import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ButtonBase from '@mui/material/ButtonBase'
import { EmptyState, LoadingState, focusRingSx } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { hexA } from '@/utils/color'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import { catTextColor, toneOfColor } from '@/pages/Calendar/catMeta'
import type { CalEvent } from '@/types'
import { HomeCard } from './HomeCard'

/**
 * 홈 첫 카드 '다가오는 일정' (2026-08-05 시안 — '오늘 일정' 대체 후보).
 *
 * 종전 '오늘 일정'은 오늘 것을 글로 읽는 카드였다. 정작 궁금한 건 "지금 다음이 뭐고 얼마나
 * 남았나"인데, 그건 목록을 눈으로 훑어야 알 수 있었다. 그래서 **남은 시간을 화면이 대신 계산해
 * 크게 보여주고**, 달력은 그 옆에서 '언제 몰려 있는지'만 모양으로 보여주는 구성으로 바꾼다.
 *
 *  - 왼쪽(넓게) = 2주 달력. 날짜를 누르면 오른쪽이 그 날짜 기준으로 바뀐다.
 *  - 오른쪽 = 고른 날짜의 다음 일정 한 건 + 남은 시간.
 *  - 모바일(768 미만)은 달력 아래로 내려 세로로 쌓는다.
 *
 * 데이터는 calSlice 가 날짜별로 펼쳐 둔 것을 그대로 쓴다(여러 날 일정은 날짜마다 같은 id).
 * events/now 를 넘기면 그 값으로 그린다 — 시안 화면(_UpcomingPreview)이 쓰는 통로다.
 */

/** 한 칸에 찍을 점 최대 개수 — 넘치면 마지막 점을 회색으로 바꿔 '더 있음'을 알린다 */
const MAX_DOTS = 3
/** 남은 시간 갱신 주기 — 분 단위(초 카운트다운은 쓰지 않는다) */
const TICK_MS = 60_000

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const colorOf = (cat: string) => CAL_CAT_MAP[cat]?.color || accent.blue
const labelOf = (cat: string) => CAL_CAT_MAP[cat]?.label || '기타'

/** 일정의 시작 시각 — 종일이면 그날 0시. 브라우저 시간대가 KST 라는 전제는 기존 화면과 동일하다 */
function startOf(e: CalEvent, dateKey: string): Date {
  if (e.allDay || e.time === '종일') return new Date(dateKey + 'T00:00:00')
  const t = e.time.slice(0, 5)
  return new Date(`${dateKey}T${t}:00`)
}

/** 일정의 종료 시각 — 없으면 시작 + 1시간(진행 중 판정용 근사) */
function endOf(e: CalEvent, dateKey: string): Date {
  if (e.allDay || e.time === '종일') return new Date(dateKey + 'T23:59:59')
  const parts = e.time.split('-')
  if (parts[1]) return new Date(`${dateKey}T${parts[1].slice(0, 5)}:00`)
  return new Date(startOf(e, dateKey).getTime() + 3600_000)
}

/**
 * 남은 시간 문구 — 사용자 확정 규칙(2026-08-05).
 * 종일 · 진행 중 · 1시간 이내 분 · 24시간 이내 시간+분 · 내일 이후 N일 후 · 지난 날짜.
 */
function remainText(e: CalEvent, dateKey: string, now: Date, todayKey: string): string {
  if (dateKey < todayKey) return '지난 일정'
  const gap = dayGap(dateKey, todayKey)
  const isAll = e.allDay || e.time === '종일'
  // 오늘이 아니면 시간이 아니라 날로 말한다(사용자 확정 2026-08-05).
  // 내일 10시를 '23시간 24분 후'라고 하면 바로 위 '내일 10:00' 과 겹쳐 읽히기만 한다.
  if (gap > 0) return gap === 1 ? (isAll ? '내일 종일' : '내일') : `${gap}일 후${isAll ? ' · 종일' : ''}`
  if (isAll) return '오늘 종일'
  const s = startOf(e, dateKey)
  const en = endOf(e, dateKey)
  if (now >= s && now < en) return '진행 중'
  if (now >= en) return '지난 일정'
  const min = Math.floor((s.getTime() - now.getTime()) / 60_000)
  if (min < 60) return `${Math.max(min, 0)}분 후`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}시간 후` : `${h}시간 ${m}분 후`
}

const dayGap = (a: string, b: string) =>
  Math.round((new Date(a + 'T00:00:00').getTime() - new Date(b + 'T00:00:00').getTime()) / 86_400_000)

/** '오늘 12:00' / '8.7(목) 14:00' / '오늘 종일' */
function whenText(e: CalEvent, dateKey: string, todayKey: string): string {
  const d = new Date(dateKey + 'T00:00:00')
  const gap = dayGap(dateKey, todayKey)
  const day = gap === 0 ? '오늘' : gap === 1 ? '내일' : gap === -1 ? '어제' : `${d.getMonth() + 1}.${d.getDate()}(${DOW[d.getDay()]})`
  if (e.allDay || e.time === '종일') return `${day} 종일`
  return `${day} ${e.time.slice(0, 5)}`
}

/** 종류 배지 — 캘린더와 같은 색·라벨. 틴트 면 위 글자는 반드시 catTextColor 로 뽑는다 */
function CatBadge({ cat }: { cat: string }) {
  const color = colorOf(cat)
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: typescale.small.size, fontWeight: weight.semibold,
        px: 0.75, py: '2px', borderRadius: `${radius.chip}px`,
        color: (th) => catTextColor(th, toneOfColor(color)),
        bgcolor: hexA(color, 0.14),
        border: `1px solid ${hexA(color, 0.32)}`,
      }}
    >
      {labelOf(cat)}
    </Box>
  )
}

export default function UpcomingSection({ events: given, now: nowProp, variant = 'split' }: {
  events?: CalEvent[]
  now?: Date
  /** split = PC 좌우 배치(2칸용) · stack = 모바일처럼 위아래 배치(1칸용). 화면 폭이 아니라 카드 폭이 기준이라 값으로 받는다 */
  variant?: 'split' | 'stack'
} = {}) {
  const stack = variant === 'stack'
  const navigate = useNavigate()
  const storeReady = useAppSelector((s) => s.cal.ready)
  const storeEvents = useAppSelector((s) => s.cal.events)
  const events = given ?? storeEvents
  const ready = given ? true : storeReady

  // 분 단위 갱신 — 초 카운트다운은 쓰지 않는다. 사라질 때 반드시 정리한다.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (nowProp) return
    const id = window.setInterval(() => setTick((n) => n + 1), TICK_MS)
    return () => window.clearInterval(id)
  }, [nowProp])
  const now = useMemo(() => nowProp ?? new Date(), [nowProp, tick])

  const todayKey = nowProp ? iso(nowProp) : todaySeoul()
  const [picked, setPicked] = useState<string | null>(null)
  const selected = picked ?? todayKey

  // 2주 = 오늘이 속한 주의 일요일부터 14일
  const days = useMemo(() => {
    const base = new Date(todayKey + 'T00:00:00')
    const sun = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
    return Array.from({ length: 14 }, (_, i) => new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i))
  }, [todayKey])

  // 날짜별 점 색 — 같은 종류가 여러 건이어도 점은 종류당 하나만(칸이 점으로 뒤덮이지 않게)
  const dotsByDate = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const e of events) {
      const seen = (m[e.date] ||= [])
      const c = colorOf(e.cat)
      if (!seen.includes(c)) seen.push(c)
    }
    return m
  }, [events])

  const dayList = useMemo(
    () => events.filter((e) => e.date === selected).sort((a, b) => startOf(a, selected).getTime() - startOf(b, selected).getTime()),
    [events, selected],
  )

  /**
   * 고른 날짜의 '다음 일정' 한 건.
   * **시간이 정해진 일정을 먼저 고른다** — 종일 연차가 하루를 덮고 있으면 정작 알아야 할
   * 14시 회의가 종일 일정에 가려 안 보인다(사용자 지시 2026-08-05). 종일은 아래 보조 줄로 뺀다.
   */
  const timed = dayList.filter((e) => !(e.allDay || e.time === '종일'))
  const allDay = dayList.filter((e) => e.allDay || e.time === '종일')
  const next =
    selected === todayKey
      ? timed.find((e) => endOf(e, selected) > now) ?? timed[0] ?? allDay[0] ?? null
      : timed[0] ?? allDay[0] ?? null

  // 보조 줄 — 가려진 종일 일정과 남은 건수. 다음 일정 자신은 빼고 센다.
  const nextIsAllDay = !!next && (next.allDay || next.time === '종일')
  const hiddenAllDay = nextIsAllDay ? [] : allDay
  const restCount = next ? dayList.length - 1 - hiddenAllDay.length : 0
  const subParts: string[] = []
  if (hiddenAllDay.length) subParts.push(`종일 ${hiddenAllDay[0].title}${hiddenAllDay.length > 1 ? ` 외 ${hiddenAllDay.length - 1}건` : ''}`)
  if (restCount > 0) subParts.push(`${selected === todayKey ? '오늘' : '이 날'} 일정 ${restCount}건 더`)

  const rangeLabel = `${days[0].getMonth() + 1}.${days[0].getDate()} – ${days[13].getMonth() + 1}.${days[13].getDate()}`

  return (
    <HomeCard title="다가오는 일정" count={rangeLabel} actionLabel="캘린더" onAction={() => navigate('/calendar')}>
      {!ready ? (
        <LoadingState size="md" />
      ) : (
        <Box
          sx={{
            display: 'grid',
            // split = 달력 넓게 / 다음 일정 좁게(약 65:35)이되 모바일에서는 세로로. stack = 항상 세로.
            gridTemplateColumns: stack ? '1fr' : { xs: '1fr', shell: '1.85fr 1fr' },
            gap: stack ? 2 : { xs: 2, shell: 2.5 },
            alignItems: 'start',
          }}
        >
          {/* ── 왼쪽: 2주 달력 ── */}
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
              {DOW.map((d, i) => (
                <Typography
                  key={d}
                  sx={{ textAlign: 'center', fontSize: typescale.caption.size, color: i === 0 ? 'error.main' : 'text.disabled' }}
                >
                  {d}
                </Typography>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.5 }}>
              {days.map((d) => {
                const key = iso(d)
                const isToday = key === todayKey
                const isSel = key === selected
                const dots = dotsByDate[key] || []
                const off = d.getMonth() !== days[0].getMonth() && !isToday
                return (
                  <ButtonBase
                    key={key}
                    onClick={() => setPicked(key)}
                    aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 일정 보기`}
                    aria-pressed={isSel}
                    sx={{
                      flexDirection: 'column', gap: '3px', py: 0.5,
                      borderRadius: `${radius.chip}px`,
                      '&:hover': { bgcolor: 'action.hover' },
                      ...(focusRingSx as object),
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: 'grid', placeItems: 'center', width: 28, height: 28,
                        fontSize: typescale.body.size,
                        fontWeight: isToday || isSel ? weight.bold : weight.medium,
                        borderRadius: radius.circle,
                        // 오늘 = 파란 원(채움), 고른 날 = 파란 테두리. 둘이 같은 날이면 채움만 보인다.
                        color: isToday ? 'primary.contrastText' : off ? 'text.disabled' : 'text.primary',
                        bgcolor: isToday ? 'primary.main' : 'transparent',
                        boxShadow: !isToday && isSel ? (th) => `inset 0 0 0 1.5px ${th.palette.primary.main}` : 'none',
                      }}
                    >
                      {d.getDate()}
                    </Box>
                    {/* 일정 있는 날 = 작은 점. 종류별로 하나씩, 넘치면 마지막은 회색 */}
                    <Box sx={{ display: 'flex', gap: '3px', height: 5, alignItems: 'center' }}>
                      {dots.slice(0, MAX_DOTS).map((c, i) => (
                        <Box key={i} sx={{ width: 5, height: 5, borderRadius: radius.circle, bgcolor: c }} />
                      ))}
                      {dots.length > MAX_DOTS && (
                        <Box sx={{ width: 5, height: 5, borderRadius: radius.circle, bgcolor: 'text.disabled' }} />
                      )}
                    </Box>
                  </ButtonBase>
                )
              })}
            </Box>
          </Box>

          {/* ── 오른쪽: 고른 날짜의 다음 일정 ── */}
          <Box
            sx={{
              minWidth: 0,
              // 좌우 배치면 세로 구분선, 위아래 배치면 위쪽 가로 구분선(카드 왼쪽 색 줄은 금지 규칙)
              borderTop: stack ? 1 : { xs: 1, shell: 0 },
              borderLeft: stack ? 0 : { xs: 0, shell: 1 },
              borderColor: 'divider',
              pt: stack ? 2 : { xs: 2, shell: 0 },
              pl: stack ? 0 : { xs: 0, shell: 2.5 },
            }}
          >
            {!next ? (
              <EmptyState size="sm" title="예정된 일정이 없습니다" />
            ) : (
              <>
                <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mb: 0.5 }}>
                  {selected === todayKey ? '다음 일정' : `${whenText(next, selected, todayKey).split(' ')[0]} 일정`}
                </Typography>
                <Typography
                  sx={{
                    fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1.35,
                    // 두 줄까지 보여주고 넘치면 줄임 — 좁은 화면에서 제목이 잘려 겹치지 않게
                    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
                  }}
                >
                  {next.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                  <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
                    {whenText(next, selected, todayKey)}
                  </Typography>
                  <CatBadge cat={next.cat} />
                </Box>

                {/* 이 카드에서 가장 크게 — 목록을 훑지 않아도 '얼마나 남았나'가 바로 읽히게 */}
                <Typography
                  sx={{
                    mt: 1.25,
                    fontSize: typescale.display.size, fontWeight: typescale.display.weight,
                    lineHeight: 1.15, color: 'primary.main',
                  }}
                >
                  {remainText(next, selected, now, todayKey)}
                </Typography>

                {subParts.length > 0 && (
                  <Typography sx={{ mt: 1, fontSize: typescale.small.size, color: 'text.disabled' }}>
                    {subParts.join(' · ')}
                  </Typography>
                )}
              </>
            )}
          </Box>
        </Box>
      )}
    </HomeCard>
  )
}
