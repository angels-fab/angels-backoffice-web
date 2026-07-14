import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useMediaQuery from '@mui/material/useMediaQuery'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
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
import { PageContainer, PageHeader, SearchBar, SegTabs, useSnack } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents, moveCalEvent } from '@/store/slices/calSlice'
import { putSetting } from '@/store/slices/userSettingsSlice'
import type { CalEvent } from '@/types'
import { todaySeoul } from '@/utils/date'
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'
import { MEMBERS, memberById, membersForEvent, given, eventContent, eventMembers, rawTitleNoTags } from './members'
import CalFilterBar from './CalFilterBar'
import ChipContent, { type ChipContentProps } from './ChipContent'
import EventPopover, { type EventDetail } from './EventPopover'
import CalEventWrite from './CalEventWrite'
import { updateCalEvent } from '@/api/calendar'
import { iconSize, radius } from '@/theme/tokens'
import AddIcon from '@mui/icons-material/Add'
import { useRole } from '@/auth/role'


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
  if (view === 'agenda') {
    // 목록(listMonth) = 해당 달 1일~말일(그리드 오버플로 없음)
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return { start: first, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) }
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

type ViewKey = 'month' | 'timeweek' | 'agenda'

function renderEventContent(arg: EventContentArg) {
  const chip = arg.event.extendedProps as unknown as ChipContentProps
  // 주 시간표의 시간일정만 'timed'(2줄 가능), 그 외(월간·종일행)는 'daygrid'.
  const variant: 'daygrid' | 'timed' = !arg.event.allDay && arg.view.type === 'timeGridWeek' ? 'timed' : 'daygrid'
  // 멀티데이 = 1일 초과 span (FullCalendar가 정규화한 start/end 기준). 주 단위로 나뉜 구간도 동일 적용.
  const ms = (arg.event.end?.getTime() ?? 0) - (arg.event.start?.getTime() ?? 0)
  const multiDay = ms > 24 * 3600 * 1000 + 60000
  // 목록(listMonth) 뷰는 FullCalendar가 왼쪽 .fc-list-event-time 셀에 시간을 이미 렌더하므로
  // 칩(제목 셀) 안에서 시간을 또 표시하면 중복 노출됨 → 목록에서는 칩 시간 생략.
  const time = arg.view.type === 'listMonth' ? '' : chip.time
  return (
    <Box sx={{ display: 'flex', width: '100%', minWidth: 0 }}>
      <ChipContent
        participants={chip.participants}
        catKey={chip.catKey}
        catColor={chip.catColor}
        time={time}
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

  // 복수선택 버튼·모바일 기본뷰 판정. 폰(≤768px)은 월 그리드 대신 목록(아젠다) 뷰가 기본.
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true })
  // 마지막으로 보던 뷰 기억(localStorage) — 없으면 기기 기본(모바일=목록, PC=월)
  const [view, setView] = useState<ViewKey>(() => {
    const saved = localStorage.getItem('cal:view')
    return saved === 'month' || saved === 'timeweek' || saved === 'agenda' ? saved : isMobile ? 'agenda' : 'month'
  })
  const [anchor, setAnchor] = useState<Date>(() => parseKey(todaySeoul()))
  const [search, setSearch] = useState('')
  const [selMembers, setSelMembers] = useState<string[]>([]) // 빈 배열 = 전체 선택
  const [selCats, setSelCats] = useState<RealCat[]>([]) // 빈 배열 = 전체(종류 필터 없음)
  const [multiSel, setMultiSel] = useState(false) // 모바일 복수선택 모드(Shift 대체)
  const [showWeekends, setShowWeekends] = useState(false) // 기본: 주말 숨김(평일 넓게)
  // 화면에 실제로 보이는 날짜 범위(FC activeStart/activeEnd). 종류별 건수 집계에 사용. datesSet에서 실제값 주입.
  const [visRange, setVisRange] = useState<{ start: Date; end: Date }>(() => gridRange(view, parseKey(todaySeoul())))
  const calRef = useRef<FullCalendar>(null)

  // 호버·클릭 상세 — 마우스 위치 기준. 호버(locked=false)는 포인터를 따라다니고, 클릭(locked=true)은 그 자리 고정.
  const [pop, setPop] = useState<{ detail: EventDetail; x: number; y: number; locked: boolean; evId?: string } | null>(null)
  // 일정 작성/수정 모달(관리자) + 저장 안내 스낵바 — 5단계: 캘린더 쓰기 UI 연결(Supabase·세션 인증)
  const { isAdmin } = useRole()
  const snack = useSnack()
  const [write, setWrite] = useState<{ mode: 'add' | 'edit'; event: CalEvent | null; initialDate: string; initialEndDate?: string } | null>(null)
  const idMap = useRef(new WeakMap<HTMLElement, string>()) // segment → 일정 id (수정 진입용)
  const dragClickSuppress = useRef(0) // 드래그 드롭 직후 합성 click이 팝오버를 고정하는 것 방지

  // 일정 문자열('yyyy-MM-dd' 또는 'yyyy-MM-ddTHH:mm')을 delta(년/월/일/ms)만큼 이동 — KST 문자열 산술(타임존 무관)
  const shiftDt = (v: string, d: { years?: number; months?: number; days?: number; milliseconds?: number }) => {
    const hasTime = v.length > 10
    const dt = new Date(
      Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10)),
      hasTime ? Number(v.slice(11, 13)) : 0, hasTime ? Number(v.slice(14, 16)) : 0,
    )
    dt.setFullYear(dt.getFullYear() + (d.years || 0))
    dt.setMonth(dt.getMonth() + (d.months || 0))
    dt.setDate(dt.getDate() + (d.days || 0))
    dt.setTime(dt.getTime() + (d.milliseconds || 0))
    const base = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
    return hasTime ? `${base}T${pad(dt.getHours())}:${pad(dt.getMinutes())}` : base
  }

  // 드래그 이동/리사이즈 공용 저장 — FC가 확정한 '이동 결과' 좌표(fcStart/fcEnd)를 그대로 저장하고,
  // 성공 시 리덕스를 낙관 패치(moveCalEvent — 해당 일정만 재전개). 전체 재조회는 하지 않는다:
  // 이동마다 재조회하면 응답이 다음 이동과 경쟁해 이전 이동이 화면에서 원위치로 되돌아가 보였음.
  const fmtFc = (d: Date, withTime: boolean) => {
    const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return withTime ? `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}` : base
  }
  const commitEventChange = async (
    ev: CalEvent,
    fcStart: Date,
    fcEnd: Date | null,
    revert: () => void,
  ) => {
    try {
      const allDay = ev.allDay
      const startStr = fmtFc(fcStart, !allDay)
      let endStr: string
      if (allDay) {
        // FC end는 '미포함'(다음 날 0시), null이면 하루짜리 — DB에는 마지막 날(포함)로 저장
        endStr = fcEnd ? shiftDt(fmtFc(fcEnd, false), { days: -1 }) : startStr
      } else {
        endStr = fcEnd ? fmtFc(fcEnd, true) : startStr
      }
      await updateCalEvent({
        id: ev.id,
        title: ev.title, // 제목·장소는 원본 그대로 유지(이동은 날짜/시간만 변경)
        loc: ev.loc && ev.loc !== '-' ? ev.loc : '',
        allDay,
        start: startStr,
        end: endStr,
      })
      // 낙관 패치 — 원본(RawCalEvent) 계약으로: 종일 end는 '다음 날'(미포함)
      dispatch(moveCalEvent({
        id: ev.id,
        start: startStr,
        end: allDay ? shiftDt(endStr, { days: 1 }) : endStr,
      }))
      snack('일정을 이동했어요')
    } catch (err) {
      revert()
      snack(err instanceof Error ? err.message : '이동에 실패했어요', 'error')
    }
  }
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
      // 월/주=.fc-event, 목록(listMonth)=.fc-list-event 행
      const fe = el.closest('.fc-event, .fc-list-event') as HTMLElement | null
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
    const fcView = view === 'month' ? 'dayGridMonth' : view === 'agenda' ? 'listMonth' : 'timeGridWeek'
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

  // 계정 개인화 뷰 — 설정 로드되면 서버 저장값으로 1회 동기화(기기 넘나들며 유지)
  const usReady = useAppSelector((s) => s.userSettings.ready)
  const svCalView = useAppSelector((s) => s.userSettings.settings['cal.view'] as string | undefined)
  const svViewApplied = useRef(false)
  useEffect(() => {
    if (!usReady || svViewApplied.current) return
    svViewApplied.current = true
    if (svCalView === 'month' || svCalView === 'timeweek' || svCalView === 'agenda') setView(svCalView)
  }, [usReady, svCalView])
  // 뷰 변경 시 저장 — 로컬 캐시(즉시) + 계정 서버(디바운스, 기기 동기화)
  useEffect(() => {
    try { localStorage.setItem('cal:view', view) } catch { /* 저장 불가 무시 */ }
    dispatch(putSetting({ key: 'cal.view', value: view }))
  }, [view, dispatch])

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
        // 반복 일정 인스턴스는 드래그/리사이즈 제외 — 시리즈 전체가 움직이면 위험(개별 예외 미지원)
        editable: !ev.recurring,
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
      view === 'timeweek' ? addDays(a, dir * 7) : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    )
  }
  const goToday = () => setAnchor(parseKey(todayKey))

  const periodLabel = useMemo(() => {
    if (view !== 'timeweek') return `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`
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
        actions={
          <>
            {isAdmin && (
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: iconSize.action }} />}
                onClick={() => setWrite({ mode: 'add', event: null, initialDate: todayKey })}
                sx={(th) => ({
                  height: 30, px: 1.25, fontSize: 13, fontWeight: 700, borderRadius: `${radius.chip}px`,
                  color: th.palette.accent.green, border: `1px solid ${th.palette.accent.green}66`,
                  '&:hover': { bgcolor: `${th.palette.accent.green}1f` },
                })}
              >
                일정 추가
              </Button>
            )}
            <IconButton
              aria-label="새로고침"
              onClick={() => dispatch(loadCalEvents())}
              disabled={loading}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <RefreshIcon sx={{ fontSize: iconSize.header }} />
            </IconButton>
          </>
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
          <SegTabs
            ariaLabel="달력 보기 전환"
            items={[
              { value: 'agenda', label: '목록' },
              { value: 'month', label: '월' },
              { value: 'timeweek', label: '주' },
            ] as const}
            value={view}
            onChange={setView}
          />

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
              <Box role="group" aria-label="기간 이동" sx={{ display: 'inline-flex', alignItems: 'stretch', height: 34, border: '1px solid', borderColor: 'divider', borderRadius: `${radius.button}px`, overflow: 'hidden', bgcolor: 'background.paper' }}>
                <Box component="button" aria-label="이전" onClick={() => shift(-1)} sx={{ ...navBtn, width: 32 }}><ChevronLeftIcon sx={{ fontSize: iconSize.header }} /></Box>
                <Box sx={sep} />
                <Box component="button" onClick={goToday} sx={{ ...navBtn, px: '14px', fontSize: 13, fontWeight: 600 }}>오늘</Box>
                <Box sx={sep} />
                <Box component="button" aria-label="다음" onClick={() => shift(1)} sx={{ ...navBtn, width: 32 }}><ChevronRightIcon sx={{ fontSize: iconSize.header }} /></Box>
              </Box>
            )
          })()}

          <Typography component="span" sx={{ ml: '2px', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            {periodLabel}
          </Typography>
        </Box>

        {/* 검색 — 우측(주말 보기 왼쪽). 좁은 화면에서는 한 줄 전체로 내려감(order 3 + basis 100%) */}
        <Box sx={{ order: { xs: 3, sm: 2 }, ml: { sm: 'auto' }, flex: { xs: '1 1 100%', sm: '0 1 240px' }, maxWidth: { sm: 260 } }}>
          <SearchBar value={search} onChange={setSearch} placeholder="검색 (팀원·구분·내용)" width="100%" />
        </Box>

        {/* 주말 보기 — 검색 오른쪽 */}
        <Box
          component="button"
          onClick={() => setShowWeekends((s) => !s)}
          sx={{
            order: { xs: 2, sm: 3 }, flex: '0 0 auto',
            height: 34, px: '14px', borderRadius: `${radius.button}px`, border: '1px solid',
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
            if (!el) {
              // 빈 날짜 칸 클릭(관리자) = 그 날짜로 작성 모달 — 일정·링크·팝오버 열림 상태는 제외
              if (
                isAdmin &&
                !lockedEl.current &&
                Date.now() >= dragClickSuppress.current &&
                !(e.target as HTMLElement).closest('a, button, .fc-more-link, .fc-popover')
              ) {
                const dayEl = (e.target as HTMLElement).closest('[data-date]')
                const date = dayEl?.getAttribute('data-date')
                if (date) setWrite({ mode: 'add', event: null, initialDate: date.slice(0, 10) })
              }
              return // 팝오버 닫기는 바깥-클릭 핸들러가 담당
            }
            e.stopPropagation() // 바깥-클릭 닫기로 전파 방지(하나의 클릭 경로)
            if (Date.now() < dragClickSuppress.current) return // 드래그 드롭 직후 클릭 무시
            const evId = idMap.current.get(el)
            // 관리자: 일정 클릭 = 수정 모달 바로 열기(상세 팝오버 단계 생략)
            if (isAdmin && evId) {
              const ev = allEvents.find((e2) => e2.id === evId)
              closePop()
              if (ev) setWrite({ mode: 'edit', event: ev, initialDate: ev.start.slice(0, 10) })
              return
            }
            // 열람 사용자: 기존 잠금 상세 팝오버(재클릭=닫기)
            const detail = detailMap.current.get(el)
            if (lockedEl.current === el) {
              closePop()
            } else if (detail) {
              lockedEl.current = el
              setPop({ detail, x: e.clientX, y: e.clientY, locked: true, evId })
            }
          }}
        >
          <FullCalendar
            ref={calRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={isMobile ? 'listMonth' : 'dayGridMonth'}
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
            // ── 구글캘린더식 상호작용(관리자만): 날짜 클릭=작성, 일정 드래그=이동, 끝단 드래그=기간 변경 ──
            editable={isAdmin}
            eventStartEditable={isAdmin}
            eventDurationEditable={isAdmin}
            eventDragStop={() => { dragClickSuppress.current = Date.now() + 400 }}
            eventDrop={(info: EventDropArg) => {
              dragClickSuppress.current = Date.now() + 400
              const ev = allEvents.find((e2) => e2.id === info.event.id)
              if (!ev || !info.event.start) return info.revert()
              void commitEventChange(ev, info.event.start, info.event.end, () => info.revert())
            }}
            eventResize={(info: EventResizeDoneArg) => {
              dragClickSuppress.current = Date.now() + 400
              const ev = allEvents.find((e2) => e2.id === info.event.id)
              if (!ev || !info.event.start) return info.revert()
              void commitEventChange(ev, info.event.start, info.event.end, () => info.revert())
            }}
            // 범위 드래그 선택 — 하이라이트 미리보기(FC 기본) 후 놓으면 그 구간으로 작성 모달.
            // 하루짜리 선택(단일 클릭)은 위임 클릭 경로가 담당하므로 무시(이중 오픈 방지).
            selectable={isAdmin}
            select={(info) => {
              const spanDays = Math.round((info.end.getTime() - info.start.getTime()) / 86400000)
              if (!info.allDay || spanDays <= 1) return
              dragClickSuppress.current = Date.now() + 400
              const startStr = fmtFc(info.start, false)
              const endStr = shiftDt(fmtFc(info.end, false), { days: -1 })
              setWrite({ mode: 'add', event: null, initialDate: startStr, initialEndDate: endStr })
            }}
            eventDisplay="block"
            eventContent={renderEventContent}
            // 실제 보이는 날짜 범위(activeStart/activeEnd) → 종류별 건수 집계 기준. 이동·뷰전환 시 즉시 갱신.
            datesSet={(arg) => setVisRange({ start: arg.start, end: arg.end })}
            // 각 segment(.fc-event) → 원본 상세 매핑만 등록. 실제 hit 판정은 컨테이너 위임이 담당.
            eventDidMount={(info) => {
              detailMap.current.set(info.el, info.event.extendedProps.detail as EventDetail)
              idMap.current.set(info.el, String(info.event.id))
            }}
            eventWillUnmount={(info) => {
              detailMap.current.delete(info.el)
              idMap.current.delete(info.el)
              if (lockedEl.current === info.el) closePop()
            }}
            dayMaxEvents={view === 'month' ? 3 : false}
            moreLinkContent={(arg) => `+${arg.num}건`}
            height="auto"
            dayCellContent={(arg) => String(arg.date.getDate())}
          />
        </Box>
      </Box>

      {pop && (
        <EventPopover
          detail={pop.detail}
          x={pop.x}
          y={pop.y}
          locked={pop.locked}
          onEdit={
            isAdmin && pop.evId
              ? () => {
                  const ev = allEvents.find((e2) => e2.id === pop.evId) || null
                  closePop()
                  if (ev) setWrite({ mode: 'edit', event: ev, initialDate: ev.start.slice(0, 10) })
                }
              : undefined
          }
        />
      )}

      {/* 일정 작성/수정 — 구글캘린더식 폼(세션 인증·반복 lite). 저장 후 재조회 + 안내 */}
      <CalEventWrite
        open={!!write}
        mode={write?.mode || 'add'}
        event={write?.event || null}
        initialDate={write?.initialDate || todayKey}
        initialEndDate={write?.initialEndDate}
        onClose={() => setWrite(null)}
        onSaved={(msg) => {
          setWrite(null)
          snack(msg)
          dispatch(loadCalEvents())
        }}
      />
    </PageContainer>
  )
}
