import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { CAL_CATS, CAL_CAT_MAP } from '@/constants/calendar'
import type { CalCatId, CalEvent } from '@/types'
import { todaySeoul } from '@/utils/date'
import TitleLoad from '@/components/TitleLoad'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

interface CalCell {
  day: number
  dateStr: string
  isOther: boolean
}

function buildCells(year: number, month: number): CalCell[] {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const prevLast = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDay + lastDate) / 7) * 7
  const cells: CalCell[] = []
  const ds = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  for (let i = 0; i < totalCells; i++) {
    if (i < firstDay) {
      const day = prevLast - firstDay + i + 1
      const m = month === 0 ? 11 : month - 1
      const y = month === 0 ? year - 1 : year
      cells.push({ day, dateStr: ds(y, m, day), isOther: true })
    } else if (i >= firstDay + lastDate) {
      const day = i - firstDay - lastDate + 1
      const m = month === 11 ? 0 : month + 1
      const y = month === 11 ? year + 1 : year
      cells.push({ day, dateStr: ds(y, m, day), isOther: true })
    } else {
      const day = i - firstDay + 1
      cells.push({ day, dateStr: ds(year, month, day), isOther: false })
    }
  }
  return cells
}

export default function Calendar() {
  // 원본은 2026년 6월 고정이었으나 현재 월 기준으로 초기화
  const today = new Date(todaySeoul() + 'T00:00:00')
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, error, updatedAt } = useAppSelector(s => s.cal)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeCats, setActiveCats] = useState<CalCatId[]>(['all'])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const move = (d: number) => {
    let m = month + d
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
    setSelectedDate(null)
  }

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
    setSelectedDate(null)
  }

  const events = useMemo(
    () => (activeCats.includes('all') ? allEvents : allEvents.filter(e => activeCats.includes(e.cat))),
    [allEvents, activeCats],
  )

  const evMap = useMemo(() => {
    const m: Record<string, CalEvent[]> = {}
    events.forEach(e => {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    })
    return m
  }, [events])

  const cells = buildCells(year, month)
  const todayStr = todaySeoul()
  const selectedEvents = selectedDate ? events.filter(e => e.date === selectedDate) : []
  const selD = selectedDate ? new Date(selectedDate) : null

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
      <div style={{ width: '100%' }}>
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

        {/* 달력 헤더 */}
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={() => move(-1)}><ChevronLeftIcon sx={{ fontSize: 18 }} /></button>
          <span className="cal-month-label">
            {year}년 {MONTHS[month]}
          </span>
          <button className="cal-nav-btn" onClick={() => move(1)}><ChevronRightIcon sx={{ fontSize: 18 }} /></button>
        </div>

        {/* 달력 */}
        <div className="cal-wrap">
          <div className="cal-dow-row">
            <div className="cal-dow sun">일</div>
            <div className="cal-dow">월</div>
            <div className="cal-dow">화</div>
            <div className="cal-dow">수</div>
            <div className="cal-dow">목</div>
            <div className="cal-dow">금</div>
            <div className="cal-dow sat">토</div>
          </div>
          <div className="cal-grid">
            {cells.map((cell, i) => {
              const col = i % 7
              const dayEvs = evMap[cell.dateStr] || []
              const cls = [
                'cal-cell',
                cell.isOther ? 'other-month' : '',
                cell.dateStr === todayStr ? 'today' : '',
                cell.dateStr === selectedDate ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <div key={cell.dateStr} className={cls} onClick={() => setSelectedDate(cell.dateStr)}>
                  <div className={`cal-day ${col === 0 ? 'sun-day' : col === 6 ? 'sat-day' : ''}`}>
                    {cell.day}
                  </div>
                  {dayEvs.slice(0, 3).map((e, j) => (
                    <div key={j} className={`cal-event-dot ev-${e.cat}`}>
                      {e.title}
                    </div>
                  ))}
                  {dayEvs.length > 3 && (
                    <div style={{ fontSize: 9, color: 'var(--text3)', paddingLeft: 2 }}>
                      +{dayEvs.length - 3}건
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 선택된 날 이벤트 */}
        {selectedEvents.length > 0 && selD && (
          <div className="cal-event-panel" style={{ display: 'block' }}>
            <div className="cal-event-panel-title">
              {selD.getMonth() + 1}월 {selD.getDate()}일 일정 ({selectedEvents.length}건)
            </div>
            {selectedEvents.map((e, i) => {
              const cat = CAL_CAT_MAP[e.cat]
              return (
                <div key={i} className="cal-event-item">
                  <div className="cal-ev-bar" style={{ background: cat.color }} />
                  <div style={{ flex: 1 }}>
                    <div className="cal-ev-title">{e.title}</div>
                    <div className="cal-ev-meta">
                      {e.time}
                      {e.loc && e.loc !== '-' ? ' · ' + e.loc : ''}
                    </div>
                  </div>
                  <span
                    className="cal-ev-badge"
                    style={{
                      background: cat.color + '22',
                      color: cat.color,
                      border: `1px solid ${cat.color}44`,
                    }}
                  >
                    {cat.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
