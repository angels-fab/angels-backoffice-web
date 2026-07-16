import { Component, type ErrorInfo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import { reportError } from '@/utils/reportError'
import { radius } from '@/theme/tokens'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * 앱 최상위 오류 경계 — 렌더 도중 예외가 나면 앱 전체가 백지가 되던 것을 막고(감사 C1),
 * '문제 발생 · 새로고침' 복구 화면을 보여준다. 잡은 오류는 reportError로 흘려보낸다
 * (그 함수 한 곳에 Sentry/자체로그를 연결하면 유지보수자에게 알림까지 이어짐).
 *
 * 오류 경계는 클래스 컴포넌트만 가능(React 제약). ThemeProvider 안쪽에 두어 복구 화면도 테마 적용.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { source: 'react-render', componentStack: info.componentStack })
  }

  private reload = () => window.location.reload()
  private goHome = () => {
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Box
        role="alert"
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <ReportProblemOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
            문제가 발생했어요
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
            일시적인 오류일 수 있어요. 새로고침하면 대개 해결됩니다.
            <br />
            계속 반복되면 관리자에게 알려주세요.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 3 }}>
            <Button variant="contained" startIcon={<RefreshIcon />} onClick={this.reload}>
              새로고침
            </Button>
            <Button variant="outlined" startIcon={<HomeOutlinedIcon />} onClick={this.goHome} sx={{ color: 'text.secondary' }}>
              홈으로
            </Button>
          </Box>
          {/* 오류 상세 — 평소엔 접혀 있음(유지보수 참고용) */}
          <Box
            component="details"
            sx={{
              mt: 3.5,
              textAlign: 'left',
              border: 1,
              borderColor: 'divider',
              borderRadius: `${radius.card}px`,
              p: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Box component="summary" sx={{ cursor: 'pointer', fontSize: 12, color: 'text.disabled', userSelect: 'none' }}>
              오류 상세
            </Box>
            <Box
              component="pre"
              sx={{
                mt: 1,
                mb: 0,
                fontSize: 11,
                color: 'text.disabled',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 200,
                overflow: 'auto',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}
