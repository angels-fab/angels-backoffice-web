import { useState } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { AppCard, focusRingSx } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import { ROADMAP_STEPS } from '@/constants/roadmap'
import { iconSize, motion, radius, typescale, weight } from '@/theme/tokens'
import RoadmapCard from '../RoadmapCard'

/**
 * 홈 '현황' — 로드맵·장비처럼 **분기 단위로 바뀌는 것**을 한 줄로 접어 둔다.
 *
 * 홈 상단을 로드맵 7단계 그림과 장비 비율 막대가 차지하고 있었는데, 둘 다 다음 변화가 몇 달 뒤다
 * (로드맵 다음 단계 2026.12 · 장비 첫 착수 2027.05 — 그때까지 장비 막대는 '도입예정' 한 칸뿐).
 * 매일 달라지는 일정·업무를 위로 올리기 위해 접었고, 펼치면 종전 화면 그대로 나온다
 * (2026-08-05 사용자 확정: 로그인 사용자는 접기 · 방문자에게는 로드맵을 크게).
 */
export default function StatusSummary() {
  const [open, setOpen] = useState(false)
  const eq = useAppSelector(selectEqCounts)
  const cur = ROADMAP_STEPS.find((s) => s.status === 'current')
  const next = ROADMAP_STEPS.find((s) => s.status === 'plan')
  const totalUnits = Object.values(eq.units).reduce((a, b) => a + b, 0)

  return (
    <AppCard padding={0}>
      <ButtonBase
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, width: '100%',
          px: 2, py: 1.5, borderRadius: `${radius.card}px`, textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
          ...(focusRingSx as object),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          {cur && (
            <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
              FAB 구축{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: weight.bold }}>{cur.label}</Box>{' '}
              진행중
            </Typography>
          )}
          {next && (
            <>
              <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
              <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
                다음 <Box component="span" sx={{ color: 'text.primary', fontWeight: weight.bold }}>{next.label}</Box> {next.period.split('~')[0]}
              </Typography>
            </>
          )}
          <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
          <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
            장비 {eq.types}종 {totalUnits}대
          </Typography>
        </Box>
        <ExpandMoreIcon
          sx={{
            flexShrink: 0, fontSize: iconSize.header, color: 'text.disabled',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: `transform ${motion.slow} ${motion.ease}`,
          }}
        />
      </ButtonBase>

      {/* 펼침 = 구축 로드맵. 장비 상태 비율 막대·타일은 여기서 뺐다(2026-08-06 사용자 지시) —
          같은 숫자를 홈 '장비 도입'·'장비 운영' 카드가 이미 보여 주고 있어 두 번 읽을 것이 됐다. */}
      <Collapse in={open} unmountOnExit>
        <Box sx={{ px: 2, pb: 2 }}>
          <RoadmapCard showLegend={false} showBadges={false} />
        </Box>
      </Collapse>
    </AppCard>
  )
}
