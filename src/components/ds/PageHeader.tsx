import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'
import { usePageImprovementMemo } from '@/components/PageImprovementMemo'

export interface PageHeaderProps {
  /** 페이지 제목 */
  title: string
  /** 페이지 아이콘(MUI 아이콘) — 제목 좌측 */
  icon?: ReactNode
  /** 부제/설명(선택) */
  subtitle?: string
  /** 업데이트 시간 등 메타 정보(선택) — 제목 아래 작게 */
  updatedAt?: string
  /** 우측 액션 영역(버튼·검색 등) */
  actions?: ReactNode
}

/**
 * PageHeader — 모든 페이지 상단의 통일된 헤더.
 *
 * 구성: 아이콘 + 페이지명 + (업데이트 시간/부제) + 우측 액션.
 * 레이아웃 규칙: 아래 여백 24px(Header → 첫 Section).
 *
 * @example
 * <PageHeader icon={<MonitorIcon/>} title="장비운영관리"
 *   updatedAt="2026-06-13 18:00 업데이트"
 *   actions={<Button variant="contained">추가</Button>} />
 */
export default function PageHeader({ title, icon, subtitle, updatedAt, actions }: PageHeaderProps) {
  // 현재 경로에 활성 개선 메모가 있으면 제목 옆 칩 + 아래 패널을 렌더(없으면 모두 null → 변화 없음)
  const { chip, panel, snackbar } = usePageImprovementMemo()
  return (
    <Box sx={{ mb: `${layout.pageHeaderGap}px` }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
          {icon && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: 'background.elevated',
                color: 'primary.main',
                '& svg': { fontSize: 22 },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            {/* 제목 + (있으면) 개선 메모 칩 — 제목 바로 옆 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h2" component="h1">
                {title}
              </Typography>
              {chip}
            </Box>
            {subtitle && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
            {updatedAt && (
              <Typography variant="caption" sx={{ display: 'block', mt: subtitle ? 0.25 : 0.5, color: 'text.disabled' }}>
                {updatedAt}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>{actions}</Box>
        )}
      </Box>
      {/* 칩 클릭 시 제목 아래 메모 패널 */}
      {panel}
      {snackbar}
    </Box>
  )
}
