import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Slider from '@mui/material/Slider'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import LayersClearIcon from '@mui/icons-material/LayersClear'
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward'
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { SnipPenIcon, SnipHighlightIcon, SnipShapesIcon, SnipEraserIcon } from '@/components/snipIcons'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import { HL_TOKENS, HL_LABEL, HL_SOLID } from '@/pages/Work/richContent'
import { accent, radius, shadow, typescale, weight, z } from '@/theme/tokens'
import type { MemoStroke, MemoStrokeKind } from '@/api/improve'
import { snapStroke, mergeArrowHead } from '@/utils/shapeRecognize'

/**
 * 화면 위 그리기 도구 (2026-08-06 개편 — 윈도우 캡처 도구 구성을 따름).
 *
 * 도구 = **버튼 + 전용 설정**. 버튼을 누르면 도구가 선택되면서 색·굵기 팝오버가 함께 열린다
 * (사용자 확정 2026-08-06 — '선택된 것을 한 번 더 누르면 설정'의 두 단계 조작을 되돌림).
 * 설정은 **도구마다 따로 기억**한다 — 형광펜을 노랑 굵게 쓰다 펜으로 돌아와도 펜은 쓰던 색·굵기 그대로다.
 *
 * 저장 형식은 MemoStroke 하나로 통일한다. 자유곡선은 지나온 점 전부, 도형은 시작·끝 두 점.
 * 종류(k)가 없으면 자유곡선으로 읽으므로 개편 전에 그린 그림도 그대로 열린다.
 */

/**
 * 펜 색. 'ink' 는 고정색이 아니라 **테마 글자색**으로 풀린다(라이트=검정 / 다크=흰색).
 * 검정을 그대로 저장하면 다크 테마에서 배경에 묻혀 안 보인다 — 같은 그림을 두 테마에서
 * 다 봐야 하므로 색이 아니라 '먹'이라는 뜻으로 저장한다.
 */
export const INK = 'ink'

/**
 * 선용 색 — 다섯 가지만(사용자 확정 2026-08-06). 검정은 'ink' 라 라이트=검정·다크=흰색으로 뒤집히고,
 * 나머지 넷은 두 테마 모두에서 대비가 확보된 디자인 시스템 강조색이다(임의 hex 금지).
 */
const LINE_COLORS: { c: string; label: string }[] = [
  { c: INK, label: '검정' },
  { c: accent.red, label: '빨강' },
  { c: accent.blue, label: '파랑' },
  { c: accent.green, label: '초록' },
  { c: accent.amber, label: '노랑' },
]
/**
 * 형광펜 색 — 업무카드 서식 툴바의 형광펜과 같은 넷(HL_SOLID). 두 곳에서 색이 갈리면
 * 같은 노랑을 칠했는데 화면마다 달라 보인다. PPT·Word 형광펜 표준 원색이라 채도를 낮추지 않는다.
 */
const HL_COLORS: { c: string; label: string }[] = HL_TOKENS.map((t) => ({ c: HL_SOLID[t], label: HL_LABEL[t] }))

/** 형광펜 불투명도 — 아래 글자가 비쳐야 '덧칠'로 읽힌다 */
const HL_ALPHA = 0.35
/** 지우개 판정 반경(px) — 획까지 거리가 이 안이면 그 획을 통째로 지운다 */
const ERASE_R = 14
/** 화살촉 길이 비율(선 굵기 대비)과 벌어진 각 */
const HEAD_LEN = 4.5
const HEAD_ANGLE = Math.PI / 7

/**
 * 도구는 넷 — 도형 셋(사각형·타원·화살표)을 버튼 하나로 합쳤다(사용자 지시 2026-08-06:
 * "도형 버튼이 세 개나 있을 이유가 없음"). 어떤 도형인지는 그 도구의 팝오버에서 고른다.
 */
type Tool = 'pen' | 'hl' | 'shape' | 'eraser'
/** 도형 종류 — 'shape' 도구가 지금 무엇을 그리는지 */
type ShapeKind = Extract<MemoStrokeKind, 'rect' | 'ellipse' | 'arrow'>

