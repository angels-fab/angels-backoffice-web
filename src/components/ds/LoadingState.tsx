import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

export interface LoadingStateProps {
  /** 안내 문구. 표기는 '불러오는 중…'(줄임표 단일 문자)으로 통일 */
  label?: string
  /** sm=행/셀 안, md=카드/페이지 영역 (EmptyState와 대칭) */
  size?: 'sm' | 'md'
  /** 스켈레톤 표현(요청메모 92) — 스피너 대신 내용 골격(칩·제목·값 줄)을 잡아 둔다. 홈 카드용 */
  skeleton?: boolean
  /** 스켈레톤 줄 수 — 실제 내용의 줄 수와 비슷하게 (기본 3) */
  rows?: number
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
export default function LoadingState({ label = '불러오는 중…', size = 'md', skeleton, rows = 3, sx }: LoadingStateProps) {
  const sm = size === 'sm'
  if (skeleton) {
    // 줄 골격 = 홈 카드 행(HomeRow)의 [칩·제목·오른쪽 값] — 로딩이 끝나면 같은 자리에 실제 행이 들어선다.
    // 문구는 화면에서 빼고 보조기기에만 남긴다(role=status 유지) — 스켈레톤 자체가 "불러오는 중"의 표현.
    return (
      <Box role="status" aria-live="polite" aria-label={label} sx={mergeSx({ py: 0.5 }, sx)}>
        {Array.from({ length: rows }, (_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75 }}>
            <Skeleton variant="rounded" width={44} height={20} sx={{ flexShrink: 0 }} />
            <Skeleton variant="text" sx={{ flex: 1 }} />
            <Skeleton variant="text" width={40} sx={{ flexShrink: 0 }} />
          </Box>
        ))}
      </Box>
    )
  }
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={mergeSx({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: sm ? 1.5 : 4,
      }, sx)}
    >
      <CircularProgress size={sm ? 14 : 18} thickness={5} sx={{ color: 'text.disabled' }} />
      <Typography variant={sm ? 'caption' : 'body2'} sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  )
}
