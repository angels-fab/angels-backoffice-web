import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import SearchIcon from '@mui/icons-material/Search'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import Switch from '@mui/material/Switch'
import { alpha, styled } from '@mui/material/styles'
import { focusRingSx } from '@/components/ds'
import { useRole, ROLE_LABEL } from '@/auth/role'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import GlobalSearchDialog from '@/components/GlobalSearchDialog'
import MemoComposeButton from '@/components/MemoComposeButton'
import { MEMO_DRAW_EVENT } from '@/components/MemoDraw'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import NotificationBell from './NotificationBell'
import { isForceDesktop, setForceDesktop, isTouchDevice } from '@/utils/viewportMode'
import { useThemeMode } from '@/theme/mode'
import { control, iconSize, radius, typescale, weight, z } from '@/theme/tokens'
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
      '& .MuiSwitch-thumb': { backgroundColor: '#0B1C3A', boxShadow: '0 1px 2px rgba(0,0,0,.45)' }, // design-lint-ok(hex,shadow): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
      '& .MuiSwitch-thumb:before': {
        // 달(다크) — 남색 알 위라 흰색
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#fff')}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`, // design-lint-ok(hex): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
      },
      '& + .MuiSwitch-track': { opacity: 1, backgroundColor: '#5A6B80' }, // design-lint-ok(hex): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    },
  },
  // 썸 — 라이트(해)는 밝은 알 + 진한 해, 다크(달)는 남색 알 + 흰 달.
  // 구현: 기본(미체크)=라이트, 위 '&.Mui-checked' 블록이 다크로 덮는다.
  '& .MuiSwitch-thumb': {
    backgroundColor: '#FDFEFF', // design-lint-ok(hex): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    boxShadow: '0 1px 2px rgba(20,37,66,.28)', /* design-lint-ok(shadow): 28px 스위치 알의 경계용 마이크로 입체 — 카드 스케일 3단과 다른 축 */
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
      backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 20 20"><path fill="${encodeURIComponent('#B26A00')}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`, // design-lint-ok(hex): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    },
  },
  '& .MuiSwitch-track': {
    opacity: 1,
    backgroundColor: '#aab4be', // design-lint-ok(hex): MUI 공식 데모 MaterialUISwitch 값 — 순정 유지가 사용자 결정(2026-08-02)
    borderRadius: `${radius.pill}px`,
  },
})

export default function TopBar() {
  const navigate = useNavigate()
  const { role, loggedIn, isMember, user, logout } = useRole()
  const { mode, toggle: toggleTheme } = useThemeMode()
  const [loginOpen, setLoginOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // 단축키 표기 — 바인딩은 Ctrl·⌘ 둘 다 받으므로(아래 onKey) 기기에 맞는 쪽만 보여준다
  const [modKey] = useState(() => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'))
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
          py: '7px',
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
          {/*
            로고 이미지에는 'ANGELS 첨단AI반도체팹센터 | FAB 구축 포털 시스템'이 통째로 박혀 있어
            포털 이름을 코드에서 바꿀 수 없었다(개선요청 #43 '통합업무포털'로 변경).
            그래서 **이미지는 ANGELS 마크까지만 잘라 쓰고 포털 이름은 글자로 그린다** —
            앞으로 이름이 바뀌어도 이미지 새로 만들 필요 없이 아래 한 줄만 고치면 된다.
            자르는 비율 0.41 = 원본(4315×463)에서 '첨단AI반도체팹센터'가 끝나고 구분선 앞까지.

            로고는 원본이 흰 글자·검은 배경이라 테마별로 다르게 눌러 없앤다:
            다크 = lighten 으로 배경을 배경색에 묻고, 라이트 = 반전 후 multiply.
          */}
          {/* 크기는 상단바 높이(53px, StickyMemo 의 TOPBAR_H·모바일 body padding 과 같은 값)에 묶여 있다.
              로고를 키운 만큼 위아래 여백(py)을 줄여 총 높이를 지킨다 — 38+7*2 = 52.

              ⚠ 이미지 높이를 상자 높이(38)에 맞추면 로고가 위로 치우쳐 보인다 — 원본(4315×463)
              안에서 마크가 y 41~349 에 있어 위 여백 41 · 아래 여백 113 으로 위쪽에 붙어 있기 때문이다
              (캔버스로 실측). 그래서 **상자보다 큰 45px 로 그려 넣어** 마크 자체가 상자 세로 가운데에
              오게 한다(45 기준 마크는 4.0~33.9 → 위아래 여백 4.0/4.1). 남는 아래쪽은 잘린다. */}
          <Box sx={{ height: { xs: 34, shell: 38 }, width: { xs: 153, shell: 172 }, flexShrink: 0, overflow: 'hidden' }}>
            <Box
              component="img"
              src={topbarLogo}
              alt="ANGELS 첨단AI반도체팹센터"
              sx={(th) => ({
                height: { xs: 40, shell: 45 },
                width: 'auto',
                maxWidth: 'none',
                display: 'block',
                ...(th.palette.mode === 'light'
                  ? { mixBlendMode: 'multiply', filter: 'invert(1)', background: 'transparent' }
                  : { mixBlendMode: 'lighten', background: th.palette.background.default }),
              })}
            />
          </Box>
          {/* 구분선 — 종전 로고 이미지 안의 밝은 세로줄을 대신한다. divider 토큰은 그보다 훨씬 옅어
              선이 사라진 것처럼 보였다(사용자 지적) → 글자와 같은 잉크를 옅게 쓴다. */}
          <Box sx={(th) => ({ width: '1px', height: 26, bgcolor: alpha(th.palette.text.primary, 0.35), flexShrink: 0 })} />
          <Typography
            sx={{
              fontSize: { xs: typescale.cardTitle.size, shell: typescale.pageTitle.size },
              fontWeight: weight.bold,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            통합업무포털
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {touch && (
            <Tooltip title={desktopView ? '모바일 보기로' : '데스크톱(PC) 보기로'}>
              <IconButton
                aria-label={desktopView ? '모바일 보기로 전환' : '데스크톱 보기로 전환'}
                onClick={toggleDesktopView}
                size="small"
                sx={{ width: control.topbar, height: control.topbar, color: desktopView ? 'primary.main' : 'text.secondary' }}
              >
                {desktopView ? <PhoneIphoneIcon sx={{ fontSize: iconSize.header }} /> : <DesktopWindowsIcon sx={{ fontSize: iconSize.header }} />}
              </IconButton>
            </Tooltip>
          )}
          {/* 통합검색 진입점(PC) — 아이콘만 두면 검색인지 안 읽혀 단축키 키캡을 함께 노출한다.
              실제 입력은 다이얼로그가 하므로 input 이 아니라 버튼이다(클릭·Enter·Space 로 열림).
              테두리 없이 옅은 면으로만 구분(사용자 결정) · 폭은 내용만큼(라벨 없음). 모바일은 아래 아이콘 버튼이 대신한다. */}
          <Tooltip title={`통합검색 (${modKey}+K)`}>
            <ButtonBase
              onClick={() => setSearchOpen(true)}
              aria-label={`통합검색 열기 (${modKey}+K)`}
              sx={(th) => ({
                display: { xs: 'none', shell: 'flex' },
                alignItems: 'center', gap: 0.75,
                height: control.topbar, flexShrink: 0, px: 1,
                // 테두리 없이 '한 톤 들어간 면'으로만 구분 — paper(흰색)는 라이트 상단바와 1.08:1 로 묻힌다.
                // 글자색 알파라 라이트=옅은 회색·다크=옅은 밝음으로 두 테마가 같은 만큼 떠오른다.
                border: 'none', borderRadius: `${radius.input}px`,
                bgcolor: alpha(th.palette.text.primary, 0.08),
                color: 'text.secondary',
                transition: 'background-color .14s',
                '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.14) },
                ...(focusRingSx as object),
              })}
            >
              <SearchIcon sx={{ fontSize: typescale.sectionTitle.size, color: 'text.disabled' }} />
              {/* 단축키 키캡 — 얇은 테두리는 라이트에서 흐려지므로 옅은 채움으로 형태를 만든다 */}
              {[modKey, 'K'].map((k) => (
                <Box
                  key={k}
                  component="span"
                  sx={(th) => ({
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 18, height: 18, px: '5px', borderRadius: `${radius.chip}px`,
                    bgcolor: alpha(th.palette.text.primary, 0.09), color: 'text.disabled',
                    fontSize: typescale.caption.size, fontWeight: typescale.caption.weight, lineHeight: 1,
                  })}
                >
                  {k}
                </Box>
              ))}
            </ButtonBase>
          </Tooltip>
          {/* 모바일 전용 — PC는 위 검색창이 대신한다(중복 노출 방지) */}
          <Tooltip title={`통합검색 (${modKey}+K)`}>
            <IconButton aria-label="통합검색" onClick={() => setSearchOpen(true)} size="small" sx={{ width: control.topbar, height: control.topbar, display: { xs: 'inline-flex', shell: 'none' }, color: 'text.secondary' }}>
              <SearchIcon sx={{ fontSize: iconSize.header }} />
            </IconButton>
          </Tooltip>
          {/* 이 화면에 메모 붙이기 — 게시판 폼을 거치지 않는 개선요청 입력 창구(쓰기 권한자만 렌더) */}
          <MemoComposeButton />
          {/* 화면에 그리기 — 메모를 켜지 않고도 바로 그릴 수 있게 메모 버튼 옆에 따로 뒀다.
              구성원 이상에게 열려 있다(2026-08-06 개방 — 종전 포털 관리자 전용).
              PC 에서만 보인다 — 쪽지 레이어 자체가 PC 전용이라 모바일에서는 눌러도 아무 일도 안 났다. */}
          {isMember && (
            <Tooltip title="화면에 그리기">
              <IconButton
                aria-label="화면에 그리기"
                onClick={() => window.dispatchEvent(new Event(MEMO_DRAW_EVENT))}
                size="small"
                sx={{ width: control.topbar, height: control.topbar, display: { xs: 'none', shell: 'inline-flex' }, color: 'text.secondary' }}
              >
                <BorderColorIcon sx={{ fontSize: iconSize.header }} />
              </IconButton>
            </Tooltip>
          )}
          {/* 알림 센터 — 로그인 사용자만(읽음 상태가 계정에 저장되므로 게스트에겐 제 역할을 못 한다) */}
          {loggedIn && <NotificationBell />}
          <Tooltip title={mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}>
            <ThemeSwitch
              checked={mode === 'dark'}
              onChange={toggleTheme}
              slotProps={{ input: { 'aria-label': mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환' } }}
            />
          </Tooltip>
          {/* 계정 컨트롤(칩·로그아웃·로그인)은 PC 전용 — 모바일은 하단 탭바/메뉴 드로어가 담당(상단바 잘림 방지).
              구 .d-only 클래스를 반응형 display 로 이관 */}
          <Box sx={{ display: { xs: 'none', shell: 'flex' }, alignItems: 'center', gap: 1 }}>
            {loggedIn ? (
              <>
                {/*
                  신분 표시 — 칩(높이 24)이 아니라 **옆 컨트롤과 같은 32px 면**으로 바꿨다(2026-08-06).
                  칩은 '상태'를 나타내는 부품이라 색이 의미를 갖는데, 여기 색(초록/파랑)은 등급을 두 번
                  말할 뿐이고 높이도 혼자 낮아 상단바가 들쭉날쭉했다. 통합검색·메모와 같은 옅은 면을 쓰고
                  이름은 진하게·등급은 흐리게 두어 무엇이 주어인지는 굵기와 색으로 구분한다.
                */}
                <Box
                  sx={(th) => ({
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    height: control.topbar, px: 1.25, flexShrink: 0,
                    borderRadius: `${radius.input}px`,
                    bgcolor: alpha(th.palette.text.primary, 0.08),
                    fontSize: typescale.body.size, whiteSpace: 'nowrap',
                  })}
                >
                  {user && <Box component="span" sx={{ fontWeight: weight.bold }}>{user}</Box>}
                  <Box component="span" sx={{ color: 'text.secondary' }}>{ROLE_LABEL[role]}</Box>
                </Box>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<LogoutIcon sx={{ fontSize: iconSize.body }} />}
                  onClick={logout}
                  sx={{ height: control.topbar, flexShrink: 0, color: 'text.secondary' }}
                >
                  로그아웃
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<LockOpenIcon sx={{ fontSize: iconSize.body }} />}
                onClick={() => setLoginOpen(true)}
                sx={{ height: control.topbar, flexShrink: 0 }}
              >
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
