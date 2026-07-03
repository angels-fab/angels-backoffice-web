import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventContentArg } from '@fullcalendar/core'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
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
// 현재 뷰에서 실제로 보이는 날짜 범위 [start, end) — datesSet가 FC 실제값으로 갱신하기 전 초기값/폴백.
// 월간(dayGridMonth, firstDay=0, fixedWeekCount=false)=달이 걸친 주 전체(이전달 말·다음달 초 포함), 주간(timeGridWeek)=그 주.
function gridRange(view: ViewKey, anchor: Date): { start: Date; end: Date } {
  if (view === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return { start: startOfWeek(first), end: addDays(startOfWeek(last), 7) }
  }
  const start = startOfWeek(anchor)
  return { start, end: addDays(start, 7) }
}
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
  const { events: allEvents, loading, error, errorMsg, updatedAt } = useAppSelector((s) => s.cal)

  const [view, setView] = useState<ViewKey>('month')
  const [anchor, setAnchor] = useState<Date>(() => parseKey(todaySeoul()))
  const [search, setSearch] = useState('')
  const [selMembers, setSelMembers] = useState<string[]>([]) // 빈 배열 = 전체 선택
  const [selCats, setSelCats] = useState<RealCat[]>([]) // 빈 배열 = 전체(종류 필터 없음)
  const [multiSel, setMultiSel] = useState(false) // 모바일 복수선택 모드(Shift 대체)
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true }) // 복수선택 버튼은 모바일에서만
  const [showWeekends, setShowWeekends] = useState(false) // 기본: 주말 숨김(평일 넓게)
  // 화면에 실제로 보이는 날짜 범위(FC activeStart/activeEnd). 종류별 건수 집계에 사용. datesSet에서 실제값 주입.
  const [visRange, setVisRange] = useState<{ start: Date; end: Date }>(() => gridRange('month', parseKey(todaySeoul())))
  const calRef = useRef<FullCalendar>(null)

  // 호버·클릭 상세 — 마우스 위치 기준. 호버(locked=false)는 포인터를 따라다니고, 클릭(locked=true)은 그 자리 고정.
  const [pop, setPop] = useState<{ detail: EventDetail; x: number; y: number; locked: boolean } | null>(null)
  const lockedEl = useRef<HTMLElement | null>(null) // 클릭 고정된 .fc-event segment
  // segment(.fc-event element) → 원본 일정 상세. eventDidMount에서 채우고 eventWillUnmount에서 제거.
  const detailMap = useRef(new WeakMap<HTMLElement, EventDetail>())
  const closePop = () => {
    lockedEl.current = null
    setPop(null)
  }
  // 포인터 (x,y)가 가리키는 .fc-event segment 찾기 — elementsFromPoint는 다른 칸의 day-events 컨테이너에
  // 덮인 멀티데이 막대도 함께 반환하므로, 중간·마지막 칸의 빈 영역에서도 실제 막대를 찾아낸다.
  const findEvAt = (x: number, y: number): HTMLElement | null => {
    const stack = document.elementsFromPoint(x, y) as HTMLElement[]
    for (const el of stack) {
      const fe = el.closest('.fc-event') as HTMLElement | null
      if (fe && detailMap.current.has(fe)) return fe
    }
    return null
  }

  const todayKey = todaySeoul()
  const searchTrim = search.trim()

  // 실패 상태에서 캘린더 페이지에 다시 진입하면 자동 재시도(마운트 시 1회).
  // 성공하면 리듀서가 오류 안내를 제거하고 updatedAt을 갱신한다.
  useEffect(() => {
    if (error && !loading) dispatch(loadCalEvents())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    lockedEl.current = null
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

  // 필터 선택 — 일반 클릭=단일선택 / additive(Shift·모바일 복수모드)=추가·해제 토글.
  // 팀원: [] = 전체(모든 칩 on). 일반클릭=그 팀원만 / 단일 선택된 팀원 재클릭=전체([])로 복귀.
  // additive는 [전체−그것]로 확장 후 토글, 모두 켜지면 [](전체) 정규화.
  const toggleMember = (id: string, additive: boolean) => setSelMembers((prev) => {
    if (!additive) return prev.length === 1 && prev[0] === id ? [] : [id]
    const all = MEMBERS.map((m) => m.id)
    const base = prev.length === 0 ? all : prev
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    return next.length >= all.length ? [] : next
  })
  // 종류: [] = 전체(필터 없음). 일반클릭=그 종류만 / 단일 선택된 종류 재클릭=해제([], 전체 표시) / additive=개별 토글(모두 선택→[] 전체)
  const toggleCat = (id: RealCat, additive: boolean) => setSelCats((prev) => {
    if (!additive) return prev.length === 1 && prev[0] === id ? [] : [id]
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    return next.length >= CAT_ORDER.length ? [] : next
  })

  // ── 종류별 건수 ──
  // 현재 보이는 날짜 범위 ∩ (주말 보기) ∩ 팀원 필터 ∩ 검색어로 집계. 종류 필터는 적용하지 않음
  // (각 종류 칩에 "선택 가능한 건수"를 계속 노출 — 종류를 골라도 다른 종류 숫자가 0이 되지 않게).
  // allEvents는 날짜별로 펼쳐져 있어 같은 id가 여러 행 → 멀티데이는 id 기준 1회만 집계.
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of CAT_ORDER) counts[c] = 0
    const seen = new Set<string>()
    const { start, end } = visRange
    for (const ev of allEvents) {
      if (seen.has(ev.id)) continue
      const d = parseKey(ev.date)
      if (d < start || d >= end) continue // 화면에 보이는 범위 밖
      if (!showWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue // 주말 숨김 시 주말 전용일 제외
      if (!membersForEvent(ev.title).some(memberSelected)) continue
      if (!searchMatch(ev)) continue
      seen.add(ev.id) // 보이는 평일 1칸이라도 통과하면 그 일정 1건 집계
      counts[ev.cat] = (counts[ev.cat] || 0) + 1
    }
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, visRange, showWeekends, selMembers, searchTrim])

  const sidebarMembers = useMemo(
    () => MEMBERS.map((m) => ({ member: m, on: memberSelected(m.id) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selMembers],
  )
  // 종류 칩 — 0건(현재 기간·팀원·검색 기준)은 숨김. on = 선택 없음([]=전체)이면 모두 on, 아니면 선택된 것만.
  const sidebarCats = CAT_ORDER
    .filter((id) => (catCounts[id] || 0) > 0)
    .map((id) => ({
      id,
      label: CAT_META[id].label,
      color: CAT_META[id].color,
      count: catCounts[id] || 0,
      on: selCats.length === 0 || selCats.includes(id),
    }))
  // 선택된 종류가 조건 변경으로 0건이 되면(숨겨지면) 보이지 않는 필터가 남지 않게 자동 해제.
  useLayoutEffect(() => {
    setSelCats((prev) => {
      const next = prev.filter((id) => (catCounts[id] || 0) > 0)
      return next.length === prev.length ? prev : next
    })
  }, [catCounts])

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

      {/* 일정 불러오기 최종 실패 — 빈 화면 대신 오류 안내 + 다시 시도. 기존 일정이 있으면 유지 표시 중임을 알림 */}
      {error && (
        <Alert
          severity={allEvents.length > 0 ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => dispatch(loadCalEvents())} disabled={loading}>
              {loading ? '불러오는 중…' : '다시 시도'}
            </Button>
          }
        >
          {allEvents.length > 0
            ? `일정 새로고침에 실패했습니다. 마지막으로 불러온 일정(${updatedAt || '이전'})을 표시 중입니다.`
            : '일정을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'}
          {errorMsg ? ` — ${errorMsg}` : ''}
        </Alert>
      )}

      {/* 툴바 — 한 행(space-between): 왼쪽=[월/주]·[‹|오늘|›] 그룹·년월 / 오른쪽=검색·주말.
          반응형: 좁아지면 검색이 한 줄 전체로 내려감(order/flex-basis). */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px 8px', mb: 2 }}>
        {/* 왼쪽 그룹 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', order: 1 }}>
          {/* 월/주 토글 */}
          <Box sx={{ display: 'inline-flex', gap: '3px', bgcolor: 'background.elevated', p: '3px', borderRadius: '9px' }}>
            {([{ k: 'month', l: '월' }, { k: 'timeweek', l: '주' }] as const).map((t) => (
              <Box
                key={t.k}
                component="button"
                onClick={() => setView(t.k)}
                sx={{
                  px: '16px', py: '6px', borderRadius: '7px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
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

          {/* 이전 · 오늘 · 다음 — 하나의 외곽선 버튼 그룹(바깥 모서리만 둥글게, 사이 얇은 구분선) */}
          {(() => {
            const navBtn = {
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '100%',
              border: 'none', bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .12s, color .12s',
              '&:hover': { bgcolor: 'background.elevated', color: 'text.primary' },
              '&:active': { bgcolor: 'action.selected' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
            } as const
            const sep = { width: '1px', flex: 'none', bgcolor: 'divider' } as const
            return (
              <Box role="group" aria-label="기간 이동" sx={{ display: 'inline-flex', alignItems: 'stretch', height: 34, border: '1px solid', borderColor: 'divider', borderRadius: '9px', overflow: 'hidden', bgcolor: 'background.paper' }}>
                <Box component="button" aria-label="이전" onClick={() => shift(-1)} sx={{ ...navBtn, width: 32 }}><ChevronLeftIcon sx={{ fontSize: 20 }} /></Box>
                <Box sx={sep} />
                <Box component="button" onClick={goToday} sx={{ ...navBtn, px: '14px', fontSize: 13, fontWeight: 600 }}>오늘</Box>
                <Box sx={sep} />
                <Box component="button" aria-label="다음" onClick={() => shift(1)} sx={{ ...navBtn, width: 32 }}><ChevronRightIcon sx={{ fontSize: 20 }} /></Box>
              </Box>
            )
          })()}

          <Typography component="span" sx={{ ml: '2px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            {periodLabel}
          </Typography>
        </Box>

        {/* 검색 — 우측(주말 보기 왼쪽). 좁은 화면에서는 한 줄 전체로 내려감(order 3 + basis 100%) */}
        <Box sx={{ position: 'relative', order: { xs: 3, sm: 2 }, ml: { sm: 'auto' }, flex: { xs: '1 1 100%', sm: '0 1 240px' }, maxWidth: { sm: 260 } }}>
          <SearchIcon sx={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'text.disabled' }} />
          <Box
            component="input"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="검색 (팀원·구분·내용)"
            sx={(th) => ({
              width: '100%', height: 34, border: `1px solid ${th.palette.divider}`, borderRadius: '9px',
              p: '0 10px 0 30px', fontSize: 13, fontFamily: 'inherit', color: 'text.primary', bgcolor: 'background.paper', outline: 'none',
              '&::placeholder': { color: th.palette.text.disabled },
              '&:focus': { borderColor: th.palette.primary.main },
            })}
          />
        </Box>

        {/* 주말 보기 — 검색 오른쪽 */}
        <Box
          component="button"
          onClick={() => setShowWeekends((s) => !s)}
          sx={{
            order: { xs: 2, sm: 3 }, flex: '0 0 auto',
            height: 34, px: '14px', borderRadius: '9px', border: '1px solid',
            borderColor: showWeekends ? 'primary.main' : 'divider',
            color: showWeekends ? 'primary.main' : 'text.secondary',
            bgcolor: showWeekends ? 'background.elevated' : 'background.paper',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .12s',
          }}
        >
          {showWeekends ? '주말 숨기기' : '주말 보기'}
        </Box>
      </Box>

      {/* 상단 필터 바 — 팀원·일정 종류만(검색은 상단 툴바로 이동) */}
      <CalFilterBar
        members={sidebarMembers}
        onToggleMember={toggleMember}
        cats={sidebarCats}
        onToggleCat={toggleCat}
        showMulti={isMobile}
        multiSelect={multiSel}
        onToggleMulti={() => setMultiSel((m) => !m)}
      />

      {/* 달력 (풀폭) — 컨테이너 위임: 포인터 위치의 .fc-event를 elementsFromPoint로 찾아
          모든 멀티데이 segment(시작·중간·마지막, 텍스트 없는 빈 영역 포함)에서 호버·클릭 동작.
          호버 상세는 포인터를 따라다니고(기존 동작 유지), 클릭은 그 자리에 고정. */}
      <Box sx={{ minWidth: 0 }}>
        <Box
          className="fc-theme-angels fc-team"
          onPointerMove={(e) => {
            const x = e.clientX
            const y = e.clientY
            const el = findEvAt(x, y)
            // 손가락 포인터 — 일정 위(가려진 멀티데이 중간·마지막 구간 포함)에서만 pointer, 그 외엔 기본 커서.
            // 가려진 구간은 위 칸의 day-events 컨테이너가 덮어 .fc-event의 cursor:pointer가 안 보이므로 컨테이너에 직접 지정.
            e.currentTarget.style.cursor = el ? 'pointer' : ''
            if (lockedEl.current) return // 클릭 고정 중엔 호버로 안 바뀜
            if (el) {
              const detail = detailMap.current.get(el)
              if (detail) setPop({ detail, x, y, locked: false })
            } else {
              setPop((p) => (p && !p.locked ? null : p)) // 일정 밖으로 나가면 호버 닫힘
            }
          }}
          onPointerLeave={() => {
            if (!lockedEl.current) setPop(null)
          }}
          onClick={(e) => {
            const el = findEvAt(e.clientX, e.clientY)
            if (!el) return // 빈 곳 클릭은 바깥-클릭 닫기 핸들러로
            e.stopPropagation() // 바깥-클릭 닫기로 전파 방지(하나의 클릭 경로)
            const detail = detailMap.current.get(el)
            if (lockedEl.current === el) {
              closePop() // 같은 segment 재클릭 = 닫기
            } else if (detail) {
              lockedEl.current = el
              setPop({ detail, x: e.clientX, y: e.clientY, locked: true })
            }
          }}
        >
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
            // 같은 시간대 겹치는 일정은 좌우로 균등 분할(겹치지 않게). 기본 true는 50% 겹침이라 false로.
            slotEventOverlap={false}
            allDaySlot
            events={fcEvents}
            eventDisplay="block"
            eventContent={renderEventContent}
            // 실제 보이는 날짜 범위(activeStart/activeEnd) → 종류별 건수 집계 기준. 이동·뷰전환 시 즉시 갱신.
            datesSet={(arg) => setVisRange({ start: arg.start, end: arg.end })}
            // 각 segment(.fc-event) → 원본 상세 매핑만 등록. 실제 hit 판정은 컨테이너 위임이 담당.
            eventDidMount={(info) => {
              detailMap.current.set(info.el, info.event.extendedProps.detail as EventDetail)
            }}
            eventWillUnmount={(info) => {
              detailMap.current.delete(info.el)
              if (lockedEl.current === info.el) closePop()
            }}
            dayMaxEvents={view === 'month' ? 3 : false}
            moreLinkContent={(arg) => `+${arg.num}건`}
            height="auto"
            dayCellContent={(arg) => String(arg.date.getDate())}
          />
        </Box>
      </Box>

      {pop && <EventPopover detail={pop.detail} x={pop.x} y={pop.y} locked={pop.locked} />}
    </PageContainer>
  )
}
