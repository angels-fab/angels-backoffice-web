import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { store } from '@/store'
import { darkTheme } from '@/theme/theme'
import App from '@/App'
import '@/index.css'

// GitHub Pages(정적 호스팅) 배포를 고려해 HashRouter 사용 — 원본도 해시 기반 라우팅
//
// ThemeProvider: 디자인 시스템(MUI) 컴포넌트에 다크 테마를 공급한다.
// 기존 페이지는 @mui/material 컴포넌트를 쓰지 않으므로 영향이 없고,
// CssBaseline(전역 리셋)은 기존 index.css 보호를 위해 2단계에서 도입한다.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <HashRouter>
          <App />
        </HashRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
)
