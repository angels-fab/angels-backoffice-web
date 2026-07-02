import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { alpha } from '@mui/material/styles'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { dragScale, suckOverlayInto, zoneAt, type DropZone, type StatusDropResult } from './dropZones'

// 시안(docs/mockups/work-card-reorder.html) 물리값
const ACTIVATION_DISTANCE = 8 // px 이상 움직여야 드래그 시작(마우스)
const TOUCH_HOLD_MS = 250 // 터치는 길게 눌러야 시작(스크롤과 구분)
const SLOT_OVERLAP = 0.28 // 다른 슬롯으로 이동 판정 최소 겹침 비율
const RETURN_OVERLAP = 0.2 // 원위치 복귀 판정 최소 겹침 비율
const MOVE_DURATION = 180 // 이동 애니메이션(ms)
const CLICK_SUPPRESS_MS = 350 // 드롭 직후 클릭(카드 열기) 억제

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
  /** Cmd/Ctrl/Shift 클릭 선택 토글 */
  onSelectToggle?: (num: string, mods: { shift: boolean }) => void
  /** 선택 안 된 카드를 잡음 — 부모가 선택 해제 */
  onDragStartCard?: (num: string) => void
  /** KPI 드롭존에 놓음 — null=변경 없음(원위치 복귀) */
  onStatusDrop?: (nums: string[], zone: DropZone) => StatusDropResult
  /** 드래그 시작/존 변경/종료 알림(KPI 강조용) */
  onZoneChange?: (dragging: boolean, zone: DropZone | null) => void
  /** 카드 더블클릭 — 수정모드 진입(부모가 권한 확인) */
  onCardDoubleClick?: (num: string) => void
  /** 카드 영역 좌우 빈 공간에 드롭 — 삭제 확인(단일 드래그만) */
  onDeleteDrop?: (num: string) => void
}

const overlap = (a: Rect, b: DOMRect): number => {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return (w * h) / Math.max(1, a.width * a.height)
}

/**
 * 진행중 업무카드 삽입정렬 드래그 그리드 + KPI 상태변경 드롭.
 * - 핸들 없이 카드 전체를 잡아 이동(버튼·링크 제외). 짧은 클릭은 카드 열기.
 * - swap이 아닌 삽입정렬: A를 D 자리로 옮기면 B-C-D-A. 원래 순서 기준으로 매번 목적지 재계산(누적오차 없음).
 * - 드래그 중 목적지 placeholder 표시 + 영향 카드 FLIP 애니메이션. drag-active 동안 hover 테두리 억제.
 * - KPI 드롭존 접근 시 카드 축소, 드롭 시 흡입 애니메이션 후 상태변경.
 * - 복수선택 카드 중 하나를 잡으면 전체를 스택 미리보기로 함께 이동(복수는 존 드롭 전용, 삽입정렬 없음).
 * - 마우스 8px / 터치 250ms 롱프레스로 시작. Esc·취소 시 원위치. 저장은 부모가 담당.
 */
