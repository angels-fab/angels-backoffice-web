import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { HashRouter } from 'react-router-dom'
import { store } from '@/store'
import App from '@/App'
import '@/index.css'

// GitHub Pages(정적 호스팅) 배포를 고려해 HashRouter 사용 — 원본도 해시 기반 라우팅
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  </React.StrictMode>,
)
