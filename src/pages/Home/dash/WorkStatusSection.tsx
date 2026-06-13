import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { AppCard, CardGrid, RatioBar, StatTile } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { todayMidMs, workStatusCounts } from './derive'

/**
 * Section 3 — 업무 현황(상태별 집계 + 비율 막대).
 * 상태 파생 기준은 derive.ts(workStatusCounts) 참조.
 */
export default function WorkStatusSection() {
  const navigate = useNavigate()
  const items = useAppSelector((s) => s.work.items)
  const c = workStatusCounts(items, todayMidMs())
  const go = () => navigate('/work')

  return (
    <Box>
      {/* 비율 막대 (Mini Chart) */}
      <AppCard padding={18} sx={{ mb: 2 }}>
        <RatioBar
          segments={[
            { label: '진행중', value: c.inProgress, status: 'success' },
            { label: '예정', value: c.upcoming, status: 'info' },
            { label: '완료', value: c.done, status: 'neutral' },
            { label: '지연', value: c.delayed, status: 'error' },
          ]}
        />
      </AppCard>

      {/* 상태별 집계 타일 */}
      <CardGrid columns={4}>
        <StatTile value={c.inProgress} unit="건" label="진행중" status="success" onClick={go} />
        <StatTile value={c.upcoming} unit="건" label="예정" status="info" onClick={go} />
        <StatTile value={c.done} unit="건" label="완료" status="neutral" onClick={go} />
        <StatTile value={c.delayed} unit="건" label="지연" status="error" onClick={go} />
      </CardGrid>
    </Box>
  )
}