const SHAPE_KINDS: { k: ShapeKind; label: string; Icon: typeof RectangleOutlinedIcon }[] = [
  { k: 'rect', label: '사각형', Icon: RectangleOutlinedIcon },
  { k: 'ellipse', label: '타원', Icon: CircleOutlinedIcon },
  { k: 'arrow', label: '화살표', Icon: ArrowOutwardIcon },
]

/**
 * 도구 아이콘 — 윈도우 캡처 도구의 그림 그대로(snipIcons, 사용자가 캡처로 지정 2026-08-06).
 * MUI 세트에는 이 그림들이 없어 비슷한 것으로 때웠더니 캡처와 전혀 달랐다 — snipIcons 주석 참고.
 */
const TOOLS: { key: Tool; label: string; Icon: typeof SnipPenIcon }[] = [
  { key: 'pen', label: '펜', Icon: SnipPenIcon },
  { key: 'hl', label: '형광펜', Icon: SnipHighlightIcon },
  { key: 'shape', label: '도형', Icon: SnipShapesIcon },
  { key: 'eraser', label: '지우개', Icon: SnipEraserIcon },
]

/** 도구별 굵기 범위 — 형광펜은 덧칠이라 훨씬 두껍다 */
const WIDTH_RANGE: Record<Exclude<Tool, 'eraser'>, [number, number]> = {
  pen: [1, 12], hl: [8, 32], shape: [1, 12],
}

/**
 * 도구 아이콘 렌더 크기 — 사다리(iconSize) 밖 값이지만 사용자가 "두 단계는 더"를 지정했다
 * (20 → 24 → 28). iconSize 주석의 예외 조항 그대로: 크기가 위계가 아니라 **컨테이너**(도구 줄)에서
 * 나오는 그래픽이라 사다리에 올리지 않는다.
 */
const TOOL_ICON = 28

/**
 * 지우개 커서 — 도구 아이콘과 같은 그림으로(사용자 지시 2026-08-05. 아이콘이 캡처 도구 모양으로
 * 바뀌면서 커서도 함께 교체 — SnipEraserIcon 과 같은 기하).
 * 기본 커서 중에는 지우개가 없어 'cell'(십자)을 썼더니 더하기처럼 보였다.
 * 커서는 CSS url() 이라 currentColor 를 못 쓴다 → 흰 굵은 선을 밑에 깔고 어두운 선을 얹어
 * 밝은/어두운 배경 양쪽에서 보이게 한다.
 */
const ERASER_SHAPE =
  `<g transform='rotate(-45 12 10)'><rect x='4.8' y='6.2' width='14.4' height='7.6' rx='2.2'/><path d='M10 6.2v7.6'/></g><path d='M4.2 20.4h15.6'/>`
const ERASER_CURSOR =
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24">`
    + `<g fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${ERASER_SHAPE}</g>`
    + `<g fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ERASER_SHAPE}</g>`
    + `</svg>`,
  )}") 12 14, cell`

/**
 * 상단바 '그리기' 버튼 → 쪽지 레이어에 그리기 시작을 알리는 신호.
 *
 * 버튼은 TopBar 에, 그리기 판은 MainLayout 의 쪽지 레이어에 있어 부모-자식이 아니다.
 * 이 하나를 위해 전역 상태를 새로 만들 이유가 없어 창 이벤트로 잇는다(수신은 StickyMemoLayer).
 */
export const MEMO_DRAW_EVENT = 'memo-draw:start'

/** [x,y,x,y,...] → SVG polyline 의 "x,y x,y" 문자열. 저장 형식이 평면 배열이라 여기서 편다. */
export function pointsOf(p: number[]): string {
  const out: string[] = []
  for (let i = 0; i + 1 < p.length; i += 2) out.push(`${p[i]},${p[i + 1]}`)
  return out.join(' ')
}

const kindOf = (s: MemoStroke): MemoStrokeKind => s.k ?? 'pen'

/**
 * 획 하나를 SVG 로 그린다 — **그리는 중(MemoDraw)과 저장된 그림(StickyMemo)이 같은 함수를 쓴다.**
 * 두 곳에서 따로 그리면 새 종류를 넣을 때마다 한쪽을 빠뜨린다.
 * ink 는 테마 글자색으로 풀어 넘겨야 한다(sx 로는 stroke 에 팔레트 경로가 안 풀린다 — 아래 inkColor 주석).
 */
