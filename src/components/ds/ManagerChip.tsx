import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'
import { mergeSx } from './sxMerge'
import { managerColor, radius, typescale } from '@/theme/tokens'

/**
 * ManagerChip — 담당자(사람) 이름 라벨 칩.
 *
 * 칩 2체계 중 "라벨형"(보여주는 것) = radius.chip(8px) · 높이 24 · 솔리드. 색은 managerColor
 * (단일 출처)라 Work·Calendar 어디서나 같은 사람=같은 색. 빈값이면 '미지정' 회색.
 * ※ 필터(토글)가 아니라 표시 전용 — 필터는 FilterChip(PillChip/TintChip, 알약형)을 쓴다.
 */
export interface ManagerChipProps {
  name?: string | null
  sx?: SxProps<Theme>
}

export default function ManagerChip({ name, sx }: ManagerChipProps) {
  return (
    <Box
      component="span"
      sx={mergeSx(
        {
          display: 'inline-flex', alignItems: 'center', flexShrink: 0, height: 24, boxSizing: 'border-box',
          px: '10px', borderRadius: `${radius.chip}px`, bgcolor: managerColor(name || ''),
          color: 'common.white', fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight,
          lineHeight: 1, whiteSpace: 'nowrap',
        },
        sx,
      )}
    >
      {/* 한글 글리프는 잉크가 baseline 위로 쏠려(descent 거의 없음) 고정높이 칩에서 0.5px 떠 보임 →
          글자만 0.5px 하향(실측: -0.5px→0). 배경은 그대로 두려고 텍스트만 감싼다. */}
      <Box component="span" sx={{ display: 'inline-block', transform: 'translateY(0.5px)' }}>{(name || '').trim() || '미지정'}</Box>
    </Box>
  )
}
