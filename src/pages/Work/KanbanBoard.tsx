import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import TimelapseIcon from '@mui/icons-material/Timelapse'
import PauseIcon from '@mui/icons-material/Pause'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'
import { radius, shadow, typescale } from '@/theme/tokens'
import { StatusChip, focusRingSx } from '@/components/ds'
import ManagerChip from '@/components/ds/ManagerChip'
import { fmtDate, dateSortValue } from '@/utils/date'
import { isWorkNew } from '@/utils/newPost'
import type { WorkItem } from '@/types'
import { classify, taskTitle, catKind, TONE_RGB } from './workMeta'
import type { CardTone } from './workMeta'
import { zoneAt, genieOverlayInto } from './dropZones'
import type { DropZone, StatusDropResult } from './dropZones'

// 그리드(ReorderableTaskGrid) 시안 물리값 그대로 — 순서변경 '이동 감각' 동일화
// 드래그 시작 임계는 보드만 작게(3px) — 그리드는 카드가 토큰으로 모핑돼 8px 공백을 가리지만,
// 보드는 크기 유지(모핑 없음)라 그 공백이 '멈췄다 시작'으로 보임. 3px면 사실상 잡자마자 따라옴
// (순수 클릭은 <2px라 상세 열기 유지). 판정 재배치 여유(28px)는 그대로.
const ACTIVATION_DISTANCE = 3 // px 이상 움직이면 드래그 시작(거의 즉시)
const SWITCH_MARGIN = 28 // 새 슬롯이 현재 슬롯보다 이만큼 명확히 가까울 때만 재배치(중심거리, px)
const SWITCH_LOCK_MS = 240 // 재배치 시작 후 추가 재배치 판정 잠금(왕복 방지)
const MOVE_DURATION = 240 // 주변 카드 자리 이동(FLIP) 애니메이션(ms)
const SETTLE_DURATION = 180 // 드롭 후 최종 정착 애니메이션(ms)
const MOVE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)' // 부드러운 감속곡선
const REORDER_PAD_X = 40 // 진행중 열 좌우 순서판정 여유(px) — 열이 좁아 살짝 벗어나도 유지(보드 전용)

export interface KanbanBoardProps {
  /** 필터·검색이 적용된 업무 목록(상태 분류는 보드가 수행) */
  items: WorkItem[]
  canDrag: (t: WorkItem) => boolean
  /** 열 간·KPI 드롭 → 기존 KPI 존과 동일 시맨틱(진행중/보류/완료/Remind) */
  onStatusDrop: (nums: string[], zone: DropZone) => StatusDropResult
  onCardClick: (t: WorkItem) => void
  /** 상세 Drawer가 열린 카드 — 보드에서 선택 강조 표시 */
  selectedNum?: string | null
  /** 표시 정렬(날짜/담당자/구분 버튼) — 각 열 안에서 적용. null이면 기본(진행중 수동순서·그 외 최신순) */
  sort?: ((arr: WorkItem[]) => WorkItem[]) | null
  /** 진행중 열 표시 순서(num 배열) — 목록 보기와 같은 내 수동 순서 공유 */
  inProgressOrder?: string[]
  /** 진행중 열 안 드래그 순서변경 허용 여부(관리자) */
  canReorder?: boolean
  /** 진행중 열 안 드롭 확정 — 목록 보기 handleReorder와 동일(부분 순서를 전체에 병합·Undo 포함) */
  onReorder?: (orderedNums: string[]) => void
  /** KPI 존 하이라이트 연동(드래그 중 존 표시·드롭 직후 KPI 클릭 억제) — 그리드와 동일 계약 */
  onZoneChange?: (dragging: boolean, zone: DropZone | null) => void
}

// 열 구성 — KPI 드롭존(DropZone)과 1:1. 색은 D3 전역 배정(진행중 그린·보류 앰버·완료 블루·Remind 퍼플)
const COLS: { zone: DropZone; title: string; tone: CardTone; accent: 'green' | 'amber' | 'blue' | 'purple'; Icon: React.ElementType }[] = [
  { zone: 'inProgress', title: '진행중', tone: 'green', accent: 'green', Icon: TimelapseIcon },
  { zone: 'hold', title: '보류', tone: 'amber', accent: 'amber', Icon: PauseIcon },
  { zone: 'done', title: '완료', tone: 'blue', accent: 'blue', Icon: TaskAltIcon },
  { zone: 'remind', title: 'Remind', tone: 'purple', accent: 'purple', Icon: TipsAndUpdatesIcon },
]

