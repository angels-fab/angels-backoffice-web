import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { radius } from '@/theme/tokens'

/**
 * FilterToolbar — 목록 페이지 상단 필터 바 표준 (박스 + 라벨 + 칩 + 검색 + 액션).
 *
 * 공지·개선요청·업무·일정이 각자 손코딩하던 "필터 박스"를 하나로 통일한다.
 * 이 컴포넌트를 쓰면 테두리 박스·간격·검색/새글 배치가 전 페이지 동일(구조적 일관성).
 * 좌측 = 라벨(선택) + 칩(children) / 우측(ml auto) = 검색 + 액션(선택).
 *
 * @example
 * <FilterToolbar
 *   label="분류"
 *   search={<SearchBar value={q} onChange={setQ} />}
 *   actions={<Button>새 공지</Button>}
 * >
 *   {cats.map((c) => <TintChip …>{c}</TintChip>)}
 * </FilterToolbar>
 */
export interface FilterToolbarProps {
  /** 좌측 라벨(예: '분류', '상태'). 없으면 생략. */
  label?: string
  /** 필터 칩들 */
  children: ReactNode
  /** 우측 검색창(선택) */
  search?: ReactNode
  /** 우측 액션(새 글쓰기 버튼 등, 선택) */
  actions?: ReactNode
  sx?: SxProps<Theme>
}

const LABEL_SX = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none',
} as const

export default function FilterToolbar({ label, children, search, actions, sx }: FilterToolbarProps) {
  return (
    <Box
      sx={mergeSx(
        (t: Theme) => ({
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2,
          p: '10px 14px', bgcolor: 'background.paper',
          border: `1px solid ${t.palette.divider}`, borderRadius: `${radius.card}px`,
        }),
        sx,
      )}
    >
      {label && <Box component="span" sx={LABEL_SX}>{label}</Box>}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>{children}</Box>
      {(search || actions) && (
        <Box sx={{ ml: { sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 1 }}>
          {search}
          {actions}
        </Box>
      )}
    </Box>
  )
}
