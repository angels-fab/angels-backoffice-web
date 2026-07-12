import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import type { ReactNode } from 'react'

export interface FormDialogProps {
  open: boolean
  onClose: () => void
  /** 헤더 좌측 아이콘 (MUI 아이콘, primary 색 적용) */
  icon?: ReactNode
  title: string
  /** 본문(스크롤 영역) */
  children: ReactNode
  /** 하단 고정 액션(취소=text, 저장=contained primary 원칙) */
  footer?: ReactNode
  /** 폭(px, 기본 560 — 작성폼형 표준) */
  width?: number
  /** 처리 중 — 닫기(X·백드롭·ESC) 차단 */
  busy?: boolean
}

/**
 * FormDialog — 작성폼형 다이얼로그 표준 (P2, B#6).
 *
 * CalEventWrite·WorkWrite·ScheduleWrite에 3벌 복붙돼 있던
 * "아이콘+제목+닫기(X) 헤더 / width 560" 패턴의 단일 구현.
 * 배경 paper·radius modal(16)은 테마 상속 — 개별 지정 금지.
 *
 * @example
 * <FormDialog open={open} onClose={close} icon={<EventIcon/>} title="일정 등록"
 *   footer={<><Button variant="text" sx={{color:'text.secondary'}} onClick={close}>취소</Button>
 *           <Button variant="contained" onClick={save}>저장</Button></>}>
 *   ...필드들...
 * </FormDialog>
 */
export default function FormDialog({
  open,
  onClose,
  icon,
  title,
  children,
  footer,
  width = 560,
  busy,
}: FormDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{ paper: { sx: { width, maxWidth: '92vw' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, pt: 2.5, pb: 1.5 }}>
        {icon != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main', '& svg': { fontSize: 20 } }}>
            {icon}
          </Box>
        )}
        <Typography component="h2" variant="h4" sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
        <IconButton size="small" aria-label="닫기" disabled={busy} onClick={onClose} sx={{ color: 'text.disabled' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ px: 3, pb: footer ? 1.5 : 3, overflowY: 'auto' }}>{children}</Box>
      {footer != null && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, pb: 2.5, pt: 1 }}>{footer}</Box>
      )}
    </Dialog>
  )
}
