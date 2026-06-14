import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import SettingsIcon from '@mui/icons-material/Settings'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import LogoutIcon from '@mui/icons-material/Logout'
import TableChartIcon from '@mui/icons-material/TableChart'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import { useRole } from '@/auth/role'
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

/** 설정 — 현재 권한 · 포털 버전 · 데이터 소스 (STEP 10). */
export default function Settings() {
  const { isAdmin, user, logout } = useRole()
  const [loginOpen, setLoginOpen] = useState(false)

  return (
    <PageContainer variant="detail">
      <PageHeader icon={<SettingsIcon />} title="설정" subtitle="포털 정보 및 권한" />

      <ContentSection title="권한">
        <AppCard padding={18}>
          <Row
            label="현재 권한"
            value={<StatusChip status={isAdmin ? 'success' : 'neutral'} label={isAdmin ? `관리자${user ? ' · ' + user : ''}` : '게스트 (Guest)'} />}
            action={
              isAdmin ? (
                <Button variant="text" startIcon={<LogoutIcon sx={{ fontSize: 18 }} />} onClick={logout} sx={{ color: 'text.secondary' }}>
                  로그아웃
                </Button>
              ) : (
                <Button variant="outlined" startIcon={<LockOpenIcon sx={{ fontSize: 18 }} />} onClick={() => setLoginOpen(true)}>
                  관리자 모드 전환
                </Button>
              )
            }
          />
          <Typography variant="body2" sx={{ mt: 1.5 }}>
            {isAdmin ? '작성·관리 기능을 사용할 수 있습니다.' : '조회 전용입니다. 작성·관리 기능은 관리자 모드에서 가능합니다.'}
          </Typography>
        </AppCard>
      </ContentSection>

      <ContentSection title="포털 정보">
        <AppCard padding={18}>
          <Row label="포털 버전" value={<Typography variant="subtitle1">v{APP_VERSION}</Typography>} />
        </AppCard>
      </ContentSection>

      <ContentSection title="데이터 소스" description="현재 포털은 아래 소스를 읽어 표시합니다" last>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <SourceCard icon={<TableChartIcon />} name="Google Sheet" detail="구축총괄시트 (업무·장비·공지·담당자)" />
          <SourceCard icon={<CalendarMonthIcon />} name="Google Calendar" detail="gist.angels@gmail.com (업무일정)" />
        </Box>
      </ContentSection>

      <AdminLoginDialog open={loginOpen} onClose={() => setLoginOpen(false)} />
    </PageContainer>
  )
}
