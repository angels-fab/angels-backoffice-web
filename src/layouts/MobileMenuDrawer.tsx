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
import FlagIcon from '@mui/icons-material/Flag'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import LinkIcon from '@mui/icons-material/Link'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useRole, ROLE_LABEL } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { NavBadge } from '@/components/ds'
import { useNavBadges } from './useNavBadges'
import { memoCountByPath, visibleMemos } from '@/utils/improveMemo'
import { alpha } from '@mui/material/styles'
import { radius, typescale } from '@/theme/tokens'

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
  memberOnly?: boolean
  badge?: number
  /** 준비중 메뉴 — 이름 옆 앰버 칩 */
  wip?: boolean
}

export default function MobileMenuDrawer({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { role, loggedIn, isMember, isAdmin, user, logout } = useRole()
  const badges = useNavBadges()
  const improveItems = useAppSelector((s) => s.improve.items)
  // 사이드바 배지와 같은 기준 — 작성자 본인 + 포털 관리자(2026-08-05)
  const memoCounts = memoCountByPath(visibleMemos(improveItems, user, isAdmin))

  const go = (path: string) => {
    onClose()
    navigate(path)
  }
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  // 하단 탭에 없는 목적지(장비관리는 /equipment 안에서 도입/운영 탭으로 분기)
  // 장비·개선요청 = 팀원 이상 / 행사·바로가기 = 유관자 포함 전체 로그인
  const rows: NavRow[] = [
    { icon: <MonitorIcon />, label: '장비관리', path: '/equipment', memberOnly: true },
    { icon: <FlagIcon />, label: '마일스톤', path: '/milestone', memberOnly: true, wip: true },
    { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badge: badges.improve, memberOnly: true },
    { icon: <CoPresentIcon />, label: '학술·교육·전시', path: '/events' },
    { icon: <LinkIcon />, label: '바로가기', path: '/links' },
  ].filter((r) => !r.memberOnly || isMember)

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            borderTopLeftRadius: radius.modal,
            borderTopRightRadius: radius.modal,
            pb: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          },
        },
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: `${radius.pill}px`, bgcolor: 'divider', mx: 'auto', mt: 1.25, mb: 0.5 }} />

      <Typography variant="caption" sx={{ px: 2.5, pt: 1, color: 'text.disabled' }}>
        이동
      </Typography>
      <List dense sx={{ pt: 0.5 }}>
        {rows.map((r) => {
          const active = isActive(r.path)
          const memo = memoCounts[r.path] || 0 // 이미 볼 수 있는 것만 세어 둔 값
          return (
            <ListItemButton key={r.path} selected={active} onClick={() => go(r.path)} sx={{ py: 1 }}>
              <ListItemIcon sx={{ minWidth: 40, color: active ? 'primary.main' : 'text.secondary' }}>
                {r.icon}
              </ListItemIcon>
              {/* 아이폰식 위첨자 배지(D7 표준) — 메뉴명 우상단, 빨강=새 글·앰버=메모. 행 오른쪽 배지 폐지 */}
              <ListItemText
                slotProps={{ primary: { sx: { fontSize: typescale.emphasis.size } } }}
                primary={
                  <Box component="span" sx={{ position: 'relative', display: 'inline-block' }}>
                    {r.label}
                    {/* 준비중 칩 — 완성 전 메뉴 표시 */}
                    {r.wip && (
                      <Box
                        component="span"
                        sx={{
                          ml: '5px',
                          fontSize: typescale.caption.size,
                          lineHeight: 1.5,
                          color: 'accentText.amber',
                          border: '1px solid',
                          borderColor: (t) => alpha(t.palette.accent.amber, 0.45),
                          bgcolor: (t) => alpha(t.palette.accent.amber, 0.12),
                          borderRadius: `${radius.chip}px`,
                          px: '5px',
                        }}
                      >
                        준비중
                      </Box>
                    )}
                    {((r.badge || 0) > 0 || memo > 0) && (
                      <Box component="span" sx={{ position: 'absolute', left: '100%', top: -7, ml: '3px', display: 'inline-flex', gap: '3px' }}>
                        <NavBadge count={r.badge || 0} kind="new" />
                        <NavBadge count={memo} kind="memo" />
                      </Box>
                    )}
                  </Box>
                }
              />
            </ListItemButton>
          )
        })}
      </List>

      {loggedIn && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="caption" sx={{ px: 2.5, pt: 1, color: 'text.disabled' }}>
            계정{user ? ` · ${user}` : ''} · {ROLE_LABEL[role]}
          </Typography>
          <List dense sx={{ pt: 0.5 }}>
            {/* 설정 = 로그인 전원(본인 비밀번호 변경). 가입 승인·권한 변경은 페이지 안에서 관리자에게만. */}
            {loggedIn && (
              <ListItemButton selected={isActive('/settings')} onClick={() => go('/settings')} sx={{ py: 1 }}>
                <ListItemIcon sx={{ minWidth: 40, color: isActive('/settings') ? 'primary.main' : 'text.secondary' }}>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText slotProps={{ primary: { sx: { fontSize: typescale.emphasis.size } } }} primary="설정" />
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
              <ListItemText slotProps={{ primary: { sx: { fontSize: typescale.emphasis.size } } }} primary="로그아웃" />
            </ListItemButton>
          </List>
        </>
      )}
    </Drawer>
  )
}
