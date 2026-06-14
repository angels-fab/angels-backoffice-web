import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import SearchIcon from '@mui/icons-material/Search'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import { StatusChip } from '@/components/ds'
import { useRole } from '@/auth/role'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import GlobalSearchDialog from '@/components/GlobalSearchDialog'
import topbarLogo from '@/assets/topbar-logo.jpg'

export default function TopBar() {
  const navigate = useNavigate()
  const { isAdmin, user, logout } = useRole()
  const [loginOpen, setLoginOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
          <Tooltip title="통합검색 (Ctrl+K)">
            <IconButton aria-label="통합검색" onClick={() => setSearchOpen(true)} size="small" sx={{ color: 'text.secondary' }}>
              <SearchIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
          {isAdmin ? (
            <>
              <StatusChip status="success" label={user ? `관리자 · ${user}` : '관리자'} />
              <Button size="small" variant="text" startIcon={<LogoutIcon sx={{ fontSize: 16 }} />} onClick={logout} sx={{ color: 'text.secondary' }}>
                로그아웃
              </Button>
            </>
          ) : (
            <Button size="small" variant="outlined" startIcon={<LockOpenIcon sx={{ fontSize: 16 }} />} onClick={() => setLoginOpen(true)}>
              관리자 모드
            </Button>
          )}
        </Box>
      </div>

      <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
