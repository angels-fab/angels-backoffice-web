import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  // PORT 환경변수 우선 — 다른 세션이 3600을 쓰는 중에도 병행 개발 서버를 띄울 수 있게(기본 3600 유지)
  server: { port: Number(process.env.PORT) || 3600 },
})
