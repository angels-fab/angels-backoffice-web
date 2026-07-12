import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

export interface ConfirmDialogProps {
  open: boolean
  /** 질문형 제목 — "일정을 삭제할까요?" */
  title: string
  /** 보조 설명(문자열) 또는 임의 본문 */
  description?: ReactNode
  /** 확인 버튼 라벨 (기본 '확인') */
  confirmLabel?: string
  /** 취소 버튼 라벨 (기본 '취소') */
  cancelLabel?: string
  /**
   * 위험(삭제·되돌릴 수 없는) 작업 — 확인 버튼이 빨강(error)으로 강제된다.
   * 원칙(사용자 확정): 저장·확인=파랑 / 삭제·되돌릴 수 없음=빨강. 개별 색 지정 금지.
   */
  destructive?: boolean
  /** 처리 중 — 버튼 잠금 + 스피너, 백드롭/ESC 닫기 차단 */
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * ConfirmDialog — 확인형 다이얼로그 표준 (P2, B#6).
 *
 * 규격: 배경 paper·radius modal(16) = 테마 상속(개별 지정 금지), maxWidth xs.
 * window.confirm 대체. busy 중에는 어떤 경로로도 닫히지 않는다.
 *
 * @example 위험 작업 — 빨간 확인 버튼 자동
 * <ConfirmDialog open={!!del} destructive title="일정을 삭제할까요?"
 *   description="삭제 후 되돌릴 수 없습니다." confirmLabel="삭제"
 *   busy={deleting} onConfirm={doDelete} onClose={() => setDel(null)} />
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive,
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: description ? 1 : 2 }}>
        <Typography component="span" variant="h4">
          {title}
        </Typography>
      </DialogTitle>
      {description != null && (
        <DialogContent>
          {typeof description === 'string' ? (
            <Typography variant="body2">{description}</Typography>
          ) : (
            description
          )}
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" disabled={busy} onClick={onClose} sx={{ color: 'text.secondary' }}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          disabled={busy}
          onClick={onConfirm}
          startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
