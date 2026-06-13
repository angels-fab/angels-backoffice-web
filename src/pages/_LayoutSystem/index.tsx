import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import HomeIcon from '@mui/icons-material/Home'
import EventIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MonitorIcon from '@mui/icons-material/Monitor'
import CampaignIcon from '@mui/icons-material/Campaign'
import LinkIcon from '@mui/icons-material/Link'
import Memory from '@mui/icons-material/Memory'
import Factory from '@mui/icons-material/Factory'
import LocalShipping from '@mui/icons-material/LocalShipping'
import FactCheck from '@mui/icons-material/FactCheck'
import AddIcon from '@mui/icons-material/Add'
import {
  AppLayout,
  PageContainer,
  PageHeader,
  ContentSection,
  CardGrid,
  KpiCard,
  AppCard,
} from '@/components/ds'

const NAV = [
  { icon: <HomeIcon />, label: '홈', active: true },
  { icon: <EventIcon />, label: '업무일정' },
  { icon: <AssessmentIcon />, label: '업무현황' },
  { icon: <MonitorIcon />, label: '장비운영관리' },
  { icon: <Factory />, label: '장비도입관리' },
  { icon: <CampaignIcon />, label: '공지사항' },
  { icon: <LinkIcon />, label: '바로가기' },
]

function DemoSidebar() {
  return (
    <Box sx={{ p: 1.5 }}>
      <Typography sx={{ px: 1.5, py: 1, fontWeight: 700, fontSize: 14, color: 'text.primary' }}>
        ANGELS FAB
      </Typography>
      <List dense disablePadding>
        {NAV.map((n) => (
          <ListItemButton
            key={n.label}
            selected={n.active}
            sx={{
              borderRadius: 2,
              mb: 0.25,
              color: n.active ? 'text.primary' : 'text.secondary',
              '&.Mui-selected': { bgcolor: 'background.elevated' },
              '& .MuiListItemIcon-root': { minWidth: 34, color: 'inherit' },
            }}
          >
            <ListItemIcon>{n.icon}</ListItemIcon>
            <ListItemText slotProps={{ primary: { sx: { fontSize: 13, fontWeight: 600 } } }}>{n.label}</ListItemText>
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}

/**
 * Layout System 쇼케이스 — /#/layout-system (내비 미노출).
 * STEP 3 레이아웃 시스템(AppLayout/PageContainer/PageHeader/ContentSection/CardGrid)을
 * 한 화면에서 확인하기 위한 임시 페이지. 실제 페이지에는 아직 적용하지 않음.
 */
export default function LayoutSystemShowcase() {
  return (
    <ScopedCssBaseline>
      <AppLayout sidebar={<DemoSidebar />} brand={<Typography sx={{ fontWeight: 700, fontSize: 14 }}>ANGELS FAB</Typography>}>
        <PageContainer>
          <PageHeader
            icon={<MonitorIcon />}
            title="Layout System 미리보기"
            updatedAt="2026-06-13 업데이트 · 폭 1400 / 상단 32 / 섹션 24 / 카드·KPI 16"
            actions={
              <Button variant="contained" startIcon={<AddIcon />}>
                액션
              </Button>
            }
          />

          <ContentSection title="KPI 영역" description="KPI ↔ KPI 간격 16px (Mobile 1열 · Tablet 2열 · Desktop 4열)">
            <CardGrid columns={4}>
              <KpiCard value={20} unit="종" label="총 도입장비" sub="29대 운영중" icon={<Memory />} accentColor="blue" />
              <KpiCard value={29} unit="대" label="운영 중" icon={<Factory />} accentColor="green" />
              <KpiCard value={4} unit="대" label="입고 예정" icon={<LocalShipping />} accentColor="amber" />
              <KpiCard value={12} unit="건" label="점검 대상" icon={<FactCheck />} accentColor="purple" />
            </CardGrid>
          </ContentSection>

          <ContentSection title="카드 목록 영역" description="Card ↔ Card 간격 16px (auto-fill, 최소 280px)" count={6}>
            <CardGrid minColWidth={280}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <AppCard key={i} interactive onClick={() => {}}>
                  <Typography variant="subtitle1">카드 {i}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    내부 padding 24px. hover 시 translateY(-2px) + 약한 그림자.
                  </Typography>
                </AppCard>
              ))}
            </CardGrid>
          </ContentSection>

          <ContentSection
            title="섹션 ↔ 섹션 24px"
            description="모든 섹션은 ContentSection으로 감싸 동일한 간격을 갖는다."
            action={<Button variant="text">전체보기</Button>}
            last
          >
            <AppCard>
              <Typography variant="body2">
                이 화면 전체가 PageContainer(폭 1400 · 상단 32 · 좌우 24) 안에 있고, 각 영역은 ContentSection,
                숫자 묶음은 CardGrid로 구성됩니다. 브라우저 폭을 줄이면 4열 → 2열 → 1열로 반응형 전환됩니다.
              </Typography>
            </AppCard>
          </ContentSection>
        </PageContainer>
      </AppLayout>
    </ScopedCssBaseline>
  )
}
