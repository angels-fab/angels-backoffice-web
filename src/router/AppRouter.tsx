import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Home from '@/pages/Home'
import Notice from '@/pages/Notice'
import Calendar from '@/pages/Calendar'
import Work from '@/pages/Work'
import Equipment from '@/pages/Equipment'
import EquipmentOps from '@/pages/EquipmentOps'
import Links from '@/pages/Links'
import Events from '@/pages/Events'
import Settings from '@/pages/Settings'
import Improve from '@/pages/Improve'
import RequireAdmin from '@/auth/RequireAdmin'
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
        {/* 장비관리 — 로그인(관리자) 전용. 게스트는 홈으로 리다이렉트 */}
        <Route path="/equipment" element={<RequireAdmin><Equipment /></RequireAdmin>} />
        <Route path="/equipment-ops" element={<RequireAdmin><EquipmentOps /></RequireAdmin>} />
        <Route path="/links" element={<Links />} />
        <Route path="/improve" element={<Improve />} />
        {/* 구축 로드맵 전용 페이지 제거 — 콘텐츠는 홈으로 이관. /roadmap 접근은 전역 규칙(홈 리다이렉트) */}
        <Route path="/events" element={<Events />} />
        {/* 설정 — 로그인(관리자) 전용. 게스트는 홈으로 (로그인은 상단바 '관리자 모드' 버튼) */}
        <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
