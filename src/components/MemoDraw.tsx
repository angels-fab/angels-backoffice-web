import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { accent, radius, shadow, typescale, weight, z } from '@/theme/tokens'
import type { MemoStroke } from '@/api/improve'

/** 펜 색 — 화면 위에 겹쳐 그리므로 배경과 싸우지 않는 강조색 셋만 */
const PENS: { key: string; color: string; label: string }[] = [
  { key: 'red', color: accent.red, label: '빨강' },
  { key: 'amber', color: accent.amber, label: '노랑' },
  { key: 'blue', color: accent.blue, label: '파랑' },
]
const WIDTHS = [3, 6]

/** [x,y,x,y,...] → SVG polyline 의 "x,y x,y" 문자열. 저장 형식이 평면 배열이라 여기서 편다. */
export function pointsOf(p: number[]): string {
  const out: string[] = []
  for (let i = 0; i + 1 < p.length; i += 2) out.push(`${p[i]},${p[i + 1]}`)
  return out.join(' ')
}

/**
 * 화면 위 그리기 — **포털 관리자 전용 편의 도구**(2026-08-05 사용자 지시).
 *
 * 만든 이유: 고칠 곳을 말로 설명하는 대신 화면에 직접 동그라미·화살표를 쳐 두면
 * 무엇을 말하는지 훨씬 빨리 통한다. 구성원에게는 도구도 그림도 보이지 않는다.
 *
 * 좌표는 **본문 칸 좌상단 기준 px** — 붙임쪽지 압정과 같은 기준이라 해상도가 달라져도
 * 같은 지점에 남는다(StickyMemo 의 POS_KEY 주석 참고). 그래서 이 컴포넌트는 그리기 판을
 * 직접 만들지 않고, 쪽지 레이어가 넘겨준 상자(layerRef) 안에서 좌표를 잰다.
 *
 * 저장은 하지 않는다 — 완료를 누르면 획 배열을 부모에게 돌려주고, 어디에 붙일지는 부모가 정한다.
 */
export default function MemoDraw({ layerRef, initial, onDone, onCancel }: {
  layerRef: React.RefObject<HTMLDivElement | null>
  initial?: MemoStroke[]
  onDone: (strokes: MemoStroke[]) => void
  onCancel: () => void
}) {
  const [strokes, setStrokes] = useState<MemoStroke[]>(initial || [])
  const [pen, setPen] = useState(PENS[0])
  const [width, setWidth] = useState(WIDTHS[0])
  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  /** 포인터 위치 → 본문 칸 기준 px */
  const at = (e: React.PointerEvent): [number, number] | null => {
    const layer = layerRef.current
    if (!layer) return null
    const r = layer.getBoundingClientRect()
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)]
  }

  const down = (e: React.PointerEvent) => {
    const p = at(e)
    if (!p) return
    drawing.current = true
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* 캡처 실패해도 그리기는 동작 */ }
    setStrokes((s) => [...s, { c: pen.color, w: width, p }])
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = at(e)
    if (!p) return
    setStrokes((s) => {
      const last = s[s.length - 1]
      if (!last) return s
      // 같은 자리 반복 점은 버린다 — 저장 용량과 렌더 비용이 그냥 늘어난다
      const n = last.p.length
      if (last.p[n - 2] === p[0] && last.p[n - 1] === p[1]) return s
      return [...s.slice(0, -1), { ...last, p: [...last.p, ...p] }]
    })
  }
  const up = () => { drawing.current = false }

  return (
    <>
      {/* 그리기 판 — 쪽지 레이어와 같은 상자에 겹친다 */}
      <Box
        component="svg"
        ref={svgRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        sx={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'auto', cursor: 'crosshair', touchAction: 'none',
          zIndex: 5,
        }}
      >
        {strokes.map((s, i) => (
          <polyline
            key={i}
            points={pointsOf(s.p)}
            fill="none"
            stroke={s.c}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Box>

      {/* 도구 — 화면 아래 가운데 고정. 그림을 가리지 않게 낮게 둔다 */}
      <Box
        sx={{
          position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1, borderRadius: `${radius.pill}px`,
          bgcolor: 'background.paper', border: 1, borderColor: 'divider',
          boxShadow: shadow.lg, zIndex: z.stickyMemo + 1, pointerEvents: 'auto',
        }}
      >
        {PENS.map((p) => (
          <Tooltip key={p.key} title={p.label}>
            <Box
              component="button"
              aria-label={`${p.label} 펜`}
              onClick={() => setPen(p)}
              sx={{
                width: 24, height: 24, p: 0, borderRadius: radius.circle, cursor: 'pointer',
                bgcolor: p.color,
                border: pen.key === p.key ? '3px solid' : '1px solid',
                borderColor: pen.key === p.key ? 'text.primary' : 'divider',
              }}
            />
          </Tooltip>
        ))}

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        {WIDTHS.map((w) => (
          <Box
            key={w}
            component="button"
            aria-label={`굵기 ${w}`}
            onClick={() => setWidth(w)}
            sx={{
              display: 'grid', placeItems: 'center', width: 28, height: 24, p: 0, cursor: 'pointer',
              bgcolor: width === w ? 'action.selected' : 'transparent',
              border: 0, borderRadius: `${radius.chip}px`,
            }}
          >
            <Box sx={{ width: 16, height: `${w}px`, borderRadius: `${radius.pill}px`, bgcolor: 'text.primary' }} />
          </Box>
        ))}

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Tooltip title="마지막 획 지우기">
          <span>
            <IconButton size="small" aria-label="실행취소" disabled={strokes.length === 0} onClick={() => setStrokes((s) => s.slice(0, -1))}>
              <UndoIcon sx={{ fontSize: typescale.cardTitle.size }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="전부 지우기">
          <span>
            <IconButton size="small" aria-label="전부 지우기" disabled={strokes.length === 0} onClick={() => setStrokes([])}>
              <DeleteSweepIcon sx={{ fontSize: typescale.cardTitle.size }} />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Button size="small" onClick={onCancel} sx={{ color: 'text.secondary', fontWeight: weight.medium }}>취소</Button>
        <Button size="small" variant="contained" onClick={() => onDone(strokes)}>완료</Button>
      </Box>
    </>
  )
}
