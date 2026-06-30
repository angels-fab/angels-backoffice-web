import Box from '@mui/material/Box'
import type { EqGroup, EqRawItem } from '@/types'
import { eqStateKey } from '@/pages/EquipmentOps/eqMeta'

/** 대표 관리번호 표기 — 여러 대면 'CL-001 외 1' */
export const codeRange = (g: EqGroup) =>
  g.count > 1 ? `${g.codes[0] || '-'} 외 ${g.count - 1}` : g.codes[0] || '관리번호 미등록'

/**
 * 장비명 + 복수 수량(2대 이상만) — 배지가 아닌 '장비명 옆 강조 텍스트'.
 * 1대면 수량 미표시. 수량은 장비명보다 약간 작게(0.82em) 표기. 타임라인·목록·대장 공용 규칙.
 */
export function NameWithQty({ name, count, fontSize = 13, color = 'text.primary' }: { name: string; count: number; fontSize?: number; color?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, minWidth: 0 }}>
      <Box component="span" sx={{ fontSize, fontWeight: 700, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Box>
      {count > 1 && (
        <Box component="span" sx={{ fontSize: '0.82em', fontWeight: 700, color: 'text.secondary', flexShrink: 0 }}>{count}대</Box>
      )}
    </Box>
  )
}

/** 필수 등록정보 4종(제조사·모델명·설치장소·NFEC) — 누락 라벨 목록 */
export const REG_FIELDS: { label: string; pick: (x: EqGroup | EqRawItem) => string }[] = [
  { label: '제조사', pick: (x) => x.maker },
  { label: '모델명', pick: (x) => x.model },
  { label: '설치장소', pick: (x) => x.installLoc },
  { label: 'NFEC', pick: (x) => x.nfec },
]

// 등록정보가 '필수'가 되는 상태 — 도입이 실제 진행/운영되는 단계. 도입예정(과 미분류/빈값)은 아직 미요구.
const REG_REQUIRED_STATES = new Set(['도입중', '운영중', '비가동'])
/** 이 장비 상태에서 제조사·모델명·설치장소·NFEC 등 등록정보가 필수인가 (도입예정은 false) */
export const isRegRequired = (state?: string): boolean => REG_REQUIRED_STATES.has(eqStateKey(state))

/** 누락 등록정보 라벨 — 등록정보가 필수인 상태에서 비어 있는 항목만. 도입예정은 항상 [] (정상적 미등록). */
export const missingLabels = (x: EqGroup | EqRawItem): string[] =>
  isRegRequired(x.state) ? REG_FIELDS.filter((f) => !(f.pick(x) || '').trim()).map((f) => f.label) : []
