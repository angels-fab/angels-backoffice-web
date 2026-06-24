import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import { PageContainer, PageHeader, ContentSection } from '@/components/ds'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import Greeting from './Greeting'
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
  const { isAdmin } = useRole()
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

      {/* 로그인(관리자) 전용 섹션 — 게스트에겐 공개 정보(장비 현황)만 노출 */}
      {isAdmin && (
        <>
          {/* ① KPI Overview */}
          <ContentSection>
            <KpiOverview />
          </ContentSection>

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

      {/* ④ 장비 현황 — 공개(게스트도 표시) */}
      <ContentSection title="장비 현황" action={moreBtn('/equipment')} last={!isAdmin}>
        <EquipmentSection />
      </ContentSection>

      {/* ⑤ 공지사항 — 로그인 전용 */}
      {isAdmin && (
        <ContentSection title="공지사항" action={moreBtn('/notice')} last>
          <NoticeSection />
        </ContentSection>
      )}
    </PageContainer>
  )
}
