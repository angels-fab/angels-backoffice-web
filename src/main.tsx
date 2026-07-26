import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { store } from '@/store'
import { ThemeModeProvider } from '@/theme/mode'
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
// ThemeModeProvider: 라이트/다크 모드 상태를 쥐고, MUI 컴포넌트에 해당 테마를 공급한다.
// 레거시 페이지는 <html data-theme>로 index.css 변수를 전환한다(ThemeModeProvider가 세팅).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeModeProvider>
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
      </ThemeModeProvider>
    </Provider>
  </React.StrictMode>,
)