export function StrokeShape({ s, ink, keyId }: { s: MemoStroke; ink: string; keyId: string }) {
  const stroke = s.c === INK ? ink : s.c
  const k = kindOf(s)
  const common = { fill: 'none', stroke, strokeWidth: s.w, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const [x1, y1, x2, y2] = s.p

  if (k === 'hl') {
    // 형광펜 — 굵고 반투명. 끝을 각지게 두어 형광펜 자국처럼 보이게 한다
    return <polyline key={keyId} {...common} points={pointsOf(s.p)} strokeOpacity={HL_ALPHA} strokeLinecap="butt" />
  }
  if (k === 'rect') {
    return <rect key={keyId} {...common} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} rx={4} />
  }
  if (k === 'ellipse') {
    return <ellipse key={keyId} {...common} cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} rx={Math.abs(x2 - x1) / 2} ry={Math.abs(y2 - y1) / 2} />
  }
  if (k === 'line') {
    return <line key={keyId} {...common} x1={x1} y1={y1} x2={x2} y2={y2} />
  }
  if (k === 'arrow') {
    // 화살촉 — 끝점에서 몸통 반대 방향으로 두 갈래. 길이는 선 굵기에 비례해 굵은 선에도 균형이 맞는다
    const a = Math.atan2(y2 - y1, x2 - x1)
    const L = s.w * HEAD_LEN
    const p1 = `${x2 - L * Math.cos(a - HEAD_ANGLE)},${y2 - L * Math.sin(a - HEAD_ANGLE)}`
    const p2 = `${x2 - L * Math.cos(a + HEAD_ANGLE)},${y2 - L * Math.sin(a + HEAD_ANGLE)}`
    return (
      <g key={keyId}>
        <line {...common} x1={x1} y1={y1} x2={x2} y2={y2} />
        <polyline {...common} points={`${p1} ${x2},${y2} ${p2}`} />
      </g>
    )
  }
  return <polyline key={keyId} {...common} points={pointsOf(s.p)} />
}

/** 커서와 획 사이 거리 — 꼭짓점이 아니라 **선분까지의 거리**. 도형은 두 점 사이 선분으로 본다 */
function hits(st: MemoStroke, x: number, y: number) {
  const r = ERASE_R + st.w / 2
  const p = st.p
  const k = kindOf(st)
  if (k === 'arrow' || k === 'line') {
    // 두 점 사이 선분까지의 거리
    const [ax, ay, bx, by] = p
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    return Math.hypot(ax + t * dx - x, ay + t * dy - y) <= r
  }
  if (k === 'rect' || k === 'ellipse') {
    // 테두리 근처만 — 안쪽 빈 곳을 문질러 지워지면 아래 화면을 못 쓴다
    const [x1, y1, x2, y2] = p
    const L = Math.min(x1, x2) - r, R = Math.max(x1, x2) + r, T = Math.min(y1, y2) - r, B = Math.max(y1, y2) + r
    const l = Math.min(x1, x2) + r, rr = Math.max(x1, x2) - r, t = Math.min(y1, y2) + r, b = Math.max(y1, y2) - r
    const inOuter = x >= L && x <= R && y >= T && y <= B
    const inInner = x >= l && x <= rr && y >= t && y <= b
    return inOuter && !inInner
  }
  if (p.length <= 2) return Math.hypot((p[0] ?? 0) - x, (p[1] ?? 0) - y) <= r
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], ay = p[i + 1], dx = p[i + 2] - ax, dy = p[i + 3] - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
    if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= r) return true
  }
  return false
}

