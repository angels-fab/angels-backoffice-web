import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventContentArg } from '@fullcalendar/core'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { PageContainer, PageHeader } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'
import type { CalEvent } from '@/types'
import { todaySeoul } from '@/utils/date'
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'
import { MEMBERS, memberById, membersForEvent, given, eventContent, eventMembers, rawTitleNoTags } from './members'
import CalFilterBar from './CalFilterBar'
import ChipContent, { type ChipContentProps } from './ChipContent'
import EventPopover, { type EventDetail } from './EventPopover'


const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parseKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(d, -d.getDay())
const catShort = (cat: RealCat) => CAT_META[cat].label.split('/')[0]
function rgba(hex: string, a: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

type ViewKey = 'month' | 'timeweek'

function renderEventContent(arg: EventContentArg) {
  const chip = arg.event.extendedProps as unknown as ChipContentProps
  // 주 시간표의 시간일정만 'timed'(2줄 가능), 그 외(월간·종일행)는 'daygrid'.
  const variant: 'daygrid' | 'timed' = !arg.event.allDay && arg.view.type === 'timeGridWeek' ? 'timed' : 'daygrid'
  // 멀티데이 = 1일 초과 span (FullCalendar가 정규화한 start/end 기준). 주 단위로 나뉜 구간도 동일 적용.
  const ms = (arg.event.end?.getTime() ?? 0) - (arg.event.start?.getTime() ?? 0)
  const multiDay = ms > 24 * 3600 * 1000 + 60000
  return (
    <Box sx={{ display: 'flex', width: '100%', minWidth: 0 }}>
      <ChipContent
        participants={chip.participants}
        catKey={chip.catKey}
        catColor={chip.catColor}
        time={chip.time}
        title={chip.title}
        variant={variant}
        multiDay={multiDay}
      />
    </Box>
  )
}

export default function Calendar() {
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, updatedAt } = useAppSelector((s) => s.cal)

  const [view, setView] = useState<ViewKey>('month')
  const [anchor, setAnchor] = useState<Date>(() => parseKey(todaySeoul()))
  const [search, setSearch] = useState('')
  const [selMembers, setSelMembers] = useState<string[]>([]) // 빈 배열 = 전체 선택
  const [selCats, setSelCats] = useState<RealCat[]>([]) // 빈 배열 = 전체 선택
  const [showWeekends, setShowWeekends] = useState(false) // 기본: 주말 숨김(평일 넓게)
  const calRef = useRef<FullCalendar>(null)

  // 호버·클릭 상세 — 마우스 위치 기준. lockedId=클릭 고정된 일정 id(있으면 호버로 안 바뀜).
  const [pop, setPop] = useState<{ detail: EventDetail; x: number; y: number } | null>(null)
  const lockedId = useRef<string | null>(null)
  const closePop = () => {
    lockedId.current = null
    setPop(null)
  }

  const todayKey = todaySeoul()
  const searchTrim = search.trim()

  // 바깥 클릭·Esc로 고정 상세 닫기 (eventClick은 stopPropagation으로 이 핸들러에 안 닿음)
  useEffect(() => {
    const onDocClick = () => closePop()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePop()
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // 뷰/기준일 변경 시 FullCalendar 동기화 (월=dayGridMonth / 주(시간표)=timeGridWeek).
  // changeView는 flushSync를 유발하므로 렌더 단계 밖(setTimeout)에서 호출.
  useEffect(() => {
    const fcView = view === 'month' ? 'dayGridMonth' : 'timeGridWeek'
    const id = setTimeout(() => {
      calRef.current?.getApi().changeView(fcView, keyOf(anchor))
    }, 0)
    return () => clearTimeout(id)
  }, [anchor, view])

  // 뷰·기간·필터 변경 시 열려있던 상세 닫기(스테일 방지)
  useEffect(() => {
    lockedId.current = null
    setPop(null)
  }, [view, anchor, searchTrim, selCats, selMembers])

  // ── 필터 술어 (빈 선택 = 전체) ──
  const catSelected = (cat: RealCat) => selCats.length === 0 || selCats.includes(cat)
  const memberSelected = (id: string) => selMembers.length === 0 || selMembers.includes(id)
  const sLow = searchTrim.toLowerCase()
  const searchMatch = (ev: CalEvent) => {
    if (!sLow) return true
    if (ev.title.toLowerCase().includes(sLow)) return true // 내용(제목)
    if (CAT_META[ev.cat].label.toLowerCase().includes(sLow)) return true // 일정 구분
    return membersForEvent(ev.title).some((id) => memberById(id).name.toLowerCase().includes(sLow)) // 팀원
  }
  const eventActive = (ev: CalEvent) =>
    catSelected(ev.cat) && membersForEvent(ev.title).some(memberSelected) && searchMatch(ev)

  // 전체선택 상태에서 한 탭 클릭 = 그것만 선택 / 선택된 탭 재클릭 = 해제(마지막 해제 시 전체로 복귀)
  const isolateToggle = <T,>(prev: T[], id: T, total: number): T[] => {
    if (prev.length === 0 || prev.length >= total) return [id] // 전체선택(빈 배열 또는 모두 포함) → 그것만
    if (prev.includes(id)) return prev.filter((x) => x !== id) // 선택 해제(마지막이면 [] = 전체)
    const next = [...prev, id]
    return next.length >= total ? [] : next // 모두 선택되면 전체(빈 배열)로 정규화
  }
  const toggleMember = (id: string) => setSelMembers((prev) => isolateToggle(prev, id, MEMBERS.length))
  const toggleCat = (id: RealCat) => setSelCats((prev) => isolateToggle(prev, id, CAT_ORDER.length))

  // ── 사이드바 데이터 ──
  const catCounts = useMemo(() => {
    const byId = new Map<string, CalEvent>()
    for (const ev of allEvents) if (!byId.has(ev.id)) byId.set(ev.id, ev)
    const counts: Record<string, number> = {}
    for (const c of CAT_ORDER) counts[c] = 0
    for (const ev of byId.values()) counts[ev.cat]++
    return counts
  }, [allEvents])

  const sidebarMembers = useMemo(
    () => MEMBERS.map((m) => ({ member: m, on: memberSelected(m.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selMembers],
  )
  const sidebarCats = CAT_ORDER.map((id) => ({
    id,
    label: CAT_META[id].label,
    color: CAT_META[id].color,
    count: catCounts[id] || 0,
    on: catSelected(id),
  }))

  // ── FullCalendar 이벤트 ──
  // 여러 날 일정은 가로로 이어지는 바(스팬)로 표시. 겹침은 칩 높이를 시간/종일 모두 2줄로 통일해
  // 방지함(멀티데이 abs harness와 당일 일정 높이가 같아 lane이 정확히 쌓임).
  const fcEvents = useMemo(() => {
    const byId = new Map<string, CalEvent>()
    for (const ev of allEvents) if (!byId.has(ev.id)) byId.set(ev.id, ev)
    return [...byId.values()].filter(eventActive).map((ev) => {
      const cat = ev.cat
      const catColor = CAT_META[cat].color
      const time = ev.allDay ? '' : ev.start.slice(11, 16)
      const content = eventContent(ev.title, cat) || catShort(cat)
      const members = eventMembers(ev.title) // 해당자(@우선, 없으면 센터)
      const props: ChipContentProps = {
        participants: members.map((n) => ({ initials: given(n), color: memberById(n).color })),
        catKey: cat,
        catColor,
        time,
        title: content, // 칩은 "장소-목적"을 그대로 표시
      }
      // 호버·클릭 상세 — 원본 제목 그대로(장소-목적 파싱 안 함) + 시간 + 전체 해당자
      const detail: EventDetail = {
        catLabel: CAT_META[cat].label,
        catColor,
        time,
        title: rawTitleNoTags(ev.title),
        members,
      }
      return {
        id: ev.id,
        title: ev.title,
        start: ev.allDay ? ev.start.slice(0, 10) : ev.start,
        end: ev.allDay ? ev.end.slice(0, 10) : ev.end,
        allDay: ev.allDay,
        backgroundColor: rgba(catColor, 0.18),
        borderColor: catColor,
        extendedProps: { ...props, detail },
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, selCats, selMembers, searchTrim])

  // 주간 기간 라벨용
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])

  // ── 네비게이션 ──
  const shift = (dir: number) => {
    setAnchor((a) =>
      view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7),
    )
  }
  const goToday = () => setAnchor(parseKey(todayKey))

  const periodLabel = useMemo(() => {
    if (view === 'month') return `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`
    const ws = weekStart
    const we = addDays(ws, 6)
    return we.getMonth() === ws.getMonth()
      ? `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${ws.getDate()}일 – ${we.getDate()}일`
      : `${ws.getFullYear()}년 ${ws.getMonth() + 1}월 ${ws.getDate()}일 – ${we.getMonth() + 1}월 ${we.getDate()}일`
  }, [view, anchor, weekStart])

  return (
    <PageContainer>
      <PageHeader
        icon={<EventNoteIcon />}
        title="업무 일정"
        updatedAt={updatedAt || undefined}
        actions={
          <IconButton
            aria-label="새로고침"
            onClick={() => dispatch(loadCalEvents())}
            disabled={loading}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* 툴바 — 뷰 토글 / 오늘 / 이전·다음 / 기간 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ display: 'inline-flex', gap: '3px', bgcolor: 'background.elevated', p: '3px', borderRadius: '9px' }}>
          {([{ k: 'month', l: '월' }, { k: 'timeweek', l: '주' }] as const).map((t) => (
            <Box
              key={t.k}
              component="button"
              onClick={() => setView(t.k)}
              sx={{
                px: '18px',
                py: '6px',
                borderRadius: '7px',
                fontSize: 13,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border: 'none',
                fontWeight: view === t.k ? 700 : 600,
                color: view === t.k ? 'primary.main' : 'text.secondary',
                bgcolor: view === t.k ? 'background.paper' : 'transparent',
                boxShadow: view === t.k ? '0 1px 2px rgba(0,0,0,.35)' : 'none',
                transition: 'all .12s',
              }}
            >
              {t.l}
            </Box>
          ))}
        </Box>

        <Box sx={(th) => ({ width: '1px', height: 22, bgcolor: th.palette.divider })} />

        <Box
          component="button"
          onClick={goToday}
          sx={{
            height: 34,
            px: '16px',
            borderRadius: '9px',
            border: '1px solid',
            borderColor: 'divider',
            color: 'text.secondary',
            fontSize: 13,
            fontWeight: 600,
            bgcolor: 'background.paper',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'background .12s',
            '&:hover': { bgcolor: 'background.elevated' },
          }}
        >
          오늘
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton aria-label="이전" onClick={() => shift(-1)} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronLeftIcon />
          </IconButton>
          <IconButton aria-label="다음" onClick={() => shift(1)} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        <Typography component="span" sx={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
          {periodLabel}
        </Typography>

        <Box
          component="button"
          onClick={() => setShowWeekends((s) => !s)}
          sx={{
            ml: { md: 'auto' },
            height: 34,
            px: '14px',
            borderRadius: '9px',
            border: '1px solid',
            borderColor: showWeekends ? 'primary.main' : 'divider',
            color: showWeekends ? 'primary.main' : 'text.secondary',
            bgcolor: showWeekends ? 'background.elevated' : 'background.paper',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'all .12s',
          }}
        >
          {showWeekends ? '주말 숨기기' : '주말 보기'}
        </Box>
      </Box>

      {/* 상단 필터 바 (좌측 사이드바 대체) — 달력 풀폭 확보 */}
      <CalFilterBar
        search={search}
        onSearch={setSearch}
        members={sidebarMembers}
        onToggleMember={toggleMember}
        cats={sidebarCats}
        onToggleCat={toggleCat}
      />

      {/* 달력 (풀폭) */}
      <Box sx={{ minWidth: 0 }}>
        <Box className="fc-theme-angels fc-team">
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="dayGridMonth"
            initialDate={keyOf(anchor)}
            locale={koLocale}
            headerToolbar={false}
            firstDay={0}
            weekends={showWeekends}
            fixedWeekCount={false}
            slotMinTime="09:00:00"
            slotMaxTime="18:00:00"
            slotDuration="01:00:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            allDaySlot
            events={fcEvents}
            eventDisplay="block"
            eventContent={renderEventContent}
            eventMouseEnter={(info) => {
              if (lockedId.current) return // 클릭 고정 중엔 호버로 안 바뀜
              const detail = info.event.extendedProps.detail as EventDetail
              setPop({ detail, x: info.jsEvent.clientX, y: info.jsEvent.clientY })
            }}
            eventMouseLeave={() => {
              if (!lockedId.current) setPop(null)
            }}
            eventClick={(info) => {
              info.jsEvent.preventDefault()
              info.jsEvent.stopPropagation() // 바깥-클릭 닫기 핸들러로 전파 방지
              const id = info.event.id
              if (lockedId.current === id) {
                closePop() // 같은 일정 재클릭 = 닫기
              } else {
                lockedId.current = id
                const detail = info.event.extendedProps.detail as EventDetail
                setPop({ detail, x: info.jsEvent.clientX, y: info.jsEvent.clientY })
              }
            }}
            dayMaxEvents={view === 'month' ? 3 : false}
            moreLinkContent={(arg) => `+${arg.num}건`}
            height="auto"
            dayCellContent={(arg) => String(arg.date.getDate())}
          />
        </Box>
      </Box>

      {pop && <EventPopover detail={pop.detail} x={pop.x} y={pop.y} />}
    </PageContainer>
  )
}
