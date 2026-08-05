import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useTheme } from '@mui/material/styles'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import LayersClearIcon from '@mui/icons-material/LayersClear'
// MUI 아이콘 세트에 '지우개' 전용 글리프가 없다(*Eraser* 는 PhonelinkErase 뿐).
// 칠판 지우개에 가장 가까운 청소용 브러시로 대신한다 — 수제 SVG 금지 규칙(CLAUDE.md) 때문에 직접 그리지 않는다.
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import { accent, radius, shadow, typescale, weight, z } from '@/theme/tokens'
import type { MemoStroke } from '@/api/improve'

/**
 * 펜 색. 'ink' 는 고정색이 아니라 **테마 글자색**으로 풀린다(라이트=검정 / 다크=흰색).
 * 검정을 그대로 저장하면 다크 테마에서 배경에 묻혀 안 보인다 — 같은 그림을 두 테마에서
 * 다 봐야 하므로 색이 아니라 '먹'이라는 뜻으로 저장한다.
 */
export const INK = 'ink'
const PENS: { key: string; color: string; label: string }[] = [
  { key: 'ink', color: INK, label: '검정' },
  { key: 'red', color: accent.red, label: '빨강' },
  { key: 'amber', color: accent.amber, label: '노랑' },
  { key: 'blue', color: accent.blue, label: '파랑' },
]
const WIDTHS = [3, 6]
/** 지우개 판정 반경(px) — 이 안에 획의 점이 하나라도 있으면 그 획을 통째로 지운다 */
const ERASE_R = 14

/**
 * 지우개 커서 — 도구 아이콘과 같은 그림으로(사용자 지시 2026-08-05).
 * 기본 커서 중에는 지우개가 없어 'cell'(십자)을 썼더니 더하기처럼 보였다.
 * path 는 @mui/icons-material/CleaningServices 의 것을 그대로 옮긴 값이라 아이콘과 정확히 같다
 * (수제 그림이 아니라 같은 아이콘의 재사용 — CLAUDE.md 아이콘 규칙과 어긋나지 않는다).
 * 커서는 CSS url() 이라 currentColor 를 못 쓴다 → 흰 테두리를 덧대 밝은/어두운 배경 양쪽에서 보이게 한다.
 */
