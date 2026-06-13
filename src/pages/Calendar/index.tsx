import { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventClickArg } from '@fullcalendar/core'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import EventNoteIcon from '@mui/icons-material/EventNote'
import RefreshIcon from '@mui/icons-material/Refresh'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceIcon from '@mui/icons-material/Place'
import RepeatIcon from '@mui/icons-material/Repeat'
import { PageContainer, PageHeader, ContentSection, FilterBar, StatusChip, AppDrawer } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'
import type { CalCatId, CalEvent } from '@/types'
import SummaryPanel from './SummaryPanel'
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

type ViewKey = 'dayGridMonth' | 'timeGridWeek' | 'listWeek'
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: 'dayGridMonth', label: '월간' },
  { key: 'timeGridWeek', label: '주간' },
  { key: 'listWeek', label: '목록' },
]

interface Detail {
  e: CalEvent
  date: Date
}

export default function Calendar() {
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, updatedAt } = useAppSelector((s) => s.cal)
  const [activeCats, setActiveCats] = useState<CalCatId[]>(['all'])
  const [view, setView] = useState<ViewKey>('dayGridMonth')
  const [detail, setDetail] = useState<Detail | null>(null)
  const calRef = useRef<FullCalendar>(null)

  const toggleCat = (id: CalCatId) => {
    if (id === 'all') {
      setActiveCats(['all'])
      return
    }
    let next = activeCats.filter((c) => c !== 'all')
    next = next.includes(id) ? next.filter((c) => c !== id) : [...next, id]
    setActiveCats(next.length === 0 ? ['all'] : next)
  }

  const changeView = (v: ViewKey) => {
    setView(v)
    calRef.current?.getApi().changeView(v)
  }

  // 원본 1건씩(id 기준) FullCalendar에 전달, 카테고리 필터 + 통일 색
  const fcEvents = useMemo(() => {
    const byId = new Map<string, CalEvent>()
    for (const e of allEvents) if (e.id && !byId.has(e.id)) byId.set(e.id, e)
    return [...byId.values()]
      .filter((e) => activeCats.includes('all') || activeCats.includes(e.cat))
      .map((e) => {
        const color = CAT_META[e.cat].color
        return {
          id: e.id,
          title: e.title,
          start: e.allDay ? e.start.slice(0, 10) : e.start,
          end: e.allDay ? e.end.slice(0, 10) : e.end,
          allDay: e.allDay,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { cat: e.cat },
        }
      })
  }, [allEvents, activeCats])

  const openDetail = (e: CalEvent, date?: Date) => {
    setDetail({ e, date: date ?? new Date(e.date + 'T00:00:00') })
  }

  const onEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault()
    const orig = allEvents.find((e) => e.id === info.event.id)
    if (orig) openDetail(orig, info.event.start ?? undefined)
  }

  // 상세 라벨
  const d = detail
  const meta = d ? CAT_META[d.e.cat] : null
  const dateLabel = d ? `${d.date.getMonth() + 1}월 ${d.date.getDate()}일 (${DOW[d.date.getDay()]})` : ''
  const timeLabel = d ? (d.e.time === '종일' || d.e.allDay ? '종일' : d.e.time) : ''
  const loc = d && d.e.loc && d.e.loc !== '-' ? d.e.loc : ''

  return (
    <PageContainer>
      <PageHeader
        icon={<EventNoteIcon />}
        title="업무 일정"
        updatedAt={updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadCalEvents())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* 카테고리 필터(통일 색 범례 겸용) + 뷰 전환(월간/주간/목록) */}
      <ContentSection>
        <FilterBar
          trailing={
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {VIEWS.map((v) => (
                <StatusChip key={v.key} status="neutral" label={v.label} selected={view === v.key} onClick={() => changeView(v.key)} />
              ))}
            </Box>
          }
        >
          <StatusChip status="neutral" label="전체" selected={activeCats.includes('all')} onClick={() => toggleCat('all')} />
          {CAT_ORDER.map((id: RealCat) => (
            <StatusChip key={id} status={CAT_META[id].status} label={CAT_META[id].label} selected={activeCats.includes(id)} onClick={() => toggleCat(id)} />
          ))}
        </FilterBar>
      </ContentSection>

      {/* 캘린더 + 요약 패널 */}
      <ContentSection last>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2, alignItems: 'start' }}>
          <Box className="fc-theme-angels">
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              locale={koLocale}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              events={fcEvents}
              eventClick={onEventClick}
              dayMaxEvents={3}
              height="auto"
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              firstDay={0}
              dayCellContent={(arg) => String(arg.date.getDate())}
            />
          </Box>

          <SummaryPanel events={allEvents} onPick={(e) => openDetail(e)} />
        </Box>
      </ContentSection>

      {/* 일정 상세 — Drawer */}
      <AppDrawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.e.title ?? ''}
        subtitle={dateLabel}
        width={460}
      >
        {detail && meta && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <StatusChip status={meta.status} label={meta.label} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
              <AccessTimeIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: 'text.primary' }}>{timeLabel}</Typography>
            </Box>
            {loc && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
                <PlaceIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>{loc}</Typography>
              </Box>
            )}
            {detail.e.recurring && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: 'text.secondary' }}>
                <RepeatIcon sx={{ fontSize: 18 }} />
                <Typography variant="body2" sx={{ color: 'text.primary' }}>반복 일정</Typography>
              </Box>
            )}
          </Box>
        )}
      </AppDrawer>
    </PageContainer>
  )
}
