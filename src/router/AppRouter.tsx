import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Notice from '@/pages/Notice'
import Calendar from '@/pages/Calendar'
import Work from '@/pages/Work'
import Equipment from '@/pages/Equipment'
import EquipmentOps from '@/pages/EquipmentOps'
import Links from '@/pages/Links'
import Roadmap from '@/pages/Roadmap'
import Settings from '@/pages/Settings'
import Improve from '@/pages/Improve'
import DesignSystemShowcase from '@/pages/_DesignSystem'
import LayoutSystemShowcase from '@/pages/_LayoutSystem'

export function AppRouter() {
  return (
    <Routes>
      {/* 디자인/레이아웃 시스템 쇼케이스 — 내비 미노출, 앱 셸(MainLayout) 바깥 독립 라우트 */}
      <Route path="/design-system" element={<DesignSystemShowcase />} />
      <Route path="/layout-system" element={<LayoutSystemShowcase />} />
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
        <Route path="/improve" element={<Improve />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/settings" element={<Settings />} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
