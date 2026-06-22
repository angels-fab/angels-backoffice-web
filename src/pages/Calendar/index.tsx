import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventClickArg, EventContentArg } from '@fullcalendar/core'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceIcon from '@mui/icons-material/Place'
import RepeatIcon from '@mui/icons-material/Repeat'
import { PageContainer, PageHeader, AppDrawer, StatusChip } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'
import type { CalEvent } from '@/types'
import { todaySeoul } from '@/utils/date'
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'
import { MEMBERS, memberById, membersForEvent, given, cleanTitle, eventAvatar } from './members'
import CalSidebar from './CalSidebar'
import WeekBoard from './WeekBoard'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

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

type ViewKey = 'month' | 'week'

function renderEventContent(arg: EventContentArg) {
  const { chipText, dotColor, avatar } = arg.event.extendedProps as {
    chipText: string
    dotColor: string
    avatar?: string
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
      {avatar ? (
        <img
          src={avatar}
          alt=""
          style={{ width: 15, height: 15, borderRadius: '50%', objectFit: 'cover', flex: 'none' }}
        />
      ) : (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flex: 'none' }} />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chipText}</span>
    </div>
  )
}

export default function Calendar() {
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, updatedAt } = useAppSelector((s) => s.cal)

  const [view, setView] = useState<ViewKey>('month')
  const [anchor, setAnchor] = useState<Date>(() => parseKey(todaySeoul()))
  const [search, setSearch] = useState('')
  const [disabledMembers, setDisabledMembers] = useState<string[]>([])
  const [disabledCats, setDisabledCats] = useState<RealCat[]>([])
  const [detail, setDetail] = useState<CalEvent | null>(null)
  const calRef = useRef<FullCalendar>(null)

  const todayKey = todaySeoul()
  const searchTrim = search.trim()

  // 월 뷰: anchor 변경 시 FullCalendar 이동
  useEffect(() => {
    if (view === 'month') calRef.current?.getApi().gotoDate(keyOf(anchor))
  }, [anchor, view])

  // ── 필터 술어 ──
  const catActive = (cat: RealCat) => !disabledCats.includes(cat)
  const memberActive = (id: string) =>
    !disabledMembers.includes(id) && (searchTrim === '' || memberById(id).name.includes(searchTrim))
  const eventActive = (ev: CalEvent) =>
    catActive(ev.cat) && membersForEvent(ev.title).some(memberActive)

  const toggleMember = (id: string) =>
    setDisabledMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleCat = (id: RealCat) =>
    setDisabledCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

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
    () =>
      MEMBERS.filter((m) => searchTrim === '' || m.name.includes(searchTrim)).map((m) => ({
        member: m,
        on: !disabledMembers.includes(m.id),
      })),
    [searchTrim, disabledMembers],
  )
  const sidebarCats = CAT_ORDER.map((id) => ({
    id,
    label: CAT_META[id].label,
    color: CAT_META[id].color,
    count: catCounts[id] || 0,
    on: catActive(id),
  }))

  // ── 월 뷰(FullCalendar) 이벤트 ──
  const fcEvents = useMemo(() => {
    const byId = new Map<string, CalEvent>()
    for (const ev of allEvents) if (!byId.has(ev.id)) byId.set(ev.id, ev)
    return [...byId.values()].filter(eventActive).map((ev) => {
      const color = CAT_META[ev.cat].color
      const mems = membersForEvent(ev.title)
      const name0 = memberById(mems[0]).name
      const memberLabel = mems.length > 1 ? `${name0} 외${mems.length - 1}` : name0
      const body = cleanTitle(ev.title) || catShort(ev.cat)
      const avatar = eventAvatar(mems)
      return {
        id: ev.id,
        title: ev.title,
        start: ev.allDay ? ev.start.slice(0, 10) : ev.start,
        end: ev.allDay ? ev.end.slice(0, 10) : ev.end,
        allDay: ev.allDay,
        backgroundColor: rgba(color, 0.18),
        borderColor: 'transparent',
        // 아바타가 들어가는 칩은 이름 생략(아바타가 담당자를 나타냄)
        extendedProps: { chipText: avatar ? body : `${memberLabel} · ${body}`, dotColor: color, avatar },
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, disabledCats, disabledMembers, searchTrim])

  // ── 주 뷰(보드) 데이터 ──
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const visibleMembers = useMemo(
    () => MEMBERS.filter((m) => memberActive(m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabledMembers, searchTrim],
  )
  const weekEvents = useMemo(() => {
    const lo = keyOf(weekStart)
    const hi = keyOf(addDays(weekStart, 6))
    return allEvents.filter((ev) => catActive(ev.cat) && ev.date >= lo && ev.date <= hi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEvents, weekStart, disabledCats])

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

  const onEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault()
    const orig = allEvents.find((e) => e.id === info.event.id)
    if (orig) setDetail(orig)
  }

  // ── 상세 드로어 라벨 ──
  const d = detail
  const meta = d ? CAT_META[d.cat] : null
  const detailMembers = d ? membersForEvent(d.title).map(memberById) : []
  const fmtDay = (s: string) => {
    const dt = parseKey(s.slice(0, 10))
    return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DOW[dt.getDay()]})`
  }
  let dateRange = ''
  if (d) {
    const startKey = d.start.slice(0, 10)
    const lastKey = d.allDay ? keyOf(addDays(new Date(d.end), -1)) : d.end.slice(0, 10)
    dateRange = startKey === lastKey ? fmtDay(startKey) : `${fmtDay(startKey)} – ${fmtDay(lastKey)}`
  }
  const timeText = d ? (d.allDay ? '종일' : `${d.start.slice(11, 16)} – ${d.end.slice(11, 16)}`) : ''
  const loc = d && d.loc && d.loc !== '-' ? d.loc : ''

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
          {([{ k: 'month', l: '월' }, { k: 'week', l: '주' }] as const).map((t) => (
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
      </Box>

      {/* 본문 — 사이드바 + 메인 */}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <CalSidebar
          search={search}
          onSearch={setSearch}
          members={sidebarMembers}
          onToggleMember={toggleMember}
          cats={sidebarCats}
          onToggleCat={toggleCat}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {view === 'month' ? (
            <Box className="fc-theme-angels fc-team">
              <FullCalendar
                ref={calRef}
                plugins={[dayGridPlugin]}
                initialView="dayGridMonth"
                initialDate={keyOf(anchor)}
                locale={koLocale}
                headerToolbar={false}
                firstDay={0}
                fixedWeekCount={false}
                events={fcEvents}
                eventClick={onEventClick}
                eventDisplay="block"
                eventContent={renderEventContent}
                dayMaxEvents={3}
                moreLinkContent={(arg) => `+${arg.num}건`}
                height="auto"
                dayCellContent={(arg) => String(arg.date.getDate())}
              />
            </Box>
          ) : (
            <WeekBoard
              weekStart={weekStart}
              members={visibleMembers}
              events={weekEvents}
              todayKey={todayKey}
              onSelect={setDetail}
            />
          )}
        </Box>
      </Box>

      {/* 일정 상세 — 보기 전용 Drawer */}
      <AppDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title ?? ''}
        subtitle={meta?.label}
        width={460}
      >
        {detail && meta && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <StatusChip status={meta.status} label={meta.label} />
            </Box>

            {/* 담당 팀원 */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                flexWrap: 'wrap',
                p: 1.5,
                bgcolor: 'background.elevated',
                borderRadius: '10px',
              }}
            >
              {detailMembers.map((m) => (
                <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: m.color,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      flex: 'none',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {given(m.name)}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <Box component="span" sx={{ fontSize: 13.5, fontWeight: 700, color: 'text.primary' }}>
                      {m.name}
                    </Box>
                    {m.role && (
                      <Box component="span" sx={{ fontSize: 11.5, color: 'text.disabled' }}>
                        {m.role}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* 정보 행 */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Box component="span" sx={{ width: 48, flex: 'none', fontSize: 13, color: 'text.disabled', fontWeight: 500 }}>
                  날짜
                </Box>
                <Box component="span" sx={{ fontSize: 13.5, color: 'text.primary', fontWeight: 500 }}>
                  {dateRange}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Box component="span" sx={{ width: 48, flex: 'none', fontSize: 13, color: 'text.disabled', fontWeight: 500 }}>
                  시간
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                  <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Box component="span" sx={{ fontSize: 13.5, fontWeight: 500 }}>{timeText}</Box>
                </Box>
              </Box>
              {loc && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Box component="span" sx={{ width: 48, flex: 'none', fontSize: 13, color: 'text.disabled', fontWeight: 500 }}>
                    장소
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                    <PlaceIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Box component="span" sx={{ fontSize: 13.5, fontWeight: 500 }}>{loc}</Box>
                  </Box>
                </Box>
              )}
              {detail.recurring && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Box component="span" sx={{ width: 48, flex: 'none', fontSize: 13, color: 'text.disabled', fontWeight: 500 }}>
                    반복
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.primary' }}>
                    <RepeatIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Box component="span" sx={{ fontSize: 13.5, fontWeight: 500 }}>반복 일정</Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </AppDrawer>
    </PageContainer>
  )
}
