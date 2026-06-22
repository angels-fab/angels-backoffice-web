import type { ReactNode } from 'react'
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn'
import EditIcon from '@mui/icons-material/Edit'
import LayersIcon from '@mui/icons-material/Layers'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'

// FAB 구축 로드맵 — GIST 첨단AI반도체팹센터 구축 단계별 진행 현황 (정적 데이터)
export type RoadmapStatus = 'done' | 'current' | 'plan'

export interface RoadmapStep {
  icon: ReactNode
  label: string
  period: string
  status: RoadmapStatus
  /** 가로 타임라인에서 살짝 넓게 잡을 컬럼(구축 단계) */
  wide?: boolean
}

export const ROADMAP_STEPS: RoadmapStep[] = [
  { icon: <AssignmentTurnedInIcon fontSize="inherit" />, label: '사업기획', period: '2022~2023.12', status: 'done' },
  { icon: <EditIcon fontSize="inherit" />, label: '계획설계', period: '2023.12~2025.02', status: 'done' },
  { icon: <LayersIcon fontSize="inherit" />, label: '중간설계', period: '2025.02~2026.01', status: 'done' },
  { icon: <FactCheckIcon fontSize="inherit" />, label: '실시설계', period: '2026.01~진행중', status: 'current' },
  { icon: <AccountTreeIcon fontSize="inherit" />, label: '구축 단계', period: '2026.12~2028.09', status: 'plan', wide: true },
  { icon: <RocketLaunchIcon fontSize="inherit" />, label: '시운전·운영 개시', period: '2029', status: 'plan' },
]
