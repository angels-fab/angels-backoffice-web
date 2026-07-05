import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { genieOverlayInto, kpiShrinkByCard, trashContains, trashHitByCard, trashShrinkByCard, zoneByCardRect, type CardRect, type DropZone, type StatusDropResult } from './dropZones'

// 시안(docs/mockups/work-card-motion-only.html · work-drag-trash.html) 물리값
const ACTIVATION_DISTANCE = 8 // px 이상 움직여야 드래그 시작(마우스·순서편집 터치)
const SHEET_HOLD_MS = 500 // 터치 롱프레스 → 액션 시트(스크롤·오터치와 확실히 구분되게 길게)
const SWITCH_MARGIN = 28 // 새 슬롯이 현재 슬롯보다 이만큼 명확히 가까울 때만 재배치(중심거리, px)
const SWITCH_LOCK_MS = 240 // 재배치 시작 후 추가 재배치 판정 잠금(왕복 방지)
const MOVE_DURATION = 240 // 주변 카드 자리 이동 애니메이션(ms)
const SETTLE_DURATION = 180 // 드롭 후 최종 정착 애니메이션(ms)
const MOVE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)' // 부드러운 감속곡선
const CLICK_SUPPRESS_MS = 350 // 드롭 직후 클릭(카드 선택) 억제
const SCROLL_EDGE = 72 // 화면 상/하단 자동 스크롤 시작 영역(px)
const SCROLL_MIN = 3 // 프레임당 최소 스크롤(px)
const SCROLL_MAX = 16 // 프레임당 최대 스크롤(px)

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
  /** 그리드 첫 칸에 렌더할 요소(새 업무 인라인 작성카드) — 드래그·선택 대상 아님 */
  leading?: React.ReactNode
  /** 순서 편집(흔들림) 모드 — true일 때만 터치 롱프레스가 순서변경 드래그를 시작. false면 롱프레스=액션 시트 */
  reorderMode?: boolean
  /** 터치 롱프레스(순서모드 아님) — 부모가 카드 액션 시트를 연다 */
  onLongPress?: (num: string) => void
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
  onCardDoubleClick, onDeleteDrop, onTrashHover, onRightEdge, awaitingNums, awaitingHidden, leading,
  reorderMode, onLongPress,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const flipRects = useRef(new Map<string, { left: number; top: number }>()) // 문서좌표(left/top)

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
  const onRightEdgeRef = useRef(onRightEdge); onRightEdgeRef.current = onRightEdge
  const reorderModeRef = useRef(reorderMode); reorderModeRef.current = reorderMode
  const onLongPressRef = useRef(onLongPress); onLongPressRef.current = onLongPress
  const rightEdgeRef = useRef(false)
  const trashHoverRef = useRef(false) // 휴지통 위 여부
  const overIndexRef = useRef(0)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; multiNums: string[] | null; baseOrder: string[]; slotRects: DOMRect[]; scrollY0: number; originIndex: number; width: number; height: number; offsetX: number; offsetY: number; scale: number }>(null)
  const switchLockUntil = useRef(0) // 재배치 직후 추가 판정 잠금 시각
  const settleFrom = useRef<null | { num: string; rect: DOMRect }>(null) // 드롭 정착 애니메이션 시작 위치
  const autoScrollRaf = useRef<number | null>(null) // 드래그 중 상/하단 자동 스크롤 루프
  const zoneRef = useRef<null | { zone: DropZone; rect: DOMRect }>(null)
  const longPress = useRef<number | null>(null)
  const lastPointer = useRef({ x: 0, y: 0 })
  const suppressClickUntil = useRef(0)
  const suppressNextClick = useRef(false) // 롱프레스로 시트를 연 뒤 다음 클릭 1회를 시각과 무관하게 무조건 억제(오선택 방지)

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

  // FLIP — 렌더 후 위치 변화한 카드를 이전 위치에서 새 위치로 애니메이션(드래그 중에만).
  // 기존 애니메이션은 취소 후 시작(중첩으로 인한 왕복·떨림 방지), 240ms 감속곡선.
  useLayoutEffect(() => {
    // 드롭 정착 — 들어올렸던 카드가 오버레이 마지막 위치에서 슬롯 자리로 180ms에 내려앉음
    const st = settleFrom.current
    if (st) {
      settleFrom.current = null
      const el = cellRefs.current.get(st.num)
      if (el) {
        const now = el.getBoundingClientRect()
        if (now.width > 0) {
          const dx = st.rect.left + st.rect.width / 2 - (now.left + now.width / 2)
          const dy = st.rect.top + st.rect.height / 2 - (now.top + now.height / 2)
          const sc = Math.max(0.05, st.rect.width / now.width)
          el.getAnimations?.().forEach((a) => a.cancel())
          el.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0.92 },
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            ],
            { duration: SETTLE_DURATION, easing: MOVE_EASING },
          )
        }
      }
    }
    const dragging = !!drag.current
    cellRefs.current.forEach((el, num) => {
      if (num === dragNum) return
      const r = el.getBoundingClientRect()
      // 문서좌표로 비교 — 자동 스크롤로 뷰포트가 움직여도 실제 레이아웃 이동만 FLIP
      const now = { left: r.left + window.scrollX, top: r.top + window.scrollY }
      const prev = flipRects.current.get(num)
      if (dragging && prev && (Math.abs(prev.left - now.left) > 0.5 || Math.abs(prev.top - now.top) > 0.5)) {
        el.getAnimations?.().forEach((a) => a.cancel())
        el.animate(
          [{ transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` }, { transform: 'translate(0,0)' }],
          { duration: MOVE_DURATION, easing: MOVE_EASING },
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

  // 목적지 판정 — 드래그 시작 시 고정 저장한 슬롯 좌표(d.slotRects) 기준 중심거리.
  // 이동한 카드들의 현재 위치로 재계산하지 않으며(왕복 방지), 새 슬롯이 현재 슬롯보다
  // SWITCH_MARGIN(28px) 이상 명확히 가까울 때만 재배치. 재배치 후 SWITCH_LOCK_MS(240ms) 동안 판정 잠금.
  // 가장 가까운 슬롯으로 바로 이동(중간 슬롯 순차 이동 없음) — 1·2·3열/모바일 배열 공통.
  const detectTargetIndex = (moving: Rect): number => {
    const d = drag.current
    if (!d) return overIndexRef.current
    if (Date.now() < switchLockUntil.current) return overIndexRef.current
    // 고정 슬롯(드래그 시작 시 저장)을 현재 스크롤로 보정해 같은 뷰포트 좌표계에서 비교
    const dy = window.scrollY - d.scrollY0
    const dist = (slot: DOMRect) =>
      Math.hypot(moving.left + moving.width / 2 - (slot.left + slot.width / 2), moving.top + moving.height / 2 - (slot.top - dy + slot.height / 2))
    let best = 0
    let bestD = Infinity
    d.slotRects.forEach((slot, i) => {
      const di = dist(slot)
      if (di < bestD) { bestD = di; best = i }
    })
    const cur = overIndexRef.current
    if (best === cur) return cur
    if (dist(d.slotRects[cur]) - bestD < SWITCH_MARGIN) return cur
    switchLockUntil.current = Date.now() + SWITCH_LOCK_MS
    return best
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
      num: p.num, multiNums, baseOrder: nums, slotRects, scrollY0: window.scrollY, originIndex,
      width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY, scale: 1,
    }
    flipRects.current.clear()
    nums.forEach((n) => {
      const el = cellRefs.current.get(n)
      if (el) { const r = el.getBoundingClientRect(); flipRects.current.set(n, { left: r.left + window.scrollX, top: r.top + window.scrollY }) }
    })
    overIndexRef.current = originIndex
    switchLockUntil.current = 0
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
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
    if (autoScrollRaf.current == null) autoScrollRaf.current = requestAnimationFrame(scrollTick)
  }

  // 드래그 갱신(포인터 이벤트·자동 스크롤 공용) — 이동 카드의 '실제 영역' 기준으로
  // 존/휴지통/축소/삽입정렬을 모두 재계산한다(마우스 포인터 위치는 판정에 사용하지 않음).
  const updateDrag = (x: number, y: number) => {
    const d = drag.current
    if (!d) return
    const left = x - d.offsetX
    const top = y - d.offsetY
    const cardRect: CardRect = { left, top, right: left + d.width, bottom: top + d.height, width: d.width, height: d.height }
    // 휴지통·KPI — 카드 실영역 기준. 휴지통 버튼이 KPI 위에 있어 큰 카드는 둘을 동시에 덮을 수 있는데,
    // 그때는 포인터가 휴지통 판정영역(+16px) 안일 때만 휴지통 우선(Remind 존 드롭이 휴지통으로 오폭 방지).
    const trRaw = onDeleteDropRef.current ? trashHitByCard(cardRect) : null
    const zhRaw = onStatusDropRef.current ? zoneByCardRect(cardRect, zoneRef.current?.zone ?? null) : null
    const tr = trRaw && (!zhRaw || trashContains(trRaw, x, y)) ? trRaw : null
    const zh = tr ? null : zhRaw
    const prevZone = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prevZone) onZoneChangeRef.current?.(true, zh?.zone ?? null)
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
    // 축소 — KPI·휴지통 동일 방식: 카드 외곽이 대상에 맞닿는 순간부터 침투 깊이 비례(smoothstep),
    // 그 외 원본 크기. 원점=잡은 지점(포인터-카드 어긋남 방지).
    const sc = tr ? trashShrinkByCard(cardRect, tr) : (zh ? kpiShrinkByCard(cardRect, zh.rect) : 1)
    d.scale = sc
    if (liftedRef.current) {
      liftedRef.current.style.left = `${left}px`
      liftedRef.current.style.top = `${top}px`
      liftedRef.current.style.transform = sc === 1 ? '' : `scale(${sc})`
      liftedRef.current.style.setProperty('--stack-gap', `${Math.max(2, 10 * sc).toFixed(1)}px`)
    }
    // 존·휴지통 위이거나 복수 드래그면 삽입정렬 이동 없음(원위치 placeholder 유지)
    if (zh || tr || d.multiNums) {
      if (overIndexRef.current !== d.originIndex) { overIndexRef.current = d.originIndex; setOverIndex(d.originIndex) }
      return
    }
    const next = detectTargetIndex(cardRect)
    if (next !== overIndexRef.current) { overIndexRef.current = next; setOverIndex(next) }
  }

  // 자동 스크롤 — 카드(포인터)가 화면 상/하단 72px 영역에 들어가면 가장자리에 가까울수록 빠르게(3~16px/frame).
  // 스크롤 후 updateDrag를 다시 돌려 슬롯·KPI·휴지통 위치를 재계산(그랩 오프셋은 그대로 유지).
  const scrollTick = () => {
    if (!drag.current) { autoScrollRaf.current = null; return }
    const y = lastPointer.current.y
    let v = 0
    if (y < SCROLL_EDGE) v = -(SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * Math.min(1, (SCROLL_EDGE - y) / SCROLL_EDGE))
    else if (y > window.innerHeight - SCROLL_EDGE) v = SCROLL_MIN + (SCROLL_MAX - SCROLL_MIN) * Math.min(1, (y - (window.innerHeight - SCROLL_EDGE)) / SCROLL_EDGE)
    if (v !== 0) {
      window.scrollBy(0, v) // 세로만 — 가로 스크롤 없음
    }
    // 포인터가 멈춰 있어도 매 프레임 재판정 — 드웰 휴지통이 무장된 '직후'(이동 없이 릴리즈)에도
    // 카드-패널 접촉이 반영되도록. updateDrag는 rect 몇 개 계산이라 프레임 비용 무시 가능.
    updateDrag(lastPointer.current.x, lastPointer.current.y)
    autoScrollRaf.current = requestAnimationFrame(scrollTick)
  }

  const onMove = (e: PointerEvent) => {
    if (!pending.current) return
    lastPointer.current = { x: e.clientX, y: e.clientY }
    const dist = Math.hypot(e.clientX - pending.current.startX, e.clientY - pending.current.startY)
    if (!drag.current) {
      if (pending.current.pointerType === 'touch') {
        if (reorderModeRef.current) {
          // 순서 편집 모드: 이동하면 바로 드래그(홀드 불필요) — 흔들리는 카드를 끌어 재정렬
          if (dist > ACTIVATION_DISTANCE) beginDrag(e.clientX, e.clientY)
          else return
        } else {
          // 평소: 롱프레스 전 이동 = 스크롤로 간주해 시트 대기 취소(스크롤과 충돌 방지)
          if (dist > ACTIVATION_DISTANCE) cleanupPending()
          return
        }
      } else {
        if (dist < ACTIVATION_DISTANCE) return
        beginDrag(e.clientX, e.clientY)
      }
    }
    if (!drag.current) return
    e.preventDefault()
    updateDrag(e.clientX, e.clientY)
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
    if (autoScrollRaf.current != null) { cancelAnimationFrame(autoScrollRaf.current); autoScrollRaf.current = null }
    flipRects.current.clear()
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    trashHoverRef.current = false
    onZoneChangeRef.current?.(false, null)
    onTrashHoverRef.current?.(false)
    if (rightEdgeRef.current) { rightEdgeRef.current = false; onRightEdgeRef.current?.(false) }
    setOverTrash(false)
    setDragNum(null)
    setOverIndex(0)
    setMultiCount(0)
    if (changed) onReorderRef.current(finalOrder)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 휴지통 드롭 — 흡입 없이 부모에 확인 위임(단일·복수). 드롭 시점 오버레이 기하를 전달해
    // 부모가 같은 자리·크기로 고정 카드를 렌더(확인창 동안 유지, 동의 시 흡입의 원본).
    // 잡은 카드(d.num)를 맨 앞에 — 고정 표시가 드래그하던 카드와 동일하도록.
    if (d && !zh && trashHoverRef.current && onDeleteDropRef.current) {
      const nums = d.multiNums ? [d.num, ...d.multiNums.filter((n) => n !== d.num)] : [d.num]
      const at = {
        cx: lastPointer.current.x - d.offsetX + d.width / 2,
        cy: lastPointer.current.y - d.offsetY + d.height / 2,
        w: d.width, h: d.height, scale: d.scale,
      }
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
    if (d) {
      // 일반 드롭 — 오버레이 마지막 시각 위치에서 슬롯으로 180ms 정착 애니메이션
      const lifted = liftedRef.current
      if (lifted) settleFrom.current = { num: d.num, rect: lifted.getBoundingClientRect() }
      finishDrag(true)
    }
    cleanupPending()
  }
  const onCancel = () => { zoneRef.current = null; if (drag.current) finishDrag(false); cleanupPending() }
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }

  const onPointerDown = (e: React.PointerEvent, num: string) => {
    if (pending.current || drag.current) return
    if (e.button !== 0) return // 주 버튼만
    suppressNextClick.current = false // 새 상호작용 시작 — 억제 플래그 초기화
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
    // 평소(터치): 길게 눌러 액션 시트. 순서 편집 모드는 타이머 없이 onMove에서 바로 드래그(홀드 불필요).
    if (pending.current.pointerType === 'touch' && !reorderModeRef.current) {
      longPress.current = window.setTimeout(() => {
        if (!pending.current) return
        if (onLongPressRef.current) {
          suppressNextClick.current = true // 손을 늦게 떼도 다음 클릭 1회 억제(시간 만료 허점 제거)
          onLongPressRef.current(num)
          cleanupPending()
        } else {
          beginDrag(lastPointer.current.x, lastPointer.current.y) // 폴백: 롱프레스 콜백 미제공 시 기존 드래그
        }
      }, SHEET_HOLD_MS)
    }
  }

  // 클릭 선택(캡처 단계) — 일반=그 카드만 / Cmd·Ctrl=토글 / Shift=범위. 드롭 직후 클릭은 억제.
  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (suppressNextClick.current) { suppressNextClick.current = false; e.preventDefault(); e.stopPropagation(); return }
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
      {displayNums.map((num, i) => {
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
            className={`reorder-cell${reorderMode && !dragNum ? ' jiggle' : ''}`}
            ref={setCellRef(num)}
            aria-selected={selected}
            style={reorderMode ? { animationDelay: `${(i % 4) * 70}ms` } : undefined}
            onPointerDown={(e) => onPointerDown(e, num)}
            onClickCapture={(e) => onClickCapture(e, num)}
            onDoubleClick={(e) => {
              if (Date.now() < suppressClickUntil.current) return
              if ((e.target as HTMLElement).closest('button, a')) return
              onCardDoubleClickRef.current?.(num)
            }}
            // 카드가 늘어난 셀 높이를 채우도록(높이 통일 시 하단 여백이 카드 내부로) — 자식(카드) height:100%
            // 선택 표시는 카드(TaskAccordion)가 상태 대표색으로 직접 그림 — 셀 래퍼의 공통 파란 outline 제거
            sx={{
              // 순서 편집 모드: touch-action none → 터치 이동이 페이지 스크롤 대신 카드 드래그로 감(핵심)
              position: 'relative', minWidth: 0, touchAction: reorderMode ? 'none' : 'pan-y',
              '& > *:first-of-type': { height: '100%' },
              borderRadius: 1,
              ...(isDragSource ? { opacity: 0.35 } : {}),
              ...(awaiting ? { opacity: awaitingHidden ? 0 : 0.32, pointerEvents: 'none' } : {}),
              ...(hidingNums.has(num) ? { opacity: 0, pointerEvents: 'none' } : {}),
              transition: 'opacity .15s',
            }}
          >
            {renderCard(item)}
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
            transition: `transform .18s ${MOVE_EASING}`,
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
