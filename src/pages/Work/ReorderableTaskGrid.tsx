import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { taskTitle } from './workMeta'
import DragToken from './DragToken'
import { gatherToToken, genieOverlayInto, trashAt, zoneAt, TOKEN_SIZE, TOKEN_SCALE, type DropZone, type StatusDropResult } from './dropZones'

// 시안(docs/mockups/work-card-reorder.html · work-drag-trash.html) 물리값
const ACTIVATION_DISTANCE = 8 // px 이상 움직여야 드래그 시작(마우스)
const TOUCH_HOLD_MS = 250 // 터치는 길게 눌러야 시작(스크롤과 구분)
const SLOT_OVERLAP = 0.28 // 다른 슬롯으로 이동 판정 최소 겹침 비율
const RETURN_OVERLAP = 0.2 // 원위치 복귀 판정 최소 겹침 비율
const MOVE_DURATION = 180 // 이동 애니메이션(ms)
const CLICK_SUPPRESS_MS = 350 // 드롭 직후 클릭(카드 선택) 억제

interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }

interface Props {
  /** 확정된 표시 순서의 진행중 카드들 */
  items: WorkItem[]
  /** 카드 본문 렌더 (TaskAccordion 또는 수정 인라인 폼) */
  renderCard: (t: WorkItem) => React.ReactNode
  /** 이 카드를 드래그할 수 있는지(수정 중·비관리자는 false) */
  canDrag: (t: WorkItem) => boolean
  /** 드롭으로 순서가 실제 바뀌었을 때만 호출 — 최종 num 순서 */
  onReorder: (orderedNums: string[]) => void
  /** 복수선택 상태(선택 시각·복수 드래그) */
  selectedNums?: Set<string>
  /** 일반=단일선택 / toggle(Cmd·Ctrl)=추가·해제 / shift=범위 */
  onSelectToggle?: (num: string, mods: { shift: boolean; toggle: boolean }) => void
  /** 선택 안 된 카드를 잡음 — 부모가 그 카드만 선택 */
  onDragStartCard?: (num: string) => void
  /** KPI 드롭존에 놓음 — null=변경 없음(원위치 복귀) */
  onStatusDrop?: (nums: string[], zone: DropZone) => StatusDropResult
  /** 드래그 시작/존 변경/종료 알림(KPI 강조용) */
  onZoneChange?: (dragging: boolean, zone: DropZone | null) => void
  /** 카드 더블클릭 — 수정모드 진입(부모가 권한 확인) */
  onCardDoubleClick?: (num: string) => void
  /** 휴지통에 드롭 — 흡입 없이 삭제 확인부터(부모가 확인창·흡입·삭제 담당). at=토큰 중심 좌표 */
  onDeleteDrop?: (nums: string[], at: { x: number; y: number }) => void
  /** 휴지통 위 진입/이탈(부모 휴지통 강조용) */
  onTrashHover?: (hover: boolean) => void
  /** 삭제 확인 대기 카드(흐림) — 부모의 확인창 라이프사이클 동안 유지 */
  awaitingNums?: Set<string>
  /** 삭제 확정(흡입 후) — 대기 카드를 숨김 */
  awaitingHidden?: boolean
  /** 그리드 첫 칸에 렌더할 요소(새 업무 인라인 작성카드) — 드래그·선택 대상 아님 */
  leading?: React.ReactNode
}

const overlap = (a: Rect, b: DOMRect): number => {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return (w * h) / Math.max(1, a.width * a.height)
}

/**
 * 진행중 업무카드 삽입정렬 드래그 그리드 + KPI 상태변경 드롭 + 휴지통 삭제.
 * - 핸들 없이 카드 전체를 잡아 이동(버튼·링크 제외). 짧은 클릭은 카드 선택.
 * - swap이 아닌 삽입정렬: A를 D 자리로 옮기면 B-C-D-A. 원래 순서 기준으로 매번 목적지 재계산(누적오차 없음).
 * - 드래그 중 목적지 placeholder 표시 + 영향 카드 FLIP 애니메이션. drag-active 동안 hover 테두리 억제.
 * - 드래그 시작 시 카드가 포인터로 모이며 50% 정사각 토큰으로 모핑. 크기는 드롭까지 불변.
 * - KPI 드롭 시 지니 흡입 후 상태변경 / 휴지통 드롭은 흡입 없이 부모에 확인 위임.
 * - 복수선택 카드 중 하나를 잡으면 전체가 스택 토큰으로 함께 이동(복수는 존·휴지통 전용, 삽입정렬 없음).
 * - 마우스 8px / 터치 250ms 롱프레스로 시작. Esc·취소 시 원위치. 저장은 부모가 담당.
 */
