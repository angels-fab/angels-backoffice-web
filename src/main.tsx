import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { store } from '@/store'
import { darkTheme } from '@/theme/theme'
import { RoleProvider } from '@/auth/role'
import { SnackProvider } from '@/components/ds'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initSentry } from '@/utils/sentry'
import App from '@/App'
import '@/index.css'

// 오류 추적 시작 — 렌더보다 먼저 켜야 초기 오류까지 잡는다(운영에서만 전송)
initSentry()

// GitHub Pages(정적 호스팅) 배포를 고려해 HashRouter 사용 — 원본도 해시 기반 라우팅
//
// ThemeProvider: 디자인 시스템(MUI) 컴포넌트에 다크 테마를 공급한다.
// 기존 페이지는 @mui/material 컴포넌트를 쓰지 않으므로 영향이 없고,
// CssBaseline(전역 리셋)은 기존 index.css 보호를 위해 2단계에서 도입한다.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        {/* 최상위 오류 경계 — 렌더 예외 시 백지 대신 복구 화면(감사 C1). 테마 안쪽·앱 바깥에 둔다 */}
        <ErrorBoundary>
          {/* 전역 스낵바(P2) — 페이지별 Snackbar 보일러플레이트를 useSnack 훅으로 수렴 */}
          <SnackProvider>
            <RoleProvider>
              <HashRouter>
                <App />
              </HashRouter>
            </RoleProvider>
          </SnackProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
)
