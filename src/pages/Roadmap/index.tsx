import { PageContainer } from '@/components/ds'
import RoadmapCard from './RoadmapCard'

/**
 * FAB 구축 로드맵 — 전용 페이지(/roadmap).
 * Claude Design 시안 "FAB Construction Roadmap"(가로 타임라인 카드)으로 교체.
 * 카드가 자체 헤더(로고·제목·부제·범례)를 가지므로 별도 PageHeader는 두지 않는다.
 */
export default function Roadmap() {
  return (
    <PageContainer variant="detail">
      <RoadmapCard />
    </PageContainer>
  )
}
