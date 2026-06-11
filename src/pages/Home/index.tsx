import { useNavigate } from 'react-router-dom'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import Greeting from './Greeting'
import BentoStats from './BentoStats'
import RoadmapTimeline from './RoadmapTimeline'
import EqSummaryInner from '@/components/EqSummaryInner'
import { CalPreview, EqPreview, NoticePreview, WorkPreview, useWorkCountBadge } from './previews'

export default function Home() {
  const navigate = useNavigate()
  const workBadge = useWorkCountBadge()

  return (
    <div id="home">
      <main>
        <Greeting />

        {/* 벤토 KPI 타일 */}
        <BentoStats />

        {/* 장비 현황 (전체) */}
        <div className="eq-summary" onClick={() => navigate('/equipment')} role="button" tabIndex={0}>
          <EqSummaryInner showSeeAll />
        </div>

        <RoadmapTimeline />

        {/* 장비현황 (PC) */}
        <div className="dashboard d-only">
          <div className="dash-header">
            <span className="dash-title">장비현황</span>
            <span className="see-all" onClick={() => navigate('/equipment')} role="button" tabIndex={0}>
              전체보기 ›
            </span>
          </div>
          <div className="eq-dash" onClick={() => navigate('/equipment')} role="button" tabIndex={0}>
            <EqPreview />
          </div>
        </div>

        {/* 메뉴 카드 (PC) */}
        <div className="menu-label d-only">미리보기</div>
        <div className="grid d-only">
          <div className="card c-notice" onClick={() => navigate('/notice')} role="button" tabIndex={0}>
            <div className="card-header-row">
              <div className="icon"><CampaignIcon fontSize="inherit" htmlColor="#f85149" /></div>
              <div className="card-name">공지사항</div>
            </div>
            <NoticePreview />
          </div>

          <div className="card c-meeting" onClick={() => navigate('/calendar')} role="button" tabIndex={0}>
            <div className="card-header-row">
              <div className="icon"><CalendarMonthIcon fontSize="inherit" htmlColor="#bc8cff" /></div>
              <div className="card-name">업무일정</div>
            </div>
            <CalPreview />
          </div>

          <div
            className="card c0"
            onClick={() => navigate('/work')}
            role="button"
            tabIndex={0}
            style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch', gridColumn: '1 / -1' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="icon" style={{ width: 34, height: 34, fontSize: 18, borderRadius: 8 }}><AssessmentIcon fontSize="inherit" htmlColor="#f0b429" /></div>
              <div className="card-name" style={{ textAlign: 'left' }}>업무현황</div>
              <span className="hdr-badge">{workBadge}</span>
            </div>
            <div className="work-preview">
              <WorkPreview />
            </div>
          </div>
        </div>

        {/* 메뉴 카드 (모바일) */}
        <div className="menu-stack">
          <div
            className="card c-notice"
            onClick={() => navigate('/notice')}
            role="button"
            tabIndex={0}
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
          >
            <div className="card-top">
              <div className="icon"><CampaignIcon fontSize="inherit" htmlColor="#f85149" /></div>
              <div className="card-name">공지사항</div>
              <span className="see-all">전체보기 ›</span>
            </div>
            <NoticePreview />
          </div>

          <div
            className="card c0"
            onClick={() => navigate('/work')}
            role="button"
            tabIndex={0}
            style={{ flexDirection: 'column', gap: 10, alignItems: 'stretch' }}
          >
            <div className="card-top">
              <div className="icon" style={{ background: 'rgba(240,180,41,.12)' }}><AssessmentIcon fontSize="inherit" htmlColor="#f0b429" /></div>
              <div className="card-name">업무현황</div>
              <span className="hdr-badge">{workBadge}</span>
              <span className="see-all">전체보기 ›</span>
            </div>
            <div className="work-preview">
              <WorkPreview />
            </div>
          </div>

          <div
            className="card c-meeting"
            onClick={() => navigate('/calendar')}
            role="button"
            tabIndex={0}
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}
          >
            <div className="card-top">
              <div className="icon"><CalendarMonthIcon fontSize="inherit" htmlColor="#bc8cff" /></div>
              <div className="card-name">업무일정</div>
              <span className="see-all">전체보기 ›</span>
            </div>
            <CalPreview />
          </div>
        </div>
      </main>
    </div>
  )
}