export default function MemoDraw({ layerRef, initial, onDone, onCancel }: {
  layerRef: React.RefObject<HTMLDivElement | null>
  initial?: MemoStroke[]
  onDone: (strokes: MemoStroke[]) => void
  onCancel: () => void
}) {
  /**
   * 획 이력은 **한 덩어리 상태 + 스냅샷 스택**으로 둔다.
   *
   * ① 한 덩어리인 이유 — 종전에는 done/undone 을 따로 두고 setStrokes 의 갱신 함수 *안에서*
   *    setUndone 을 불렀다. 갱신 함수는 순수해야 하는데(개발 모드에서 일부러 두 번 실행한다)
   *    그 안에서 다른 상태를 바꾸니 실행취소 한 번에 이력이 두 번 쌓여 다시실행이 엉켰다.
   * ② 스냅샷인 이유 — '되돌릴 획'을 하나씩 빼는 방식이면 **지우개로 지운 획이 이력에 안 남는다.**
   *    그리기·지우개·전부 지우기를 모두 '되돌림 지점 하나 + 새 상태'로 통일하면 다 같이 복구된다.
   *
   * erased = 이번 지우개 제스처에서 이미 되돌림 지점을 만들었는지. 지우개는 포인터가 움직일 때마다
   * 호출되므로 이게 없으면 한 번 문지르는 동안 이력이 수십 개 쌓인다.
   */
  type Hist = { past: MemoStroke[][]; cur: MemoStroke[]; future: MemoStroke[][]; erased: boolean }
  const [hist, setHist] = useState<Hist>({ past: [], cur: initial || [], future: [], erased: false })
  const strokes = hist.cur

  const [tool, setTool] = useState<Tool>('pen')
  /** 도형 도구가 지금 그리는 종류 */
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rect')
  /** 도구별 색·굵기 — 캡처 도구처럼 도구마다 따로 기억한다 */
  const [cfg, setCfg] = useState<Record<Exclude<Tool, 'eraser'>, { c: string; w: number }>>({
    pen: { c: INK, w: 3 },
    hl: { c: HL_SOLID.yellow, w: 16 },
    shape: { c: accent.red, w: 3 },
  })
  const [cfgAnchor, setCfgAnchor] = useState<HTMLElement | null>(null)
  const [cfgTool, setCfgTool] = useState<Tool>('pen')
  /** 손그림 도형 인식 — 켜고 끌 수 있어야 한다. 오인식이 거슬리면 바로 꺼야 하니까 */
  const [snap, setSnap] = useState(true)

  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const theme = useTheme()
  /**
   * 'ink' 는 테마 글자색으로 푼다.
   * ⚠ sx 로 넘기면 안 된다 — MUI sx 는 color·bgcolor 처럼 정해진 속성에만 팔레트 경로를 풀어주고
   * stroke 는 그 목록에 없어 'text.primary' 가 그대로 CSS 값이 되어 **선이 안 그려졌다**
   * (2026-08-05 사용자 신고: 검정색 안 그려진다). 그래서 여기서 실제 색으로 바꿔 속성으로 준다.
   */
  const inkColor = theme.palette.text.primary
  const swatch = (c: string) => (c === INK ? inkColor : c)

  // 모두 순수 갱신 하나로 끝난다 — 갱신 함수 안에서 다른 상태·ref 를 건드리지 않는다
  const canUndo = hist.past.length > 0
  const canRedo = hist.future.length > 0
  const undo = () => setHist((h) => (h.past.length === 0 ? h
    : { past: h.past.slice(0, -1), cur: h.past[h.past.length - 1], future: [h.cur, ...h.future], erased: false }))
  const redo = () => setHist((h) => (h.future.length === 0 ? h
    : { past: [...h.past, h.cur], cur: h.future[0], future: h.future.slice(1), erased: false }))
  const clearAll = () => setHist((h) => (h.cur.length === 0 ? h
    : { past: [...h.past, h.cur], cur: [], future: [], erased: false }))

  /**
   * 키보드 — Ctrl/⌘+Z 실행취소 · Ctrl/⌘+Shift+Z(또는 Ctrl+Y) 다시실행 · Esc 그리기 닫기.
   * onCancel 은 ref 로 잡아 리스너를 한 번만 건다(부모가 매 렌더 새 함수를 넘겨도 재등록되지 않게).
   *
   * ⚠ 입력칸 안에서는 Ctrl+Z 를 가로채지 않는다 — 그리는 중에도 쪽지 답글칸·검색창은 살아 있어서
   * 거기서 글자를 되돌리려던 Ctrl+Z 가 그림을 되돌려 버렸다.
   */
  const cancelRef = useRef(onCancel)
  cancelRef.current = onCancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cancelRef.current(); return }
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, [contenteditable="true"]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 지우개 — 지나간 자리에 걸린 획을 통째로 지운다. 되돌림 지점은 제스처당 한 번만 쌓는다 */
  const eraseAt = (x: number, y: number, start = false) =>
    setHist((h) => {
      const cur = h.cur.filter((st) => !hits(st, x, y))
      if (cur.length === h.cur.length) return start && h.erased ? { ...h, erased: false } : h
      const fresh = start || !h.erased
      return { past: fresh ? [...h.past, h.cur] : h.past, cur, future: [], erased: true }
    })

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
    if (tool === 'eraser') return eraseAt(p[0], p[1], true)
    const { c, w } = cfg[tool]
    // 도형은 시작·끝 두 점으로 시작한다(끝점은 move 가 갱신). 새로 그으면 다시실행 이력은 끊는다
    const seed: MemoStroke = tool === 'shape'
      ? { c, w, p: [p[0], p[1], p[0], p[1]], k: shapeKind }
      : { c, w, p, ...(tool === 'hl' ? { k: 'hl' as const } : {}) }
    setHist((h) => ({ past: [...h.past, h.cur], cur: [...h.cur, seed], future: [], erased: false }))
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = at(e)
    if (!p) return
    if (tool === 'eraser') return eraseAt(p[0], p[1])
    setHist((h) => {
      const last = h.cur[h.cur.length - 1]
      if (!last) return h
      if (tool === 'shape') {
        // 도형 — 끝점만 갈아 끼운다
        if (last.p[2] === p[0] && last.p[3] === p[1]) return h
        return { ...h, cur: [...h.cur.slice(0, -1), { ...last, p: [last.p[0], last.p[1], p[0], p[1]] }] }
      }
      // 같은 자리 반복 점은 버린다 — 저장 용량과 렌더 비용이 그냥 늘어난다
      const n = last.p.length
      if (last.p[n - 2] === p[0] && last.p[n - 1] === p[1]) return h
      return { ...h, cur: [...h.cur.slice(0, -1), { ...last, p: [...last.p, ...p] }] }
    })
  }
  /**
   * 손을 떼는 순간 — 펜으로 그린 마지막 획을 도형으로 알아본다(켜져 있을 때만).
   *
   * 바꿀 때 되돌림 지점을 **하나 더** 쌓는다. 잘못 알아봤을 때 Ctrl+Z 한 번으로 손그림이
   * 그대로 돌아오게 하려는 것 — 오인식이 이 기능의 유일한 위험이라 되돌리는 길이 반드시 있어야 한다.
   */
  const up = () => {
    drawing.current = false
    if (!snap || tool !== 'pen') return
    setHist((h) => {
      const last = h.cur[h.cur.length - 1]
      if (!last) return h
      // ① 직선 끝에 덧그린 짧은 획이면 화살촉으로 보고 앞 획과 합친다(획을 떼어 그린 화살표)
      const prev = h.cur[h.cur.length - 2]
      if (!last.k && prev) {
        const merged = mergeArrowHead(prev, last)
        if (merged) return { past: [...h.past, h.cur], cur: [...h.cur.slice(0, -2), merged], future: [], erased: false }
      }
      // ② 한 획으로 그린 도형이면 그 도형으로
      if (last.k) return h
      const s = snapStroke(last)
      if (!s) return h
      return { past: [...h.past, h.cur], cur: [...h.cur.slice(0, -1), s], future: [], erased: false }
    })
  }

  /**
   * 도구 버튼 — **한 번 클릭 = 선택 + 색·굵기 창 열림**(사용자 확정 2026-08-06).
   * 처음엔 캡처 도구처럼 '선택된 것을 한 번 더 누르면 설정'이었는데 두 단계 조작을 되돌렸다.
   * 그래서 쐐기 화살표도 모든 도구에 붙는다 — 누르면 창이 열린다는 표시가 이제 사실이므로.
   */
  const pickTool = (t: Tool, el: HTMLElement) => {
    setTool(t)
    setCfgTool(t)
    setCfgAnchor(el)
  }

  const isEraserCfg = cfgTool === 'eraser'
  const cur = isEraserCfg ? { c: INK, w: 0 } : cfg[cfgTool]
  const palette = cfgTool === 'hl' ? HL_COLORS : LINE_COLORS
  const [wMin, wMax] = isEraserCfg ? [0, 1] : WIDTH_RANGE[cfgTool]

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
          pointerEvents: 'auto', cursor: tool === 'eraser' ? ERASER_CURSOR : 'crosshair', touchAction: 'none',
          overflow: 'visible', // 판 밖(여백)까지 끌고 나간 획도 그려야 저장 결과와 화면이 같다
          zIndex: 5,
        }}
      >
        {strokes.map((s, i) => <StrokeShape key={i} keyId={String(i)} s={s} ink={inkColor} />)}
      </Box>

      {/* 도구 — 화면 아래 가운데 고정. 그림을 가리지 않게 낮게 둔다 */}
      <Box
        sx={{
          position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 1.5, py: 1, borderRadius: `${radius.pill}px`,
          bgcolor: 'background.paper', border: 1, borderColor: 'divider',
          boxShadow: shadow.lg, zIndex: z.stickyMemo + 1, pointerEvents: 'auto',
        }}
      >
        {TOOLS.map(({ key, label, Icon }) => {
          const on = tool === key
          return (
            <Tooltip key={key} title={key === 'eraser' ? '지우개 — 지나간 획을 지웁니다' : `${label} — 색·굵기 선택`}>
              <IconButton
                size="small"
                aria-label={label}
                aria-pressed={on}
                onClick={(e) => pickTool(key, e.currentTarget)}
                sx={{
                  color: on ? 'text.primary' : 'text.secondary',
                  bgcolor: on ? 'action.selected' : 'transparent',
                  borderRadius: `${radius.chip}px`,
                  pr: '2px',
                }}
              >
                {/* 선택한 색은 **펜·형광펜의 채움 레이어에만** 들어간다(사용자 지정 2026-08-06).
                    지우개·도형은 늘 윤곽 그대로 — snipIcons 주석 참조 */}
                <Icon
                  sx={{ fontSize: TOOL_ICON }}
                  ink={key === 'pen' || key === 'hl' ? swatch(cfg[key].c) : undefined}
                />
                {/* 쐐기 화살표 — 모든 도구에. 클릭 한 번으로 창이 열리는 조작이라(위 pickTool 주석)
                    '누르면 뭐가 뜬다'는 표시가 모든 버튼에서 사실이다 */}
                <ArrowDropUpIcon sx={{ fontSize: typescale.emphasis.size, ml: '-2px', mr: '-4px', opacity: 0.7 }} />
              </IconButton>
            </Tooltip>
          )
        })}

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        {/* 손그림 도형 인식 켜기/끄기 — 오인식이 이 기능의 유일한 위험이라 끄는 길을 눈에 보이게 둔다 */}
        <Tooltip title={snap ? '도형 인식 끄기 — 지금은 대충 그린 네모·원·화살표를 반듯하게 바꿉니다' : '도형 인식 켜기'}>
          <IconButton
            size="small"
            aria-label="도형 인식"
            aria-pressed={snap}
            onClick={() => setSnap((v) => !v)}
            sx={{ color: snap ? 'primary.main' : 'text.disabled', bgcolor: snap ? 'action.selected' : 'transparent', borderRadius: `${radius.chip}px` }}
          >
            <AutoAwesomeIcon sx={{ fontSize: typescale.cardTitle.size }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Tooltip title="실행취소 (Ctrl+Z)">
          <span>
            <IconButton size="small" aria-label="실행취소" disabled={!canUndo} onClick={undo}>
              <UndoIcon sx={{ fontSize: typescale.cardTitle.size }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="다시실행 (Ctrl+Shift+Z)">
          <span>
            <IconButton size="small" aria-label="다시실행" disabled={!canRedo} onClick={redo}>
              <RedoIcon sx={{ fontSize: typescale.cardTitle.size }} />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Button size="small" onClick={onCancel} sx={{ color: 'text.secondary', fontWeight: weight.medium }}>취소 (Esc)</Button>
        {/* 점 하나짜리 획(제자리 클릭)은 버린다 — polyline 은 점 하나를 안 그리므로
            화면에는 아무것도 없는데 저장만 되는 '보이지 않는 그림'이 생긴다 */}
        <Button size="small" variant="contained" onClick={() => onDone(strokes.filter((s) => s.k || s.p.length >= 4))}>완료</Button>
      </Box>

      {/* 도구 설정 — 색 + 굵기 + 미리보기(캡처 도구와 같은 구성) */}
      <Popover
        open={!!cfgAnchor}
        anchorEl={cfgAnchor}
        onClose={() => setCfgAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // 폭 = 색 견본 한 줄(5개×26 + 간격 4×6 + 안쪽 여백 24 ≈ 178)이 꼭 들어가는 만큼만(사용자 지시)
        slotProps={{ paper: { sx: { p: 1.5, width: isEraserCfg ? 170 : 186, borderRadius: `${radius.modal}px` } } }}
      >
        {isEraserCfg ? (
          // 지우개 설정 — '전부 지우기'를 여기로 옮겼다(사용자 지시 2026-08-06).
          // 도구 줄에 늘 떠 있으면 실수로 누르기 쉬운 버튼이라, 한 단계 안으로 넣는 편이 안전하다.
          <Button
            fullWidth
            size="small"
            startIcon={<LayersClearIcon sx={{ fontSize: typescale.cardTitle.size }} />}
            disabled={strokes.length === 0}
            onClick={() => { clearAll(); setCfgAnchor(null) }}
            sx={{ color: 'text.secondary', justifyContent: 'flex-start' }}
          >
            전부 지우기
          </Button>
        ) : (
        <>
        {/* 도형 종류 — 버튼 셋을 도구 줄에 늘어놓는 대신 여기서 고른다(사용자 지시 2026-08-06) */}
        {cfgTool === 'shape' && (
          <>
            <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mb: 0.75 }}>도형</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
              {SHAPE_KINDS.map(({ k, label, Icon }) => (
                <Tooltip key={k} title={label}>
                  <IconButton
                    size="small"
                    aria-label={label}
                    aria-pressed={shapeKind === k}
                    onClick={() => setShapeKind(k)}
                    sx={{
                      borderRadius: `${radius.chip}px`,
                      color: shapeKind === k ? 'primary.main' : 'text.secondary',
                      bgcolor: shapeKind === k ? 'action.selected' : 'transparent',
                      border: 1, borderColor: shapeKind === k ? 'primary.main' : 'divider',
                    }}
                  >
                    <Icon sx={{ fontSize: typescale.cardTitle.size }} />
                  </IconButton>
                </Tooltip>
              ))}
            </Box>
          </>
        )}
        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mb: 0.75 }}>색</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
          {palette.map((p) => (
            <Tooltip key={p.c} title={p.label}>
              <Box
                component="button"
                aria-label={p.label}
                aria-pressed={cur.c === p.c}
                onClick={() => setCfg((m) => ({ ...m, [cfgTool]: { ...m[cfgTool], c: p.c } }))}
                sx={{
                  width: 26, height: 26, p: 0, cursor: 'pointer', borderRadius: radius.circle,
                  bgcolor: swatch(p.c),
                  border: cur.c === p.c ? '3px solid' : '1px solid',
                  borderColor: cur.c === p.c ? 'primary.main' : 'divider',
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled' }}>굵기</Typography>
        {/* 미리보기 — 고른 색·굵기 그대로 그은 **일자 선**(사용자 지시 2026-08-06).
            곡선·도형으로 보여주면 굵기보다 모양에 눈이 가서 정작 굵기 차이가 안 읽힌다. */}
        <Box component="svg" viewBox="0 0 210 40" sx={{ width: '100%', height: 40, display: 'block', my: 0.5 }}>
          <StrokeShape
            keyId="preview"
            ink={inkColor}
            s={{ c: cur.c, w: cur.w, k: cfgTool === 'hl' ? 'hl' : 'line', p: [12, 20, 198, 20] }}
          />
        </Box>
        <Slider
          size="small"
          min={wMin}
          max={wMax}
          step={0.5}
          value={cur.w}
          onChange={(_, v) => setCfg((m) => ({ ...m, [cfgTool]: { ...m[cfgTool], w: v as number } }))}
          aria-label="굵기"
        />
        </>
        )}
      </Popover>
    </>
  )
}
