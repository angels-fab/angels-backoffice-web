import { useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import { isForceDesktop, setForceDesktop } from '@/utils/viewportMode'
import { useRole, ROLE_LABEL } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { NavBadge } from '@/components/ds'
import { useNavBadges } from './useNavBadges'
import { NAV_ITEMS } from '@/constants/nav'
import { memoCountByPath, visibleMemos } from '@/utils/improveMemo'
import { alpha } from '@mui/material/styles'
import { radius, typescale } from '@/theme/tokens'

/**
 * 모바일 「메뉴」 바텀시트 — 하단 탭(홈·업무현황·업무일정·공지)에 없는 나머지 목적지 + 계정.
 * 하단 탭의 다섯 번째 '메뉴' 버튼에서 열린다(로그인 사용자). PC는 SideNav가 담당.
 */
interface Props {
  open: boolean
  onClose: () => void
}

interface NavRow {
  icon: ReactNode
  label: string
  path: string
  badge?: number
  /** 준비중 메뉴 — 이름 옆 앰버 칩 */
  wip?: boolean
}

/** 하단 탭바가 이미 맡은 목적지 + 계정 구역의 설정 — 드로어 '이동' 목록에서 뺀다 */
const TAB_PATHS = new Set(['/', '/work', '/calendar', '/notice', '/settings'])

export default function MobileMenuDrawer({ open, onClose }: Props) {
  const navigate = useNavigate()
  // PC 보기 전환 — 상단바에서 여기로 옮겨 왔다(2026-08-13 사용자 지시).
  // 기기 판정(isTouchDevice)은 더 보지 않는다 — 아래 '화면' 구역 주석 참조.
  const [desktopView, setDesktopView] = useState(isForceDesktop)
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

  // 하단 탭에 없는 목적지 — **PC 사이드바와 같은 출처(NAV_GROUPS)에서 파생**한다(2026-08-15 사용자 지시:
  // "PC와 순서가 다르다"). 손으로 관리하던 목록이라 메뉴를 넣을 때마다 순서가 어긋났다.
  // 노출 규칙도 SideNav 와 동일: adminOnly=관리자 / team=팀원 이상 / 그 외 전체.
  const rows: NavRow[] = NAV_ITEMS
    .filter((it) => !TAB_PATHS.has(it.path))
    .filter((it) => (it.adminOnly ? isAdmin : it.team ? isMember : true))
    .map((it) => ({ icon: it.icon, label: it.label, path: it.path, wip: it.wip, badge: it.badgeKey ? badges[it.badgeKey] : undefined }))

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      /* ★ 모달의 **뿌리 요소**까지 띄워야 탭이 눌린다(2026-08-13 사용자 지적으로 발견).
         MUI Modal 의 root 는 `position:fixed; inset:0; z-index:1200` 인 **투명한 판**이라,
         딤만 올려도 이 판이 화면 전체를 덮은 채 탭을 통째로 삼켰다("하단버튼이 하나도 안 먹힘").
         실측으로 확인: 이 판이 있으면 탭 지점의 elementFromPoint 가 판, 띄우면 탭 버튼이 잡힌다. */
      sx={{ bottom: 'var(--bottom-nav-h)' }}
      slotProps={{
        /* 시트를 **하단 탭바 위에서 멈춘다**(개선요청 80). MUI 기본은 bottom:0 이라 탭바를 덮었고,
           딤(backdrop)도 화면 전체를 덮어 탭을 눌러도 시트만 닫혔다. 둘 다 같은 높이만큼 띄운다.
           safe-area 는 탭바가 이미 자기 padding 으로 먹으므로 여기서 다시 더하지 않는다. */
        paper: {
          sx: {
            bgcolor: 'background.paper',
            borderTopLeftRadius: radius.modal,
            borderTopRightRadius: radius.modal,
            bottom: 'var(--bottom-nav-h)',
            maxHeight: 'calc(100% - var(--bottom-nav-h))',
            pb: 1.25,
          },
        },
        backdrop: { sx: { bottom: 'var(--bottom-nav-h)' } },
      }}
      /* 딤 밖(=탭바)을 눌렀을 때 그 탭이 실제로 눌리게 — 포커스 가둠을 풀지 않으면
         MUI FocusTrap 이 포커스를 시트로 되돌려 첫 탭이 먹힌다 */
      disableEnforceFocus
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
            /* 정렬은 왼쪽 그대로 — 우측정렬을 한 번 넣었다가 사용자 지시로 되돌렸다(2026-08-13) */
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

      {/* 화면 — 상단바에 있던 PC 보기 전환(2026-08-13 사용자 지시로 이동).
          누르면 시트를 닫는다: 레이아웃 폭이 통째로 바뀌므로 열린 시트를 남겨 두면 어색하다.
          **포털 관리자에게만 보인다**(요청메모 95). 실수로 켜도 갇히지는 않는다 — 데스크톱 보기는
          viewport 를 1280 으로 잡아 shell(768) 을 넘으므로 상단바 토글이 다시 나타난다.

          기기 판정(isTouchDevice)은 조건에서 뺐다(2026-08-16 사용자 지시). 이 시트는 하단탭이
          띄우는데 하단탭 자체가 shell(768) 미만에서만 나오므로, "PC 에선 숨긴다"는 목적은 이미
          분기점이 달성한다. 남겨 두면 PC 창을 좁혀 확인할 때 관리자조차 항목을 못 봤다(실제 신고).
          단, 진짜 데스크톱 브라우저에서는 눌러도 폭이 안 바뀐다 — viewport meta 는 폰 브라우저만
          해석한다. 선택은 저장되므로 같은 계정으로 폰에서 열면 PC 보기로 뜬다. */}
      {isAdmin && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="caption" sx={{ px: 2.5, pt: 1, color: 'text.disabled' }}>
            화면
          </Typography>
          <List dense sx={{ pt: 0.5 }}>
            <ListItemButton
              onClick={() => {
                const next = !desktopView
                setForceDesktop(next)
                setDesktopView(next)
                onClose()
              }}
              sx={{ py: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: desktopView ? 'primary.main' : 'text.secondary' }}>
                {desktopView ? <PhoneIphoneIcon /> : <DesktopWindowsIcon />}
              </ListItemIcon>
              <ListItemText
                slotProps={{ primary: { sx: { fontSize: typescale.emphasis.size } } }}
                primary={desktopView ? '모바일 보기로' : '데스크톱(PC) 보기로'}
              />
            </ListItemButton>
          </List>
        </>
      )}

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
