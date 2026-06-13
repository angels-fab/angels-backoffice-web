import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { ReactNode } from 'react'

export interface SectionHeaderProps {
  /** 섹션 제목 */
  title: string
  /** 제목 아래 설명(선택) */
  description?: string
  /** 제목 옆 보조 텍스트(건수 등) */
  count?: ReactNode
  /** 우측 "더보기" 액션 라벨. action 또는 onAction과 함께 사용. */
  actionLabel?: string
  /** 더보기 클릭 — 지정 시 chevron 포함 텍스트 버튼 표시 */
  onAction?: () => void
  /** 임의의 우측 액션(actionLabel 대신) */
  action?: ReactNode
}

/**
 * SectionHeader — 페이지 내 섹션 제목 줄.
 *
 * 제목 + (선택)설명 + (선택)건수 + (선택)액션. PageHeader보다 작은 위계(h3).
 *
 * @example
 * <SectionHeader title="다가오는 일정" description="향후 7일" count={5}
 *   actionLabel="전체보기" onAction={() => nav('/calendar')} />
 */
export default function SectionHeader({
  title,
  description,
  count,
  actionLabel,
  onAction,
  action,
}: SectionHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: description ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 1,
        mb: 1.5,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h3">{title}</Typography>
          {count != null && (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              {count}
            </Typography>
          )}
        </Box>
        {description && (
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action ??
        (onAction && (
          <Box
            component="button"
            onClick={onAction}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.25,
              border: 'none',
              bgcolor: 'transparent',
              cursor: 'pointer',
              color: 'text.secondary',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
              p: 0,
              '&:hover': { color: 'primary.main' },
            }}
          >
            {actionLabel ?? '더보기'}
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Box>
        ))}
    </Box>
  )
}
