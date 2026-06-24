import CoPresentIcon from '@mui/icons-material/CoPresent'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState } from '@/components/ds'

/**
 * 학술·교육 행사 — 세미나/학회/교육 일정 등.
 * 페이지 내용은 추후 구상에 따라 채울 예정(현재는 자리표시).
 */
export default function Events() {
  return (
    <PageContainer variant="detail">
      <PageHeader icon={<CoPresentIcon />} title="학술·교육 행사" subtitle="세미나 · 학회 · 교육 행사" />
      <ContentSection last>
        <AppCard padding={0}>
          <EmptyState
            icon={<CoPresentIcon />}
            title="준비 중입니다"
            description="페이지 내용은 곧 추가될 예정입니다."
          />
        </AppCard>
      </ContentSection>
    </PageContainer>
  )
}
