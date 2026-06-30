import Box from '@mui/material/Box'
import type { EqGroup, EqRawItem } from '@/types'

/** 대표 관리번호 표기 — 여러 대면 'CL-001 외 1' */
export const codeRange = (g: EqGroup) =>
  g.count > 1 ? `${g.codes[0] || '-'} 외 ${g.count - 1}` : g.codes[0] || '관리번호 미등록'

/** 작은 수량 배지(둥근 사각형, 파랑). 디자인 규칙: 과도한 알약형 금지 */
export function QtyBadge({ n }: { n: number }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', height: 18, px: '6px', borderRadius: '5px',
        border: 1, borderColor: 'primary.main', bgcolor: (t) => t.palette.primary.main + '22',
        color: 'primary.main', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {n}대
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
export const missingLabels = (x: EqGroup | EqRawItem): string[] =>
  REG_FIELDS.filter((f) => !(f.pick(x) || '').trim()).map((f) => f.label)
