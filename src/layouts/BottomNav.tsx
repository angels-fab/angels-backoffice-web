import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CampaignIcon from '@mui/icons-material/Campaign'
import MenuIcon from '@mui/icons-material/Menu'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { useRole } from '@/auth/role'
import { NavBadge } from '@/components/ds'
import { useNavBadges } from './useNavBadges'
import MobileMenuDrawer from './MobileMenuDrawer'
import AdminLoginDialog from '@/components/AdminLoginDialog'

// 아이콘 우상단 위첨자(D7 표준 NavBadge) — 하단탭 배경과 분리용 잉크 링
function Badge({ n }: { n: number }) {
  return <NavBadge count={n} kind="new" sx={{ position: 'absolute', top: -6, right: -10, boxShadow: '0 0 0 2px var(--ink)' }} />
}

/**
 * 모바일 하단 탭바 — 하이브리드 내비게이션.
 * 로그인(일반·관리자): 홈 · 업무현황 · 업무일정 · 공지 + 「메뉴」(나머지 목적지·계정은 바텀시트).
 * 게스트: 홈 + 로그인. (사내 데이터는 로그인 필수 — 게스트는 홈만 접근)
 * PC는 SideNav가 담당(.bottom-nav는 ≤768px에서만 노출).
 */
export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMember, loggedIn } = useRole()
  const { notice: noticeCnt, work: workCnt, improve: improveCnt } = useNavBadges()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  const navItem = (path: string, label: string, icon: JSX.Element, badge = 0) => (
    <button className={`bnav-item${isActive(path) ? ' active' : ''}`} onClick={() => navigate(path)}>
      <span className="bnav-ico-wrap">
        {icon}
        <Badge n={badge} />
      </span>
      {label}
    </button>
  )

  const actionItem = (label: string, icon: JSX.Element, onClick: () => void, badge = 0, active = false) => (
    <button className={`bnav-item${active ? ' active' : ''}`} onClick={onClick}>
      <span className="bnav-ico-wrap">
        {icon}
        <Badge n={badge} />
      </span>
      {label}
    </button>
  )

  return (
    <>
      <nav className="bottom-nav" id="bottom-nav">
        {navItem('/', '홈', <HomeIcon />)}
        {isMember ? (
          <>
            {navItem('/work', '업무현황', <AssessmentIcon />, workCnt)}
            {navItem('/calendar', '일정', <CalendarMonthIcon />)}
            {navItem('/notice', '공지', <CampaignIcon />, noticeCnt)}
            {/* 메뉴 — 나머지 목적지·계정을 바텀시트로. 뒤에 새 개선요청이 있으면 배지 */}
            {actionItem('메뉴', <MenuIcon />, () => setMenuOpen(true), improveCnt, menuOpen)}
          </>
        ) : loggedIn ? (
          // 유관자 — 팀 업무 탭 없이 홈 + 메뉴(행사·바로가기·계정)
          actionItem('메뉴', <MenuIcon />, () => setMenuOpen(true), 0, menuOpen)
        ) : (
          actionItem('로그인', <LockOpenIcon />, () => setLoginOpen(true))
        )}
      </nav>

      {loggedIn ? (
        <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      ) : (
        <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  )
}
