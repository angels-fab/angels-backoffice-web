import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import { PageContainer, PageHeader, ContentSection } from '@/components/ds'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import Greeting from './Greeting'
import RoadmapCard from './RoadmapCard'
import KpiOverview from './dash/KpiOverview'
import ScheduleSection from './dash/ScheduleSection'
import WorkStatusSection from './dash/WorkStatusSection'
import EquipmentSection from './dash/EquipmentSection'
import NoticeSection from './dash/NoticeSection'

/**
 * 홈 = 연구센터 운영 대시보드(STEP4).
 *
 * 정보 위계: ① KPI → ② 오늘/다가오는 일정 → ③ 업무 현황 → ④ 장비 현황 → ⑤ 공지.
 * 소개·환영·배너 없음. STEP4.5에서 FAB 로드맵은 전용 메뉴(/roadmap)로 분리.
 * 신규 섹션은 STEP3 Layout System(PageContainer/PageHeader/ContentSection/CardGrid)으로 구성.
 */
export default function Home() {
  const navigate = useNavigate()
  const { loggedIn, isAdmin } = useRole()
  const updatedAt = useAppSelector(
    (s) => s.cal.updatedAt || s.work.updatedAt || s.notice.updatedAt || s.eq.updatedAt || '',
  )

  const moreBtn = (to: string) => (
    <Button variant="text" size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate(to)} sx={{ color: 'text.secondary' }}>
      전체보기
    </Button>
  )

  return (
    <PageContainer>
      {/* 최상단 인사말 — 로그인 주체별 랜덤 인사말 + 로고(웹/모바일 공통) */}
      <Greeting />

      <PageHeader icon={<SpaceDashboardIcon />} title="운영 대시보드" updatedAt={updatedAt || undefined} />

      {/* FAB 구축 로드맵 — 전용 페이지 폐지, 홈의 주요 섹션으로 이관(전체 공개) */}
      <ContentSection title="FAB 구축 로드맵" last={!loggedIn}>
        <RoadmapCard />
      </ContentSection>

      {/* ① KPI Overview — 관리자 전용(장비 지표 포함. 일반 사용자는 장비 데이터 미로드라 0 표시되므로 제외) */}
      {isAdmin && (
        <ContentSection>
          <KpiOverview />
        </ContentSection>
      )}

      {/* 로그인(일반·관리자) 열람 미리보기 — 일정·업무·공지 */}
      {loggedIn && (
        <>
          {/* ② 오늘 일정 + 다가오는 일정 */}
          <ContentSection>
            <ScheduleSection />
          </ContentSection>

          {/* ③ 업무 현황 */}
          <ContentSection title="업무 현황" action={moreBtn('/work')}>
            <WorkStatusSection />
          </ContentSection>
        </>
      )}

      {/* ④ 장비 현황 — 관리자 전용(RLS: 장비 열람 관리자만) */}
      {isAdmin && (
        <ContentSection title="장비 현황" action={moreBtn('/equipment')}>
          <EquipmentSection />
        </ContentSection>
      )}

      {/* ⑤ 공지사항 — 로그인(일반·관리자) 열람 */}
      {loggedIn && (
        <ContentSection title="공지사항" action={moreBtn('/notice')} last>
          <NoticeSection />
        </ContentSection>
      )}
    </PageContainer>
  )
}
