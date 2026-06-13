import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import koLocale from '@fullcalendar/core/locales/ko'
import type { EventClickArg } from '@fullcalendar/core'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloseIcon from '@mui/icons-material/Close'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceIcon from '@mui/icons-material/Place'
import RepeatIcon from '@mui/icons-material/Repeat'
import { CAL_CATS, CAL_CAT_MAP } from '@/constants/calendar'
import type { CalCatId, CalEvent } from '@/types'
import TitleLoad from '@/components/TitleLoad'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')

interface Detail {
  title: string
  dateLabel: string
  timeLabel: string
  loc: string
  recurring: boolean
  cat: Exclude<CalCatId, 'all'>
}

export default function Calendar() {
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, error, updatedAt } = useAppSelector(s => s.cal)
  const [activeCats, setActiveCats] = useState<CalCatId[]>(['all'])
  const [detail, setDetail] = useState<Detail | null>(null)

  // Shift+클릭: 다중 선택 / 일반 클릭: 단일 선택
  const setCat = (id: CalCatId, e: MouseEvent) => {
    if (e.shiftKey) {
      if (id === 'all') {
        setActiveCats(['all'])
      } else {
        let next: CalCatId[] = activeCats.filter(c => c !== 'all')
        if (next.includes(id)) {
          next = next.filter(c => c !== id)
          if (next.length === 0) next = ['all']
        } else {
          next = [...next, id]
        }
        setActiveCats(next)
      }
    } else {
      setActiveCats([id])
    }
  }

  // 스토어 이벤트는 날짜별로 펼쳐져 있어 id로 원본 1건씩만 추려 FullCalendar에 전달
  // (FullCalendar가 여러 날 연속 막대를 직접 그림)
  const fcEvents = useMemo(() => {
    const byId = new Map<string, CalEvent>()
    for (const e of allEvents) if (e.id && !byId.has(e.id)) byId.set(e.id, e)
    return [...byId.values()]
      .filter(e => activeCats.includes('all') || activeCats.includes(e.cat))
      .map(e => {
        const color = CAL_CAT_MAP[e.cat].color
        return {
          id: e.id,
          title: e.title,
          start: e.allDay ? e.start.slice(0, 10) : e.start,
          end: e.allDay ? e.end.slice(0, 10) : e.end, // 종일 종료는 미포함(FullCalendar와 동일 규칙)
          allDay: e.allDay,
          backgroundColor: color,
          borderColor: color,
          extendedProps: { loc: e.loc, cat: e.cat, recurring: e.recurring },
        }
      })
  }, [allEvents, activeCats])

  const onEventClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault()
    const e = info.event
    const s = e.start
    const en = e.end
    if (!s) return
    const dateLabel = `${s.getMonth() + 1}월 ${s.getDate()}일 (${DOW[s.getDay()]})`
    const timeLabel = e.allDay
      ? '종일'
      : `${pad(s.getHours())}:${pad(s.getMinutes())}${en ? ` – ${pad(en.getHours())}:${pad(en.getMinutes())}` : ''}`
    const loc = (e.extendedProps.loc as string) || ''
    setDetail({
      title: e.title,
      dateLabel,
      timeLabel,
      loc: loc && loc !== '-' ? loc : '',
      recurring: !!e.extendedProps.recurring,
      cat: e.extendedProps.cat as Exclude<CalCatId, 'all'>,
    })
  }

  const detailColor = detail ? CAL_CAT_MAP[detail.cat].color : '#888'

  return (
    <div className="page active" id="page-캘린더">
      <div className="page-header">
        <div
          className="page-title"
          onClick={() => dispatch(loadCalEvents())}
          style={{ cursor: 'pointer' }}
          title="클릭하면 새로고침"
        >
          <CalendarMonthIcon /> Calendar
        </div>
        <TitleLoad loading={loading} text={error ? '불러오기 실패' : updatedAt} />
      </div>

      <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 카테고리 필터 */}
        <div className="cal-filter">
          <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', marginRight: 2 }}>
            Shift+클릭으로 다중선택
          </span>
          {CAL_CATS.map(c => (
            <button
              key={c.id}
              className={`cal-flt ${c.cls}${activeCats.includes(c.id) ? ' active' : ''}`}
              onClick={e => setCat(c.id, e)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* FullCalendar (읽기 전용) */}
        <div className="fc-theme-angels">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
            initialView="dayGridMonth"
            locale={koLocale}
            headerToolbar={{
              left: 'today prev,next',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
            }}
            events={fcEvents}
            eventClick={onEventClick}
            dayMaxEvents={true}
            height="100%"
            expandRows
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            firstDay={0}
            dayCellContent={arg => String(arg.date.getDate())}
          />
        </div>
      </div>

      {/* 일정 클릭 → 읽기 전용 상세 */}
      {detail && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="gcal-detail">
            <button className="modal-x gcal-detail-x" onClick={() => setDetail(null)} aria-label="닫기">
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
            <div className="gcal-detail-head">
              <span className="gcal-detail-bar" style={{ background: detailColor }} />
              <div>
                <div className="gcal-detail-title">{detail.title}</div>
                <div className="gcal-detail-date">{detail.dateLabel}</div>
              </div>
            </div>
            <div className="gcal-detail-rows">
              <div className="gcal-detail-row">
                <AccessTimeIcon sx={{ fontSize: 17 }} />
                <span>{detail.timeLabel}</span>
              </div>
              {detail.loc && (
                <div className="gcal-detail-row">
                  <PlaceIcon sx={{ fontSize: 17 }} />
                  <span>{detail.loc}</span>
                </div>
              )}
              {detail.recurring && (
                <div className="gcal-detail-row">
                  <RepeatIcon sx={{ fontSize: 17 }} />
                  <span>반복 일정</span>
                </div>
              )}
              <div className="gcal-detail-row">
                <span
                  className="gcal-detail-badge"
                  style={{
                    background: detailColor + '22',
                    color: detailColor,
                    border: `1px solid ${detailColor}44`,
                  }}
                >
                  {CAL_CAT_MAP[detail.cat].label}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
