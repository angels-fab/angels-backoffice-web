import { useNavigate } from 'react-router-dom'
import Button from '@mui/material/Button'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard'
import { PageContainer, PageHeader, ContentSection } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
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
      <PageHeader icon={<SpaceDashboardIcon />} title="운영 대시보드" updatedAt={updatedAt || undefined} />

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

      {/* ④ 장비 현황 */}
      <ContentSection title="장비 현황" action={moreBtn('/equipment')}>
        <EquipmentSection />
      </ContentSection>

      {/* ⑤ 공지사항 */}
      <ContentSection title="공지사항" action={moreBtn('/notice')} last>
        <NoticeSection />
      </ContentSection>
    </PageContainer>
  )
}
