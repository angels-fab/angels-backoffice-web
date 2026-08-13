import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import type { Theme } from '@mui/material/styles'
import HomeIcon from '@mui/icons-material/Home'
import AssessmentIcon from '@mui/icons-material/Assessment'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CampaignIcon from '@mui/icons-material/Campaign'
import MenuIcon from '@mui/icons-material/Menu'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { useRole } from '@/auth/role'
import { NavBadge } from '@/components/ds'
import { motion, radius, weight, z, typescale } from '@/theme/tokens'
import { useNavBadges } from './useNavBadges'
import MobileMenuDrawer from './MobileMenuDrawer'
import AdminLoginDialog from '@/components/AdminLoginDialog'

// 아이콘 우상단 위첨자(D7 표준 NavBadge) — 하단탭 배경과 분리용 잉크 링
function Badge({ n }: { n: number }) {
  return <NavBadge count={n} kind="new" sx={{ position: 'absolute', top: -6, right: -10, boxShadow: '0 0 0 2px var(--ink)' /* design-lint-ok(shadow): 0 0 0 = 배경색으로 배지를 오려내는 컷아웃 링 */ }} />
}

/** 하단 탭바 컨테이너 — PC는 숨김, ≤768px에서만 flex로 노출(셸 분기) */
const navSx = (t: Theme) => ({
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: z.bottomNav,
  // 반투명 표면 — accent/표면 토큰에 대응 값이 없어 리터럴(라이트는 흰 반투명)
  background: t.palette.mode === 'light' ? 'rgba(255,255,255,.92)' : 'rgba(19,23,34,.92)',
  WebkitBackdropFilter: 'blur(8px)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid var(--border)',
  padding: '6px 4px calc(6px + env(safe-area-inset-bottom,0px))',
  // 셸 분기는 theme.breakpoints 의 'shell'(768) 하나로 — SideNav·TopBar 와 같은 메커니즘.
  // 문자열 '(max-width:768px)'로 쓰면 768 을 포함해 up('shell')과 겹치고, 정확히 768px 에서
  // "하단탭은 떴는데 상단바는 PC" 같은 어긋난 조합이 1px 폭으로 생긴다.
  display: { xs: 'flex', shell: 'none' },
})

/** 탭 하나 — 세로 스택(아이콘 + 라벨) + 활성 시 아래 3px 인디케이터 */
const itemSx = (active: boolean) => (t: Theme) => ({
  flex: 1,
  background: 'none',
  border: 'none',
  color: active ? t.palette.accentText.blue : t.palette.text.secondary,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '3px',
  padding: '5px 2px',
  // 크롬 최소 단(micro 10) — 배지·탭 라벨 전용. 사다리 바닥
  fontSize: typescale.micro.size,
  fontWeight: weight.medium,
  transition: `color ${motion.base}`,
  WebkitTapHighlightColor: 'transparent',
  '&::after': {
    content: '""',
    display: 'block',
    width: '16px',
    height: '3px',
    borderRadius: `${radius.pill}px`,
    background: active ? t.palette.accent.blue : 'transparent',
    marginTop: '2px',
  },
})

/** 아이콘 + 배지 겹침 래퍼 — 아이콘 23px은 사다리(13/16/18/20) 밖이라 리터럴 유지 */
const icoWrapSx = {
  position: 'relative',
  display: 'inline-flex',
  lineHeight: 1,
  '& svg': { width: '23px', height: '23px', display: 'block' },
}

/**
 * 모바일 하단 탭바 — 하이브리드 내비게이션.
 * 로그인(일반·관리자): 홈 · 업무현황 · 업무일정 · 공지 + 「메뉴」(나머지 목적지·계정은 바텀시트).
 * 게스트: 홈 + 로그인. (사내 데이터는 로그인 필수 — 게스트는 홈만 접근)
 * PC는 SideNav가 담당(하단 탭바는 ≤768px에서만 노출).
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

  // 메뉴 시트가 열린 채로도 탭이 눌리므로(개선요청 80), 이동할 땐 시트를 함께 닫는다
  const navItem = (path: string, label: string, icon: JSX.Element, badge = 0) => (
    <Box component="button" sx={itemSx(isActive(path))} onClick={() => { setMenuOpen(false); navigate(path) }}>
      <Box component="span" sx={icoWrapSx}>
        {icon}
        <Badge n={badge} />
      </Box>
      {label}
    </Box>
  )

  const actionItem = (label: string, icon: JSX.Element, onClick: () => void, badge = 0, active = false) => (
    <Box component="button" sx={itemSx(active)} onClick={onClick}>
      <Box component="span" sx={icoWrapSx}>
        {icon}
        <Badge n={badge} />
      </Box>
      {label}
    </Box>
  )

  return (
    <>
      <Box component="nav" id="bottom-nav" sx={navSx}>
        {navItem('/', '홈', <HomeIcon />)}
        {isMember ? (
          <>
            {navItem('/work', '업무현황', <AssessmentIcon />, workCnt)}
            {navItem('/calendar', '일정', <CalendarMonthIcon />)}
            {navItem('/notice', '공지', <CampaignIcon />, noticeCnt)}
            {/* 메뉴 — 나머지 목적지·계정을 바텀시트로. 뒤에 새 개선요청이 있으면 배지 */}
            {actionItem('메뉴', <MenuIcon />, () => setMenuOpen((v) => !v), improveCnt, menuOpen)}
          </>
        ) : loggedIn ? (
          // 유관자 — 팀 업무 탭 없이 홈 + 메뉴(행사·바로가기·계정)
          actionItem('메뉴', <MenuIcon />, () => setMenuOpen((v) => !v), 0, menuOpen)
        ) : (
          actionItem('로그인', <LockOpenIcon />, () => setLoginOpen(true))
        )}
      </Box>

      {loggedIn ? (
        <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      ) : (
        <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  )
}
