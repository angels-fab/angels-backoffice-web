import { useNavigate } from 'react-router-dom'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MemoryIcon from '@mui/icons-material/Memory'
import Greeting from './Greeting'
import RoadmapTimeline from './RoadmapTimeline'
import { CalPreview, EqPreview, NoticePreview, WorkPreview, useWorkCountBadge } from './previews'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import { todaySeoul } from '@/utils/date'

// 홈 = 인사말 → 로드맵(1순위) → 벤토 모자이크(타일마다 숫자 배지 + 미리보기 통합)
export default function Home() {
  const navigate = useNavigate()
  const workBadge = useWorkCountBadge()
  const eqReady = useAppSelector(s => s.eq.ready)
  const eq = useAppSelector(selectEqCounts)
  const noticeReady = useAppSelector(s => s.notice.ready)
  const newCnt = useAppSelector(s => s.notice.items).filter(n => n.isNew).length
  const todayCnt = useAppSelector(s => s.cal.events).filter(e => e.date === todaySeoul()).length

  return (
    <div id="home">
      <main>
        <Greeting />

        <RoadmapTimeline />

        <div className="bento-grid">
          {/* 장비현황 — 우선순위 2 */}
          <div className="bento-card bc-eq" onClick={() => navigate('/equipment')} role="button" tabIndex={0}>
            <div className="bc-head">
              <span className="bc-ico bci-blue"><MemoryIcon fontSize="inherit" /></span>
              <span className="bc-name">장비현황</span>
              {eqReady && <span className="bc-badge bcb-blue">{eq.types}종 · {eq.total}대</span>}
              <span className="see-all">전체보기 ›</span>
            </div>
            <EqPreview />
          </div>

          {/* 업무현황 */}
          <div className="bento-card bc-work" onClick={() => navigate('/work')} role="button" tabIndex={0}>
            <div className="bc-head">
              <span className="bc-ico bci-amber"><AssessmentIcon fontSize="inherit" /></span>
              <span className="bc-name">업무현황</span>
              {workBadge && <span className="bc-badge bcb-amber">{workBadge}</span>}
              <span className="see-all">전체보기 ›</span>
            </div>
            <div className="work-preview">
              <WorkPreview />
            </div>
          </div>

          {/* 공지사항 */}
          <div className="bento-card bc-notice" onClick={() => navigate('/notice')} role="button" tabIndex={0}>
            <div className="bc-head">
              <span className="bc-ico bci-red"><CampaignIcon fontSize="inherit" /></span>
              <span className="bc-name">공지사항</span>
              {noticeReady && newCnt > 0 && <span className="bc-badge bcb-red">NEW {newCnt}</span>}
              <span className="see-all">전체보기 ›</span>
            </div>
            <NoticePreview />
          </div>

          {/* 업무일정 */}
          <div className="bento-card bc-cal" onClick={() => navigate('/calendar')} role="button" tabIndex={0}>
            <div className="bc-head">
              <span className="bc-ico bci-purple"><CalendarMonthIcon fontSize="inherit" /></span>
              <span className="bc-name">업무일정</span>
              <span className="bc-badge bcb-purple">오늘 {todayCnt}건</span>
              <span className="see-all">전체보기 ›</span>
            </div>
            <CalPreview />
          </div>
        </div>
      </main>
    </div>
  )
}
