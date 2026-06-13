import { useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceIcon from '@mui/icons-material/Place'
import RepeatIcon from '@mui/icons-material/Repeat'
import { CAL_CATS, CAL_CAT_MAP } from '@/constants/calendar'
import type { CalCatId, CalEvent } from '@/types'
import { todaySeoul } from '@/utils/date'
import TitleLoad from '@/components/TitleLoad'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadCalEvents } from '@/store/slices/calSlice'

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const DOW = ['일', '월', '화', '수', '목', '금', '토']

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

// 'yyyy-MM-dd' → "6월 9일 (월)"
function fmtDateKo(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`
}

export default function Calendar() {
  const today = new Date(todaySeoul() + 'T00:00:00')
  const dispatch = useAppDispatch()
  const { events: allEvents, loading, error, updatedAt } = useAppSelector(s => s.cal)
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [activeCats, setActiveCats] = useState<CalCatId[]>(['all'])
  const [detail, setDetail] = useState<CalEvent | null>(null) // 일정 클릭 → 읽기 상세
  const [moreDay, setMoreDay] = useState<string | null>(null) // "+N개" → 그날 전체 목록

  const move = (d: number) => {
    let m = month + d
    let y = year
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setMonth(m)
    setYear(y)
  }

  const goToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
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
    // 종일/여러날 일정을 위로, 그다음 시작시간순
    Object.values(m).forEach(list =>
      list.sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1)),
    )
    return m
  }, [events])

  const cells = buildCells(year, month)
  const todayStr = todaySeoul()
  const moreEvents = moreDay ? evMap[moreDay] || [] : []

  // 일정 칩 1개 렌더 (종일=색 막대 / 시간=점+시각+제목)
  const renderChip = (e: CalEvent, key: number) => {
    const cat = CAL_CAT_MAP[e.cat]
    const stop = (ev: MouseEvent) => {
      ev.stopPropagation()
      setDetail(e)
    }
    if (e.allDay) {
      return (
        <div key={key} className="gcal-ev gcal-ev-allday" style={{ background: cat.color }} onClick={stop} title={e.title}>
          {e.title}
        </div>
      )
    }
    return (
      <div key={key} className="gcal-ev gcal-ev-timed" onClick={stop} title={`${e.start.slice(11, 16)} ${e.title}`}>
        <span className="gcal-ev-dot" style={{ background: cat.color }} />
        <span className="gcal-ev-time">{e.start.slice(11, 16)}</span>
        <span className="gcal-ev-name">{e.title}</span>
      </div>
    )
  }

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

        {/* 구글 스타일 툴바 */}
        <div className="gcal-toolbar">
          <button className="gcal-today" onClick={goToday}>오늘</button>
          <button className="gcal-navbtn" onClick={() => move(-1)} aria-label="이전 달">
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </button>
          <button className="gcal-navbtn" onClick={() => move(1)} aria-label="다음 달">
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </button>
          <span className="gcal-title">{year}년 {MONTHS[month]}</span>
          <span className="gcal-view">월</span>
        </div>

        {/* 달력 */}
        <div className="gcal-wrap">
          <div className="gcal-dow-row">
            {DOW.map((d, i) => (
              <div key={d} className={`gcal-dow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>
            ))}
          </div>
          <div className="gcal-grid">
            {cells.map(cell => {
              const col = new Date(cell.dateStr + 'T00:00:00').getDay()
              const dayEvs = evMap[cell.dateStr] || []
              const cellMonth = Number(cell.dateStr.slice(5, 7))
              const numLabel = cell.day === 1 ? `${cellMonth}월 1일` : String(cell.day)
              const isToday = cell.dateStr === todayStr
              const shown = dayEvs.slice(0, 3)
              const extra = dayEvs.length - shown.length
              return (
                <div key={cell.dateStr} className={`gcal-cell${cell.isOther ? ' other-month' : ''}`}>
                  <div className={`gcal-daynum${isToday ? ' today' : ''}${col === 0 ? ' sun' : col === 6 ? ' sat' : ''}`}>
                    {numLabel}
                  </div>
                  {shown.map((e, j) => renderChip(e, j))}
                  {extra > 0 && (
                    <div className="gcal-more" onClick={() => setMoreDay(cell.dateStr)}>
                      {extra}개 더보기
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* "+N개 더보기" → 그날 전체 목록 팝오버 */}
      {moreDay && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setMoreDay(null) }}>
          <div className="gcal-pop">
            <div className="gcal-pop-head">
              <span className="gcal-pop-date">{fmtDateKo(moreDay)}</span>
              <button className="modal-x" onClick={() => setMoreDay(null)} aria-label="닫기">
                <CloseIcon sx={{ fontSize: 18 }} />
              </button>
            </div>
            <div className="gcal-pop-list">
              {moreEvents.map((e, j) => renderChip(e, j))}
            </div>
          </div>
        </div>
      )}

      {/* 일정 클릭 → 읽기 전용 상세 */}
      {detail && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setDetail(null) }}>
          <div className="gcal-detail">
            <button className="modal-x gcal-detail-x" onClick={() => setDetail(null)} aria-label="닫기">
              <CloseIcon sx={{ fontSize: 18 }} />
            </button>
            <div className="gcal-detail-head">
              <span className="gcal-detail-bar" style={{ background: CAL_CAT_MAP[detail.cat].color }} />
              <div>
                <div className="gcal-detail-title">{detail.title}</div>
                <div className="gcal-detail-date">{fmtDateKo(detail.date)}</div>
              </div>
            </div>
            <div className="gcal-detail-rows">
              <div className="gcal-detail-row">
                <AccessTimeIcon sx={{ fontSize: 17 }} />
                <span>{detail.allDay ? '종일' : `${detail.start.slice(11, 16)} – ${detail.end.slice(11, 16)}`}</span>
              </div>
              {detail.loc && detail.loc !== '-' && (
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
                    background: CAL_CAT_MAP[detail.cat].color + '22',
                    color: CAL_CAT_MAP[detail.cat].color,
                    border: `1px solid ${CAL_CAT_MAP[detail.cat].color}44`,
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
