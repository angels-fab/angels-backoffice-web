import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'
import SectionHeader from './SectionHeader'

export interface ContentSectionProps {
  children: ReactNode
  /** 섹션 제목(있으면 SectionHeader 렌더) */
  title?: string
  /** 섹션 설명 */
  description?: string
  /** 제목 옆 건수 */
  count?: ReactNode
  /** 우측 액션 */
  action?: ReactNode
  /** 마지막 섹션이면 하단 간격 제거 */
  last?: boolean
  sx?: SxProps<Theme>
}

/**
 * ContentSection — 페이지 내 콘텐츠 영역 구분 단위.
 *
 * 섹션 간 간격(24px)을 통일한다. title을 주면 SectionHeader를 함께 렌더한다.
 * 예: KPI 영역, 캘린더 영역, 장비 목록 영역, 공지사항 영역.
 *
 * @example
 * <ContentSection title="장비 현황" description="총 29대" action={<Button>전체</Button>}>
 *   <CardGrid>…</CardGrid>
 * </ContentSection>
 */
export default function ContentSection({
  children,
  title,
  description,
  count,
  action,
  last,
  sx,
}: ContentSectionProps) {
  return (
    <Box
      component="section"
      sx={{ mb: last ? 0 : `${layout.sectionGap}px`, ...sx }}
    >
      {title && (
        <SectionHeader title={title} description={description} count={count} action={action} />
      )}
      {children}
    </Box>
  )
}
