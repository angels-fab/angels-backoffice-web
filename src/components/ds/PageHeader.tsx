import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout, radius, typescale } from '@/theme/tokens'
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
  // 현재 경로에 활성 개선 메모가 있으면 제목 옆 칩 + 아래 패널을 렌더(없으면 모두 null → 변화 없음).
  // PC에서는 화면 붙임쪽지(StickyMemo)가 같은 메모를 띄우므로 칩·패널은 모바일에서만 — 중복 표시 방지.
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
                borderRadius: `${radius.modal}px`,
                // 배지 배경 — 'background.elevated'는 라이트에서 페이지 배경과 대비 1.03이라 배지가 안 보였다.
                // 아이콘과 같은 강조색의 옅은 틴트로 두면 두 테마 모두에서 형태가 드러난다.
                bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.1 : 0.16),
                color: 'primary.main',
                '& svg': { fontSize: typescale.pageTitle.size },
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            {/* 제목 + (있으면) 개선 메모 칩 — 제목 바로 옆.
                minHeight를 아이콘 배지와 같은 40으로 두고 가운데 정렬: 제목 줄(28.6px)을 그냥
                flex-start로 두면 40px 배지·36px 액션 버튼보다 중심이 5~6px 위로 떠서 '제목이
                위로 치우쳐' 보인다. 세 요소의 중심을 같은 20px 선에 맞춘다. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: layout.headerRowHeight }}>
              <Typography variant="h2" component="h1">
                {title}
              </Typography>
              {chip && <Box sx={{ display: { xs: 'contents', shell: 'none' } }}>{chip}</Box>}
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
          // 제목 줄과 같은 minHeight로 중심선을 맞춘다(제목 블록에 부제가 붙어도 첫 줄 기준 유지)
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, minHeight: layout.headerRowHeight }}>{actions}</Box>
        )}
      </Box>
      {/* 칩 클릭 시 제목 아래 메모 패널 — PC는 붙임쪽지가 대신하므로 모바일에서만 */}
      {panel && <Box sx={{ display: { xs: 'block', shell: 'none' } }}>{panel}</Box>}
      {snackbar}
    </Box>
  )
}