export default function ReorderableTaskGrid({
  items, renderCard, canDrag, onReorder,
  selectedNums, onSelectToggle, onDragStartCard, onStatusDrop, onZoneChange,
  onCardDoubleClick, onDeleteDrop, onTrashHover, awaitingNums, awaitingHidden, leading,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const flipRects = useRef(new Map<string, DOMRect>())

  const [dragNum, setDragNum] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState(0)
  const [multiCount, setMultiCount] = useState(0)
  const [overTrash, setOverTrash] = useState(false) // 토큰 danger 톤
  // 존 드롭 → 흡입 동안 숨길 카드(상태 기반 — 드래그 카드는 placeholder로 언마운트돼 있어
  // cellRefs 명령형 숨김이 닿지 않고, 패치 후 목록에 남는 카드는 inline 스타일이 잔존하므로)
  const [hidingNums, setHidingNums] = useState<Set<string>>(new Set())

  // 최신 props/상태를 이벤트 핸들러에서 읽기 위한 ref
  const itemsRef = useRef(items); itemsRef.current = items
  const canDragRef = useRef(canDrag); canDragRef.current = canDrag
  const onReorderRef = useRef(onReorder); onReorderRef.current = onReorder
  const selectedRef = useRef(selectedNums); selectedRef.current = selectedNums
  const onSelectToggleRef = useRef(onSelectToggle); onSelectToggleRef.current = onSelectToggle
  const onDragStartCardRef = useRef(onDragStartCard); onDragStartCardRef.current = onDragStartCard
  const onStatusDropRef = useRef(onStatusDrop); onStatusDropRef.current = onStatusDrop
  const onZoneChangeRef = useRef(onZoneChange); onZoneChangeRef.current = onZoneChange
  const onCardDoubleClickRef = useRef(onCardDoubleClick); onCardDoubleClickRef.current = onCardDoubleClick
  const onDeleteDropRef = useRef(onDeleteDrop); onDeleteDropRef.current = onDeleteDrop
  const onTrashHoverRef = useRef(onTrashHover); onTrashHoverRef.current = onTrashHover
  const trashHoverRef = useRef(false) // 휴지통 위 여부
  const overIndexRef = useRef(0)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; multiNums: string[] | null; baseOrder: string[]; slotRects: DOMRect[]; originIndex: number; width: number; height: number; offsetX: number; offsetY: number }>(null)
  const zoneRef = useRef<null | { zone: DropZone; rect: DOMRect }>(null)
  const longPress = useRef<number | null>(null)
  const lastPointer = useRef({ x: 0, y: 0 })
  const suppressClickUntil = useRef(0)

  const baseNums = items.map((i) => i.num)

  // 드래그 중 표시 순서 = 원래 순서에서 드래그 카드를 overIndex 위치로 삽입(원본 기준 재계산)
  let displayNums = baseNums
  let dragItem: WorkItem | undefined
  if (dragNum) {
    const rest = baseNums.filter((n) => n !== dragNum)
    const idx = Math.max(0, Math.min(overIndex, rest.length))
    displayNums = [...rest.slice(0, idx), dragNum, ...rest.slice(idx)]
    dragItem = items.find((i) => i.num === dragNum)
  }

  // FLIP — 렌더 후 위치 변화한 카드를 이전 위치에서 새 위치로 애니메이션(드래그 중에만)
  useLayoutEffect(() => {
    const dragging = !!drag.current
    cellRefs.current.forEach((el, num) => {
      if (num === dragNum) return
      const now = el.getBoundingClientRect()
      const prev = flipRects.current.get(num)
      if (dragging && prev && (Math.abs(prev.left - now.left) > 0.5 || Math.abs(prev.top - now.top) > 0.5)) {
        el.getAnimations?.().forEach((a) => a.cancel())
        el.animate(
          [{ transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` }, { transform: 'translate(0,0)' }],
          { duration: MOVE_DURATION, easing: 'cubic-bezier(.2,.8,.2,1)' },
        )
      }
      flipRects.current.set(num, now)
    })
  })

  const onSelectStart = (e: Event) => e.preventDefault() // 드래그 중 텍스트 선택 방지
  const cleanupListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('selectstart', onSelectStart)
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
  }
  const cleanupPending = () => { pending.current = null; cleanupListeners() }

  const detectTargetIndex = (moving: Rect): number => {
    const d = drag.current
    if (!d) return overIndexRef.current
    let best = overIndexRef.current
    let bestScore = 0
    d.slotRects.forEach((slot, i) => {
      const s = overlap(moving, slot)
      if (s > bestScore) { bestScore = s; best = i }
    })
    if (best === d.originIndex && bestScore >= RETURN_OVERLAP) return best
    if (best !== overIndexRef.current && bestScore >= SLOT_OVERLAP) return best
    return overIndexRef.current
  }

  const beginDrag = (clientX: number, clientY: number) => {
    const p = pending.current
    if (!p || drag.current) return
    const nums = itemsRef.current.map((i) => i.num)
    const originIndex = nums.indexOf(p.num)
    if (originIndex < 0) return
    const slotRects: DOMRect[] = []
    for (const n of nums) {
      const el = cellRefs.current.get(n)
      if (!el) return // 측정 불가 → 시작 안 함
      slotRects.push(el.getBoundingClientRect())
    }
    // 복수 드래그 — 선택된 카드를 잡으면 선택 전체(표시 순서), 아니면 그 카드만 선택 후 한 장
    const sel = selectedRef.current
    let multiNums: string[] | null = null
    if (sel && sel.has(p.num) && sel.size > 1) {
      multiNums = nums.filter((n) => sel.has(n))
    } else if (sel && sel.size > 0 && !sel.has(p.num)) {
      onDragStartCardRef.current?.(p.num)
    }
    drag.current = {
      num: p.num, multiNums, baseOrder: nums, slotRects, originIndex,
      width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY,
    }
    flipRects.current.clear()
    nums.forEach((n) => { const el = cellRefs.current.get(n); if (el) flipRects.current.set(n, el.getBoundingClientRect()) })
    overIndexRef.current = originIndex
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
    // 카드 → 토큰 모임 모핑(복수는 스태거). 클론은 렌더 전 rect 기준이라 placeholder 전환과 자연 연결.
    const gatherNums = multiNums ?? [p.num]
    gatherNums.forEach((n, i) => { const el = cellRefs.current.get(n); if (el) gatherToToken(el, clientX, clientY, i) })
    // 텍스트 선택 방지: 기존 선택 해제 + 드래그 동안 selectstart 차단
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', onSelectStart)
    document.body.style.cursor = 'grabbing'
    zoneRef.current = null
    trashHoverRef.current = false
    lastPointer.current = { x: clientX, y: clientY }
    onZoneChangeRef.current?.(true, null)
    setOverTrash(false)
    setMultiCount(multiNums ? multiNums.length : 1)
    setOverIndex(originIndex)
    setDragNum(p.num)
  }

  const onMove = (e: PointerEvent) => {
    if (!pending.current) return
    lastPointer.current = { x: e.clientX, y: e.clientY }
    const dist = Math.hypot(e.clientX - pending.current.startX, e.clientY - pending.current.startY)
    if (!drag.current) {
      if (pending.current.pointerType === 'touch') {
        // 롱프레스 전 이동 = 스크롤로 간주하고 취소(스크롤과 충돌 방지)
        if (dist > ACTIVATION_DISTANCE) cleanupPending()
        return
      }
      if (dist < ACTIVATION_DISTANCE) return
      beginDrag(e.clientX, e.clientY)
    }
    const d = drag.current
    if (!d) return
    e.preventDefault()
    // 토큰은 포인터 중앙 추적 — 크기(스케일)는 드롭 대상과 무관하게 불변
    if (liftedRef.current) {
      liftedRef.current.style.left = `${e.clientX}px`
      liftedRef.current.style.top = `${e.clientY}px`
    }
    // KPI 드롭존 + 휴지통 히트테스트
    const zh = onStatusDropRef.current ? zoneAt(e.clientX, e.clientY) : null
    const prevZone = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prevZone) onZoneChangeRef.current?.(true, zh?.zone ?? null)
    const tr = onDeleteDropRef.current && !zh ? trashAt(e.clientX, e.clientY) : null
    if (!!tr !== trashHoverRef.current) {
      trashHoverRef.current = !!tr
      setOverTrash(!!tr)
      onTrashHoverRef.current?.(!!tr)
    }
    // 존·휴지통 위이거나 복수 드래그면 삽입정렬 이동 없음(원위치 placeholder 유지)
    if (zh || tr || d.multiNums) {
      if (overIndexRef.current !== d.originIndex) { overIndexRef.current = d.originIndex; setOverIndex(d.originIndex) }
      return
    }
    // 삽입정렬 판정은 원본 카드 크기의 가상 사각형으로(토큰 시각과 무관 — 기존 동작 보존)
    const left = e.clientX - d.offsetX
    const top = e.clientY - d.offsetY
    const moving: Rect = { left, top, right: left + d.width, bottom: top + d.height, width: d.width, height: d.height }
    const next = detectTargetIndex(moving)
    if (next !== overIndexRef.current) { overIndexRef.current = next; setOverIndex(next) }
  }

  const finishDrag = (commit: boolean) => {
    const d = drag.current
    document.body.style.cursor = ''
    if (!d) return
    const finalOver = commit ? overIndexRef.current : d.originIndex
    const rest = d.baseOrder.filter((n) => n !== d.num)
    const idx = Math.max(0, Math.min(finalOver, rest.length))
    const finalOrder = [...rest.slice(0, idx), d.num, ...rest.slice(idx)]
    const changed = commit && d.originIndex !== finalOver && !d.multiNums
    drag.current = null
    flipRects.current.clear()
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    trashHoverRef.current = false
    onZoneChangeRef.current?.(false, null)
    onTrashHoverRef.current?.(false)
    setOverTrash(false)
    setDragNum(null)
    setOverIndex(0)
    setMultiCount(0)
    if (changed) onReorderRef.current(finalOrder)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 휴지통 드롭 — 흡입 없이 부모에 확인 위임(단일·복수). 토큰 중심 = 포인터 좌표.
    // 잡은 카드(d.num)를 맨 앞에 — 부모 고정 토큰이 드래그 토큰과 같은 카드 정보를 유지.
    if (d && !zh && trashHoverRef.current && onDeleteDropRef.current) {
      const nums = d.multiNums ? [d.num, ...d.multiNums.filter((n) => n !== d.num)] : [d.num]
      const at = { ...lastPointer.current }
      finishDrag(false)
      cleanupPending()
      onDeleteDropRef.current(nums, at)
      return
    }
    if (d && zh && onStatusDropRef.current) {
      const nums = d.multiNums ?? [d.num]
      const res = onStatusDropRef.current(nums, zh.zone)
      zoneRef.current = null
      if (res) {
        // 변경 카드 즉시 숨김(흡입 중 중복 표시 방지) — 상태 기반이라 placeholder로 언마운트됐던
        // 드래그 카드도 재마운트 즉시 투명. 흡입 후 패치와 함께 해제(목록에 남는 카드는 다시 표시).
        const changed = res.changedNums
        setHidingNums((prev) => new Set([...prev, ...changed]))
        const finalize = res.finalize
        const done = () => {
          finalize()
          setHidingNums((prev) => { const n = new Set(prev); changed.forEach((c) => n.delete(c)); return n })
        }
        const lifted = liftedRef.current
        if (lifted) {
          void genieOverlayInto(lifted, zh.rect).then(done)
        } else {
          done()
        }
        finishDrag(false) // 순서변경 아님 — 존 드롭
        cleanupPending()
        return
      }
      // 변경 없음(같은 상태) — 원위치 복귀
      finishDrag(false)
      cleanupPending()
      return
    }
    zoneRef.current = null
    if (d) finishDrag(true)
    cleanupPending()
  }
  const onCancel = () => { zoneRef.current = null; if (drag.current) finishDrag(false); cleanupPending() }
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }

  const onPointerDown = (e: React.PointerEvent, num: string) => {
    if (pending.current || drag.current) return
    if (e.button !== 0) return // 주 버튼만
    if ((e.target as HTMLElement).closest('button, a')) return // 버튼·링크는 드래그 제외
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.detail >= 2) e.preventDefault() // 수정키 선택·더블클릭 시 텍스트 선택 방지
    const item = itemsRef.current.find((i) => i.num === num)
    if (!item || !canDragRef.current(item)) return
    const el = cellRefs.current.get(num)
    if (!el) return
    const rect = el.getBoundingClientRect()
    pending.current = {
      num, pointerType: e.pointerType || 'mouse',
      startX: e.clientX, startY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, rect,
    }
    lastPointer.current = { x: e.clientX, y: e.clientY }
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKeyDown)
    if (pending.current.pointerType === 'touch') {
      longPress.current = window.setTimeout(() => {
        if (pending.current) beginDrag(lastPointer.current.x, lastPointer.current.y)
      }, TOUCH_HOLD_MS)
    }
  }

  // 클릭 선택(캡처 단계) — 일반=그 카드만 / Cmd·Ctrl=토글 / Shift=범위. 드롭 직후 클릭은 억제.
  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (Date.now() < suppressClickUntil.current) { e.preventDefault(); e.stopPropagation(); return }
    if (!onSelectToggleRef.current) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return
    const item = itemsRef.current.find((i) => i.num === num)
    if (!item || !canDragRef.current(item)) return
    e.preventDefault(); e.stopPropagation()
    onSelectToggleRef.current(num, { shift: e.shiftKey, toggle: e.metaKey || e.ctrlKey })
  }

  const setCellRef = (num: string) => (el: HTMLElement | null) => {
    if (el) cellRefs.current.set(num, el)
    else cellRefs.current.delete(num)
  }

  const draggingMulti = !!dragNum && multiCount > 1

  return (
    <Box
      ref={gridRef}
      onDragStart={(e) => e.preventDefault()} // 네이티브 드래그(텍스트·이미지) 차단
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: `${layout.cardGap}px`,
        // 같은 행 카드 높이 통일(PC 2열): 그리드 행이 가장 높은 카드에 맞춰 늘어나고, 짧은 카드는 하단 여백이 늘어남.
        // 다음 행에는 영향 없음. 모바일 1열은 행마다 카드 1개라 자연 높이.
        alignItems: 'stretch',
        // 드래그 중: 카드 포인터이벤트 차단(hover 억제) + 텍스트 선택 방지
        ...(dragNum ? { '& .reorder-cell': { pointerEvents: 'none' }, userSelect: 'none', WebkitUserSelect: 'none' } : {}),
      }}
    >
      {leading}
      {displayNums.map((num) => {
        if (dragNum && num === dragNum) {
          // 목적지 placeholder(점선) — 드래그 카드 높이만큼 공간 확보
          return (
            <Box
              key="__placeholder__"
              aria-hidden
              sx={(th) => ({
                minHeight: drag.current?.height ?? 120,
                border: '2px dashed', borderColor: alpha(th.palette.accent.green, 0.72),
                bgcolor: alpha(th.palette.accent.green, 0.06), borderRadius: 1,
              })}
            />
          )
        }
        const item = itemsRef.current.find((i) => i.num === num)
        if (!item) return null
        const selected = !!selectedNums?.has(num)
        const isDragSource = draggingMulti && selected
        const awaiting = !!awaitingNums?.has(num)
        return (
          <Box
            key={num}
            className="reorder-cell"
            ref={setCellRef(num)}
            aria-selected={selected}
            onPointerDown={(e) => onPointerDown(e, num)}
            onClickCapture={(e) => onClickCapture(e, num)}
            onDoubleClick={(e) => {
              if (Date.now() < suppressClickUntil.current) return
              if ((e.target as HTMLElement).closest('button, a')) return
              onCardDoubleClickRef.current?.(num)
            }}
            // 카드가 늘어난 셀 높이를 채우도록(높이 통일 시 하단 여백이 카드 내부로) — 자식(카드) height:100%
            sx={(th) => ({
              position: 'relative', minWidth: 0, touchAction: 'pan-y',
              '& > *:first-of-type': { height: '100%' },
              borderRadius: 1,
              // 선택 = 테두리 + 은은한 배경 워시(체크·배지 없음)
              ...(selected ? {
                outline: `2px solid ${alpha(th.palette.accent.blue, 0.9)}`, outlineOffset: '-1px',
                '&::after': { content: '""', position: 'absolute', inset: 0, borderRadius: 1, bgcolor: alpha(th.palette.accent.blue, 0.09), pointerEvents: 'none', zIndex: 1 },
              } : {}),
              ...(isDragSource ? { opacity: 0.35 } : {}),
              ...(awaiting ? { opacity: awaitingHidden ? 0 : 0.32, pointerEvents: 'none' } : {}),
              ...(hidingNums.has(num) ? { opacity: 0, pointerEvents: 'none' } : {}),
              transition: 'opacity .15s',
            })}
          >
            {renderCard(item)}
          </Box>
        )
      })}

      {/* 드래그 토큰(포인터 중앙 추적) — 정사각 50% 고정 스케일, 복수는 스택+N건. 위치는 ref로 명령형 갱신 */}
      {dragNum && dragItem && (
        <Box
          ref={(el: HTMLDivElement | null) => {
            liftedRef.current = el
            if (el) { el.style.left = `${lastPointer.current.x}px`; el.style.top = `${lastPointer.current.y}px` }
          }}
          aria-hidden
          sx={{
            position: 'fixed', zIndex: (th) => th.zIndex.modal + 1,
            width: TOKEN_SIZE, height: TOKEN_SIZE, pointerEvents: 'none',
            transform: `translate(-50%, -50%) scale(${TOKEN_SCALE})`, transformOrigin: '50% 50%',
            opacity: 0, animation: 'workTokenIn .14s ease .12s forwards',
            '@keyframes workTokenIn': { to: { opacity: 0.96 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 0.96 },
          }}
        >
          <DragToken cat={dragItem.cat} title={taskTitle(dragItem)} count={multiCount} danger={overTrash} />
        </Box>
      )}
    </Box>
  )
}
