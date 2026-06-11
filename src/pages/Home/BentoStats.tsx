import { useNavigate } from 'react-router-dom'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CampaignIcon from '@mui/icons-material/Campaign'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MemoryIcon from '@mui/icons-material/Memory'
import { useAppSelector } from '@/store/hooks'
import { selectCurrentWork, selectEqCounts } from '@/store/selectors'
import { CAL_EVENTS } from '@/constants/calendar'
import { todaySeoul } from '@/utils/date'

// 홈 벤토 KPI 타일 — 오늘 일정 / 신규 공지 / 진행 업무 / 전체 장비
export default function BentoStats() {
  const navigate = useNavigate()
  const workReady = useAppSelector(s => s.work.ready)
  const noticeReady = useAppSelector(s => s.notice.ready)
  const eqReady = useAppSelector(s => s.eq.ready)
  const cur = useAppSelector(selectCurrentWork)
  const notices = useAppSelector(s => s.notice.items)
  const eq = useAppSelector(selectEqCounts)

  const today = todaySeoul()
  const todayCnt = CAL_EVENTS.filter(e => e.date === today).length
  const newCnt = notices.filter(n => n.isNew).length

  const tiles = [
    { cls: 'bt-purple', label: '오늘 일정', icon: <CalendarMonthIcon fontSize="inherit" />, val: String(todayCnt), unit: '건', to: '/calendar' },
    { cls: 'bt-amber', label: '신규 공지', icon: <CampaignIcon fontSize="inherit" />, val: noticeReady ? String(newCnt) : '–', unit: noticeReady ? '건' : '', to: '/notice' },
    { cls: 'bt-green', label: '진행 업무', icon: <AssessmentIcon fontSize="inherit" />, val: workReady ? String(cur.length) : '–', unit: workReady ? '건' : '', to: '/work' },
    { cls: 'bt-blue', label: '전체 장비', icon: <MemoryIcon fontSize="inherit" />, val: eqReady ? String(eq.types) : '–', unit: eqReady ? '종' : '', to: '/equipment' },
  ]

  return (
    <div className="bento-stats">
      {tiles.map(t => (
        <button key={t.label} className={`bento-tile ${t.cls}`} onClick={() => navigate(t.to)}>
          <span className="bt-head">
            <span className="bt-label">{t.label}</span>
            {t.icon}
          </span>
          <span className="bt-num">
            {t.val}
            {t.unit && <span className="u">{t.unit}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
