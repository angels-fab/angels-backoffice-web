import { createPortal } from 'react-dom'
import Box from '@mui/material/Box'
import { radius, shadow, typescale } from '../../theme/tokens'

/** 드래그(이동/리사이즈) 중 실시간 안내 툴팁 데이터 — 표시 전용(저장·상태 변경 없음) */
export interface DragTipData {
  /** 커서 viewport 좌표 */
  x: number
  y: number
  /** 줄 단위 텍스트 (1줄=강조, 이후=보조) */
  lines: string[]
}

// 이동·리사이즈가 공유하는 공통 프리뷰 툴팁. body로 포털, 커서 추적, 화면 끝에선 반대로 뒤집음.
export default function DragTip({ tip }: { tip: DragTipData | null }) {
  if (!tip) return null
  const flipX = typeof window !== 'undefined' && tip.x > window.innerWidth - 180
  const flipY = typeof window !== 'undefined' && tip.y > window.innerHeight - 96
  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        left: tip.x + (flipX ? -14 : 14),
        top: tip.y + (flipY ? -16 : 16),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
        zIndex: 2000,
        pointerEvents: 'none',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${radius.card}px`,
        px: 1.25,
        py: 0.75,
        boxShadow: shadow.md,
      }}
    >
      {tip.lines.map((l, i) => (
        <Box
          key={i}
          sx={{
            fontSize: typescale.small.size,
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
            color: i === 0 ? 'text.primary' : 'text.secondary',
            fontWeight: i === 0 ? 600 : 400,
          }}
        >
          {l}
        </Box>
      ))}
    </Box>,
    document.body,
  )
}
