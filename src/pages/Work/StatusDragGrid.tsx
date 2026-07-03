import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { taskTitle } from './workMeta'
import DragToken from './DragToken'
import { gatherToToken, genieOverlayInto, trashAt, zoneAt, TOKEN_SIZE, TOKEN_SCALE, type DropZone, type StatusDropResult } from './dropZones'

const ACTIVATION_DISTANCE = 8 // px 이상 이동해야 드래그 시작(마우스)
const LONG_PRESS_MS = 480 // 터치 롱프레스 = 복수선택 모드 진입
const CLICK_SUPPRESS_MS = 350

interface Props {
  items: WorkItem[]
  renderCard: (t: WorkItem) => React.ReactNode
  /** 선택·드래그 가능(관리자·수정 중 아님) */
  canDrag: (t: WorkItem) => boolean
  selectedNums: Set<string>
  /** 모바일 복수선택 모드 */
  selMode: boolean
  /** 일반=단일선택 / toggle(Cmd·Ctrl·선택모드 탭)=추가·해제 / shift=범위 */
  onSelectToggle: (num: string, mods: { shift: boolean; toggle: boolean }) => void
  /** 터치 롱프레스 — 선택모드 진입+선택 */
  onLongPress: (num: string) => void
  /** 선택 안 된 카드를 잡음 — 부모가 그 카드만 선택 */
  onDragStartCard: (num: string) => void
  /** 드롭존에 놓음 — null=변경 없음(원위치) */
  onStatusDrop: (nums: string[], zone: DropZone) => StatusDropResult
  /** 드래그 시작/존 변경/종료 알림(KPI 강조용) */
  onZoneChange: (dragging: boolean, zone: DropZone | null) => void
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
}

/**
 * 상태변경 드래그 그리드(보류·Check·완료·Remind 목록 공용) — 삽입정렬 없음.
 * 카드를 잡으면 50% 정사각 토큰으로 모핑되어 KPI 드롭존·휴지통으로 끌 수 있다.
 * 복수선택 시 카드들이 포인터로 모여 스택 토큰(N건 배지)이 된다.
 */
