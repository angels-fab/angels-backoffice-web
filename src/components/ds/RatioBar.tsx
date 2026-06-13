import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Theme } from '@mui/material/styles'
import type { StatusKind } from './StatusChip'

export interface RatioSegment {
  label: string
  value: number
  status: StatusKind
}

export interface RatioBarProps {
  segments: RatioSegment[]
  /** 막대 높이(px). 기본 10. */
  height?: number
  /** 하단 범례 표시. 기본 true. */
  showLegend?: boolean
}

const colorFor = (status: StatusKind, t: Theme): string => {
  switch (status) {
    case 'success': return t.palette.accent.green
    case 'info': return t.palette.accent.blue
    case 'warning': return t.palette.accent.amber
    case 'error': return t.palette.accent.red
    case 'purple': return t.palette.accent.purple
    case 'teal': return t.palette.accent.teal
    case 'neutral': return t.palette.text.secondary
    default: return t.palette.text.disabled
  }
}

/**
 * RatioBar — 상태 비율을 가로 누적 막대 + 범례로 시각화.
 * 값 비율로 칸 너비가 정해지며, 색은 StatusKind→테마 accent로 매핑.
 *
 * @example
 * <RatioBar segments={[
 *   { label: '진행중', value: 7, status: 'success' },
 *   { label: '지연', value: 2, status: 'error' },
 * ]} />
 */
export default function RatioBar({ segments, height = 10, showLegend = true }: RatioBarProps) {
  const total = segments.reduce((s, x) => s + x.value, 0)

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height,
          borderRadius: 999,
          overflow: 'hidden',
          bgcolor: 'background.elevated',
          gap: '2px',
        }}
      >
        {total === 0
          ? null
          : segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <Box
                  key={s.label}
                  title={`${s.label} ${s.value}`}
                  sx={{ flexGrow: s.value, flexBasis: 0, bgcolor: (t) => colorFor(s.status, t) }}
                />
              ))}
      </Box>
      {showLegend && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.25 }}>
          {segments.map((s) => (
            <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', flexShrink: 0, bgcolor: (t) => colorFor(s.status, t) }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {s.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700 }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
