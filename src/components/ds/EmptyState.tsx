import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  /** 안내 제목. 예: "등록된 장비가 없습니다" */
  title: string
  /** 보조 설명 */
  description?: string
  /** 아이콘(MUI). 기본 InboxOutlined. */
  icon?: ReactNode
  /** 액션 버튼 등 */
  action?: ReactNode
  /** 세로 여백 크기. 기본 'md'. */
  size?: 'sm' | 'md'
}

/**
 * EmptyState — 데이터/검색 결과가 없을 때의 통일된 빈 상태.
 *
 * @example
 * <EmptyState title="검색 결과가 없습니다" description="다른 키워드로 시도해 보세요." />
 */
export default function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'md',
}: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        py: size === 'md' ? 8 : 4,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Box sx={{ color: 'text.disabled', display: 'flex', '& svg': { fontSize: 44 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography variant="h4" sx={{ color: 'text.secondary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 320 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  )
}
