import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { layout } from '@/theme/tokens'

export interface FilterBarProps {
  /** 필터 요소들(Select, StatusChip, SearchBar 등) */
  children: ReactNode
  /** 우측 끝에 붙일 요소(정렬·뷰 전환 등) */
  trailing?: ReactNode
  sx?: SxProps<Theme>
}

/**
 * FilterBar — 페이지 상단 필터 영역의 통일된 가로 컨테이너.
 *
 * ⚠ 미채택 — 프로덕션 사용처 0곳(_DesignSystem 쇼케이스에만 남음).
 *   실제 정본은 <FilterToolbar>(공지·개선요청에서 사용 중)다. 새 화면은 FilterToolbar 를 쓸 것.
 *   여기에 값을 맞추려 들면 정본이 두 벌이 된다.
 *
 * 레이아웃 규칙: 아래 여백 layout.filterGap(16). 좁은 화면에서 wrap.
 *
 * @example
 * <FilterBar trailing={<SearchBar value={q} onChange={setQ} />}>
 *   <StatusChip status="success" label="국내" />
 *   <StatusChip status="info" label="해외" />
 * </FilterBar>
 */
export default function FilterBar({ children, trailing, sx }: FilterBarProps) {
  return (
    <Box
      sx={mergeSx({
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 1,
        mb: `${layout.filterGap}px`,
      }, sx)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, flex: 1, minWidth: 0 }}>
        {children}
      </Box>
      {trailing}
    </Box>
  )
}
