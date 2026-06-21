import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import CloseIcon from '@mui/icons-material/Close'
import type { ReactNode } from 'react'
import { drawer as drawerSpec, layout } from '@/theme/tokens'

export interface AppDrawerProps {
  open: boolean
  onClose: () => void
  /** 헤더 제목 */
  title: ReactNode
  /** 제목 아래 보조 텍스트 */
  subtitle?: ReactNode
  /** 본문 */
  children: ReactNode
  /** 하단 고정 영역(액션 버튼 등) */
  footer?: ReactNode
  /** 폭(px). 480~600 권장. 기본 520. */
  width?: number
  /** 비모달 — 배경 딤/클릭 차단 없이 본문과 동시 조작 가능(목록 카드 연속 클릭용). */
  nonModal?: boolean
}

/**
 * AppDrawer — 상세 정보용 공통 우측 슬라이드 드로어(명세 5단계).
 *
 * 장비/일정/업무/공지 상세를 Modal 대신 통일된 Drawer로 표시한다.
 * 폭 480~600px, 헤더(제목+닫기) / 스크롤 본문 / (선택)고정 푸터 구조.
 *
 * @example
 * <AppDrawer open={open} onClose={close} title="장비 상세" subtitle="ASML / 노광">
 *   <EquipmentDetail id={id} />
 * </AppDrawer>
 */
export default function AppDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = drawerSpec.defaultWidth,
  nonModal = false,
}: AppDrawerProps) {
  const w = Math.min(Math.max(width, drawerSpec.minWidth), drawerSpec.maxWidth)
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      hideBackdrop={nonModal}
      ModalProps={nonModal ? { disableEnforceFocus: true, disableScrollLock: true } : undefined}
      sx={nonModal ? { pointerEvents: 'none' } : undefined}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', ...(nonModal ? { pointerEvents: 'auto' } : {}) } } }}
    >
      <Box
        sx={{
          width: { xs: '100vw', sm: w },
          maxWidth: '100vw',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 헤더 */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            p: `${layout.cardPadding}px`,
            bgcolor: 'background.elevated',
            borderBottom: 1,
            borderColor: 'divider',
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="닫기" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* 본문(스크롤) */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: `${layout.cardPadding}px` }}>{children}</Box>

        {/* 푸터(고정) */}
        {footer && (
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'background.elevated',
            }}
          >
            {footer}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
