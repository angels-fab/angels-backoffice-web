import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import SettingsIcon from '@mui/icons-material/Settings'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import StorageIcon from '@mui/icons-material/Storage'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import { useRole } from '@/auth/role'
import { supabase, padPassword } from '@/api/supabase'
import AdminLoginDialog from '@/components/AdminLoginDialog'

const APP_VERSION = '0.1.0'

function Row({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>{label}</Typography>
        <Box sx={{ mt: 0.25 }}>{value}</Box>
      </Box>
      {action}
    </Box>
  )
}

function SourceCard({ icon, name, detail }: { icon: React.ReactNode; name: string; detail: string }) {
  return (
    <AppCard padding={16}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ display: 'flex', color: 'primary.main', '& svg': { fontSize: 24 } }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1">{name}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{detail}</Typography>
        </Box>
      </Box>
    </AppCard>
  )
}

/** 비밀번호 변경 — Supabase Auth updateUser. 저장 시 padPassword 변환(로그인과 동일 규칙). */
function PasswordChangeCard() {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setMsg(null)
    if (pw.length < 4) return setMsg({ kind: 'err', text: '비밀번호는 4자 이상이어야 합니다.' })
    if (pw !== pw2) return setMsg({ kind: 'err', text: '두 비밀번호가 일치하지 않습니다.' })
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: padPassword(pw) })
    setBusy(false)
    if (error) return setMsg({ kind: 'err', text: error.message || '변경에 실패했습니다.' })
    setPw('')
    setPw2('')
    setMsg({ kind: 'ok', text: '비밀번호를 변경했습니다.' })
  }

  return (
    <AppCard padding={18}>
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="새 비밀번호" type="password" size="small" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
          <TextField label="새 비밀번호 확인" type="password" size="small" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
        </Box>
        {msg && <Alert severity={msg.kind === 'ok' ? 'success' : 'error'}>{msg.text}</Alert>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" size="small" disabled={busy}>{busy ? '변경 중…' : '비밀번호 변경'}</Button>
        </Box>
      </Box>
    </AppCard>
  )
}

/** 설정 — 권한 · 비밀번호 변경 · 포털 정보. */
export default function Settings() {
  const { isAdmin, role, user, logout } = useRole()
  const [loginOpen, setLoginOpen] = useState(false)
  const loggedIn = role !== 'guest'

  return (
    <PageContainer variant="detail">
      <PageHeader icon={<SettingsIcon />} title="설정" subtitle="포털 정보 및 권한" />

      <ContentSection title="권한">
        <AppCard padding={18}>
          <Row
            label="현재 권한"
            value={<StatusChip status={isAdmin ? 'success' : 'neutral'} label={isAdmin ? `관리자${user ? ' · ' + user : ''}` : loggedIn ? `일반 사용자${user ? ' · ' + user : ''}` : '게스트 (Guest)'} />}
            action={
              loggedIn ? (
                <Button variant="text" startIcon={<LogoutIcon sx={{ fontSize: 18 }} />} onClick={logout} sx={{ color: 'text.secondary' }}>
                  로그아웃
                </Button>
              ) : (
                <Button variant="outlined" startIcon={<LockOpenIcon sx={{ fontSize: 18 }} />} onClick={() => setLoginOpen(true)}>
                  로그인
                </Button>
              )
            }
          />
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            {isAdmin ? '작성·관리 기능을 사용할 수 있습니다.' : loggedIn ? '열람 및 일부 작성이 가능합니다.' : '조회 전용입니다. 작성·관리 기능은 로그인 후 가능합니다.'}
          </Typography>
        </AppCard>
      </ContentSection>

      {loggedIn && (
        <ContentSection title="비밀번호 변경" description="로그인에 사용하는 비밀번호를 변경합니다">
          <PasswordChangeCard />
        </ContentSection>
      )}

      <ContentSection title="포털 정보">
        <AppCard padding={18}>
          <Row label="포털 버전" value={<Typography variant="subtitle1">v{APP_VERSION}</Typography>} />
        </AppCard>
      </ContentSection>

      <ContentSection title="데이터 소스" description="현재 포털의 모든 데이터는 아래 백엔드에서 읽고 씁니다" last>
        <SourceCard icon={<StorageIcon />} name="Supabase (PostgreSQL)" detail="업무·공지·장비·일정·개선요청 — 세션 인증 + RLS" />
      </ContentSection>

      <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </PageContainer>
  )
}
