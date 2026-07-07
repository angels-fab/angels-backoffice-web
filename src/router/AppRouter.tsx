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
import RequireAuth from '@/auth/RequireAuth'
import RequireMember from '@/auth/RequireMember'
import DesignSystemShowcase from '@/pages/_DesignSystem'
import LayoutSystemShowcase from '@/pages/_LayoutSystem'

export function AppRouter() {
  return (
    <Routes>
      {/* 디자인/레이아웃 시스템 쇼케이스 — 내비 미노출, 앱 셸(MainLayout) 바깥 독립 라우트 */}
      <Route path="/design-system" element={<DesignSystemShowcase />} />
      <Route path="/layout-system" element={<LayoutSystemShowcase />} />
      <Route element={<MainLayout />}>
        {/* 홈 = 공개 랜딩(로드맵 + 로그인 진입). 그 외 사내 데이터 페이지는 전부 로그인 필수 */}
        <Route path="/" element={<Home />} />
        {/* 팀 콘텐츠(공지·업무·개선) — 팀원 이상. 게스트·유관자는 홈으로 */}
        <Route path="/notice" element={<RequireMember><Notice /></RequireMember>} />
        {/* 연번 딥링크(/notice/12) — 해당 공지를 아코디언으로 펼친 채 진입 */}
        <Route path="/notice/:num" element={<RequireMember><Notice /></RequireMember>} />
        <Route path="/calendar" element={<RequireMember><Calendar /></RequireMember>} />
        <Route path="/work" element={<RequireMember><Work /></RequireMember>} />
        {/* 장비관리 — 팀원 이상 열람(편집은 페이지 내 관리자 게이트). 유관자 제한열람은 추후 */}
        <Route path="/equipment" element={<RequireMember><Equipment /></RequireMember>} />
        <Route path="/equipment-ops" element={<RequireMember><EquipmentOps /></RequireMember>} />
        {/* 행사·바로가기 — 로그인(유관자 포함) 열람 */}
        <Route path="/links" element={<RequireAuth><Links /></RequireAuth>} />
        <Route path="/improve" element={<RequireMember><Improve /></RequireMember>} />
        {/* 구축 로드맵 전용 페이지 제거 — 콘텐츠는 홈으로 이관. /roadmap 접근은 전역 규칙(홈 리다이렉트) */}
        <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
        {/* 설정 — 로그인(관리자) 전용. 게스트는 홈으로 (로그인은 상단바 '관리자 모드' 버튼) */}
        <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
