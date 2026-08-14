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
import Resources from '@/pages/Resources'
import Milestone from '@/pages/Milestone'
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
        {/* 마일스톤(팹 구축~개소 실행계획 현황판) — 게스트 포함 로그인 전원 열람(개선요청 90),
            편집은 페이지 안에서 isMember 게이트 + RLS(member+)가 이중으로 막는다 */}
        <Route path="/milestone" element={<RequireAuth><Milestone /></RequireAuth>} />
        {/* 행사·바로가기 — 로그인(유관자 포함) 열람 */}
        <Route path="/links" element={<RequireAuth><Links /></RequireAuth>} />
        <Route path="/improve" element={<RequireMember><Improve /></RequireMember>} />
        {/* 자료실(개선요청 86) — 팀 내부 참고 링크 모음이라 팀원 이상 */}
        <Route path="/resources" element={<RequireMember><Resources /></RequireMember>} />
        {/* 구축 로드맵 전용 페이지 제거 — 콘텐츠는 홈으로 이관. /roadmap 접근은 전역 규칙(홈 리다이렉트) */}
        <Route path="/events" element={<RequireAuth><Events /></RequireAuth>} />
        {/* 설정 — 로그인 전원. 페이지를 등급별로 나누지 않는 이유: 내부가 이미 갈려 있다
            (비밀번호 변경 = loggedIn / 사용자 관리 = isAdmin + RLS profiles_admin_*).
            예전엔 문 자체가 RequireAdmin이라 구성원이 본인 비밀번호를 못 바꿨다(2026-08-05 수정). */}
        <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
        {/* 원본 한글 페이지명 별칭 ('회의'는 캘린더로 — goPage alias 대응) */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
