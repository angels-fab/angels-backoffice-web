import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import SearchIcon from '@mui/icons-material/Search'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import { StatusChip } from '@/components/ds'
import { useRole, ROLE_LABEL } from '@/auth/role'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import GlobalSearchDialog from '@/components/GlobalSearchDialog'
import { isForceDesktop, setForceDesktop, isTouchDevice } from '@/utils/viewportMode'
import { iconSize } from '@/theme/tokens'
import topbarLogo from '@/assets/topbar-logo.jpg'

export default function TopBar() {
  const navigate = useNavigate()
  const { role, loggedIn, isAdmin, user, logout } = useRole()
  const [loginOpen, setLoginOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // 모바일에서 데스크톱(PC) 레이아웃 보기 토글 (터치 기기에서만 노출)
  const [touch] = useState(isTouchDevice)
  const [desktopView, setDesktopView] = useState(isForceDesktop)
  const toggleDesktopView = () => {
    const next = !desktopView
    setForceDesktop(next)
    setDesktopView(next)
  }

  // Ctrl/⌘+K 로 통합검색 열기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand" onClick={() => navigate('/')} role="button" tabIndex={0} title="메인화면으로">
          <img src={topbarLogo} className="topbar-logo" alt="ANGELS FAB 구축 현황" />
        </div>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {touch && (
            <Tooltip title={desktopView ? '모바일 보기로' : '데스크톱(PC) 보기로'}>
              <IconButton
                aria-label={desktopView ? '모바일 보기로 전환' : '데스크톱 보기로 전환'}
                onClick={toggleDesktopView}
                size="small"
                sx={{ color: desktopView ? 'primary.main' : 'text.secondary' }}
              >
                {desktopView ? <PhoneIphoneIcon sx={{ fontSize: iconSize.header }} /> : <DesktopWindowsIcon sx={{ fontSize: iconSize.header }} />}
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="통합검색 (Ctrl+K)">
            <IconButton aria-label="통합검색" onClick={() => setSearchOpen(true)} size="small" sx={{ color: 'text.secondary' }}>
              <SearchIcon sx={{ fontSize: iconSize.header }} />
            </IconButton>
          </Tooltip>
          {/* 계정 컨트롤(칩·로그아웃·로그인)은 PC 전용 — 모바일은 하단 탭바/메뉴 드로어가 담당(상단바 잘림 방지) */}
          <Box className="d-only" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {loggedIn ? (
              <>
                <StatusChip
                  status={isAdmin ? 'success' : role === 'member' ? 'info' : 'neutral'}
                  label={user ? `${ROLE_LABEL[role]} · ${user}` : ROLE_LABEL[role]}
                />
                <Button size="small" variant="text" startIcon={<LogoutIcon sx={{ fontSize: iconSize.body }} />} onClick={logout} sx={{ color: 'text.secondary' }}>
                  로그아웃
                </Button>
              </>
            ) : (
              <Button size="small" variant="outlined" startIcon={<LockOpenIcon sx={{ fontSize: iconSize.body }} />} onClick={() => setLoginOpen(true)}>
                로그인
              </Button>
            )}
          </Box>
        </Box>
      </div>

      <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
