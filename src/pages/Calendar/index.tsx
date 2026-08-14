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
import Button from '@mui/material/Button'
import { alpha } from '@mui/material/styles'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { PageContainer, PageHeader, SegTabs, ErrorBanner, LoadingState, useSnack } from '@/components/ds'
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
import CalEventWrite, { type CalDraft } from './CalEventWrite'
import { updateCalEvent } from '@/api/calendar'
import { iconSize, layout, radius, control, typescale, weight } from '@/theme/tokens'
import { usePageImprovementMemo } from '@/components/PageImprovementMemo'
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
  if (view === 'day') return { start: anchor, end: addDays(anchor, 1) }
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

// 'day' = 하루 시간표. 탭으로 고르는 뷰가 아니라 **월간에서 날짜를 누르면 들어가는 화면**이다
// (구글캘린더식 — 사용자 지시 2026-08-09). 여기서 시간대를 누르거나 끌어 일정을 만든다.
type ViewKey = 'month' | 'timeweek' | 'agenda' | 'day'

function renderEventContent(arg: EventContentArg, isMobile: boolean) {
  // 새 일정 초안 막대(모달 열림 중 미리보기) — 단순 흰 글자 바
  if (arg.event.extendedProps.draft) {
    return (
      <Box sx={{ px: '4px', fontSize: typescale.small.size, fontWeight: weight.bold, color: 'common.white', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {arg.event.title}
      </Box>
    )
  }
  const chip = arg.event.extendedProps as unknown as ChipContentProps
  // 주 시간표의 시간일정만 'timed'(2줄 가능), 그 외(월간·종일행)는 'daygrid'.
  const variant: 'daygrid' | 'timed' = !arg.event.allDay && arg.view.type === 'timeGridWeek' ? 'timed' : 'daygrid'
  // 멀티데이 = 1일 초과 span (FullCalendar가 정규화한 start/end 기준). 주 단위로 나뉜 구간도 동일 적용.
  const ms = (arg.event.end?.getTime() ?? 0) - (arg.event.start?.getTime() ?? 0)
  const multiDay = ms > 24 * 3600 * 1000 + 60000
  // 목록(listMonth) 뷰는 FullCalendar가 왼쪽 .fc-list-event-time 셀에 시간을 이미 렌더하므로
  // 칩(제목 셀) 안에서 시간을 또 표시하면 중복 노출됨 → 목록에서는 칩 시간 생략.
  const time = arg.view.type === 'listMonth' ? '' : chip.time
  // 모바일 월간·주간은 칸이 좁아 2줄 배치(compact). 목록은 행이 가로로 넓으니 종류칩 배치(catChip).
  const compact = isMobile && (arg.view.type === 'dayGridMonth' || arg.view.type === 'timeGridWeek')
  const catChip = arg.view.type === 'listMonth'
  // 모바일 월간·주간은 **제목만**(2026-08-14 사용자 지시) — 아이콘·시간은 탭하면 뜨는 상세 카드로.
  // 월간은 한 줄, 주간 시간일정은 칸이 세로로 넉넉하면 두 줄까지(ChipContent titleOnly).
  const titleOnly = compact
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
        compact={compact}
        catChip={catChip}
        titleOnly={titleOnly}
      />
    </Box>
  )
}

export default function Calendar() {
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, error, errorMsg, updatedAt, ready } = useAppSelector((s) => s.cal)

  // 복수선택 버튼·모바일 기본뷰 판정. 폰(≤768px)은 월 그리드 대신 목록(아젠다) 뷰가 기본.
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true })
  // 개선 메모 — 칩을 툴바(뷰 전환 오른쪽)에 두려고 PageHeader 대신 이 페이지가 직접 그린다.
  // PageHeader 쪽은 suppressImprovementMemo 로 껐다(두 군데서 그리면 열림 상태가 갈라진다).
  const memo = usePageImprovementMemo()
  // 마지막으로 보던 뷰 기억(localStorage) — 없으면 기기 기본(모바일=목록, PC=월)
  const [view, setView] = useState<ViewKey>(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem('cal:view') } catch { /* 저장소 차단 환경(사생활 모드 등) */ }
    return saved === 'month' || saved === 'timeweek' || saved === 'agenda' ? saved : isMobile ? 'agenda' : 'month'
  })
  const [anchor, setAnchor] = useState<Date>(() => parseKey(todaySeoul()))
  // 검색창은 삭제(사용자 지시 2026-08-09 — 상단바 전역검색으로 대체). 걸러내는 로직은 손대지 않고
  // 입력만 없앤 상태라, 되살릴 땐 이 줄을 useState 로 되돌리고 SearchBar 한 줄만 다시 넣으면 된다.
  // ⚠ 상단바 전역검색(GlobalSearchDialog)은 공지·업무현황·장비 4종만 훑고 **일정은 안 훑는다**.
  const search = ''
  const [selMembers, setSelMembers] = useState<string[]>([]) // 빈 배열 = 전체 선택
  const [selCats, setSelCats] = useState<RealCat[]>([]) // 빈 배열 = 전체(종류 필터 없음)
  // 복수선택 버튼·주말보기 버튼 삭제(사용자 지시 2026-08-09).
  //  · 복수선택: PC 는 Shift+클릭이 그대로 남는다. 모바일은 추가선택 수단이 없어진다.
  //  · 주말: 항상 숨김(평일 5열)으로 고정 — 버튼이 있던 시절의 기본값과 같다.
  const showWeekends = false
  // 화면에 실제로 보이는 날짜 범위(FC activeStart/activeEnd). 종류별 건수 집계에 사용. datesSet에서 실제값 주입.
  const [visRange, setVisRange] = useState<{ start: Date; end: Date }>(() => gridRange(view, parseKey(todaySeoul())))
  const calRef = useRef<FullCalendar>(null)

  // 호버·클릭 상세 — 마우스 위치 기준. 호버(locked=false)는 포인터를 따라다니고, 클릭(locked=true)은 그 자리 고정.
  const [pop, setPop] = useState<{ detail: EventDetail; x: number; y: number; locked: boolean; evId?: string; anchorRect?: { left: number; top: number } } | null>(null)
  // 일정 작성/수정 모달(구성원) + 저장 안내 스낵바 — 5단계: 캘린더 쓰기 UI 연결(Supabase·세션 인증)
  const { isMember } = useRole() // 구성원 쓰기 개방(2026-08-05)
  const snack = useSnack()
  const [write, setWrite] = useState<{ mode: 'add' | 'edit'; event: CalEvent | null; initialDate: string; initialEndDate?: string; initialStartTime?: string; initialEndTime?: string } | null>(null)
  // 새 일정 초안 — 누르는 순간부터 '(새 일정)' 막대로 미리보기(임시 일정이라 기존 일정을 안 덮음).
  // 그리드 제스처(월간): pointerdown=막대 생성 → 드래그로 기간 확장 → pointerup=모달. 모달이 열린 뒤에도 이어서 표시.
  const [draft, setDraft] = useState<CalDraft | null>(null)
  const draftRef = useRef<CalDraft | null>(null)
  draftRef.current = draft
  const createDrag = useRef<{ startDate: string; pointerId: number; touch: boolean; x0: number; y0: number } | null>(null)
  const idMap = useRef(new WeakMap<HTMLElement, string>()) // segment → 일정 id (수정 진입용)
  const dragClickSuppress = useRef(0) // 드래그 드롭 직후 합성 click이 팝오버를 고정하는 것 방지
  // 모바일 기간 이동 스와이프 — 이전·다음 버튼을 없앤 대신(사용자 지시 2026-08-08) 달력을 좌우로 민다.
  // fired: 한 번의 손가락 동작에서 두 달이 넘어가지 않게 하는 잠금.
  const swipe = useRef<{ id: number; x0: number; y0: number; fired: boolean } | null>(null)
  /** 방금 스와이프한 방향(1=다음, -1=이전) — datesSet 에서 새 기간이 밀려 들어오는 효과를 한 번 준다(요청메모 82) */
  const swipeFx = useRef(0)
  /** 효과를 걸 달력 래퍼 — FullCalendar DOM 이 아니라 우리 상자를 움직인다(FC 재렌더와 안 얽히게) */
  const calBoxRef = useRef<HTMLDivElement | null>(null)

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
  // 포인터 (x,y)가 가리키는 날짜 칸의 날짜 — 제스처 드래그용(포인터 캡처 중엔 e.target이 고정이라 좌표로 찾음)
  const findDayAt = (x: number, y: number): string | null => {
    const stack = document.elementsFromPoint(x, y) as HTMLElement[]
    for (const el of stack) {
      const d = el.closest?.('[data-date]') as HTMLElement | null
      if (d) return (d.getAttribute('data-date') || '').slice(0, 10) || null
    }
    return null
  }

  // 일정 열기(마우스 클릭·키보드 Enter 공용) — 구성원=수정 모달 바로, 열람=그 자리 고정 상세(재실행=닫기).
  // 예외: **모바일 월간·주간은 구성원도 상세 카드 먼저**(2026-08-14 사용자 지시) — 칩이 제목만 남아
  // 시간·종류를 볼 길이 상세뿐이고, 탭하자마자 수정 모달이 덮치면 '보기'가 불가능하다.
  // 수정은 카드 안 '수정' 버튼으로(EventPopover 에 이미 있던 버튼 — 이 경로로 처음 실사용된다).
  const openEventAt = (el: HTMLElement, x: number, y: number) => {
    const evId = idMap.current.get(el)
    const mobileCardDetail = isMobile && (view === 'month' || view === 'timeweek')
    if (isMember && evId && !mobileCardDetail) { // 구성원 쓰기 개방(2026-08-05)
      const ev = allEvents.find((e2) => e2.id === evId)
      closePop()
      if (ev) setWrite({ mode: 'edit', event: ev, initialDate: ev.start.slice(0, 10) })
      return
    }
    const detail = detailMap.current.get(el)
    if (lockedEl.current === el) {
      closePop()
    } else if (detail) {
      lockedEl.current = el
      // 칩의 화면 사각형 — 모바일 카드가 '그 칩 자리에서 우하단으로 피어나게' 하는 닻(요청메모 84 후속)
      const r = el.getBoundingClientRect()
      setPop({ detail, x, y, locked: true, evId, anchorRect: { left: r.left, top: r.top } })
    }
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
      if (e.key === 'Escape') {
        closePop()
        // 진행 중인 새 일정 드래그 제스처도 취소
        if (createDrag.current) {
          createDrag.current = null
          setDraft(null)
        }
      }
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
    const fcView = view === 'month' ? 'dayGridMonth' : view === 'agenda' ? 'listMonth' : view === 'day' ? 'timeGridDay' : 'timeGridWeek'
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

  // 미니달력에서 화면 밖 날짜를 고르면 달력이 따라감 — 초안 미리보기가 항상 보이게(적대 리뷰 확정)
  useEffect(() => {
    if (!draft) return
    const d = parseKey(draft.start)
    if (d < visRange.start || d >= visRange.end) setAnchor(d)
  }, [draft, visRange])

  // 계정 개인화 뷰 — 설정 로드되면 서버 저장값으로 1회 동기화(기기 넘나들며 유지)
  const usReady = useAppSelector((s) => s.userSettings.ready)
  const svCalView = useAppSelector((s) => s.userSettings.settings['cal.view'] as string | undefined)
  const svViewApplied = useRef(false)
  useEffect(() => {
    if (!usReady || svViewApplied.current) return
    svViewApplied.current = true
    if (svCalView === 'month' || svCalView === 'timeweek' || svCalView === 'agenda') setView(svCalView)
  }, [usReady, svCalView])
  // 뷰 변경 시 로컬 캐시(즉시). 계정 저장은 사용자가 토글로 바꾼 순간만(SegTabs onChange) —
  // 마운트 자동 저장은 로컬 초기값이 서버 복원값을 선점·덮어써 기기 간 동기화를 깨므로 금지(2026-07-25 UX 감사).
  useEffect(() => {
    // 'day'는 저장하지 않는다 — 탭으로 고르는 뷰가 아니라 월간에서 잠깐 들어가는 화면이다.
    // 저장하면 다음 방문에 복원 대상이 못 돼(초기값 검사에서 탈락) 사용자가 고른 뷰가 기기 기본값으로 되돌아간다.
    if (view === 'day') return
    try { localStorage.setItem('cal:view', view) } catch { /* 저장 불가 무시 */ }
  }, [view])

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

  // 현재 화면 범위에서 실제로 보이는(모든 필터 통과) 일정 수 — 빈 상태 안내용(캘린더 UI 점검 #6)
  const visibleCount = useMemo(() => {
    const seen = new Set<string>()
    const { start, end } = visRange
    for (const ev of allEvents) {
      if (seen.has(ev.id)) continue
      const d = parseKey(ev.date)
      if (d < start || d >= end) continue
      if (!showWeekends && (d.getDay() === 0 || d.getDay() === 6)) continue
      if (!eventActive(ev)) continue
      seen.add(ev.id)
    }
    return seen.size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, visRange, showWeekends, selMembers, selCats, searchTrim])

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
    const list = [...byId.values()].filter(eventActive).map((ev) => {
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
        // 0.18 → 0.40 (요청메모 84, 사용자 C안 선택 2026-08-14) — 배경만으로 종류가 구분되는 최소 채도.
        // 모바일에서 좌측 띠를 떼므로(같은 요청) 색을 배경이 대신 날라야 한다.
        backgroundColor: rgba(catColor, 0.4),
        borderColor: catColor,
        // 반복 일정 인스턴스는 드래그/리사이즈 제외 — 시리즈 전체가 움직이면 위험(개별 예외 미지원)
        editable: !ev.recurring,
        extendedProps: { ...props, detail, sortPri: 0 },
      }
    })
    // 새 일정 초안 막대 — 임시 일정으로 넣어 다른 일정과 같은 줄서기(겹침 없음). sortPri=1로 같은 날 맨 아래.
    if (draft) {
      list.push({
        id: '__draft',
        title: draft.title || '(새 일정)',
        start: draft.start,
        end: keyOf(addDays(parseKey(draft.end), 1)), // 종일 end는 미포함(다음 날)
        allDay: true,
        // 반투명이면 라이트에서 흰 달력 칸이 비쳐 배경이 밝아지고(#6EA2E0) 흰 제목이 2.67:1로 흐려진다.
        // 두 테마 공통 진한 파랑(--blue-solid)으로 불투명하게 — 흰 글자 5.7:1.
        backgroundColor: 'var(--blue-solid)',
        borderColor: 'var(--blue-solid)',
        editable: false,
        extendedProps: { draft: true, sortPri: 1 } as never,
      } as (typeof list)[number])
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, selCats, selMembers, searchTrim, draft])

  // 주간 기간 라벨용
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])

  // ── 네비게이션 ──
  const shift = (dir: number) => {
    setAnchor((a) =>
      view === 'day' ? addDays(a, dir)
        : view === 'timeweek' ? addDays(a, dir * 7)
          : new Date(a.getFullYear(), a.getMonth() + dir, 1),
    )
  }
  const goToday = () => setAnchor(parseKey(todayKey))

  // 툴바 왼쪽 짧은 라벨 — 뷰 전환 버튼 좌측에 굵게(사용자 지시 2026-08-09).
  // 일간은 어느 날에 들어와 있는지가 핵심이라 날짜·요일까지 쓴다.
  const shortLabel = view === 'day'
    ? `${anchor.getMonth() + 1}월 ${anchor.getDate()}일 (${'일월화수목금토'[anchor.getDay()]})`
    : `${anchor.getMonth() + 1}월`

  const periodLabel = useMemo(() => {
    if (view === 'day') return `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월 ${anchor.getDate()}일`
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
        title="업무일정"
        // 모바일은 하단 탭바가 이미 '일정'을 보여 준다 — 제목 줄을 비워 달력을 위로 끌어올린다(사용자 지시 2026-08-08)
        hideTitleOnMobile
        suppressImprovementMemo
        // 모바일은 액션을 **통째로 넘기지 않는다**. 안에서 조건부로 비우면 빈 액션 박스가 40px(+아래 여백 24px)를
        // 그대로 차지해 제목을 지운 효과가 사라진다 — 실측으로 확인(2026-08-09).
        //  · 일정 추가: 모바일 삭제(사용자 지시). 월간에서 날짜를 눌러 들어간 일간 화면에서 시간대로 만든다.
        //  · 새로고침: 모바일 삭제(사용자 지시). PC는 유지 — 구글캘린더 양방향 연동이라 다시 받아올 길이 필요하다.
        actions={isMobile ? undefined : (
          <>
            {isMember && (
              <Button
                size="small"
                variant="contained"
                startIcon={<AddIcon sx={{ fontSize: iconSize.action }} />}
                sx={{ minHeight: control.height }}
                onClick={() => setWrite({ mode: 'add', event: null, initialDate: todayKey })}
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
        )}
      />

      {/* 일정 불러오기 최종 실패 — 표준 ErrorBanner(다른 페이지와 동일 부품). 기존 일정이 있으면 유지 표시 중임을 알림 */}
      {error && (
        <ErrorBanner
          severity={allEvents.length > 0 ? 'warning' : 'error'}
          message={
            (allEvents.length > 0
              ? `일정 새로고침에 실패했습니다. 마지막으로 불러온 일정(${updatedAt || '이전'})을 표시 중입니다.`
              : '일정을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.') +
            (errorMsg ? ` — ${errorMsg}` : '')
          }
          onRetry={() => dispatch(loadCalEvents())}
          busy={loading}
        />
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
            // 일간은 탭이 없는 화면이라 '월'을 켠 상태로 둔다 — 그대로 누르면 월간으로 빠져나온다
            value={view === 'day' ? 'month' : view}
            onChange={(v) => { setView(v); dispatch(putSetting({ key: 'cal.view', value: v })) }}
          />

          {/* 짧은 기간 라벨 — 이전·다음 버튼을 없앤 모바일에서 '지금 몇 월인지'를 알려 주는 유일한 표시.
              목록/월/주 버튼 **오른쪽**에, 글자는 한 단 큰 18px(요청메모 82 — 종전엔 버튼 왼쪽 16px).
              일간에서는 누르면 월간으로 돌아가는 뒤로가기도 겸한다(2026-08-09). */}
          {isMobile && (
            <Box
              component={view === 'day' ? 'button' : 'span'}
              {...(view === 'day' ? { onClick: () => setView('month'), 'aria-label': `${shortLabel} — 월간으로 돌아가기` } : {})}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: '2px', flex: 'none',
                fontSize: typescale.sectionTitle.size, fontWeight: weight.bold, letterSpacing: '-0.03em', whiteSpace: 'nowrap',
                color: 'text.primary', fontFamily: 'inherit',
                ...(view === 'day' ? { border: 'none', bgcolor: 'transparent', p: 0, cursor: 'pointer' } : {}),
              }}
            >
              {view === 'day' && <ChevronLeftIcon sx={{ fontSize: iconSize.header, ml: '-4px' }} />}
              {shortLabel}
            </Box>
          )}

          {/* 개선 메모(전구) — 제목 줄에 있던 것을 뷰 전환 버튼 바로 오른쪽으로 옮겼다(사용자 지시 2026-08-09).
              **모바일에서만** 그린다: PC에는 붙임쪽지가 같은 메모를 이미 띄우고 있어서, 여기 전구가
              목록/월/주 옆에 붙으면 뷰 전환 버튼이 하나 더 생긴 것처럼 보였다(개선요청 74). */}
          {isMobile && memo.chip}

          {/* 이전 · 오늘 · 다음 — PC 전용. 모바일은 이 줄을 통째로 없애고 달력을 좌우로 밀어 이동한다
              (사용자 지시 2026-08-08 — 툴바가 6줄이나 차지해 달력이 화면 밖으로 밀리던 문제). */}
          {!isMobile && (() => {
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
                <Box component="button" onClick={goToday} sx={{ ...navBtn, px: '14px', fontSize: typescale.body.size, fontWeight: weight.semibold }}>오늘</Box>
                <Box sx={sep} />
                <Box component="button" aria-label="다음" onClick={() => shift(1)} sx={{ ...navBtn, width: 32 }}><ChevronRightIcon sx={{ fontSize: iconSize.header }} /></Box>
              </Box>
            )
          })()}

          {!isMobile && (
            <Typography component="span" sx={{ ml: '2px', fontSize: typescale.cardTitle.size, fontWeight: weight.bold, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              {periodLabel}
            </Typography>
          )}
        </Box>

      </Box>

      {/* 상단 필터 바 — 팀원·일정 종류만 */}
      <CalFilterBar
        members={sidebarMembers}
        onToggleMember={toggleMember}
        cats={sidebarCats}
        onToggleCat={toggleCat}
      />

      {/* 개선 메모 패널·스낵바 — 칩을 툴바로 옮겼으므로 패널도 PageHeader 대신 여기서 그린다.
          패널은 칩과 한 몸이라 함께 모바일 전용. 스낵바는 폭과 무관하게 남긴다(PageHeader 와 같은 규칙). */}
      {isMobile && memo.panel}
      {memo.snackbar}

      {/* 달력 (풀폭) — 컨테이너 위임: 포인터 위치의 .fc-event를 elementsFromPoint로 찾아
          모든 멀티데이 segment(시작·중간·마지막, 텍스트 없는 빈 영역 포함)에서 호버·클릭 동작.
          호버 상세는 포인터를 따라다니고(기존 동작 유지), 클릭은 그 자리에 고정. */}
      <Box sx={{ minWidth: 0, position: 'relative' }}>
        <Box
          ref={calBoxRef}
          className="fc-theme-angels fc-team"
          // pan-y: 세로 스크롤은 브라우저에 맡기고 가로는 우리가 받는다. 이게 없으면 가로로 미는 순간
          // 브라우저가 페이지 가로 패닝(.page{overflow-x:auto})을 가져가며 pointercancel 이 떨어져 스와이프가 죽는다.
          // 모바일은 페이지 좌우 여백(16px)을 상쇄해 화면 끝까지 채운다(요청메모 82 — 구글캘린더처럼).
          // 뷰마다 폭이 널뛰지 않게 월간만이 아니라 달력 전체에 준다. 외곽 세로선 제거는 index.css 모바일 블록.
          sx={{ touchAction: isMobile ? 'pan-y' : undefined, mx: { xs: `-${layout.pageXMobile}px`, shell: 0 } }}
          // 새 일정 제스처(월간·구성원): 빈 날짜 칸을 누르는 순간 '(새 일정)' 막대 생성 → 드래그로 기간 확장 → 놓으면 모달.
          // 사용자 확정: "누를 때부터 막대" — 셀 틴트(FC selectable) 대신 임시 일정 막대가 처음부터 보인다.
          onPointerDown={(e) => {
            // 기간 이동 스와이프 등록 — 일정 위에서 시작한 손짓은 FullCalendar 의 열기·이동에 양보한다
            if (isMobile && e.pointerType !== 'mouse' && !findEvAt(e.clientX, e.clientY)) {
              swipe.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, fired: false }
            }
            // 모바일 월간은 이 제스처를 쓰지 않는다 — 날짜를 누르면 그날 시간표로 들어가는 쪽으로 바뀌었다(onClick)
            if (!isMember || view !== 'month' || e.button !== 0 || isMobile) return // 구성원 쓰기 개방(2026-08-05)
            if (lockedEl.current) return // 상세 팝오버 열림 중엔 기존처럼 '닫기'만(생성 시작 안 함)
            const t = e.target as HTMLElement
            if (findEvAt(e.clientX, e.clientY)) return // 일정 위 — 열기/이동 제스처에 양보
            if (t.closest('a, button, .fc-more-link, .fc-popover')) return
            const dayEl = t.closest('[data-date]')
            const d = dayEl?.getAttribute('data-date')?.slice(0, 10)
            if (!d) return
            const touch = e.pointerType !== 'mouse'
            createDrag.current = { startDate: d, pointerId: e.pointerId, touch, x0: e.clientX, y0: e.clientY }
            if (!touch) {
              e.preventDefault() // 드래그 중 텍스트 선택 방지(마우스만 — 터치는 스크롤 보존)
              try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* 미지원 무시 */ }
            }
            setDraft({ start: d, end: d, title: '' })
          }}
          onPointerUp={(e) => {
            if (swipe.current?.id === e.pointerId) swipe.current = null
            const cd = createDrag.current
            if (!cd || e.pointerId !== cd.pointerId) return
            createDrag.current = null
            try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* no-op */ }
            // 드래그를 일정 칩 위에서 놓아도 뒤따르는 합성 click이 그 일정의 수정 모달로 덮어쓰지 않게 억제
            dragClickSuppress.current = Date.now() + 400
            const cur = draftRef.current
            const s = cur?.start ?? cd.startDate
            const en = cur?.end ?? cd.startDate
            setWrite({ mode: 'add', event: null, initialDate: s, initialEndDate: en !== s ? en : undefined })
          }}
          onPointerCancel={() => {
            swipe.current = null
            if (createDrag.current) {
              createDrag.current = null
              setDraft(null)
            }
          }}
          onPointerMove={(e) => {
            const x = e.clientX
            const y = e.clientY
            // 기간 이동 스와이프 — 가로가 세로보다 뚜렷하게 우세할 때만(세로 스크롤과 헷갈리지 않게)
            const sw = swipe.current
            if (sw && e.pointerId === sw.id && !sw.fired) {
              const dx = x - sw.x0
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(y - sw.y0) * 1.6) {
                sw.fired = true // 한 손짓에 한 칸만
                createDrag.current = null // 같은 손짓으로 떴던 '(새 일정)' 막대는 취소
                setDraft(null)
                dragClickSuppress.current = Date.now() + 400
                swipeFx.current = dx < 0 ? 1 : -1 // 새 기간이 민 방향에서 들어오는 효과용(datesSet 에서 소비)
                shift(dx < 0 ? 1 : -1) // 왼쪽으로 밀면 다음 기간
                return
              }
            }
            // 새 일정 드래그 중 — 기간 확장(마우스) / 이동 크면 스크롤로 간주해 취소(터치)
            const cd = createDrag.current
            if (cd) {
              if (cd.touch) {
                if (Math.abs(x - cd.x0) > 8 || Math.abs(y - cd.y0) > 8) {
                  createDrag.current = null
                  setDraft(null)
                }
              } else {
                const dd = findDayAt(x, y)
                if (dd) {
                  const [s, en] = dd < cd.startDate ? [dd, cd.startDate] : [cd.startDate, dd]
                  setDraft((p) => (p && p.start === s && p.end === en ? p : { start: s, end: en, title: '' }))
                }
              }
              return // 제스처 중엔 호버 팝오버 갱신 안 함
            }
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
              // 모바일 월간: 날짜를 누르면 그날 시간표(일간)로 들어간다 — 구글캘린더식(사용자 지시 2026-08-09).
              // 일정 추가 버튼을 없앤 대신, 추가는 그 화면에서 시간대를 누르거나 끌어서 한다.
              if (
                isMobile && view === 'month' &&
                !lockedEl.current &&
                Date.now() >= dragClickSuppress.current &&
                !(e.target as HTMLElement).closest('a, button, .fc-more-link, .fc-popover')
              ) {
                const d = (e.target as HTMLElement).closest('[data-date]')?.getAttribute('data-date')
                if (d) {
                  setAnchor(parseKey(d.slice(0, 10)))
                  setView('day')
                  return
                }
              }
              // 빈 날짜 칸 클릭 = 작성 모달. 월간은 pointer 제스처(누를 때부터 막대)가 담당하므로 그 외 뷰만 여기서 처리
              if (
                view !== 'month' &&
                isMember && // 구성원 쓰기 개방(2026-08-05)
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
            openEventAt(el, e.clientX, e.clientY)
          }}
          // 키보드 접근(감사 E1) — Tab으로 일정(.fc-event, eventInteractive) 포커스 후 Enter/Space로 열기.
          // 위치는 포커스된 일정 막대 아래 중앙(마우스 좌표 대체).
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            const el = (e.target as HTMLElement).closest?.('.fc-event, .fc-list-event') as HTMLElement | null
            if (!el || !detailMap.current.has(el)) return
            e.preventDefault()
            e.stopPropagation()
            const r = el.getBoundingClientRect()
            openEventAt(el, Math.round(r.left + r.width / 2), Math.round(r.bottom))
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
            // ── 구글캘린더식 상호작용(구성원): 날짜 클릭=작성, 일정 드래그=이동, 끝단 드래그=기간 변경 ──
            // 구성원 쓰기 개방(2026-08-05)
            editable={isMember}
            eventStartEditable={isMember}
            eventDurationEditable={isMember}
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
            // 범위 드래그 선택 — 월간은 자체 제스처('(새 일정)' 막대)가 대체하므로 주(시간표) 뷰에서만 FC selectable.
            // 범위 드래그 선택 — 월간은 자체 제스처가 대체하므로 시간표 뷰(주·일)에서만.
            selectable={isMember && (view === 'timeweek' || view === 'day')} // 구성원 쓰기 개방(2026-08-05)
            select={(info) => {
              dragClickSuppress.current = Date.now() + 400
              // 시간대 선택(누르기 = 한 칸, 끌기 = 그 구간) → 그 시각이 채워진 작성 모달.
              // 일정 추가 버튼을 없앤 모바일에서 이게 유일한 추가 경로다(사용자 지시 2026-08-09).
              if (!info.allDay) {
                setWrite({
                  mode: 'add', event: null,
                  initialDate: fmtFc(info.start, false),
                  initialStartTime: fmtFc(info.start, true).slice(11, 16),
                  initialEndTime: fmtFc(info.end, true).slice(11, 16),
                })
                return
              }
              const spanDays = Math.round((info.end.getTime() - info.start.getTime()) / 86400000)
              if (spanDays <= 1) return
              const startStr = fmtFc(info.start, false)
              const endStr = shiftDt(fmtFc(info.end, false), { days: -1 })
              setWrite({ mode: 'add', event: null, initialDate: startStr, initialEndDate: endStr })
            }}
            eventDisplay="block"
            eventContent={(arg) => renderEventContent(arg, isMobile)}
            // 실제 보이는 날짜 범위(activeStart/activeEnd) → 종류별 건수 집계 기준. 이동·뷰전환 시 즉시 갱신.
            datesSet={(arg) => {
              setVisRange({ start: arg.start, end: arg.end })
              /* 스와이프 전환 효과(요청메모 82) — 새 기간이 민 방향에서 살짝 밀려 들어온다.
                 FC 는 제자리 재렌더라 두 달이 나란히 미끄러지는 완전한 슬라이드는 못 만들고,
                 단방향 들어오기가 현실적인 최선. WAAPI 라 연속 스와이프에도 매번 다시 걸린다.
                 prefers-reduced-motion 이면 걸지 않는다. */
              const dir = swipeFx.current
              swipeFx.current = 0
              const el = calBoxRef.current
              if (dir && el && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                el.animate(
                  [{ transform: `translateX(${dir * 28}px)`, opacity: 0.35 }, { transform: 'none', opacity: 1 }],
                  { duration: 220, easing: 'ease-out' },
                )
              }
            }}
            // 각 segment(.fc-event) → 원본 상세 매핑만 등록. 실제 hit 판정은 컨테이너 위임이 담당.
            // 같은 날 줄서기: 초안 막대(sortPri=1)는 기존 일정 뒤로
            eventOrder="sortPri,start,-duration,allDay,title"
            eventDidMount={(info) => {
              // 초안 막대(detail 없음)는 호버·클릭 대상에서 제외
              const detail = info.event.extendedProps.detail as EventDetail | undefined
              if (!detail) return
              detailMap.current.set(info.el, detail)
              idMap.current.set(info.el, String(info.event.id))
            }}
            eventWillUnmount={(info) => {
              detailMap.current.delete(info.el)
              idMap.current.delete(info.el)
              if (lockedEl.current === info.el) closePop()
            }}
            // 초안 막대가 열려 있는 동안은 한 줄 여유(+1) — 일정 3건인 날에서 미리보기가 '+N건'으로 접히지 않게(적대 리뷰 확정)
            dayMaxEvents={view === 'month' ? (draft ? 4 : 3) : false}
            moreLinkContent={(arg) => `+${arg.num}건`}
            height="auto"
            dayCellContent={(arg) => String(arg.date.getDate())}
            // 키보드 접근 — 일정에 tabindex 부여(Tab 순회 가능). 열기는 컨테이너 onKeyDown이 담당
            eventInteractive
          />
        </Box>

        {/* 첫 로드 — 격자 위 표준 로딩 오버레이(캘린더 UI 점검 #7) */}
        {!ready && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (th) => alpha(th.palette.background.default, 0.45), borderRadius: `${radius.card}px` }}>
            <LoadingState label="일정을 불러오는 중…" />
          </Box>
        )}
        {/* 빈 상태 — 이 범위·조건에 일정 0건(캘린더 UI 점검 #6). 목록(agenda) 뷰는 FC 자체 빈 안내가 있어 제외.
            첫 로드 실패(오류배너 표시 중·데이터 0)에는 '없어요' 안내가 모순이라 숨김(적대 리뷰 확정) */}
        {ready && !(error && allEvents.length === 0) && !draft && visibleCount === 0 && view !== 'agenda' && (
          <Box sx={{ position: 'absolute', left: 0, right: 0, top: '42%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
            <Box sx={{ px: 2, py: 1, borderRadius: `${radius.pill}px`, bgcolor: 'background.elevated', border: 1, borderColor: 'divider', fontSize: typescale.body.size, fontWeight: weight.semibold, color: 'text.secondary' }}>
              {selCats.length > 0 || selMembers.length > 0 || searchTrim
                ? '조건에 맞는 일정이 없어요 — 필터·검색을 확인해 보세요'
                : '이 기간에는 일정이 없어요'}
            </Box>
          </Box>
        )}
      </Box>

      {pop && (
        <EventPopover
          detail={pop.detail}
          x={pop.x}
          y={pop.y}
          locked={pop.locked}
          anchorRect={isMobile ? pop.anchorRect : undefined}
          onEdit={
            // 구성원 쓰기 개방(2026-08-05)
            isMember && pop.evId
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
        initialStartTime={write?.initialStartTime}
        initialEndTime={write?.initialEndTime}
        onDraftChange={setDraft}
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