export default function StatusDragGrid({
  items, renderCard, canDrag, selectedNums, selMode,
  onSelectToggle, onLongPress, onDragStartCard, onStatusDrop, onZoneChange,
  onCardDoubleClick, onDeleteDrop, onTrashHover, awaitingNums, awaitingHidden,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const [dragNum, setDragNum] = useState<string | null>(null)
  const [multiCount, setMultiCount] = useState(0)
  const [overTrash, setOverTrash] = useState(false) // 토큰 danger 톤

  const itemsRef = useRef(items); itemsRef.current = items
  const canDragRef = useRef(canDrag); canDragRef.current = canDrag
  const selectedRef = useRef(selectedNums); selectedRef.current = selectedNums
  const selModeRef = useRef(selMode); selModeRef.current = selMode
  const onSelectToggleRef = useRef(onSelectToggle); onSelectToggleRef.current = onSelectToggle
  const onLongPressRef = useRef(onLongPress); onLongPressRef.current = onLongPress
  const onDragStartCardRef = useRef(onDragStartCard); onDragStartCardRef.current = onDragStartCard
  const onStatusDropRef = useRef(onStatusDrop); onStatusDropRef.current = onStatusDrop
  const onZoneChangeRef = useRef(onZoneChange); onZoneChangeRef.current = onZoneChange
  const onCardDoubleClickRef = useRef(onCardDoubleClick); onCardDoubleClickRef.current = onCardDoubleClick
  const onDeleteDropRef = useRef(onDeleteDrop); onDeleteDropRef.current = onDeleteDrop
  const onTrashHoverRef = useRef(onTrashHover); onTrashHoverRef.current = onTrashHover
  const trashHoverRef = useRef(false)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; nums: string[]; width: number; height: number; offsetX: number; offsetY: number }>(null)
  const zoneRef = useRef<null | { zone: DropZone; rect: DOMRect }>(null)
  const longPress = useRef<number | null>(null)
  const lastPointer = useRef({ x: 0, y: 0 })
  const suppressClickUntil = useRef(0)

  const onSelectStart = (e: Event) => e.preventDefault()
  const cleanupListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('selectstart', onSelectStart)
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
  }
  const cleanupPending = () => { pending.current = null; cleanupListeners() }

  const beginDrag = (clientX: number, clientY: number) => {
    const p = pending.current
    if (!p || drag.current) return
    const sel = selectedRef.current
    // 선택 안 된 카드를 잡으면 그 카드만 선택 후 한 장
    let nums: string[]
    if (sel.has(p.num) && sel.size > 1) {
      nums = itemsRef.current.filter((t) => sel.has(t.num)).map((t) => t.num) // 표시 순서
    } else {
      if (sel.size > 0 && !sel.has(p.num)) onDragStartCardRef.current(p.num)
      nums = [p.num]
    }
    drag.current = {
      num: p.num, nums,
      width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY,
    }
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
    // 카드 → 토큰 모임 모핑(복수는 스태거)
    nums.forEach((n, i) => { const el = cellRefs.current.get(n); if (el) gatherToToken(el, clientX, clientY, i) })
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', onSelectStart)
    document.body.style.cursor = 'grabbing'
    zoneRef.current = null
    trashHoverRef.current = false
    lastPointer.current = { x: clientX, y: clientY }
    onZoneChangeRef.current(true, null)
    setOverTrash(false)
    setMultiCount(nums.length)
    setDragNum(p.num)
  }

  const onMove = (e: PointerEvent) => {
    const p = pending.current
    if (!p) return
    lastPointer.current = { x: e.clientX, y: e.clientY }
    const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY)
    if (!drag.current) {
      if (p.pointerType === 'touch') {
        // 롱프레스 전 이동 = 스크롤 — 취소(선택모드 진입 방지)
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
    const zh = zoneAt(e.clientX, e.clientY)
    const prev = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prev) onZoneChangeRef.current(true, zh?.zone ?? null)
    const tr = onDeleteDropRef.current && !zh ? trashAt(e.clientX, e.clientY) : null
    if (!!tr !== trashHoverRef.current) {
      trashHoverRef.current = !!tr
      setOverTrash(!!tr)
      onTrashHoverRef.current?.(!!tr)
    }
  }

  const endDrag = () => {
    document.body.style.cursor = ''
    drag.current = null
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    trashHoverRef.current = false
    onZoneChangeRef.current(false, null)
    onTrashHoverRef.current?.(false)
    setOverTrash(false)
    setDragNum(null)
    setMultiCount(0)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 휴지통 드롭 — 흡입 없이 부모에 확인 위임(단일·복수). 토큰 중심 = 포인터 좌표.
    if (d && !zh && trashHoverRef.current && onDeleteDropRef.current) {
      const nums = [...d.nums]
      const at = { ...lastPointer.current }
      endDrag()
      cleanupPending()
      onDeleteDropRef.current(nums, at)
      return
    }
    if (d && zh) {
      const res = onStatusDropRef.current(d.nums, zh.zone)
      if (res) {
        // 변경 카드 즉시 숨김(흡입 중 중복 표시 방지) — 패치 후 목록에서 자연 제거
        for (const n of res.changedNums) {
          const el = cellRefs.current.get(n)
          if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none' }
        }
        const lifted = liftedRef.current
        const finalize = res.finalize
        if (lifted) {
          void genieOverlayInto(lifted, zh.rect).then(finalize)
        } else {
          finalize()
        }
      }
    }
    zoneRef.current = null
    if (drag.current) endDrag()
    cleanupPending()
  }
  const onCancel = () => { zoneRef.current = null; if (drag.current) endDrag(); cleanupPending() }
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }

  const onPointerDown = (e: React.PointerEvent, num: string) => {
    if (pending.current || drag.current) return
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return
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
      // 터치 롱프레스 = 복수선택 모드 진입(+해당 카드 선택)
      longPress.current = window.setTimeout(() => {
        if (pending.current) {
          suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
          onLongPressRef.current(num)
          cleanupPending()
        }
      }, LONG_PRESS_MS)
    }
  }

  // 클릭 선택(캡처 단계) — 일반=그 카드만 / Cmd·Ctrl·선택모드 탭=토글 / Shift=범위
  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (Date.now() < suppressClickUntil.current) { e.preventDefault(); e.stopPropagation(); return }
    if ((e.target as HTMLElement).closest('button, a, input, textarea')) return // 메뉴·링크는 통과
    const item = itemsRef.current.find((i) => i.num === num)
    if (!item || !canDragRef.current(item)) return
    e.preventDefault(); e.stopPropagation()
    const toggle = e.metaKey || e.ctrlKey || (selModeRef.current && !e.shiftKey)
    onSelectToggleRef.current(num, { shift: e.shiftKey, toggle })
  }

  const setCellRef = (num: string) => (el: HTMLElement | null) => {
    if (el) cellRefs.current.set(num, el)
    else cellRefs.current.delete(num)
  }

  const dragItem = dragNum ? items.find((i) => i.num === dragNum) : undefined
  const draggingMulti = !!dragNum && multiCount > 1

  return (
    <Box
      ref={rootRef}
      onDragStart={(e) => e.preventDefault()}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: `${layout.cardGap}px`,
        alignItems: 'stretch',
        ...(dragNum ? { '& .sdg-cell': { pointerEvents: 'none' }, userSelect: 'none', WebkitUserSelect: 'none' } : {}),
      }}
    >
      {items.map((t) => {
        const selected = selectedNums.has(t.num)
        const isDragSource = !!dragNum && (t.num === dragNum || (draggingMulti && selected))
        const awaiting = !!awaitingNums?.has(t.num)
        return (
          <Box
            key={t.num}
            className="sdg-cell"
            ref={setCellRef(t.num)}
            aria-selected={selected}
            onPointerDown={(e) => onPointerDown(e, t.num)}
            onClickCapture={(e) => onClickCapture(e, t.num)}
            onDoubleClick={(e) => {
              if (Date.now() < suppressClickUntil.current) return
              if ((e.target as HTMLElement).closest('button, a')) return
              onCardDoubleClickRef.current?.(t.num)
            }}
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
              transition: 'opacity .15s',
            })}
          >
            {renderCard(t)}
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
