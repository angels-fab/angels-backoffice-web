import type { ReactNode } from 'react'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import MemoryIcon from '@mui/icons-material/Memory'
import BoltIcon from '@mui/icons-material/Bolt'
import ScienceIcon from '@mui/icons-material/Science'
import StorageIcon from '@mui/icons-material/Storage'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import GavelIcon from '@mui/icons-material/Gavel'
import GroupsIcon from '@mui/icons-material/Groups'
import CampaignIcon from '@mui/icons-material/Campaign'
import type { MilestoneRow, MilestoneStatus } from '@/api/milestones'
import type { StatusKind } from '@/components/ds'

/**
 * 마일스톤 도메인 모델 — 분기 축·분야 메타·상태 파생 규칙.
 *
 * 분기 축: 2026Q3(계획 출발) ~ 2029Q4(개소 목표) 총 14분기.
 * 퍼지 원문("착공 전" 등)의 분기 앵커는 시딩 시 확정(gen-seed) — 원문은 startLabel/endLabel에 보존.
 * 임박·지연은 저장하지 않고 여기서 자동 파생한다(D3: 임박=앰버 · 지연=레드, fuzzy 항목은 지연 판정 제외).
 */

export const FIRST_Q = { y: 2026, q: 3 }
export const TOTAL_QUARTERS = 14

/** '2026Q3' → 0 ~ 13 (축 밖은 클램프) */
export function qIndex(qstr: string): number {
  const m = qstr.match(/^(\d{4})Q(\d)$/)
  if (!m) return 0
  const idx = (Number(m[1]) - FIRST_Q.y) * 4 + (Number(m[2]) - FIRST_Q.q)
  return Math.max(0, Math.min(TOTAL_QUARTERS - 1, idx))
}

/** 0~13 → '2026Q3' */
export function qAt(idx: number): string {
  const abs = FIRST_Q.y * 4 + (FIRST_Q.q - 1) + idx
  return `${Math.floor(abs / 4)}Q${(abs % 4) + 1}`
}

/** '2026Q3' → '26.3Q' (표시용 축약) */
export const qShort = (qstr: string) => qstr.replace(/^\d{2}(\d{2})Q(\d)$/, "$1.$2Q")

/** '2026Q3' → '2026.3Q' */
export const qFull = (qstr: string) => qstr.replace(/^(\d{4})Q(\d)$/, '$1.$2Q')

/** 오늘(KST)이 속한 분기의 축 인덱스 */
export function currentQIndex(): number {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const idx = (now.getFullYear() - FIRST_Q.y) * 4 + (Math.floor(now.getMonth() / 3) + 1 - FIRST_Q.q)
  return Math.max(0, Math.min(TOTAL_QUARTERS - 1, idx))
}

export interface CategoryMeta {
  /** 엑셀 원문 대분류명(= DB category) */
  full: string
  /** 카드·레인 표시용 축약명 */
  short: string
  icon: ReactNode
}

/** 9개 대분류 — 엑셀 순서 고정 */
export const CATEGORIES: CategoryMeta[] = [
  { full: '예산·건축 및 특수시설 연계', short: '예산·건축', icon: <AccountBalanceIcon fontSize="inherit" /> },
  { full: '연구장비 도입·제작·검수', short: '연구장비', icon: <MemoryIcon fontSize="inherit" /> },
  { full: '유틸리티·시설 성능검증', short: '유틸리티', icon: <BoltIcon fontSize="inherit" /> },
  { full: '공정 셋업', short: '공정 셋업', icon: <ScienceIcon fontSize="inherit" /> },
  { full: '운영 플랫폼·IT·공정데이터', short: '운영 IT', icon: <StorageIcon fontSize="inherit" /> },
  { full: '안전·환경·인허가', short: '안전·환경', icon: <HealthAndSafetyIcon fontSize="inherit" /> },
  { full: '운영규정·제도·요율', short: '규정·요율', icon: <GavelIcon fontSize="inherit" /> },
  { full: '조직·인력·교육', short: '조직·인력', icon: <GroupsIcon fontSize="inherit" /> },
  { full: '기업지원·고객지원·홍보·수익모델', short: '기업지원·홍보', icon: <CampaignIcon fontSize="inherit" /> },
]

export const categoryShort = (full: string) => CATEGORIES.find((c) => c.full === full)?.short || full

/** 화면 표시 상태(파생) — 저장 상태 4종 + 자동 지연 */
export type DerivedStatus = MilestoneStatus | '지연'

/** D3 전역 배정: 진행중=그린 · 완료=파랑 · 예정=회색 · 보류=앰버 · 지연=레드 */
export const STATUS_KIND: Record<DerivedStatus, StatusKind> = {
  예정: 'neutral',
  진행중: 'success',
  완료: 'info',
  보류: 'warning',
  지연: 'error',
}

/**
 * 표시 상태 파생 — 완료·보류는 그대로, 미완료(예정·진행중)는 완료목표 분기가
 * "완전히 지난" 경우에만 지연. 추정 매핑(fuzzy) 항목은 지연 판정에서 제외(조기 오경보 방지).
 */
export function deriveStatus(row: MilestoneRow, curIdx: number): DerivedStatus {
  if (row.status === '완료' || row.status === '보류') return row.status
  if (!row.fuzzy && qIndex(row.endQ) < curIdx) return '지연'
  return row.status
}

/** 임박 — 완료목표가 이번 분기인데 아직 미완료(보류 제외) */
export const isImminent = (row: MilestoneRow, curIdx: number) =>
  row.status !== '완료' && row.status !== '보류' && qIndex(row.endQ) === curIdx
