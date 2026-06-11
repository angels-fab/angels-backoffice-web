import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Notice from '@/pages/Notice'
import NoticeDetail from '@/pages/Notice/NoticeDetail'
import Calendar from '@/pages/Calendar'
import Work from '@/pages/Work'
import Equipment from '@/pages/Equipment'
import Links from '@/pages/Links'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/notice" element={<Notice />} />
        <Route path="/notice/:id" element={<NoticeDetail />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/work" element={<Work />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/links" element={<Links />} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
