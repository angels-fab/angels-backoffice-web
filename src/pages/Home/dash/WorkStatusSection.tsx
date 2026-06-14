import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { AppCard, CardGrid, RatioBar, StatTile } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { workStatusCounts } from './derive'

/**
 * Section 3 — 업무 현황(상태별 집계 + 비율 막대).
 * 시트 '상태' 열(진행중/보류/완료) 기준 — derive.ts(workStatusCounts) 참조.
 */
export default function WorkStatusSection() {
  const navigate = useNavigate()
  const items = useAppSelector((s) => s.work.items)
  const c = workStatusCounts(items)
  const go = () => navigate('/work')

  return (
    <Box>
      {/* 비율 막대 (Mini Chart) */}
      <AppCard padding={18} sx={{ mb: 2 }}>
        <RatioBar
          segments={[
            { label: '진행중', value: c.inProgress, status: 'success' },
            { label: '보류', value: c.hold, status: 'warning' },
            { label: '완료', value: c.done, status: 'neutral' },
            ...(c.etc > 0 ? [{ label: '미정', value: c.etc, status: 'neutral' as const }] : []),
          ]}
        />
      </AppCard>

      {/* 상태별 집계 타일 */}
      <CardGrid columns={4}>
        <StatTile value={c.inProgress} unit="건" label="진행중" status="success" onClick={go} />
        <StatTile value={c.hold} unit="건" label="보류" status="warning" onClick={go} />
        <StatTile value={c.done} unit="건" label="완료" status="neutral" onClick={go} />
        <StatTile value={c.total} unit="건" label="전체" status="info" onClick={go} />
      </CardGrid>
    </Box>
  )
}