const byDateDesc = (a: WorkItem, b: WorkItem) => dateSortValue(b.start) - dateSortValue(a.start)

// 드래그 중 유령 카드 상태 — 포인터를 따라다니는 고정 위치 복제 카드(위치는 DOM 직접 갱신)
type DragState = { num: string; w: number; h: number; dx: number; dy: number; x: number; y: number; from: DropZone }
// 드롭 대상 — KPI 존(스트립) 또는 다른 열. 진행중 열 안 순서변경은 overIdx(자리표시 위치)가 담당
type HoverState = { kind: 'kpi' | 'col'; zone: DropZone } | null

// 호버 대상 동일성 — 같은 값이면 setState 스킵(드래그 중 불필요한 보드 리렌더 방지)
const sameHover = (a: HoverState, b: HoverState) => {
  if (a === b) return true
  if (!a || !b) return false
  return a.kind === b.kind && a.zone === b.zone
}

// 카드 내용(열·유령 공용) — TaskAccordion의 압축판.
// 제목 줄: N배지 · 제목 · (Check 칩, 우측) / 메타 줄: 구분 · 담당자 · (발의일, 우측).
// Check는 제목 줄 오른쪽에 둬서 메타 줄의 날짜 '위'에 오게 한다(우측 상하 정렬).
function CardInner({ t }: { t: WorkItem }) {
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
        {isWorkNew(t) && (
          <Box component="span" sx={{ flexShrink: 0, mt: '3px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: 'error.main', color: 'common.white', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
        )}
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.45 }}>
          {taskTitle(t)}
        </Typography>
        {t.chief && <Box component="span" sx={{ flexShrink: 0 }}><StatusChip status="purple" label="Check" /></Box>}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
        {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
        <ManagerChip name={t.mgr} />
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', height: 22, fontSize: typescale.small.size, borderRadius: `${radius.chip}px`, px: 0.75, color: 'text.secondary', bgcolor: alpha(th.palette.text.secondary, 0.12), fontFamily: 'monospace', whiteSpace: 'nowrap', marginLeft: 'auto' })}>
          {fmtDate(t.start)}
        </Box>
      </Box>
    </>
  )
}

// 보드 카드 — memo로 감싸 드래그 중 다른 카드의 리렌더를 차단(순서 전환 시 프레임 저하의 주원인 제거).
// 콜백은 부모에서 ref로 고정 전달하므로, 실제로 바뀌는 값은 selected/draggable/toneRgb뿐 → 해당 카드만 갱신.
interface BoardCardProps {
  t: WorkItem
  zone: DropZone
  toneRgb: string
  selected: boolean
  draggable: boolean
  onPointerDown: (e: React.PointerEvent, t: WorkItem, zone: DropZone) => void
  onClick: (t: WorkItem) => void
  register: (num: string, el: HTMLElement | null) => void
}
const BoardCard = memo(function BoardCard({ t, zone, toneRgb, selected, draggable, onPointerDown, onClick, register }: BoardCardProps) {
  const c = (a: number) => `rgb(${toneRgb} / ${a})`
  const sel = selected ? { borderColor: c(0.92), bgcolor: c(0.15), boxShadow: `0 0 0 2px ${c(0.22)}` } : null
  return (
    <Box
      data-kanban-card
      data-num={t.num}
      ref={(el: HTMLElement | null) => register(t.num, el)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`업무: ${taskTitle(t)}`}
      onPointerDown={(e) => onPointerDown(e, t, zone)}
      onClick={() => onClick(t)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(t) }
      }}
      sx={{
        border: '1px solid', borderColor: c(0.24), bgcolor: c(0.055),
        borderRadius: `${radius.card}px`, px: 1.5, py: 1.25,
        cursor: draggable ? 'grab' : 'pointer',
        userSelect: 'none',
        // 드래그 가능한 카드만 세로 팬 제한(가로 끌기=드래그). 비드래그 카드는 모바일 보드 가로 스크롤 통과
        touchAction: draggable ? 'pan-y' : 'auto',
        transition: 'border-color .14s, background-color .14s, box-shadow .14s',
        '&:hover': { borderColor: c(0.78), bgcolor: c(0.09) },
        // 선택 > 호버 — 선택 시 호버에도 선택 모습 유지(TaskAccordion과 동일 규칙)
        ...(sel ? { ...sel, '&:hover': sel } : {}),
        ...(focusRingSx as object),
      }}
    >
      <CardInner t={t} />
    </Box>
  )
})

