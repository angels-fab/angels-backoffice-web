import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import SettingsIcon from '@mui/icons-material/Settings'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import StorageIcon from '@mui/icons-material/Storage'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip, LoadingState, ConfirmDialog, useSnack, Select } from '@/components/ds'
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
        <Box sx={{ display: 'flex', color: 'primary.main', '& svg': { fontSize: iconSize.feature } }}>{icon}</Box>
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
    <AppCard padding={16}>
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

// 라벨은 ROLE_LABEL 단일 출처를 따른다 — 상단바 칩·설정 표시와 문구가 갈리지 않게.
const MANAGEABLE_ROLES: { value: 'member' | 'admin'; label: string }[] = [
  { value: 'member', label: ROLE_LABEL.member },
  { value: 'admin', label: ROLE_LABEL.admin },
]

/** 사용자 관리 — 포털 관리자만. 가입 승인·권한 변경·강퇴. RLS: profiles_admin_update/delete.
 *  본인 계정은 잠금 방지로 변경/강퇴 불가. */
function UserManagement() {
  const { user: me } = useRole()
  const [rows, setRows] = useState<ProfileRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const snack = useSnack()

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
  // 강퇴·거절 = 프로필 삭제(재가입 필요)라 되돌릴 수 없다. 구현은 window.confirm이었는데
  // 브라우저 기본 포커스가 '확인'이라 Enter 한 번에 실행됐고, 테마·한글 타이포도 안 탔다.
  // ConfirmDialog(정본)로 교체 — 빨간 확인 버튼·busy 잠금은 컴포넌트가 담당.
  const [delUser, setDelUser] = useState<{ id: string; name: string; pending: boolean } | null>(null)
  const remove = async () => {
    if (!delUser) return
    setBusyId(delUser.id)
    const { error } = await supabase.from('profiles').delete().eq('id', delUser.id)
    setBusyId(null)
    setDelUser(null)
    if (error) snack(error.message || '삭제에 실패했습니다.', 'error')
    void load()
  }

  if (rows === null) return <AppCard padding={16}><LoadingState size="md" /></AppCard>

  const pending = rows.filter((r) => r.role === 'pending')
  const active = rows.filter((r) => r.role !== 'pending')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 가입 승인 대기 */}
      <Box>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>가입 승인 대기{pending.length > 0 ? ` (${pending.length})` : ''}</Typography>
        {pending.length === 0 ? (
          <AppCard padding={16}><Typography variant="body2" sx={{ color: 'text.secondary' }}>대기 중인 가입 신청이 없습니다.</Typography></AppCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
            {pending.map((r) => (
              <AppCard key={r.id} padding={16}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1">{r.name || '(이름 없음)'}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>사번 {r.emp_no || '-'} · 신청 {r.created_at?.slice(0, 10)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <Button size="small" variant="contained" disabled={busyId === r.id} onClick={() => changeRole(r.id, 'member')}>구성원 승인</Button>
                    <Button size="small" color="error" disabled={busyId === r.id} onClick={() => setDelUser({ id: r.id, name: r.name, pending: true })}>거절</Button>
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
            const roleVal = ['member', 'admin'].includes(r.role) ? r.role : 'member'
            return (
              <AppCard key={r.id} padding={16}>
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
                      value={roleVal}
                      disabled={self || busyId === r.id}
                      onChange={(v) => changeRole(r.id, v)}
                      ariaLabel={`${r.name || '구성원'} 역할`}
                      minWidth={116}
                      options={MANAGEABLE_ROLES}
                    />
                    <Button size="small" color="error" variant="text" disabled={self || busyId === r.id} onClick={() => setDelUser({ id: r.id, name: r.name, pending: false })}>강퇴</Button>
                  </Box>
                </Box>
              </AppCard>
            )
          })}
        </Box>
      </Box>

      <ConfirmDialog
        open={!!delUser}
        destructive
        title={delUser?.pending ? '가입 신청을 거절할까요?' : `${delUser?.name || ''} 회원을 강퇴할까요?`}
        description="프로필이 삭제되어 다시 가입해야 합니다. 이 작업은 되돌릴 수 없습니다."
        confirmLabel={delUser?.pending ? '거절' : '강퇴'}
        busy={!!delUser && busyId === delUser.id}
        onConfirm={() => void remove()}
        onClose={() => setDelUser(null)}
      />
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
      <PageHeader icon={<SettingsIcon />} title="설정" />

      <ContentSection title="권한">
        <AppCard padding={16}>
          <Row
            label="현재 권한"
            value={<StatusChip status={isAdmin ? 'success' : role === 'member' ? 'info' : 'neutral'} label={user ? `${user} · ${ROLE_LABEL[role]}` : ROLE_LABEL[role]} />}
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
            {isAdmin ? '작성·관리 및 사용자 관리 기능을 사용할 수 있습니다.' : role === 'member' ? '팀 콘텐츠 열람 및 작성이 가능합니다.' : '조회 전용입니다. 작성·관리 기능은 로그인 후 가능합니다.'}
          </Typography>
        </AppCard>
      </ContentSection>

      {loggedIn && (
        <ContentSection title="비밀번호 변경" description="로그인에 사용하는 비밀번호를 변경합니다">
          <PasswordChangeCard />
        </ContentSection>
      )}

      {isAdmin && (
        <ContentSection title="사용자 관리" description="가입 승인 · 권한 변경 · 강퇴">
          <UserManagement />
        </ContentSection>
      )}

      <ContentSection title="포털 정보">
        <AppCard padding={16}>
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
