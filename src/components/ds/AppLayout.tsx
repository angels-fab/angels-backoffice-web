import { useState } from 'react'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import type { ReactNode } from 'react'

export interface AppLayoutProps {
  /** 사이드바 내용(내비게이션 등) */
  sidebar: ReactNode
  /** 메인 콘텐츠(보통 PageContainer로 감싼 페이지) */
  children: ReactNode
  /** 사이드바 폭(px). 기본 256. */
  sidebarWidth?: number
  /** 모바일 상단바 좌측 브랜드/로고 영역 */
  brand?: ReactNode
}

/**
 * AppLayout — 최상위 레이아웃 셸. Sidebar + Main + 반응형을 관리한다.
 *
 * - Desktop(md≥900): 좌측 고정 사이드바 + 우측 메인.
 * - Mobile(<md): 사이드바는 숨고, 상단 햄버거 버튼으로 임시 Drawer로 연다.
 *
 * 페이지는 보통 children을 <PageContainer>로 감싼다.
 *
 * @example
 * <AppLayout sidebar={<SideNav/>} brand={<Logo/>}>
 *   <PageContainer>…</PageContainer>
 * </AppLayout>
 */
export default function AppLayout({ sidebar, children, sidebarWidth = 256, brand }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 데스크톱 고정 사이드바 */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          flexShrink: 0,
          width: sidebarWidth,
          height: '100vh',
          position: 'sticky',
          top: 0,
          bgcolor: 'background.sidebar',
          borderRight: 1,
          borderColor: 'divider',
          overflowY: 'auto',
        }}
      >
        {sidebar}
      </Box>

      {/* 모바일 임시 Drawer 사이드바 */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' } }}
        slotProps={{ paper: { sx: { width: sidebarWidth, bgcolor: 'background.sidebar' } } }}
      >
        {sidebar}
      </Drawer>

      {/* 메인 영역 */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 모바일 상단바(햄버거) */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            gap: 1,
            height: 52,
            px: 1.5,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'background.sidebar',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <IconButton aria-label="메뉴" onClick={() => setMobileOpen(true)} sx={{ color: 'text.secondary' }}>
            <MenuIcon />
          </IconButton>
          {brand}
        </Box>

        <Box component="main" sx={{ flex: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