export default function ReorderableTaskGrid({
  items, renderCard, canDrag, onReorder,
  selectedNums, onSelectToggle, onDragStartCard, onStatusDrop, onZoneChange,
  onCardDoubleClick, onDeleteDrop,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const flipRects = useRef(new Map<string, DOMRect>())

  const [dragNum, setDragNum] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState(0)
  const [multiCount, setMultiCount] = useState(0)

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
  const deleteZoneRef = useRef(false) // 좌우 빈 공간(삭제) 위 여부
  const overIndexRef = useRef(0)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; multiNums: string[] | null; baseOrder: string[]; slotRects: DOMRect[]; originIndex: number; width: number; height: number; offsetX: number; offsetY: number; startLeft: number; startTop: number; scale: number }>(null)
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
    // 복수 드래그 — 선택된 카드를 잡으면 선택 전체(표시 순서), 아니면 선택 해제 후 한 장
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
      startLeft: clientX - p.offsetX, startTop: clientY - p.offsetY, scale: 1,
    }
    flipRects.current.clear()
    nums.forEach((n) => { const el = cellRefs.current.get(n); if (el) flipRects.current.set(n, el.getBoundingClientRect()) })
    overIndexRef.current = originIndex
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
    // 텍스트 선택 방지: 기존 선택 해제 + 드래그 동안 selectstart 차단
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', onSelectStart)
    document.body.style.cursor = 'grabbing'
    zoneRef.current = null
    deleteZoneRef.current = false
    onZoneChangeRef.current?.(true, null)
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
    const left = e.clientX - d.offsetX
    const top = e.clientY - d.offsetY
    // KPI 드롭존 히트테스트 + 접근 축소(transform 전용)
    const zh = onStatusDropRef.current ? zoneAt(e.clientX, e.clientY) : null
    const s = onStatusDropRef.current ? dragScale(e.clientX, e.clientY, !!zh) : 1
    d.scale = s
    if (liftedRef.current) {
      liftedRef.current.style.left = `${left}px`
      liftedRef.current.style.top = `${top}px`
      liftedRef.current.style.transform = s === 1 ? '' : `scale(${s})`
      liftedRef.current.style.setProperty('--stack-gap', `${Math.max(2, 10 * ((s - 0.72) / 0.28)).toFixed(1)}px`)
    }
    const prevZone = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prevZone) onZoneChangeRef.current?.(true, zh?.zone ?? null)
    // 카드 영역 좌우 빈 공간 = 삭제 영역(단일 드래그·존 밖에서만). 오버레이에 경고 표시.
    if (onDeleteDropRef.current && !d.multiNums) {
      const gr = gridRef.current?.getBoundingClientRect()
      const del = !zh && !!gr && (e.clientX < gr.left - 24 || e.clientX > gr.right + 24)
      if (del !== deleteZoneRef.current) {
        deleteZoneRef.current = del
        if (liftedRef.current) {
          liftedRef.current.style.outline = del ? '2px dashed rgba(224,91,84,.95)' : ''
          liftedRef.current.style.outlineOffset = del ? '3px' : ''
          liftedRef.current.style.opacity = del ? '0.55' : '0.9'
        }
      }
      if (del && liftedRef.current) liftedRef.current.style.transform = 'scale(0.9)'
    }
    // 존 위이거나 복수 드래그면 삽입정렬 이동 없음(원위치 placeholder 유지)
    if (zh || d.multiNums) {
      if (overIndexRef.current !== d.originIndex) { overIndexRef.current = d.originIndex; setOverIndex(d.originIndex) }
      return
    }
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
    onZoneChangeRef.current?.(false, null)
    setDragNum(null)
    setOverIndex(0)
    setMultiCount(0)
    if (changed) onReorderRef.current(finalOrder)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 좌우 빈 공간 드롭 = 삭제 확인(단일). 카드는 원위치로 되돌리고 부모가 경고 다이얼로그를 연다.
    if (d && !zh && deleteZoneRef.current && !d.multiNums && onDeleteDropRef.current) {
      const num = d.num
      deleteZoneRef.current = false
      finishDrag(false)
      cleanupPending()
      onDeleteDropRef.current(num)
      return
    }
    deleteZoneRef.current = false
    if (d && zh && onStatusDropRef.current) {
      const nums = d.multiNums ?? [d.num]
      const res = onStatusDropRef.current(nums, zh.zone)
      zoneRef.current = null
      if (res) {
        // 변경 카드 즉시 숨김(흡입 중 중복 표시 방지) — 패치 후 목록에서 자연 제거
        for (const n of res.changedNums) {
          const el = cellRefs.current.get(n)
          if (el) { el.style.opacity = '0'; el.style.pointerEvents = 'none' }
        }
        const lifted = liftedRef.current
        const scale = d.scale
        const finalize = res.finalize
        if (lifted) {
          void suckOverlayInto(lifted, zh.rect, scale).then(finalize)
        } else {
          finalize()
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
    if (e.shiftKey || e.detail >= 2) e.preventDefault() // Shift 구간선택·더블클릭 시 텍스트 선택 방지
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

  // 드롭 직후의 클릭(카드 선택/열기) 억제 + Cmd/Ctrl/Shift 복수선택 — 캡처 단계에서 가로챔
  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (Date.now() < suppressClickUntil.current) { e.preventDefault(); e.stopPropagation(); return }
    if (!onSelectToggleRef.current) return
    if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return
    if ((e.target as HTMLElement).closest('button, a')) return
    const item = itemsRef.current.find((i) => i.num === num)
    if (!item || !canDragRef.current(item)) return
    e.preventDefault(); e.stopPropagation()
    onSelectToggleRef.current(num, { shift: e.shiftKey })
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
              ...(selected ? { outline: `2px solid ${alpha(th.palette.accent.blue, 0.9)}`, outlineOffset: '-1px' } : {}),
              ...(isDragSource ? { opacity: 0.35 } : {}),
              transition: 'opacity .15s',
            })}
          >
            {renderCard(item)}
            {selected && (
              <CheckCircleIcon
                sx={(th) => ({ position: 'absolute', top: 6, right: 6, fontSize: 20, color: th.palette.accent.blue, pointerEvents: 'none', zIndex: 2, bgcolor: th.palette.background.default, borderRadius: '50%' })}
              />
            )}
          </Box>
        )
      })}

      {/* 들어올린 카드(포인터 추적) — position:fixed, 포인터이벤트 없음. 위치·축소는 ref로 명령형 갱신 */}
      {dragNum && dragItem && (
        <Box
          ref={(el: HTMLDivElement | null) => {
            liftedRef.current = el
            const d = drag.current
            if (el && d) { el.style.left = `${d.startLeft}px`; el.style.top = `${d.startTop}px` }
          }}
          aria-hidden
          sx={{
            position: 'fixed', zIndex: (th) => th.zIndex.modal + 1,
            width: drag.current?.width, height: drag.current?.height, pointerEvents: 'none',
            opacity: 0.9, borderRadius: 1, transformOrigin: '50% 50%',
            '--stack-gap': '10px',
          }}
        >
          {multiCount > 2 && (
            <Box sx={(th) => ({ position: 'absolute', inset: 0, transform: 'translate(calc(var(--stack-gap) * 2), calc(var(--stack-gap) * 2))', bgcolor: 'background.elevated', border: `1px solid ${th.palette.divider}`, borderRadius: 1 })} />
          )}
          {multiCount > 1 && (
            <Box sx={(th) => ({ position: 'absolute', inset: 0, transform: 'translate(var(--stack-gap), var(--stack-gap))', bgcolor: 'background.elevated', border: `1px solid ${th.palette.divider}`, borderRadius: 1 })} />
          )}
          <Box sx={{ position: 'relative', height: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.48)', borderRadius: 1, '& > *': { height: '100%' } }}>
            {renderCard(dragItem)}
            {multiCount > 1 && (
              <Box sx={(th) => ({
                position: 'absolute', top: -10, right: -10, zIndex: 2,
                px: 1, py: 0.4, borderRadius: '999px',
                bgcolor: th.palette.accent.blue, color: '#fff',
                fontSize: 12.5, fontWeight: 700, lineHeight: 1,
              })}>
                {multiCount}건
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
