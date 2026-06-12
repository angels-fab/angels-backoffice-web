import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Notice from '@/pages/Notice'
import Calendar from '@/pages/Calendar'
import Work from '@/pages/Work'
import Equipment from '@/pages/Equipment'
import EquipmentOps from '@/pages/EquipmentOps'
import Links from '@/pages/Links'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/notice" element={<Notice />} />
        {/* 연번 딥링크(/notice/12) — 해당 공지를 아코디언으로 펼친 채 진입 */}
        <Route path="/notice/:num" element={<Notice />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/work" element={<Work />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/equipment-ops" element={<EquipmentOps />} />
        <Route path="/links" element={<Links />} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
