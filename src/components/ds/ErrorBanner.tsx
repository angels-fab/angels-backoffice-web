import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import type { SxProps, Theme } from '@mui/material/styles'

export interface ErrorBannerProps {
  /** 사용자에게 보일 문구 — 무엇이 실패했고 어떻게 되는지 */
  message: string
  /** 재시도 콜백 — 있으면 '다시 시도' 버튼 표시 */
  onRetry?: () => void
  /**
   * 기존 데이터를 유지한 채 갱신만 실패 = warning(강등),
   * 표시할 데이터 자체가 없음 = error. (Calendar·Work의 검증된 설계 승격)
   */
  severity?: 'error' | 'warning'
  sx?: SxProps<Theme>
}

/**
 * ErrorBanner — 페이지 데이터 로드 실패 표준 배너 (P2, B#7).
 *
 * @example
 * {error && <ErrorBanner message="일정을 불러오지 못했습니다." severity={items.length ? 'warning' : 'error'} onRetry={reload} />}
 */
export default function ErrorBanner({ message, onRetry, severity = 'error', sx }: ErrorBannerProps) {
  return (
    <Alert
      severity={severity}
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            다시 시도
          </Button>
        )
      }
      sx={{ mb: 2, ...sx }}
    >
      {message}
    </Alert>
  )
}
