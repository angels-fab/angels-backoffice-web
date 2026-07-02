import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { alpha } from '@mui/material/styles'
import { layout } from '@/theme/tokens'
import type { WorkItem } from '@/types'
import { dragScale, suckOverlayInto, zoneAt, type DropZone, type StatusDropResult } from './dropZones'

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
  onSelectToggle: (num: string, mods: { shift: boolean }) => void
  /** 터치 롱프레스 — 선택모드 진입+선택 */
  onLongPress: (num: string) => void
  /** 선택 안 된 카드를 잡음 — 부모가 선택 해제 */
  onDragStartCard: (num: string) => void
  /** 드롭존에 놓음 — null=변경 없음(원위치) */
  onStatusDrop: (nums: string[], zone: DropZone) => StatusDropResult
  /** 드래그 시작/존 변경/종료 알림(KPI 강조용) */
  onZoneChange: (dragging: boolean, zone: DropZone | null) => void
  /** 카드 더블클릭 — 수정모드 진입(부모가 권한 확인) */
  onCardDoubleClick?: (num: string) => void
  /** 카드 영역 좌우 빈 공간에 드롭 — 삭제 확인(단일 드래그만) */
  onDeleteDrop?: (num: string) => void
}

/**
 * 상태변경 드래그 그리드(보류·Check·완료·Remind 목록 공용) — 삽입정렬 없음.
 * 카드를 KPI 드롭존으로 끌어 상태를 바꾼다. 복수선택 시 겹침 스택 미리보기(최대 3장+N건 배지).
 */
export default function StatusDragGrid({
  items, renderCard, canDrag, selectedNums, selMode,
  onSelectToggle, onLongPress, onDragStartCard, onStatusDrop, onZoneChange,
  onCardDoubleClick, onDeleteDrop,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const [dragNum, setDragNum] = useState<string | null>(null)
  const [multiCount, setMultiCount] = useState(0)

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
  const deleteZoneRef = useRef(false)

  const pending = useRef<null | { num: string; pointerType: string; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { num: string; nums: string[]; width: number; height: number; offsetX: number; offsetY: number; startLeft: number; startTop: number; scale: number }>(null)
  const zoneRef = useRef<null | { zone: DropZone; rect: DOMRect }>(null)
  const longPress = useRef<number | null>(null)
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
    // 선택 안 된 카드를 잡으면 선택 해제 후 그 카드 한 장만
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
      startLeft: clientX - p.offsetX, startTop: clientY - p.offsetY, scale: 1,
    }
    if (longPress.current) { clearTimeout(longPress.current); longPress.current = null }
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', onSelectStart)
    document.body.style.cursor = 'grabbing'
    zoneRef.current = null
    deleteZoneRef.current = false
    onZoneChangeRef.current(true, null)
    setMultiCount(nums.length)
    setDragNum(p.num)
  }

  const onMove = (e: PointerEvent) => {
    const p = pending.current
    if (!p) return
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
    const left = e.clientX - d.offsetX
    const top = e.clientY - d.offsetY
    const zh = zoneAt(e.clientX, e.clientY)
    const s = dragScale(e.clientX, e.clientY, !!zh)
    d.scale = s
    const el = liftedRef.current
    if (el) {
      el.style.left = `${left}px`
      el.style.top = `${top}px`
      el.style.transform = `scale(${s})`
      el.style.setProperty('--stack-gap', `${Math.max(2, 10 * ((s - 0.72) / 0.28)).toFixed(1)}px`)
    }
    const prev = zoneRef.current?.zone ?? null
    zoneRef.current = zh
    if ((zh?.zone ?? null) !== prev) onZoneChangeRef.current(true, zh?.zone ?? null)
    // 카드 영역 좌우 빈 공간 = 삭제 영역(단일 드래그·존 밖에서만)
    if (onDeleteDropRef.current && d.nums.length === 1) {
      const gr = rootRef.current?.getBoundingClientRect()
      const del = !zh && !!gr && (e.clientX < gr.left - 24 || e.clientX > gr.right + 24)
      if (del !== deleteZoneRef.current) {
        deleteZoneRef.current = del
        if (el) {
          el.style.outline = del ? '2px dashed rgba(224,91,84,.95)' : ''
          el.style.outlineOffset = del ? '3px' : ''
          el.style.opacity = del ? '0.55' : '0.92'
        }
      }
      if (del && el) el.style.transform = 'scale(0.9)'
    }
  }

  const endDrag = () => {
    document.body.style.cursor = ''
    drag.current = null
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    onZoneChangeRef.current(false, null)
    setDragNum(null)
    setMultiCount(0)
  }

  const onEnd = () => {
    const d = drag.current
    const zh = zoneRef.current
    // 좌우 빈 공간 드롭 = 삭제 확인(단일)
    if (d && !zh && deleteZoneRef.current && d.nums.length === 1 && onDeleteDropRef.current) {
      const num = d.num
      deleteZoneRef.current = false
      endDrag()
      cleanupPending()
      onDeleteDropRef.current(num)
      return
    }
    deleteZoneRef.current = false
    if (d && zh) {
      const res = onStatusDropRef.current(d.nums, zh.zone)
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

  const onClickCapture = (e: React.MouseEvent, num: string) => {
    if (Date.now() < suppressClickUntil.current) { e.preventDefault(); e.stopPropagation(); return }
    if ((e.target as HTMLElement).closest('button, a')) return // 메뉴·링크는 통과
    const item = itemsRef.current.find((i) => i.num === num)
    if (!item || !canDragRef.current(item)) return
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      e.preventDefault(); e.stopPropagation()
      onSelectToggleRef.current(num, { shift: e.shiftKey })
    } else if (selModeRef.current) {
      // 모바일 선택모드: 짧은 탭 = 추가 선택·해제
      e.preventDefault(); e.stopPropagation()
      onSelectToggleRef.current(num, { shift: false })
    }
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
              ...(selected ? { outline: `2px solid ${alpha(th.palette.accent.blue, 0.9)}`, outlineOffset: '-1px' } : {}),
              ...(isDragSource ? { opacity: 0.35 } : {}),
              transition: 'opacity .15s',
            })}
          >
            {renderCard(t)}
            {selected && (
              <CheckCircleIcon
                sx={(th) => ({ position: 'absolute', top: 6, right: 6, fontSize: 20, color: th.palette.accent.blue, pointerEvents: 'none', zIndex: 2, bgcolor: th.palette.background.default, borderRadius: '50%' })}
              />
            )}
          </Box>
        )
      })}

      {/* 드래그 오버레이 — 복수 시 뒤로 겹친 카드(최대 2겹) + N건 배지 */}
      {dragNum && dragItem && (
        <Box
          ref={(el: HTMLDivElement | null) => {
            liftedRef.current = el
            const d = drag.current
            if (el && d) { el.style.left = `${d.startLeft}px`; el.style.top = `${d.startTop}px` }
          }}
          aria-hidden
          sx={(th) => ({
            position: 'fixed', zIndex: th.zIndex.modal + 1,
            width: drag.current?.width, height: drag.current?.height, pointerEvents: 'none',
            opacity: 0.92, borderRadius: 1, transformOrigin: '50% 50%',
            '--stack-gap': '10px',
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