const ERASER_PATH = 'M16 11h-1V3c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v8H8c-2.76 0-5 2.24-5 5v7h18v-7c0-2.76-2.24-5-5-5m3 10h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3h-2v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H9v-3c0-.55-.45-1-1-1s-1 .45-1 1v3H5v-5c0-1.65 1.35-3 3-3h8c1.65 0 3 1.35 3 3z'
const ERASER_CURSOR =
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24"><path d="${ERASER_PATH}" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  )}") 13 22, cell`

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
  /**
   * 획 이력은 **한 덩어리 상태 + 스냅샷 스택**으로 둔다.
   *
   * ① 한 덩어리인 이유 — 종전에는 done/undone 을 따로 두고 setStrokes 의 갱신 함수 *안에서*
   *    setUndone 을 불렀다. 갱신 함수는 순수해야 하는데(개발 모드에서 일부러 두 번 실행한다)
   *    그 안에서 다른 상태를 바꾸니 실행취소 한 번에 이력이 두 번 쌓여 다시실행이 엉켰다
   *    (2026-08-05 사용자 신고: undo 가 이상하다).
   * ② 스냅샷인 이유 — '되돌릴 획'을 하나씩 빼는 방식이면 **지우개로 지운 획이 이력에 안 남는다.**
   *    A·B·C 를 그리고 지우개로 A 를 지운 뒤 Ctrl+Z 를 누르면, 이력에는 지운 기록이 없으니
   *    멀쩡한 C 가 대신 사라지고 A 는 영영 못 돌아왔다(2026-08-05 전수검사에서 확인).
   *    그리기·지우개·전부 지우기를 모두 '되돌림 지점 하나 + 새 상태'로 통일하면 다 같이 복구된다.
   *
   * erased = 이번 지우개 제스처에서 이미 되돌림 지점을 만들었는지. 지우개는 포인터가 움직일 때마다
   * 호출되므로 이게 없으면 한 번 문지르는 동안 이력이 수십 개 쌓인다.
   */
  type Hist = { past: MemoStroke[][]; cur: MemoStroke[]; future: MemoStroke[][]; erased: boolean }
  const [hist, setHist] = useState<Hist>({ past: [], cur: initial || [], future: [], erased: false })
  const strokes = hist.cur
  const [pen, setPen] = useState(PENS[0])
  const [width, setWidth] = useState(WIDTHS[0])
  const [erasing, setErasing] = useState(false)
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
  const strokeOf = (c: string) => (c === INK ? inkColor : c)

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
   * 거기서 글자를 되돌리려던 Ctrl+Z 가 그림을 되돌려 버렸다(2026-08-05 전수검사에서 확인).
   * Esc 는 어디서 눌러도 그리기를 닫는 게 맞으므로 이 검사 위에 둔다.
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

  /**
   * 커서와 획 사이 거리 — **꼭짓점이 아니라 선분까지의 거리**로 잰다.
   * 점만 보면 빠르게 그은 직선은 점이 양 끝에만 있어서 한가운데를 아무리 문질러도 안 지워졌다
   * (2026-08-05 전수검사에서 확인). 굵은 획일수록 더 관대하게 잡는다.
   */
  const hits = (st: MemoStroke, x: number, y: number) => {
    const r = ERASE_R + st.w / 2
    const p = st.p
    if (p.length <= 2) return Math.hypot((p[0] ?? 0) - x, (p[1] ?? 0) - y) <= r
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i], ay = p[i + 1], dx = p[i + 2] - ax, dy = p[i + 3] - ay
      const len2 = dx * dx + dy * dy
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2))
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= r) return true
    }
    return false
  }

  /**
   * 지우개 — 지나간 자리에 걸린 획을 통째로 지운다(선 일부만 지우는 방식은 과함).
   * start = 제스처 시작(포인터 누름). 되돌림 지점은 **제스처당 한 번만** 쌓는다.
   */
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
    if (erasing) return eraseAt(p[0], p[1], true)
    // 새로 그으면 다시실행 이력은 끊는다(편집기 표준)
    setHist((h) => ({ past: [...h.past, h.cur], cur: [...h.cur, { c: pen.color, w: width, p }], future: [], erased: false }))
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const p = at(e)
    if (!p) return
    if (erasing) return eraseAt(p[0], p[1])
    setHist((h) => {
      const last = h.cur[h.cur.length - 1]
      if (!last) return h
      // 같은 자리 반복 점은 버린다 — 저장 용량과 렌더 비용이 그냥 늘어난다
      const n = last.p.length
      if (last.p[n - 2] === p[0] && last.p[n - 1] === p[1]) return h
      return { ...h, cur: [...h.cur.slice(0, -1), { ...last, p: [...last.p, ...p] }] }
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
          pointerEvents: 'auto', cursor: erasing ? ERASER_CURSOR : 'crosshair', touchAction: 'none',
          overflow: 'visible', // 판 밖(여백)까지 끌고 나간 획도 그려야 저장 결과와 화면이 같다
          zIndex: 5,
        }}
      >
        {strokes.map((s, i) => (
          <polyline
            key={i}
            points={pointsOf(s.p)}
            fill="none"
            stroke={strokeOf(s.c)}
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
              onClick={() => { setPen(p); setErasing(false) }}
              sx={{
                width: 24, height: 24, p: 0, borderRadius: radius.circle, cursor: 'pointer',
                bgcolor: strokeOf(p.color),
                border: !erasing && pen.key === p.key ? '3px solid' : '1px solid',
                borderColor: !erasing && pen.key === p.key ? 'primary.main' : 'divider',
              }}
            />
          </Tooltip>
        ))}

        <Tooltip title="지우개 — 지나간 획을 지웁니다">
          <IconButton
            size="small"
            aria-label="지우개"
            aria-pressed={erasing}
            onClick={() => setErasing((v) => !v)}
            sx={{ color: erasing ? 'primary.main' : 'text.secondary', bgcolor: erasing ? 'action.selected' : 'transparent' }}
          >
            <CleaningServicesIcon sx={{ fontSize: typescale.cardTitle.size }} />
          </IconButton>
        </Tooltip>

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
        <Tooltip title="전부 지우기">
          <span>
            <IconButton size="small" aria-label="전부 지우기" disabled={strokes.length === 0} onClick={clearAll}>
              <LayersClearIcon sx={{ fontSize: typescale.cardTitle.size }} />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ width: '1px', height: 20, bgcolor: 'divider', mx: 0.5 }} />

        <Button size="small" onClick={onCancel} sx={{ color: 'text.secondary', fontWeight: weight.medium }}>취소 (Esc)</Button>
        {/* 점 하나짜리 획(제자리 클릭)은 버린다 — polyline 은 점 하나를 안 그리므로
            화면에는 아무것도 없는데 저장만 되는 '보이지 않는 그림'이 생긴다 */}
        <Button size="small" variant="contained" onClick={() => onDone(strokes.filter((s) => s.p.length >= 4))}>완료</Button>
      </Box>
    </>
  )
}
