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
import Switch from '@mui/material/Switch'
import { styled } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { useRole, ROLE_LABEL } from '@/auth/role'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import GlobalSearchDialog from '@/components/GlobalSearchDialog'
import { isForceDesktop, setForceDesktop, isTouchDevice } from '@/utils/viewportMode'
import { useThemeMode } from '@/theme/mode'
import { iconSize, z } from '@/theme/tokens'
import topbarLogo from '@/assets/topbar-logo.jpg'

/**
 * 라이트/다크 토글 스위치 — 다크=ON(우측·달), 라이트=OFF(좌측·해).
 * 네이비 썸(달/해 아이콘 내장) + 회색 트랙. 아이콘은 SVG 데이터URI(이모지 아님).
 */
const ThemeSwitch = styled(Switch)({
  width: 58,
  height: 32,
  padding: 7,
  // 테마 전환은 화면 전체를 한 장으로 크로스페이드(View Transitions)하는데, 그러면 스위치의 슬라이드가
  // 그 페이드에 묻혀 "밀리는 게 아니라 흐려졌다 나타나는" 것처럼 보인다.
  // 자기 이름을 주면 스위치만 따로 잡혀서 실제로 미끄러지는 게 보인다.
  viewTransitionName: 'theme-switch',
  '& .MuiSwitch-switchBase': {
    margin: 1,
    padding: 0,
    transform: 'translateX(4px)',
    '&.Mui-checked': {
      transform: 'translateX(24px)',
      '& .MuiSwitch-thumb': { backgroundColor: '#0B1C3A', boxShadow: '0 1px 2px rgba(0,0,0,.45)' }, // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
      '& .MuiSwitch-thumb:before': {
        // 달(다크) — 남색 알 위라 흰색
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#fff')}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`, // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
      },
      '& + .MuiSwitch-track': { opacity: 1, backgroundColor: '#5A6B80' }, // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    },
  },
  // 썸 — 라이트(해)는 밝은 알 + 진한 해, 다크(달)는 남색 알 + 흰 달.
  // 구현: 기본(미체크)=라이트, 위 '&.Mui-checked' 블록이 다크로 덮는다.
  '& .MuiSwitch-thumb': {
    backgroundColor: '#FDFEFF', // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    boxShadow: '0 1px 2px rgba(20,37,66,.28)',
    width: 28,
    height: 28,
    position: 'relative',
    '&:before': {
      content: "''",
      position: 'absolute',
      width: '100%',
      height: '100%',
      left: 0,
      top: 0,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      // 해(라이트) — 밝은 알 위라 진한 앰버
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#B26A00')}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`, // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    },
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: '#aab4be', // design-lint-ok: MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    borderRadius: 20 / 2,
  },
})

export default function TopBar() {
  const navigate = useNavigate()
  const { role, loggedIn, isAdmin, user, logout } = useRole()
  const { mode, toggle: toggleTheme } = useThemeMode()
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
    /* 구 index.css .topbar/.topbar-inner/.topbar-brand/.topbar-logo 를 sx 로 이관(2026-08-01).
       모바일에서 sticky → fixed 로 바뀌는 이유: 하단탭바와 함께 쓰는 고정 셸이라 스크롤에서 빠진다
       (body padding-top 53 이 그 자리를 메운다 — index.css 모바일 블록에 남아 있다). */
    <Box
      component="header"
      sx={{
        position: { xs: 'fixed', shell: 'sticky' },
        top: 0, left: 0, right: 0,
        zIndex: z.topbar,
        bgcolor: 'background.default',
        // 구 CSS와 같은 값(--border, 카드 테두리와 동급). divider 는 한 단 옅어 선이 흐려진다
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Box
        sx={{
          mx: 'auto', width: '100%', boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
          py: '9px',
          pl: { xs: '14px', shell: '20px' },
          pr: { xs: '10px', shell: '20px' },
        }}
      >
        <Box
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          title="메인화면으로"
          sx={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 }}
        >
          {/* 로고는 원본이 흰 배경 PNG라 테마별로 다르게 눌러 없앤다:
              다크 = lighten 으로 배경을 배경색에 묻고, 라이트 = 반전 후 multiply. */}
          <Box
            component="img"
            src={topbarLogo}
            alt="ANGELS FAB 구축 현황"
            sx={(th) => ({
              height: { xs: 30, shell: 34 },
              maxWidth: { xs: '52vw', shell: 'none' },
              width: 'auto',
              objectFit: 'contain',
              ...(th.palette.mode === 'light'
                ? { mixBlendMode: 'multiply', filter: 'invert(1)', background: 'transparent' }
                : { mixBlendMode: 'lighten', background: th.palette.background.default }),
            })}
          />
        </Box>

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
          <Tooltip title={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            <ThemeSwitch
              checked={mode === 'dark'}
              onChange={toggleTheme}
              slotProps={{ input: { 'aria-label': mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환' } }}
            />
          </Tooltip>
          <Tooltip title="통합검색 (Ctrl+K)">
            <IconButton aria-label="통합검색" onClick={() => setSearchOpen(true)} size="small" sx={{ color: 'text.secondary' }}>
              <SearchIcon sx={{ fontSize: iconSize.header }} />
            </IconButton>
          </Tooltip>
          {/* 계정 컨트롤(칩·로그아웃·로그인)은 PC 전용 — 모바일은 하단 탭바/메뉴 드로어가 담당(상단바 잘림 방지).
              구 .d-only 클래스를 반응형 display 로 이관 */}
          <Box sx={{ display: { xs: 'none', shell: 'flex' }, alignItems: 'center', gap: 1 }}>
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
      </Box>

      <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
      <GlobalSearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  )
}
