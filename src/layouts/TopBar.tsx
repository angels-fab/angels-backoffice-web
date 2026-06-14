import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import { StatusChip } from '@/components/ds'
import { useRole } from '@/auth/role'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import topbarLogo from '@/assets/topbar-logo.jpg'

export default function TopBar() {
  const navigate = useNavigate()
  const { isAdmin, user, logout } = useRole()
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div className="topbar-brand" onClick={() => navigate('/')} role="button" tabIndex={0} title="메인화면으로">
          <img src={topbarLogo} className="topbar-logo" alt="ANGELS FAB 구축 현황" />
        </div>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
    </div>
  )
}
