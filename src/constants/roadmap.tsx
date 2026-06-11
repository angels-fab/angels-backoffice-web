import type { ReactNode } from 'react'
import AssignmentIcon from '@mui/icons-material/Assignment'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import ConstructionIcon from '@mui/icons-material/Construction'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import SettingsIcon from '@mui/icons-material/Settings'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'

// 홈 'FAB 구축 로드맵' 타임라인 7단계 (정적 데이터)
export type RoadmapStatus = 'done' | 'current' | 'plan'

export interface RoadmapStep {
  icon: ReactNode
  label: string
  period: string
  status: RoadmapStatus
}

export const ROADMAP_STEPS: RoadmapStep[] = [
  { icon: <AssignmentIcon fontSize="inherit" />, label: '기획', period: '2024.01~03', status: 'done' },
  { icon: <DesignServicesIcon fontSize="inherit" />, label: '설계', period: '2024.04~06', status: 'done' },
  { icon: <ConstructionIcon fontSize="inherit" />, label: '공사', period: '2024.07~12', status: 'done' },
  { icon: <LocalShippingIcon fontSize="inherit" />, label: '장비 도입', period: '2025.01~06', status: 'current' },
  { icon: <FactCheckIcon fontSize="inherit" />, label: '검수·셋업', period: '2025.07~08', status: 'plan' },
  { icon: <SettingsIcon fontSize="inherit" />, label: '시운전', period: '2025.09~10', status: 'plan' },
  { icon: <RocketLaunchIcon fontSize="inherit" />, label: '운영 개시', period: '2026.10', status: 'plan' },
]
