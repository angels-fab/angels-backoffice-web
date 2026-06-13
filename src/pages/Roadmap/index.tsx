import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TimelineIcon from '@mui/icons-material/Timeline'
import { PageContainer, PageHeader, AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { ROADMAP_STEPS, type RoadmapStatus } from '@/constants/roadmap'

const STATUS_META: Record<RoadmapStatus, { label: string; status: StatusKind; accent: 'green' | 'blue' | 'teal' }> = {
  done: { label: '완료', status: 'success', accent: 'green' },
  current: { label: '진행중', status: 'info', accent: 'blue' },
  plan: { label: '예정', status: 'neutral', accent: 'teal' },
}

/**
 * FAB 구축 로드맵 — 전용 페이지(STEP 4.5에서 Home → 별도 메뉴로 분리).
 * 디자인 시스템 기반의 반응형 세로 타임라인(모바일·데스크톱 모두 노출).
 */
export default function Roadmap() {
  return (
    <PageContainer variant="detail">
      <PageHeader icon={<TimelineIcon />} title="FAB 구축 로드맵" subtitle="GIST ANGELS FAB 구축 단계별 진행 현황" />

      <AppCard>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {ROADMAP_STEPS.map((step, i) => {
            const meta = STATUS_META[step.status]
            const isLast = i === ROADMAP_STEPS.length - 1
            return (
              <Box key={step.label} sx={{ display: 'flex', gap: 2 }}>
                {/* 타임라인 아이콘 + 연결선 */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: (t) => (step.status === 'plan' ? t.palette.text.disabled : t.palette.accent[meta.accent]),
                      bgcolor: 'background.elevated',
                      border: 1,
                      borderColor: (t) => (step.status === 'plan' ? t.palette.divider : t.palette.accent[meta.accent]),
                      fontSize: 22,
                      '& svg': { fontSize: 22 },
                    }}
                  >
                    {step.icon}
                  </Box>
                  {!isLast && <Box sx={{ width: '2px', flex: 1, minHeight: 28, bgcolor: 'divider', my: 0.5 }} />}
                </Box>

                {/* 단계 정보 */}
                <Box sx={{ pb: isLast ? 0 : 3, pt: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="h4">{step.label}</Typography>
                    <StatusChip status={meta.status} label={meta.label} />
                  </Box>
                  <Typography variant="body2" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                    {step.period}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </AppCard>
    </PageContainer>
  )
}
