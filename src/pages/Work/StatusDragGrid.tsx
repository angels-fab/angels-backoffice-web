import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { genieOverlayInto, kpiShrinkByCard, trashContains, trashHitByCard, trashShrinkByCard, zoneByCardRect, type CardRect, type DropZone, type StatusDropResult } from './dropZones'

const ACTIVATION_DISTANCE = 8 // px 이상 이동해야 드래그 시작(마우스)
const LONG_PRESS_MS = 480 // 터치 롱프레스 = 복수선택 모드 진입
const CLICK_SUPPRESS_MS = 350
const SCROLL_EDGE = 72 // 화면 상/하단 자동 스크롤 시작 영역(px)
const SCROLL_MIN = 3
const SCROLL_MAX = 16

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
  /** 휴지통에 드롭 — 흡입 없이 삭제 확인부터(부모가 확인창·흡입·삭제 담당). at=드롭 시점 오버레이 기하(고정 표시용) */
  onDeleteDrop?: (nums: string[], at: { cx: number; cy: number; w: number; h: number; scale: number }) => void
  /** 휴지통 위 진입/이탈(부모 휴지통 강조용) */
  onTrashHover?: (hover: boolean) => void
  /** 드래그 중 포인터가 화면 우측 드웰 존(오른쪽 공간)에 있는지 — 부모가 500ms 드웰 후 휴지통 무장 */
  onRightEdge?: (inZone: boolean) => void
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
  onCardDoubleClick, onDeleteDrop, onTrashHover, onRightEdge, awaitingNums, awaitingHidden,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const [dragNum, setDragNum] = useState<string | null>(null)
  const [multiCount, setMultiCount] = useState(0)
  const [overTrash, setOverTrash] = useState(false) // 토큰 danger 톤
  // 존 드롭 → 흡입 동안 숨길 카드(상태 기반 — 패치 후에도 같은 목록에 남는 카드에
  // inline 스타일이 영구 잔존하는 유령 셀 방지. 흡입 후 패치와 함께 해제)
  const [hidingNums, setHidingNums] = useState<Set<string>>(new Set())

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
  const onRightEdgeRef = useRef(onRightEdge); onRightEdgeRef.current = onRightEdge
  const rightEdgeRef = useRef(false)
  const trashHoverRef = useRef(false)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; nums: string[]; width: number; height: number; offsetX: number; offsetY: number; scale: number }>(null)
  const zoneRef = useRef<null | { zone: DropZone; rect: DOMRect }>(null)
  const longPress = useRef<number | null>(null)
  const lastPointer = useRef({ x: 0, y: 0 })
  const autoScrollRaf = useRef<number | null>(null) // 드래그 중 상/하단 자동 스크롤 루프
  const suppressClickUntil = useRef(0)
  const suppressNextClick = useRef(false) // 롱프레스로 시트를 연 뒤 다음 클릭 1회 무조건 억제(시간 만료 무관·오선택 방지)

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
      width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY, scale: 1,
    }
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
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
    if (autoScrollRaf.current == null) autoScrollRaf.current = requestAnimationFrame(scrollTick)
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
    if (!drag.current) return
    e.preventDefault()
    updateDrag(e.clientX, e.clientY)
  }

  // 드래그 갱신(포인터·자동 스크롤 공용) — 이동 카드의 '실제 영역' 기준(포인터 위치 미사용)
  const updateDrag = (x: number, y: number) => {
    const d = drag.current
    if (!d) return
    const left = x - d.offsetX
    const top = y - d.offsetY
    const cardRect: CardRect = { left, top, right: left + d.width, bottom: top + d.height, width: d.width, height: d.height }
    // 휴지통·KPI 동시 겹침 시 포인터가 휴지통 판정영역 안일 때만 휴지통 우선(RTG와 동일 규칙)
    const trRaw = onDeleteDropRef.current ? trashHitByCard(cardRect) : null
    const zhRaw = zoneByCardRect(cardRect, zoneRef.current?.zone ?? null)
    const tr = trRaw && (!zhRaw || trashContains(trRaw, x, y)) ? trRaw : null
    const zh = tr ? null : zhRaw
    const prev = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prev) onZoneChangeRef.current(true, zh?.zone ?? null)
    if (!!tr !== trashHoverRef.current) {
      trashHoverRef.current = !!tr
      setOverTrash(!!tr)
      onTrashHoverRef.current?.(!!tr)
    }
    // 우측 드웰 존 — 포인터 x가 화면 오른쪽 88px 안이면 진입(카드가 아니라 손 위치 기준: 넓은 카드 오폭 방지)
    const inEdge = x >= window.innerWidth - 88
    if (inEdge !== rightEdgeRef.current) {
      rightEdgeRef.current = inEdge
      onRightEdgeRef.current?.(inEdge)
    }
    const sc = tr ? trashShrinkByCard(cardRect, tr) : (zh ? kpiShrinkByCard(cardRect, zh.rect) : 1)
    d.scale = sc
    if (liftedRef.current) {
      liftedRef.current.style.left = `${left}px`
      liftedRef.current.style.top = `${top}px`
      liftedRef.current.style.transform = sc === 1 ? '' : `scale(${sc})`
      liftedRef.current.style.setProperty('--stack-gap', `${Math.max(2, 10 * sc).toFixed(1)}px`)
    }
  }

  // 자동 스크롤 — 상/하단 72px 영역에서 가장자리에 가까울수록 3~16px/frame(세로만)
  const scrollTick = () => {
    if (!drag.current) { autoScrollRaf.current = null; return }
    const y = lastPointer.current.y
    let v = 0
    if (y < SCROLL_EDGE) v = -(SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * Math.min(1, (SCROLL_EDGE - y) / SCROLL_EDGE))
    else if (y > window.innerHeight - SCROLL_EDGE) v = SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * Math.min(1, (y - (window.innerHeight - SCROLL_EDGE)) / SCROLL_EDGE)
    if (v !== 0) {
      window.scrollBy(0, v)
    }
    // 포인터가 멈춰 있어도 매 프레임 재판정 — 드웰 휴지통 무장 직후(이동 없이 릴리즈)에도 접촉 반영
    updateDrag(lastPointer.current.x, lastPointer.current.y)
    autoScrollRaf.current = requestAnimationFrame(scrollTick)
  }

  const endDrag = () => {
    document.body.style.cursor = ''
    drag.current = null
    if (autoScrollRaf.current != null) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null }
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    trashHoverRef.current = false
    onZoneChangeRef.current(false, null)
    onTrashHoverRef.current?.(false)
    if (rightEdgeRef.current) { rightEdgeRef.current = false; onRightEdgeRef.current?.(false) }
    setOverTrash(false)
    setDragNum(null)
    setMultiCount(0)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 휴지통 드롭 — 흡입 없이 부모에 확인 위임(단일·복수). 드롭 시점 오버레이 기하를 전달.
    // 잡은 카드(d.num)를 맨 앞에 — 고정 표시가 드래그하던 카드와 동일하도록.
    if (d && !zh && trashHoverRef.current && onDeleteDropRef.current) {
      const nums = [d.num, ...d.nums.filter((n) => n !== d.num)]
      const at = {
        cx: lastPointer.current.x - d.offsetX + d.width / 2,
        cy: lastPointer.current.y - d.offsetY + d.height / 2,
        w: d.width, h: d.height, scale: d.scale,
      }
      endDrag()
      cleanupPending()
      onDeleteDropRef.current(nums, at)
      return
    }
    if (d && zh) {
      const res = onStatusDropRef.current(d.nums, zh.zone)
      if (res) {
        // 변경 카드 즉시 숨김(흡입 중 중복 표시 방지) — 상태 기반. 흡입 후 패치와 함께 해제:
        // 목록에서 빠지는 카드는 언마운트, 같은 목록에 남는 카드(완료→Remind 등)는 다시 표시.
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
    suppressNextClick.current = false // 새 상호작용 시작 — 억제 플래그 초기화
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
      // 터치 롱프레스 = 카드 액션 시트 열기(상태변경·수정·삭제)
      longPress.current = window.setTimeout(() => {
        if (pending.current) {
          suppressNextClick.current = true // 손을 늦게 떼도 다음 클릭 1회 억제(오선택 방지)
          onLongPressRef.current(num)
          cleanupPending()
        }
      }, LONG_PRESS_MS)
    }
  }

  // 클릭 선택(캡처 단계) — 일반=그 카드만 / Cmd·Ctrl·선택모드 탭=토글 / Shift=범위
  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (suppressNextClick.current) { suppressNextClick.current = false; e.preventDefault(); e.stopPropagation(); return }
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
            // 선택 표시는 카드(TaskAccordion)가 상태 대표색으로 직접 그림 — 셀 래퍼의 공통 파란 outline 제거
            sx={{
              position: 'relative', minWidth: 0, touchAction: 'pan-y',
              '& > *:first-of-type': { height: '100%' },
              borderRadius: 1,
              ...(isDragSource ? { opacity: 0.35 } : {}),
              ...(awaiting ? { opacity: awaitingHidden ? 0 : 0.32, pointerEvents: 'none' } : {}),
              ...(hidingNums.has(t.num) ? { opacity: 0, pointerEvents: 'none' } : {}),
              transition: 'opacity .15s',
            }}
          >
            {renderCard(t)}
          </Box>
        )
      })}

      {/* 들어올린 카드(그랩 지점 추적) — 원본 직사각형 비율·크기 유지, 대상 접근 시에만 거리 비례 축소.
          복수는 직사각형 카드가 살짝 포개진 스택 + N건 배지. 위치·스케일은 ref로 명령형 갱신 */}
      {dragNum && dragItem && (
        <Box
          ref={(el: HTMLDivElement | null) => {
            liftedRef.current = el
            const d = drag.current
            if (el && d) {
              el.style.left = `${lastPointer.current.x - d.offsetX}px`
              el.style.top = `${lastPointer.current.y - d.offsetY}px`
              el.style.transformOrigin = `${d.offsetX}px ${d.offsetY}px` // 잡은 지점 기준 축소
              if (d.scale !== 1) el.style.transform = `scale(${d.scale})`
            }
          }}
          aria-hidden
          sx={(th) => ({
            position: 'fixed', zIndex: th.zIndex.modal + 1,
            width: drag.current?.width, height: drag.current?.height, pointerEvents: 'none',
            opacity: 0.92, borderRadius: 1, transformOrigin: '50% 50%',
            // 휴지통 진입/이탈의 계단식 축소를 부드럽게 잇는 전이(위치 left/top은 즉시 반영)
            transition: 'transform .18s cubic-bezier(0.22, 1, 0.36, 1)',
            '--stack-gap': '10px',
            ...(overTrash ? { outline: '2px dashed rgba(224,91,84,.95)', outlineOffset: '3px' } : {}),
          })}
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
