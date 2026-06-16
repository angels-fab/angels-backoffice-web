// 홈 카드 미리보기들 — 원본 renderWorkPreview / renderCalPreview / renderNoticePreview / renderEqPreview
import { useAppSelector } from '@/store/hooks'
import { selectCurrentWork, selectEqCounts } from '@/store/selectors'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { parseStartDate, todaySeoul } from '@/utils/date'
import { workCatRank, workCatStyle } from '@/utils/workCat'
import { hexA } from '@/utils/color'
import PreviewLoading from '@/components/PreviewLoading'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

// ── 업무현황 미리보기: 진행중 업무 상위 3건 (구분 / 제목 / 담당자) ──
export function WorkPreview() {
  const ready = useAppSelector(s => s.work.ready)
  const cur = useAppSelector(selectCurrentWork)
  if (!ready) return <PreviewLoading />
  const sorted = [...cur].sort((a, b) => workCatRank(a.cat) - workCatRank(b.cat))
  if (!sorted.length) return <div className="wp-ph">진행중 업무가 없습니다</div>

  const todayMid = new Date()
  todayMid.setHours(0, 0, 0, 0)
  const isNew = (s: string) => {
    const d = parseStartDate(s)
    if (!d) return false
    d.setHours(0, 0, 0, 0)
    const diff = (todayMid.getTime() - d.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  }

  const MAX = 3
  const shown = sorted.slice(0, MAX)
  return (
    <>
      <ul className="card-notice-list">
        {shown.map(t => (
          <li key={t.id}>
            {t.cat && (
              <span className="task-cat" style={workCatStyle(t.cat)}>
                {t.cat}
              </span>
            )}
            <span className="card-notice-txt">
              {String(t.task || '').split(/\r?\n/)[0] || ''}
              {isNew(t.start) && <span className="new-badge">NEW</span>}
            </span>
            {t.mgr && <span className="notice-date">{t.mgr}</span>}
          </li>
        ))}
      </ul>
      {sorted.length > MAX && <div className="wp-more">외 {sorted.length - MAX}건</div>}
    </>
  )
}

/** 홈 업무현황 카드 헤더 배지 텍스트 */
export function useWorkCountBadge(): string {
  const ready = useAppSelector(s => s.work.ready)
  const cur = useAppSelector(selectCurrentWork)
  return ready ? `진행중 ${cur.length}` : ''
}

// ── 업무일정 미리보기: 다가오는 일정 3건 + D-day 배지 ──
export function CalPreview() {
  const calReady = useAppSelector(s => s.cal.ready)
  const calEvents = useAppSelector(s => s.cal.events)
  const today = new Date(todaySeoul() + 'T00:00:00')
  if (!calReady) return <PreviewLoading />
  const upcoming = calEvents.map(e => {
    const d = new Date(e.date + 'T00:00:00')
    return { ...e, d, diff: Math.round((d.getTime() - today.getTime()) / 86400000) }
  })
    .filter(e => e.diff >= 0)
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .slice(0, 3)

  if (!upcoming.length) return <div className="wp-ph">예정된 일정이 없습니다</div>

  return (
    <ul className="card-notice-list">
      {upcoming.map((e, i) => {
        const col = CAL_CAT_MAP[e.cat]?.color || '#58A6FF'
        const ddayCls = e.diff <= 1 ? 'dday-urgent' : e.diff <= 3 ? 'dday-soon' : 'dday-far'
        return (
          <li key={`${e.date}-${i}`}>
            <span
              className="cal-date-badge"
              style={{ background: hexA(col, 0.12), color: col, border: `1px solid ${hexA(col, 0.3)}` }}
            >
              {String(e.d.getMonth() + 1).padStart(2, '0')}/{String(e.d.getDate()).padStart(2, '0')} (
              {DOW[e.d.getDay()]})
            </span>
            <span className="card-notice-txt">
              {e.title}
              <span className={`dday-badge ${ddayCls}`}>{e.diff === 0 ? 'D-DAY' : `D-${e.diff}`}</span>
            </span>
            {e.time && <span className="notice-date">{e.time}</span>}
          </li>
        )
      })}
    </ul>
  )
}

// ── 공지사항 미리보기: 최신 3건 + 카테고리 배지 ──
const NOTICE_BADGE_STYLE: Record<string, { bg: string; c: string; bd: string }> = {
  긴급: { bg: 'rgba(248,81,73,.14)', c: '#f87171', bd: 'rgba(248,81,73,.32)' },
  공지: { bg: 'rgba(88,166,255,.12)', c: '#58A6FF', bd: 'rgba(88,166,255,.3)' },
  일반: { bg: 'rgba(139,148,158,.14)', c: 'var(--text2)', bd: 'var(--border)' },
  행사: { bg: 'rgba(63,185,80,.14)', c: '#3FB950', bd: 'rgba(63,185,80,.3)' },
}

export function NoticePreview() {
  const ready = useAppSelector(s => s.notice.ready)
  const items = useAppSelector(s => s.notice.items)
  if (!ready) return <PreviewLoading />
  const arr = [...items].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 3)
  if (!arr.length) return null
  const fmtMD = (d: string) => {
    const m = String(d).match(/\d{4}-(\d{2})-(\d{2})/)
    return m ? m[1] + '.' + m[2] : String(d)
  }
  return (
    <ul className="card-notice-list">
      {arr.map(n => {
        const st = NOTICE_BADGE_STYLE[n.cat] || NOTICE_BADGE_STYLE['일반']
        return (
          <li key={n.id}>
            {n.isNew ? (
              <span className="ntc-cat" style={{ background: 'var(--red)', color: '#fff', border: '1px solid transparent' }}>
                NEW
              </span>
            ) : (
              <span className="ntc-cat" style={{ background: st.bg, color: st.c, border: `1px solid ${st.bd}` }}>
                {n.cat}
              </span>
            )}
            <span className="card-notice-txt">{n.title}</span>
            <span className="notice-date">{fmtMD(n.date)}</span>
          </li>
        )
      })}
    </ul>
  )
}

// ── 장비현황 미리보기 (PC 카드): 전체장비 + 2×2 상태카드, 종 수 기준 ──
export function EqPreview() {
  const ready = useAppSelector(s => s.eq.ready)
  const c = useAppSelector(selectEqCounts)
  if (!ready) return <PreviewLoading />

  const cells = [
    { label: '도입예정', val: c.typesBy['도입예정'], labelColor: 'var(--text2)', bg: '#1a1d23', border: 'var(--border)' },
    { label: '도입중', val: c.typesBy['도입중'], labelColor: '#4d9fff', bg: '#0d1f33', border: '#1f4068' },
    { label: '운영중', val: c.typesBy['운영중'], labelColor: '#34d36b', bg: '#0e2417', border: '#1d4a2e' },
    { label: '비가동', val: c.typesBy['비가동'], labelColor: '#f87171', bg: '#2a1314', border: '#5a2526' },
  ]
  return (
    <div className="eqm">
      <div className="eqm-big">
        <div className="eqm-big-lbl">전체 장비</div>
        <div className="eqm-big-num">
          {c.types}
          <span className="u">종</span> <span className="sm">{c.total}</span>
          <span className="u">대</span>
        </div>
      </div>
      <div className="eqm-grid">
        {cells.map(cl => (
          <div key={cl.label} className="eqm-cell" style={{ background: cl.bg, borderColor: cl.border }}>
            <div className="eqm-cell-lbl" style={{ color: cl.labelColor }}>
              {cl.label}
            </div>
            <div className="eqm-cell-num">
              {cl.val}
              <span className="u">종</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
