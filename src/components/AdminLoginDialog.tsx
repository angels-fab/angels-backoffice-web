import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { useRole } from '@/auth/role'

export interface AdminLoginDialogProps {
  open: boolean
  onClose: () => void
}

/** 관리자 모드 로그인 Dialog — '담당자' 시트의 이름(ID)+비밀번호로 검증. */
export default function AdminLoginDialog({ open, onClose }: AdminLoginDialogProps) {
  const { login } = useRole()
  const [empNo, setEmpNo] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    setEmpNo('')
    setPw('')
    setError('')
    setLoading(false)
    onClose()
  }

  const submit = async () => {
    if (!empNo.trim() || !pw.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const ok = await login(empNo, pw)
      if (ok) close()
      else {
        setError('사번 또는 비밀번호가 일치하지 않습니다.')
        setLoading(false)
      }
    } catch {
      setError('검증에 실패했습니다. (서버 배포·네트워크를 확인하세요)')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockOpenIcon sx={{ fontSize: 20, color: 'primary.main' }} /> 관리자 모드
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          사번과 비밀번호를 입력하세요. 로그인해야 업무·공지·일정 등 사내 정보를 볼 수 있습니다.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="사번"
            value={empNo}
            onChange={(e) => {
              setEmpNo(e.target.value)
              if (error) setError('')
            }}
            disabled={loading}
          />
          <TextField
            fullWidth
            size="small"
            type="password"
            label="비밀번호"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value)
              if (error) setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            error={!!error}
            helperText={error || ' '}
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={close} disabled={loading} sx={{ color: 'text.secondary' }}>
          취소
        </Button>
        <Button variant="contained" onClick={submit} disabled={!empNo.trim() || !pw.trim() || loading}>
          {loading ? '확인 중…' : '확인'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
