import { useLayoutEffect, useRef, useState } from 'react'
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
import { motion, radius, shadow, z } from '@/theme/tokens'
import { useNavBadges } from './useNavBadges'
import MobileMenuDrawer from './MobileMenuDrawer'
import AdminLoginDialog from '@/components/AdminLoginDialog'

// 아이콘 우상단 위첨자(D7 표준 NavBadge) — 하단탭 배경과 분리용 잉크 링
function Badge({ n }: { n: number }) {
  return <NavBadge count={n} kind="new" sx={{ position: 'absolute', top: -6, right: -10, boxShadow: '0 0 0 2px var(--ink)' /* design-lint-ok(shadow): 0 0 0 = 배경색으로 배지를 오려내는 컷아웃 링 */ }} />
}

/**
 * 하단 탭바 컨테이너 — **화면에 떠 있는 알약 바**(너츠169 참조, 2026-08-15 사용자 지시).
 * 바깥 nav 는 투명한 자리잡기 틀(pointer-events none), 실제 표면은 안쪽 group 이 담당.
 * PC는 숨김, ≤768px에서만 노출(셸 분기 — 문자열 max-width 로 쓰면 768px 정각에서 어긋남).
 */
const navSx = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: z.bottomNav,
  justifyContent: 'center',
  padding: '0 12px calc(10px + env(safe-area-inset-bottom,0px))',
  pointerEvents: 'none',
  display: { xs: 'flex', shell: 'none' },
  // 떠 있는 바 밑 콘텐츠를 살짝 가라앉히는 스크림 — 바가 허공에 뜬 느낌을 만든다
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: '84px',
    pointerEvents: 'none',
    background: 'linear-gradient(to bottom, transparent, var(--ink) 92%)',
    opacity: 0.85,
  },
}

/** 떠 있는 알약 그룹 — 반투명 + blur + 테두리 + 그림자(너츠169 문법, 색만 포털 토큰) */
const groupSx = (t: Theme) => ({
  pointerEvents: 'auto',
  position: 'relative',
  display: 'flex',
  alignItems: 'stretch',
  flex: 1,
  maxWidth: 420,
  padding: '5px 6px',
  borderRadius: '28px',
  border: `1px solid ${t.palette.divider}`,
  background: t.palette.mode === 'light' ? 'rgba(255,255,255,.9)' : 'rgba(19,23,34,.92)',
  WebkitBackdropFilter: 'blur(16px)',
  backdropFilter: 'blur(16px)',
  boxShadow: shadow.lg,
})

/** 탭 하나 — 아이콘 단독. 활성 = 아래 인디케이터 도형이 미끄러져 와서 감싸고, 아이콘은 흰색 */
const itemSx = (active: boolean) => (t: Theme) => ({
  flex: 1,
  position: 'relative',
  zIndex: 1,
  background: 'none',
  border: 'none',
  color: active ? t.palette.common.white : t.palette.text.secondary,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '3px 0',
  transition: `color ${motion.base}`,
  WebkitTapHighlightColor: 'transparent',
})

/** 아이콘 감싸개(pill) — 인디케이터 도형이 이 사각형 자리로 미끄러져 온다 */
const icoWrapSx = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '5px 16px',
  borderRadius: '999px',
  lineHeight: 1,
  '& svg': { width: '28px', height: '28px', display: 'block' },
}

/** 미끄러지는 활성 도형 — transform·width 를 스프링 베지어로(너츠169 실측 계수 그대로) */
const indicatorSx = (t: Theme) => ({
  position: 'absolute',
  left: 0,
  top: 0,
  zIndex: 0,
  borderRadius: `${radius.pill}px`,
  background: t.palette.accent.blue,
  opacity: 0,
  willChange: 'transform, width',
  transition: 'transform .4s cubic-bezier(0.34, 1.35, 0.5, 1), width .4s cubic-bezier(0.34, 1.35, 0.5, 1), opacity .18s',
  '@media (prefers-reduced-motion: reduce)': { transition: 'opacity .18s' },
})

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
  const groupRef = useRef<HTMLDivElement | null>(null)
  const indRef = useRef<HTMLDivElement | null>(null)

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  // 인디케이터 도형을 활성 탭의 아이콘 감싸개 자리로 이동 — CSS transition 이 미끄러짐을 만든다.
  // 활성 탭이 없으면(예: 자료실 등 드로어 목적지) 도형만 사라진다(opacity 0).
  useLayoutEffect(() => {
    const move = () => {
      const group = groupRef.current
      const ind = indRef.current
      if (!group || !ind) return
      const target = group.querySelector<HTMLElement>('[data-tab-active="1"] .bn-ico')
      if (!target) {
        ind.style.opacity = '0'
        return
      }
      const gr = group.getBoundingClientRect()
      const tr = target.getBoundingClientRect()
      ind.style.width = `${Math.round(tr.width)}px`
      ind.style.height = `${Math.round(tr.height)}px`
      ind.style.transform = `translate(${Math.round(tr.left - gr.left - 1)}px, ${Math.round(tr.top - gr.top - 1)}px)` // -1 = group border
      ind.style.opacity = '1'
    }
    move()
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [pathname, menuOpen, isMember, loggedIn])

  // 메뉴 시트가 열린 채로도 탭이 눌리므로(개선요청 80), 이동할 땐 시트를 함께 닫는다
  // 메뉴명은 화면에서 지웠으므로(아이콘 단독) 접근성 이름은 aria-label 로 남긴다
  const navItem = (path: string, label: string, icon: JSX.Element, badge = 0) => (
    <Box component="button" aria-label={label} data-tab-active={isActive(path) && !menuOpen ? '1' : undefined} sx={itemSx(isActive(path) && !menuOpen)} onClick={() => { setMenuOpen(false); navigate(path) }}>
      <Box component="span" className="bn-ico" sx={icoWrapSx}>
        {icon}
        <Badge n={badge} />
      </Box>
    </Box>
  )

  const actionItem = (label: string, icon: JSX.Element, onClick: () => void, badge = 0, active = false) => (
    <Box component="button" aria-label={label} data-tab-active={active ? '1' : undefined} sx={itemSx(active)} onClick={onClick}>
      <Box component="span" className="bn-ico" sx={icoWrapSx}>
        {icon}
        <Badge n={badge} />
      </Box>
    </Box>
  )

  return (
    <>
      <Box component="nav" id="bottom-nav" sx={navSx}>
        <Box ref={groupRef} sx={groupSx}>
          <Box ref={indRef} aria-hidden sx={indicatorSx} />
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
      </Box>

      {loggedIn ? (
        <MobileMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      ) : (
        <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      )}
    </>
  )
}