/**
 * 업무 보드(칸반) — 진행중/보류/완료/Remind 4열을 한 화면에.
 * 드래그 3종: ① 다른 열에 놓기 = 상태 변경(정착 애니메이션) ② KPI 스트립에 놓기 = 상태 변경(지니 흡입)
 * ③ 진행중 열 안 = 삽입정렬 순서변경 — 그리드와 동일한 감각(자리표시 + 주변 카드 FLIP 슬라이드 +
 *    고정 슬롯·28px 히스테리시스·240ms 판정 잠금 + 180ms 드롭 정착). 클릭 = 상세 토글.
 * 성능: 카드 memo화(드래그 중 무관 카드 리렌더 차단) + 유령 위치는 DOM 직접 갱신(리렌더 없음).
 * 상태 변경·순서변경 모두 기존 경로(onStatusDrop/onReorder) 재사용 — Undo/Redo·저장 큐·롤백 공유.
 */
export default function KanbanBoard({
  items, canDrag, onStatusDrop, onCardClick, selectedNum, sort,
  inProgressOrder, canReorder = false, onReorder, onZoneChange,
}: KanbanBoardProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hover, setHover] = useState<HoverState>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null) // 진행중 열 자리표시 위치(드래그 카드 제외 기준)
  const colRefs = useRef<Partial<Record<DropZone, HTMLDivElement | null>>>({})
  const cardEls = useRef(new Map<string, HTMLElement>()) // FLIP·정착 애니메이션용 카드 요소
  const flipRects = useRef(new Map<string, { left: number; top: number }>()) // 문서좌표(left/top) — 진행중 카드만
  const settleFrom = useRef<null | { num: string; rect: DOMRect }>(null) // 드롭 정착 시작 위치(유령 카드 마지막 자리)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null) // 가로 자동 스크롤 대상(overflowX 컨테이너)
  const pointerRef = useRef({ x: 0, y: 0 }) // 최신 포인터 위치(자동 스크롤·유령 위치 동기)
  const dragRef = useRef<DragState | null>(null) // grab 오프셋(dx/dy) 참조 — 렌더 시점 유령 위치 보정용
  dragRef.current = drag

  // 유령 카드 위치 동기 — 렌더 직후(페인트 전) 항상 '최신 커서 위치'로 맞춘다.
  // setDrag가 활성화 시점(8px 지난 순간) 좌표로 마운트하면, 그새 커서가 더 나가 있을 때
  // 원래 위치보다 떨어진 자리에서 시작되는 문제 방지. 이후 이동은 move에서 DOM 직접 갱신.
  useLayoutEffect(() => {
    const d = dragRef.current
    const g = ghostRef.current
    if (!d || !g) return
    g.style.left = `${pointerRef.current.x - d.dx}px`
    g.style.top = `${pointerRef.current.y - d.dy}px`
  })

  // 상태 → 열 분배. Remind 플래그는 상태와 직교라 Remind 열로만 보내 중복 표시 방지(KPI 존과 동일 시맨틱)
  const colItems = useMemo(() => {
    const m: Record<DropZone, WorkItem[]> = { inProgress: [], hold: [], done: [], remind: [] }
    for (const t of items) {
      if (t.remind) { m.remind.push(t); continue }
      const c = classify(t)
      if (c === 'inProgress') m.inProgress.push(t)
      else if (c === 'hold') m.hold.push(t)
      else if (c === 'done') m.done.push(t)
      // 취소·미정은 보드 미표시(하단 안내)
    }
    // 진행중 = 목록 보기와 같은 내 수동 순서(없는 카드는 Check 우선·최신순으로 뒤에), 그 외 = 최신순
    if (inProgressOrder && inProgressOrder.length) {
      const rank = new Map(inProgressOrder.map((n, i) => [n, i]))
      m.inProgress.sort((a, b) => (rank.get(a.num) ?? Infinity) - (rank.get(b.num) ?? Infinity)
        || (b.chief ? 1 : 0) - (a.chief ? 1 : 0) || byDateDesc(a, b))
    } else {
      m.inProgress.sort((a, b) => (b.chief ? 1 : 0) - (a.chief ? 1 : 0) || byDateDesc(a, b))
    }
    m.hold.sort(byDateDesc)
    m.done.sort(byDateDesc)
    m.remind.sort(byDateDesc)
    // 표시 정렬 활성 시 각 열 안에서 재정렬(안정 정렬 — 동률은 기본 순서 유지)
    if (sort) {
      m.inProgress = sort(m.inProgress)
      m.hold = sort(m.hold)
      m.done = sort(m.done)
      m.remind = sort(m.remind)
    }
    return m
  }, [items, sort, inProgressOrder])
  const colItemsRef = useRef(colItems)
  colItemsRef.current = colItems
  const shown = COLS.reduce((n, c) => n + colItems[c.zone].length, 0)
  const hidden = items.length - shown

  // FLIP + 드롭 정착 — overIdx/drag가 바뀔 때만(매 렌더 X) 진행중 열 카드의 위치 변화를 240ms 슬라이드.
  // 드롭된 카드는 유령 카드 마지막 자리에서 새 슬롯으로 180ms 정착. 진행중 카드만 측정해 리플로우 최소화.
  useLayoutEffect(() => {
    const st = settleFrom.current
    if (st) {
      settleFrom.current = null
      const el = cardEls.current.get(st.num)
      if (el && el.isConnected) {
        const now = el.getBoundingClientRect()
        if (now.width > 0) {
          const sdx = st.rect.left + st.rect.width / 2 - (now.left + now.width / 2)
          const sdy = st.rect.top + st.rect.height / 2 - (now.top + now.height / 2)
          const sc = Math.max(0.05, st.rect.width / now.width)
          el.getAnimations?.().forEach((a) => a.cancel())
          el.animate(
            [
              { transform: `translate(${sdx}px, ${sdy}px) scale(${sc})`, opacity: 0.92 },
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            ],
            { duration: SETTLE_DURATION, easing: MOVE_EASING },
          )
        }
      }
    }
    if (!drag) { flipRects.current.clear(); return }
    const list = colItemsRef.current.inProgress
    list.forEach((it) => {
      if (it.num === drag.num) return
      const el = cardEls.current.get(it.num)
      if (!el || !el.isConnected) return
      const r = el.getBoundingClientRect()
      const now = { left: r.left + window.scrollX, top: r.top + window.scrollY }
      const prev = flipRects.current.get(it.num)
      if (prev && (Math.abs(prev.left - now.left) > 0.5 || Math.abs(prev.top - now.top) > 0.5)) {
        el.getAnimations?.().forEach((a) => a.cancel())
        el.animate(
          [{ transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` }, { transform: 'translate(0,0)' }],
          { duration: MOVE_DURATION, easing: MOVE_EASING },
        )
      }
      flipRects.current.set(it.num, now)
    })
  }, [overIdx, drag])

  // 포인터 위치 → KPI/열 히트테스트(순서판정은 별도 — 고정 슬롯 기준)
  const hitTest = (x: number, y: number): { hover: HoverState; kpiRect?: DOMRect } => {
    const kpi = zoneAt(x, y)
    if (kpi) return { hover: { kind: 'kpi', zone: kpi.zone }, kpiRect: kpi.rect }
    for (const c of COLS) {
      const el = colRefs.current[c.zone]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { hover: { kind: 'col', zone: c.zone } }
    }
    return { hover: null }
  }

  // 카드 드래그 — 8px 이동부터 시작(클릭 보존, 그리드 ACTIVATION_DISTANCE 동일). window 리스너로 추적, Esc 취소.
  const onCardPointerDown = (e: React.PointerEvent, t: WorkItem, from: DropZone) => {
    if (!canDrag(t) || e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const start = { x: e.clientX, y: e.clientY }
    const grabX = start.x - rect.left
    const grabY = start.y - rect.top
    let moved = false
    let active = false
    let raf: number | null = null
    // 진행중 열 순서변경 문맥 — 드래그 시작 시 고정 저장(그리드와 동일: 슬롯은 시작 시점 좌표 기준)
    const reorderable = from === 'inProgress' && canReorder && !!onReorder
    let slotRects: DOMRect[] = []
    let scrollY0 = 0
    let originIndex = 0
    const overIndexRef = { current: 0 }
    const switchLockUntil = { current: 0 }

    // 목적지 슬롯 판정 — 그리드 detectTargetIndex 동일: 고정 슬롯 중심거리, 새 슬롯이 현재보다
    // SWITCH_MARGIN(28px) 이상 명확히 가까울 때만 재배치, 재배치 후 SWITCH_LOCK_MS(240ms) 판정 잠금.
    const detectTargetIndex = (cardLeft: number, cardTop: number): number => {
      if (slotRects.length === 0) return overIndexRef.current
      if (Date.now() < switchLockUntil.current) return overIndexRef.current
      const dyScroll = window.scrollY - scrollY0
      const dist = (slot: DOMRect) =>
        Math.hypot(cardLeft + rect.width / 2 - (slot.left + slot.width / 2), cardTop + rect.height / 2 - (slot.top - dyScroll + slot.height / 2))
      let best = 0
      let bestD = Infinity
      slotRects.forEach((slot, i) => {
        const di = dist(slot)
        if (di < bestD) { bestD = di; best = i }
      })
      const cur = overIndexRef.current
      if (best === cur) return cur
      if (dist(slotRects[cur]) - bestD < SWITCH_MARGIN) return cur
      switchLockUntil.current = Date.now() + SWITCH_LOCK_MS
      return best
    }

    const updateHover = (x: number, y: number) => {
      const { hover: h } = hitTest(x, y)
      setHover((prev) => (sameHover(prev, h) ? prev : h)) // 값이 같으면 리렌더 스킵
      onZoneChange?.(true, h?.kind === 'kpi' ? h.zone : null) // KPI 스트립 하이라이트 연동
      if (!reorderable) return
      // 진행중 열 안(좌우 여유 40px)이고 KPI·다른 열 위가 아니면 삽입 위치 판정, 아니면 원위치 자리표시
      const colEl = colRefs.current.inProgress
      const inCol = (() => {
        if (!colEl) return false
        const r = colEl.getBoundingClientRect()
        return x >= r.left - REORDER_PAD_X && x <= r.right + REORDER_PAD_X && y >= r.top && y <= r.bottom
      })()
      const wantReorder = inCol && (!h || (h.kind === 'col' && h.zone === 'inProgress'))
      const next = wantReorder ? detectTargetIndex(x - grabX, y - grabY) : originIndex
      if (next !== overIndexRef.current) {
        overIndexRef.current = next
        setOverIdx(next)
      }
    }
    // 가장자리 자동 스크롤(그리드 scrollTick과 동일 컨셉) — 뷰포트 상/하단 72px=페이지 세로,
    // 보드 좌/우 48px=보드 가로. 스크롤된 프레임엔 존 위치가 움직이므로 히트테스트 재계산.
    const autoScroll = () => {
      const p = pointerRef.current
      const EDGE = 72, EDGE_X = 48, MAX = 14
      let dy = 0
      if (p.y < EDGE) dy = -Math.ceil(((EDGE - p.y) / EDGE) * MAX)
      else if (p.y > window.innerHeight - EDGE) dy = Math.ceil(((p.y - (window.innerHeight - EDGE)) / EDGE) * MAX)
      if (dy) window.scrollBy(0, dy)
      let dx = 0
      const board = boardRef.current
      if (board && board.scrollWidth > board.clientWidth) {
        const r = board.getBoundingClientRect()
        if (p.x < r.left + EDGE_X) dx = -Math.ceil(((r.left + EDGE_X - p.x) / EDGE_X) * MAX)
        else if (p.x > r.right - EDGE_X) dx = Math.ceil(((p.x - (r.right - EDGE_X)) / EDGE_X) * MAX)
        if (dx) board.scrollLeft += dx
      }
      if (dy || dx) {
        const g = ghostRef.current
        if (g) { g.style.left = `${p.x - grabX}px`; g.style.top = `${p.y - grabY}px` }
        updateHover(p.x, p.y)
      }
      raf = window.requestAnimationFrame(autoScroll)
    }
    const move = (ev: PointerEvent) => {
      pointerRef.current = { x: ev.clientX, y: ev.clientY } // 항상 최신 커서 기록(활성화 렌더가 이 값으로 유령 배치)
      if (!active && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < ACTIVATION_DISTANCE) return
      if (!active) {
        active = true
        document.body.style.cursor = 'grabbing' // 드래그 중 커서 — 그리드와 동일
        if (reorderable) {
          // 고정 슬롯 캡처 — 현재 진행중 열 카드들의 시작 시점 좌표(그리드 beginDrag와 동일)
          const list = colItemsRef.current.inProgress
          originIndex = Math.max(0, list.findIndex((x) => x.num === t.num))
          const rects: DOMRect[] = []
          let ok = true
          flipRects.current.clear()
          for (const it of list) {
            const el = cardEls.current.get(it.num)
            if (!el) { ok = false; break }
            const br = el.getBoundingClientRect()
            rects.push(br)
            // FLIP 기준선 — 드래그 시작 시점 위치(문서좌표). 이후 자리표시 이동에 따른 변화만 애니메이션.
            if (it.num !== t.num) flipRects.current.set(it.num, { left: br.left + window.scrollX, top: br.top + window.scrollY })
          }
          slotRects = ok ? rects : []
          scrollY0 = window.scrollY
          overIndexRef.current = originIndex
          switchLockUntil.current = 0
          setOverIdx(originIndex) // 원위치 자리표시부터(카드는 열에서 빠지고 점선 슬롯이 생김)
        }
        setDrag({ num: t.num, w: rect.width, h: rect.height, dx: grabX, dy: grabY, x: ev.clientX, y: ev.clientY, from })
        raf = window.requestAnimationFrame(autoScroll)
      }
      moved = true
      ev.preventDefault()
      // 위치는 매 이동마다 DOM 직접 갱신 — setState 리렌더 없음(프레임 저하 방지)
      const g = ghostRef.current
      if (g) { g.style.left = `${ev.clientX - grabX}px`; g.style.top = `${ev.clientY - grabY}px` }
      updateHover(ev.clientX, ev.clientY)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', onKey)
      if (raf != null) window.cancelAnimationFrame(raf)
      document.body.style.cursor = ''
      moveCommittedRef.current = moved // 드롭 직후 click(상세 열림) 억제 여부를 카드 onClick이 읽음
      setDrag(null)
      setHover(null)
      setOverIdx(null)
    }
    const up = (ev: PointerEvent) => {
      if (active) {
        const { hover: h, kpiRect } = hitTest(ev.clientX, ev.clientY)
        const ghostRect = ghostRef.current?.getBoundingClientRect() ?? null
        if (h?.kind === 'kpi') {
          // KPI 스트립 드롭 — 그리드와 동일하게 유령 카드가 존으로 지니 흡입된 뒤 확정
          const res = onStatusDrop([t.num], h.zone)
          if (res) {
            const ghost = ghostRef.current
            const zoneEl = document.querySelector(`[data-dropzone="${h.zone}"]`)
            if (ghost && kpiRect) void genieOverlayInto(ghost, kpiRect, zoneEl).then(res.finalize)
            else res.finalize()
          }
        } else if (h?.kind === 'col' && h.zone !== from) {
          // 다른 열 드롭 = 상태 변경 — 유령 카드 마지막 자리에서 새 열 슬롯으로 정착 애니메이션
          const res = onStatusDrop([t.num], h.zone)
          if (res) {
            if (ghostRect) settleFrom.current = { num: t.num, rect: ghostRect }
            res.finalize()
          }
        } else if (reorderable) {
          // 그 외 자리에서 놓음 = 자리표시 위치로 삽입 확정(그리드와 동일 — 놓는 곳이 아니라 자리표시가 기준)
          const cur = colItemsRef.current.inProgress.map((x) => x.num)
          const rest = cur.filter((n) => n !== t.num)
          const idx = Math.max(0, Math.min(overIndexRef.current, rest.length))
          rest.splice(idx, 0, t.num)
          if (ghostRect) settleFrom.current = { num: t.num, rect: ghostRect } // 순서 무변경이어도 원위치 정착
          if (rest.join('|') !== cur.join('|')) onReorder!(rest)
        }
      }
      onZoneChange?.(false, null) // 드롭 직후 KPI 클릭 억제(그리드와 동일 계약)
      cleanup()
    }
    const cancel = () => { onZoneChange?.(false, null); cleanup() }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cancel() }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', onKey)
  }

  // 드래그 이동이 실제로 있었는지 — 카드 onClick이 읽어 드롭 직후 상세 열림을 억제(리렌더 유발 X)
  const moveCommittedRef = useRef(false)

  // memo 카드에 넘길 고정 콜백 — 매 렌더 최신 클로저를 ref로 갈아끼워, 참조는 불변(카드 리렌더 방지)
  const cbRef = useRef({ pointerDown: onCardPointerDown, click: onCardClick })
  cbRef.current.pointerDown = onCardPointerDown
  cbRef.current.click = onCardClick
  const stablePointerDown = useRef((e: React.PointerEvent, t: WorkItem, zone: DropZone) => cbRef.current.pointerDown(e, t, zone)).current
  const stableClick = useRef((t: WorkItem) => {
    if (moveCommittedRef.current) { moveCommittedRef.current = false; return }
    cbRef.current.click(t)
  }).current
  const stableRegister = useRef((num: string, el: HTMLElement | null) => {
    if (el) cardEls.current.set(num, el)
    else { cardEls.current.delete(num); flipRects.current.delete(num) }
  }).current

  const dragItem = drag ? items.find((t) => t.num === drag.num) : null
  const overKpi = hover?.kind === 'kpi'

  return (
    <>
      <Box ref={boardRef} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', overflowX: 'auto', pb: 1 }}>
        {COLS.map(({ zone, title, tone, accent, Icon }) => {
          const list = colItems[zone]
          const c = (a: number) => `rgb(${TONE_RGB[tone]} / ${a})`
          const isTarget = !!drag && hover?.kind === 'col' && hover.zone === zone && drag.from !== zone
          const isCandidate = !!drag && drag.from !== zone
          // 진행중 열 삽입정렬 표시 — 드래그 카드는 열에서 빠지고(언마운트) 자리표시(점선)가 overIdx 위치에.
          // 나머지 카드는 FLIP 레이아웃 효과가 이전→새 위치로 슬라이드시킨다(그리드와 동일 감각).
          const reordering = zone === 'inProgress' && !!drag && drag.from === 'inProgress' && overIdx != null
          type Entry = { kind: 'card'; t: WorkItem } | { kind: 'ph' }
          let entries: Entry[]
          if (reordering) {
            const rest = list.filter((x) => x.num !== drag!.num)
            const idx = Math.max(0, Math.min(overIdx!, rest.length))
            entries = [
              ...rest.slice(0, idx).map((t): Entry => ({ kind: 'card', t })),
              { kind: 'ph' },
              ...rest.slice(idx).map((t): Entry => ({ kind: 'card', t })),
            ]
          } else {
            entries = list.map((t): Entry => ({ kind: 'card', t }))
          }
          return (
            <Box
              key={zone}
              ref={(el: HTMLDivElement | null) => { colRefs.current[zone] = el }}
              sx={(th) => ({
                flex: '1 1 0', minWidth: 232,
                border: '1px solid',
                borderColor: isTarget ? c(0.85) : isCandidate ? c(0.4) : th.palette.divider,
                borderStyle: isCandidate && !isTarget ? 'dashed' : 'solid',
                borderRadius: `${radius.card}px`,
                bgcolor: isTarget ? c(0.09) : alpha(th.palette.text.primary, 0.025),
                boxShadow: isTarget ? `0 0 0 3px ${c(0.16)}` : 'none',
                transition: 'border-color .14s, background-color .14s, box-shadow .14s',
                display: 'flex', flexDirection: 'column',
              })}
            >
              {/* 열 머리 — 상태 아이콘·이름·건수 */}
              <Box sx={(th) => ({ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1.1, borderBottom: `1px solid ${th.palette.divider}` })}>
                <Icon sx={(th: { palette: { accent: Record<string, string> } }) => ({ fontSize: 18, color: th.palette.accent[accent] })} />
                <Typography sx={(th) => ({ fontSize: typescale.emphasis.size, fontWeight: typescale.pageTitle.weight, color: th.palette.accent[accent] })}>{title}</Typography>
                <Typography sx={{ fontSize: typescale.body.size, color: 'text.disabled' }}>{list.length}</Typography>
              </Box>
              {/* 카드 목록(진행중은 드래그 중 자리표시 포함) */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.25, minHeight: 96 }}>
                {list.length === 0 && (
                  <Typography sx={{ py: 3, textAlign: 'center', fontSize: typescale.body.size, color: 'text.disabled' }}>
                    {isCandidate ? '여기에 놓으면 이 상태로 변경' : '해당 업무 없음'}
                  </Typography>
                )}
                {entries.map((entry) => {
                  if (entry.kind === 'ph') {
                    // 목적지 자리표시(점선) — 그리드 placeholder와 동일 규격(드래그 카드 높이만큼 공간 확보)
                    return (
                      <Box
                        key="__placeholder__"
                        aria-hidden
                        sx={(th) => ({
                          minHeight: drag?.h ?? 96,
                          border: '2px dashed', borderColor: alpha(th.palette.accent.green, 0.72),
                          bgcolor: alpha(th.palette.accent.green, 0.06), borderRadius: `${radius.card}px`,
                        })}
                      />
                    )
                  }
                  const t = entry.t
                  return (
                    <BoardCard
                      key={t.id}
                      t={t}
                      zone={zone}
                      toneRgb={TONE_RGB[tone]}
                      selected={selectedNum === t.num}
                      draggable={canDrag(t)}
                      onPointerDown={stablePointerDown}
                      onClick={stableClick}
                      register={stableRegister}
                    />
                  )
                })}
              </Box>
            </Box>
          )
        })}
      </Box>
      {hidden > 0 && (
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
          취소·미정 상태 {hidden}건은 보드에 표시되지 않습니다.
        </Typography>
      )}
      {/* 드래그 유령 카드 — 포인터 추적 고정 복제. 원래 크기 유지(집자마자 그대로 이동), KPI 접근 시만 축소로 흡입 예고 */}
      {drag && dragItem && (
        <Box
          ref={ghostRef}
          aria-hidden
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy }}
          sx={(th) => ({
            position: 'fixed', zIndex: th.zIndex.modal + 1, pointerEvents: 'none',
            width: drag.w,
            border: '1px solid', borderColor: `rgb(${TONE_RGB[COLS.find((cc) => cc.zone === drag.from)!.tone]} / 0.85)`,
            bgcolor: 'background.paper',
            borderRadius: `${radius.card}px`, px: 1.5, py: 1.25,
            boxShadow: shadow.lg, opacity: 0.96,
            // 기본은 원래 크기(scale 없음) — 집는 순간 커지거나 떠오르는 연출 없음. KPI 위에서만 축소로 흡입 예고.
            transform: overKpi ? 'scale(0.7)' : 'none',
            transformOrigin: '50% 0%',
            transition: 'transform .16s ease',
            willChange: 'left, top',
          })}
        >
          <CardInner t={dragItem} />
        </Box>
      )}
    </>
  )
}
