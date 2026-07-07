import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { useRole } from '@/auth/role'

export interface AdminLoginDialogProps {
  open: boolean
  onClose: () => void
}

type Mode = 'login' | 'signup'

/** 로그인 / 가입 신청 Dialog — 사번+비밀번호(Auth). 가입은 pending으로 접수 → 관리자 승인 후 이용. */
export default function AdminLoginDialog({ open, onClose }: AdminLoginDialogProps) {
  const { login, signUp } = useRole()
  const [mode, setMode] = useState<Mode>('login')
  const [empNo, setEmpNo] = useState('')
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const reset = () => { setEmpNo(''); setName(''); setPw(''); setPw2(''); setError(''); setDone(''); setLoading(false) }
  const close = () => { reset(); setMode('login'); onClose() }
  const switchMode = (m: Mode) => { reset(); setMode(m) }
  const isSignup = mode === 'signup'

  const submitLogin = async () => {
    if (!empNo.trim() || !pw.trim() || loading) return
    setLoading(true); setError('')
    try {
      const res = await login(empNo, pw)
      if (res === 'ok') { close(); return }
      setError(res === 'pending'
        ? '가입 승인 대기 중입니다. 관리자 승인 후 로그인할 수 있어요.'
        : '사번 또는 비밀번호가 일치하지 않습니다.')
    } catch {
      setError('로그인에 실패했습니다. (네트워크·서버를 확인하세요)')
    }
    setLoading(false)
  }

  const submitSignup = async () => {
    if (loading) return
    setError('')
    if (!empNo.trim() || !name.trim() || !pw.trim()) return setError('사번·이름·비밀번호를 모두 입력하세요.')
    if (pw.length < 4) return setError('비밀번호는 4자 이상이어야 합니다.')
    if (pw !== pw2) return setError('두 비밀번호가 일치하지 않습니다.')
    setLoading(true)
    const res = await signUp(empNo, name, pw)
    setLoading(false)
    if (!res.ok) return setError(res.error || '가입 신청에 실패했습니다.')
    setDone('가입 신청이 접수됐어요. 관리자 승인 후 로그인할 수 있습니다.')
  }

  return (
    <Dialog open={open} onClose={close} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LockOpenIcon sx={{ fontSize: 20, color: 'primary.main' }} /> {isSignup ? '가입 신청' : '로그인'}
      </DialogTitle>
      <DialogContent>
        {done ? (
          <Alert severity="success">{done}</Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {isSignup
                ? '사번·이름·비밀번호로 가입을 신청합니다. 관리자 승인 후 이용할 수 있어요.'
                : '사번과 비밀번호로 로그인하세요. 로그인해야 사내 정보를 볼 수 있습니다.'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <TextField autoFocus fullWidth size="small" label="사번" value={empNo} onChange={(e) => { setEmpNo(e.target.value); if (error) setError('') }} disabled={loading} />
              {isSignup && (
                <TextField fullWidth size="small" label="이름" value={name} onChange={(e) => { setName(e.target.value); if (error) setError('') }} disabled={loading} />
              )}
              <TextField
                fullWidth size="small" type="password" label="비밀번호"
                value={pw} onChange={(e) => { setPw(e.target.value); if (error) setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isSignup) submitLogin() }}
                disabled={loading} autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
              {isSignup && (
                <TextField fullWidth size="small" type="password" label="비밀번호 확인" value={pw2} onChange={(e) => { setPw2(e.target.value); if (error) setError('') }} disabled={loading} autoComplete="new-password" />
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </Box>
          </>
        )}
        {!done && (
          <Box sx={{ mt: 1.5 }}>
            {isSignup ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>이미 계정이 있나요? <Button size="small" onClick={() => switchMode('login')} sx={{ minWidth: 0 }}>로그인</Button></Typography>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>계정이 없나요? <Button size="small" onClick={() => switchMode('signup')} sx={{ minWidth: 0 }}>가입 신청</Button></Typography>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="text" onClick={close} disabled={loading} sx={{ color: 'text.secondary' }}>{done ? '닫기' : '취소'}</Button>
        {!done && (
          <Button variant="contained" onClick={isSignup ? submitSignup : submitLogin} disabled={loading}>
            {loading ? '처리 중…' : isSignup ? '가입 신청' : '로그인'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
