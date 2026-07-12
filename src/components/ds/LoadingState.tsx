import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

export interface LoadingStateProps {
  /** 안내 문구. 표기는 '불러오는 중…'(줄임표 단일 문자)으로 통일 */
  label?: string
  /** sm=행/셀 안, md=카드/페이지 영역 (EmptyState와 대칭) */
  size?: 'sm' | 'md'
  sx?: SxProps<Theme>
}

/**
 * LoadingState — 데이터 로딩 표준 표현 (P2, B#7).
 *
 * "불러오는 중" 텍스트 15곳·레거시 스피너·크기 파편화를 이것 하나로 수렴한다.
 * 버튼 busy는 이 컴포넌트가 아니라 `<Button startIcon={<CircularProgress size={14} thickness={5}/>}>` 규칙.
 *
 * @example
 * {!ready ? <LoadingState /> : <List .../>}
 * <LoadingState size="sm" label="이력 불러오는 중…" />
 */
export default function LoadingState({ label = '불러오는 중…', size = 'md', sx }: LoadingStateProps) {
  const sm = size === 'sm'
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: sm ? 1.5 : 4,
        ...sx,
      }}
    >
      <CircularProgress size={sm ? 14 : 18} thickness={5} sx={{ color: 'text.disabled' }} />
      <Typography variant={sm ? 'caption' : 'body2'} sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  )
}
