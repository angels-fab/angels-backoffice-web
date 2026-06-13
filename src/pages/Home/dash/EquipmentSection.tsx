import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { AppCard, CardGrid, RatioBar, StatTile } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'

/**
 * Section 4 — 장비 현황 요약(상태 비율 막대 + 상태별 타일).
 * 매핑: 가동중=운영중 / 도입중=설치중 / 도입예정 / 비가동. → /equipment 이동.
 */
export default function EquipmentSection() {
  const navigate = useNavigate()
  const eq = useAppSelector(selectEqCounts)
  const go = () => navigate('/equipment')
  const u = eq.units

  return (
    <Box>
      {/* 상태 비율 막대(대수 기준) */}
      <AppCard padding={18} sx={{ mb: 2 }}>
        <RatioBar
          segments={[
            { label: '운영중', value: u['가동중'], status: 'success' },
            { label: '설치중', value: u['도입중'], status: 'teal' },
            { label: '도입예정', value: u['도입예정'], status: 'info' },
            { label: '비가동', value: u['비가동'], status: 'error' },
          ]}
        />
      </AppCard>

      {/* 상태별 타일 */}
      <CardGrid columns={4}>
        <StatTile value={u['가동중']} unit="대" label="운영중" status="success" sub={`${eq.typesBy['가동중']}종`} onClick={go} />
        <StatTile value={u['도입중']} unit="대" label="설치중" status="teal" sub={`${eq.typesBy['도입중']}종`} onClick={go} />
        <StatTile value={u['도입예정']} unit="대" label="도입예정" status="info" sub={`${eq.typesBy['도입예정']}종`} onClick={go} />
        <StatTile value={u['비가동']} unit="대" label="비가동" status="error" sub={`${eq.typesBy['비가동']}종`} onClick={go} />
      </CardGrid>
    </Box>
  )
}
