import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'

export interface PageContainerProps {
  children: ReactNode
  /**
   * 폭 프리셋. 'wide' = 대시보드/목록(1400), 'detail' = 상세(1200).
   * 기본 'wide'.
   */
  variant?: 'wide' | 'detail'
  /** 폭 직접 지정(px). variant보다 우선. */
  maxWidth?: number
  /** 상단 padding 제거(드물게) */
  disableTop?: boolean
  sx?: SxProps<Theme>
}

/**
 * PageContainer — 모든 페이지가 공통으로 쓰는 콘텐츠 컨테이너.
 *
 * 폭·좌우 padding·상단 padding을 통일한다(STEP 3 규칙).
 * - 최대 폭: wide 1400 / detail 1200 (가운데 정렬)
 * - 좌우 padding: 데스크톱 24 / 모바일 16
 * - 상단 padding: 32
 *
 * @example
 * <PageContainer>
 *   <PageHeader title="장비운영관리" />
 *   <ContentSection title="현황">…</ContentSection>
 * </PageContainer>
 *
 * @example 상세 페이지
 * <PageContainer variant="detail">…</PageContainer>
 */
export default function PageContainer({
  children,
  variant = 'wide',
  maxWidth,
  disableTop,
  sx,
}: PageContainerProps) {
  const mw = maxWidth ?? (variant === 'detail' ? layout.maxWidthDetail : layout.maxWidthWide)
  return (
    <Box
      sx={mergeSx({
        width: '100%',
        maxWidth: mw,
        mx: 'auto',
        px: { xs: `${layout.pageXMobile}px`, sm: `${layout.pageX}px` },
        pt: disableTop ? 0 : `${layout.pageTop}px`,
        pb: `${layout.pageBottom}px`,
      }, sx)}
    >
      {children}
    </Box>
  )
}
