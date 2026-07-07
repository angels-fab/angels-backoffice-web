import { useLocation, useNavigate } from 'react-router-dom'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import MonitorIcon from '@mui/icons-material/Monitor'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import LinkIcon from '@mui/icons-material/Link'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { useNavBadges } from './useNavBadges'
import { memoCountByPath } from '@/utils/improveMemo'

/**
 * 모바일 「메뉴」 바텀시트 — 하단 탭(홈·업무현황·업무일정·공지)에 없는 나머지 목적지 + 계정.
 * 하단 탭의 다섯 번째 '메뉴' 버튼에서 열린다(로그인 관리자 전용). PC는 SideNav가 담당.
 */
interface Props {
  open: boolean
  onClose: () => void
}

interface NavRow {
  icon: JSX.Element
  label: string
  path: string
  adminOnly?: boolean
  badge?: number
}

export default function MobileMenuDrawer({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { loggedIn, isAdmin, user, logout } = useRole()
  const badges = useNavBadges()
  const improveItems = useAppSelector((s) => s.improve.items)
  const memoCounts = memoCountByPath(improveItems)

  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  // 하단 탭에 없는 목적지(장비관리는 /equipment 안에서 도입/운영 탭으로 분기)
  const rows: NavRow[] = [
    { icon: <MonitorIcon />, label: '장비관리', path: '/equipment', adminOnly: true },
    { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badge: badges.improve },
    { icon: <CoPresentIcon />, label: '학술·교육·전시', path: '/events' },
    { icon: <LinkIcon />, label: '바로가기', path: '/links' },
  ].filter((r) => !r.adminOnly || isAdmin)

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            pb: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          },
        },
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.25, mb: 0.5 }} />

      <Typography variant="caption" sx={{ px: 2.5, pt: 1, color: 'text.disabled' }}>
        이동
      </Typography>
      <List dense sx={{ pt: 0.5 }}>
        {rows.map((r) => {
          const active = isActive(r.path)
          const memo = isAdmin ? memoCounts[r.path] || 0 : 0
          return (
            <ListItemButton key={r.path} selected={active} onClick={() => go(r.path)} sx={{ py: 1 }}>
              <ListItemIcon sx={{ minWidth: 40, color: active ? 'primary.main' : 'text.secondary' }}>
                {r.icon}
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary={r.label} />
              {memo > 0 && (
                <Box
                  component="span"
                  aria-label={`개선 메모 ${memo}건`}
                  sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main', mr: r.badge ? 1 : 0.5 }}
                />
              )}
              {r.badge ? (
                <Box
                  component="span"
                  aria-label={`새 글 ${r.badge}건`}
                  sx={{
                    minWidth: 18,
                    height: 18,
                    px: 0.5,
                    borderRadius: '9px',
                    bgcolor: '#f04438',
                    color: '#fff',
                    fontSize: 11,
                    lineHeight: '18px',
                    textAlign: 'center',
                  }}
                >
                  {r.badge > 99 ? '99+' : r.badge}
                </Box>
              ) : null}
            </ListItemButton>
          )
        })}
      </List>

      {loggedIn && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="caption" sx={{ px: 2.5, pt: 1, color: 'text.disabled' }}>
            계정{user ? ` · ${user}` : ''}{isAdmin ? '' : ' · 일반'}
          </Typography>
          <List dense sx={{ pt: 0.5 }}>
            {/* 설정 = 관리자 전용(가입 승인 등). 일반 사용자에겐 숨김. */}
            {isAdmin && (
              <ListItemButton selected={isActive('/settings')} onClick={() => go('/settings')} sx={{ py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40, color: isActive('/settings') ? 'primary.main' : 'text.secondary' }}>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary="설정" />
              </ListItemButton>
            )}
            <ListItemButton
              onClick={() => {
                onClose()
                logout()
              }}
              sx={{ py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary="로그아웃" />
            </ListItemButton>
          </List>
        </>
      )}
    </Drawer>
  )
}
