import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import SettingsIcon from '@mui/icons-material/Settings'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import StorageIcon from '@mui/icons-material/Storage'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import { useRole, ROLE_LABEL } from '@/auth/role'
import { supabase, padPassword } from '@/api/supabase'
import AdminLoginDialog from '@/components/AdminLoginDialog'
import { iconSize } from '@/theme/tokens'

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

interface ProfileRow { id: string; name: string; emp_no: string | null; role: string; created_at: string }

const MANAGEABLE_ROLES: { value: 'associate' | 'member' | 'admin'; label: string }[] = [
  { value: 'associate', label: '유관자' },
  { value: 'member', label: '팀원' },
  { value: 'admin', label: '관리자' },
]

/** 사용자 관리 — 관리자만. 가입 승인(유관자/팀원)·권한 변경·강퇴. RLS: profiles_admin_update/delete.
 *  관리자 승격은 팀원에게만(유관자는 팀원 거쳐야) · 본인 계정은 잠금 방지로 변경/강퇴 불가. */
function UserManagement() {
  const { user: me } = useRole()
  const [rows, setRows] = useState<ProfileRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, emp_no, role, created_at')
      .order('created_at', { ascending: true })
    setRows((data || []) as ProfileRow[])
  }
  useEffect(() => { void load() }, [])

  const changeRole = async (id: string, role: string) => {
    setBusyId(id)
    await supabase.from('profiles').update({ role }).eq('id', id)
    setBusyId(null)
    void load()
  }
  const remove = async (id: string, name: string, pending: boolean) => {
    const msg = pending
      ? `${name || '이 신청'} 가입 신청을 거절할까요? (프로필 삭제)`
      : `${name} 회원을 강퇴할까요? (프로필 삭제 — 재가입 필요)`
    if (!window.confirm(msg)) return
    setBusyId(id)
    await supabase.from('profiles').delete().eq('id', id)
    setBusyId(null)
    void load()
  }

  if (rows === null) return <AppCard padding={18}><Typography variant="body2">불러오는 중…</Typography></AppCard>

  const pending = rows.filter((r) => r.role === 'pending')
  const active = rows.filter((r) => r.role !== 'pending')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 가입 승인 대기 */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>가입 승인 대기{pending.length > 0 ? ` (${pending.length})` : ''}</Typography>
        {pending.length === 0 ? (
          <AppCard padding={14}><Typography variant="body2" sx={{ color: 'text.secondary' }}>대기 중인 가입 신청이 없습니다.</Typography></AppCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            {pending.map((r) => (
              <AppCard key={r.id} padding={14}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1">{r.name || '(이름 없음)'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>사번 {r.emp_no || '-'} · 신청 {r.created_at?.slice(0, 10)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" disabled={busyId === r.id} onClick={() => changeRole(r.id, 'associate')}>유관자 승인</Button>
                    <Button size="small" variant="contained" disabled={busyId === r.id} onClick={() => changeRole(r.id, 'member')}>팀원 승인</Button>
                    <Button size="small" color="error" disabled={busyId === r.id} onClick={() => remove(r.id, r.name, true)}>거절</Button>
                  </Box>
                </Box>
              </AppCard>
            ))}
          </Box>
        )}
      </Box>

      {/* 회원 목록 */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>회원 목록 ({active.length})</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
          {active.map((r) => {
            const self = !!me && r.name === me
            const roleVal = ['associate', 'member', 'admin'].includes(r.role) ? r.role : 'member'
            return (
              <AppCard key={r.id} padding={14}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1">
                      {r.name || '(이름 없음)'}
                      {self && <Typography component="span" variant="caption" sx={{ color: 'text.disabled', ml: 0.75 }}>(본인)</Typography>}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>사번 {r.emp_no || '-'} · 가입 {r.created_at?.slice(0, 10)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Select
                      size="small"
                      value={roleVal}
                      disabled={self || busyId === r.id}
                      onChange={(e) => changeRole(r.id, e.target.value)}
                      sx={{ minWidth: 104, '& .MuiSelect-select': { py: 0.5, fontSize: 14 } }}
                    >
                      {MANAGEABLE_ROLES.map((o) => (
                        // 관리자 승격은 팀원(또는 이미 관리자)에게만 — 유관자는 바로 관리자로 못 올림(팀원 거쳐야)
                        <MenuItem key={o.value} value={o.value} disabled={o.value === 'admin' && roleVal === 'associate'}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </Select>
                    <Button size="small" color="error" variant="text" disabled={self || busyId === r.id} onClick={() => remove(r.id, r.name, false)}>강퇴</Button>
                  </Box>
                </Box>
              </AppCard>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}

/** 설정 — 권한 · 비밀번호 변경 · 가입 승인 · 포털 정보. */
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
            value={<StatusChip status={isAdmin ? 'success' : role === 'member' ? 'info' : 'neutral'} label={`${ROLE_LABEL[role]}${user ? ' · ' + user : ''}`} />}
            action={
              loggedIn ? (
                <Button variant="text" startIcon={<LogoutIcon sx={{ fontSize: iconSize.action }} />} onClick={logout} sx={{ color: 'text.secondary' }}>
                  로그아웃
                </Button>
              ) : (
                <Button variant="outlined" startIcon={<LockOpenIcon sx={{ fontSize: iconSize.action }} />} onClick={() => setLoginOpen(true)}>
                  로그인
                </Button>
              )
            }
          />
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            {isAdmin ? '작성·관리 및 사용자 관리 기능을 사용할 수 있습니다.' : role === 'member' ? '팀 콘텐츠 열람 및 작성이 가능합니다.' : loggedIn ? '장비(제한)·행사·바로가기 열람이 가능합니다.' : '조회 전용입니다. 작성·관리 기능은 로그인 후 가능합니다.'}
          </Typography>
        </AppCard>
      </ContentSection>

      {loggedIn && (
        <ContentSection title="비밀번호 변경" description="로그인에 사용하는 비밀번호를 변경합니다">
          <PasswordChangeCard />
        </ContentSection>
      )}

      {isAdmin && (
        <ContentSection title="사용자 관리" description="가입 승인(유관자/팀원) · 권한 변경 · 강퇴">
          <UserManagement />
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
