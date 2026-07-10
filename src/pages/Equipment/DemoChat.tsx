import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { MEMBERS, given } from '@/pages/Calendar/members'
import { RichBodyEditor } from '@/components/richText'
import { RichBodyView } from '@/utils/richBody'
import type { DemoChatMsg } from '@/api/demo'

/** 카드 날짜 — MM.DD (KST 고정, 다른 포매터들과 동일 관례). ko-KR "07. 08." → "07.08" */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const FALLBACK = '#8a8f98'
/** 담당자 색을 밝게 — 어두운 카드 위 제목/칩 글자용 */
const liteC = (c: string) => `color-mix(in srgb, ${c} 55%, #ffffff)`

const CARD_GAP = 10 // 카드 간격(px)

// ── 부드러운 드래그(포인터 기반 삽입정렬 + FLIP) 상수 ──
const ACTIVATION_DISTANCE = 8   // px 이상 움직여야 드래그 시작(제자리 더블클릭=수정과 구분)
const SWITCH_LOCK_MS = 70       // 재배치 직후 추가 판정 잠금(애니 중 왕복만 살짝 막고 즉각 반응)
const MOVE_DURATION = 150       // 주변 카드 자리 이동 애니메이션(ms) — 짧게 = 즉시 비켜주는 감
const SETTLE_DURATION = 180     // 드롭 후 정착 애니메이션(ms)
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CLICK_SUPPRESS_MS = 320   // 드롭 직후 더블클릭(수정) 억제

/** 네온 카드 껍데기 — 제목 띠(담당자 색) + 얇은 구분선 + 본문. 작성/수정/표시 카드가 동일 포맷 공유 */
function neonSx(c: string) {
  return { borderRadius: '8px', overflow: 'hidden', bgcolor: '#1a1d26', color: '#dfe6f2', border: `1px solid ${alpha(c, 0.85)}`, boxShadow: `0 0 5px ${alpha(c, 0.18)}` } as const
}

/**
 * 코멘트 메모 카드 1장 — 네온(어두운 카드 + 담당자 색 테두리). 표시 전용.
 * 수정 = 카드 더블클릭(본인/관리자, 래퍼가 처리) · 삭제 = X 버튼(본인/관리자) · 순서 = 드래그(래퍼가 처리).
 */
function MemoCard({ m, own, onDelete }: { m: DemoChatMsg; own: boolean; onDelete: () => void }) {
  const c = memberOf(m.author)?.color || FALLBACK
  // 제목 도입 전 구버전 글(title='')은 본문을 제목 자리로 올림(빈 띠 방지)
  const title = m.title || m.body
  const body = m.title ? m.body : ''
  return (
    <Box sx={{ ...neonSx(c), height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.14), borderBottom: body ? `1px solid ${alpha(c, 0.28)}` : 'none' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, lineHeight: 1.3, color: liteC(c), textShadow: `0 0 3px ${alpha(c, 0.35)}`, wordBreak: 'break-word' }}>{title}</Box>
        <Box component="span" sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 20, px: 1, fontSize: 11, fontWeight: 600, borderRadius: '7px', whiteSpace: 'nowrap', border: `1px solid ${alpha(c, 0.85)}`, color: liteC(c) }}>{m.author || '팀원'}</Box>
        <Box component="span" sx={{ flex: 'none', fontSize: 10.5, fontFamily: 'monospace', color: '#7e8797', opacity: 0.75 }}>{fmtDay(m.createdAt)}</Box>
        {own && (
          <IconButton size="small" aria-label="코멘트 삭제" onClick={onDelete} sx={{ p: '1px', flex: 'none', color: 'rgba(255,255,255,.45)', '&:hover': { color: '#e05b54' } }}>
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        )}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: 12.5, lineHeight: 1.5 }}><RichBodyView html={body} /></Box>}
    </Box>
  )
}

/** 작성/수정 카드 — 표시 카드와 동일한 네온 포맷(제목 띠 + 리치 본문 에디터). 툴바는 축소(compact) */
function ComposeCard({ accent, title, body, busy, onTitle, onBody, onCancel, onSave, saveLabel }: {
  accent: string; title: string; body: string; busy: boolean
  onTitle: (v: string) => void; onBody: (v: string) => void; onCancel: () => void; onSave: () => void; saveLabel: string
}) {
  const c = accent
  return (
    <Box sx={{ ...neonSx(c) }}>
      {/* 제목 띠 — 표시 카드의 제목 자리에 인풋 */}
      <Box sx={{ p: '5px 10px', bgcolor: alpha(c, 0.14), borderBottom: `1px solid ${alpha(c, 0.28)}` }}>
        <InputBase autoFocus value={title} onChange={(e) => onTitle(e.target.value)} placeholder="제목"
          sx={{ width: '100%', fontSize: 13, fontWeight: 700, color: liteC(c), '& input::placeholder': { color: 'rgba(255,255,255,.45)', opacity: 1 } }} />
      </Box>
      {/* 본문 — 공용 리치 에디터(HTML). 어두운 카드라 글자색만 고정. compact=코멘트용 축소 툴바 */}
      <Box sx={{ p: '6px 10px 8px', '& .rb-editor': { color: '#dfe6f2' } }}>
        <RichBodyEditor value={body} onChange={onBody} placeholder="내용 입력… (선택)"
          ariaLabel="코멘트 내용" fontSize={12.5} minHeight={44} onCtrlEnter={onSave} compact />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
          <Button size="small" onClick={onCancel} disabled={busy} sx={{ color: 'rgba(255,255,255,.6)', fontSize: 11.5, minWidth: 0 }}>취소</Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>{saveLabel}</Button>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 코멘트 보드 — 일반 2열 그리드(모바일 1열). 순서 변경 = 부드러운 포인터 드래그(삽입정렬 + FLIP, 팀원) ·
 * 수정 = 카드 더블클릭(본인·관리자) · 삭제 = X · 작성 카드는 보드 하단 전폭.
 *
 * masonry(dense)가 아니라 줄 단위 그리드 → 순서 변경 시 카드가 한 칸씩 밀려 자연스럽다(업무카드와 동일 모델).
 * 드래그: 마우스/펜만(터치 제외) — 8px 이동 시 들어올려 커서추적 오버레이, 포인터 아래 카드 앞/뒤 삽입,
 * 주변 카드 FLIP 이동, Esc/취소 시 원위치, 드롭 시 순서 저장(onReorder) + 낙관적 순서로 즉시 반영.
 */
export default function DemoChat({ memos, canPost, canModerate = false, user, busy, onPost, onEdit, onDelete, onReorder }: {
  memos: DemoChatMsg[]; canPost: boolean; canModerate?: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
  onReorder: (ids: number[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eBody, setEBody] = useState('')
  const [optOrder, setOptOrder] = useState<number[] | null>(null) // 드롭 후 낙관적 순서(서버 반영 전 유지)
  const myColor = memberOf(user || '')?.color || FALLBACK
  // 표시 순서 = 낙관적 순서가 있으면 그 순서로 memos 정렬(원위치 튐 방지), 없으면 서버 순서 그대로
  const orderedMemos = (() => {
    if (!optOrder) return memos
    const pos = new Map(optOrder.map((id, i) => [id, i] as const))
    return [...memos].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
  })()
  const memoById = new Map(orderedMemos.map((m) => [m.id, m]))
  const ownOf = (m: DemoChatMsg) => canModerate || (!!user && m.author === user)

  const itemRefs = useRef(new Map<number, HTMLElement>())
  const setItemRef = (key: number) => (el: HTMLElement | null) => { if (el) itemRefs.current.set(key, el); else itemRefs.current.delete(key) }

  // 드래그 상태
  const [dragId, setDragId] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState(0)
  const memosRef = useRef(orderedMemos); memosRef.current = orderedMemos
  const onReorderRef = useRef(onReorder); onReorderRef.current = onReorder
  const overIndexRef = useRef(0)
  const switchLockUntil = useRef(0)
  const suppressClickUntil = useRef(0)
  const lastPointer = useRef({ x: 0, y: 0 })
  const pending = useRef<null | { id: number; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { id: number; baseOrder: number[]; width: number; height: number; offsetX: number; offsetY: number }>(null)
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const flipRects = useRef(new Map<number, { left: number; top: number }>())
  const settleFrom = useRef<null | { id: number; rect: DOMRect }>(null)

  // FLIP — 순서 변경(드래그)으로 자리가 바뀐 카드를 이전 위치→새 위치로 부드럽게 이동. 드롭 시 정착 애니메이션.
  // 측정 전 진행 중 애니메이션을 먼저 취소 → getBoundingClientRect가 '변환 없는' 실제 레이아웃 좌표를 반환(누적 오염 방지).
  useLayoutEffect(() => {
    if (!drag.current && !settleFrom.current) return
    const st = settleFrom.current
    if (st) {
      settleFrom.current = null
      const el = itemRefs.current.get(st.id)
      if (el) {
        el.getAnimations?.().forEach((a) => a.cancel())
        const now = el.getBoundingClientRect()
        if (now.width > 0) {
          const dx = st.rect.left - now.left
          const dy = st.rect.top - now.top
          el.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.92 }, { transform: 'translate(0,0)', opacity: 1 }], { duration: SETTLE_DURATION, easing: EASING })
        }
      }
    }
    const dragging = !!drag.current
    itemRefs.current.forEach((el, id) => {
      if (drag.current && id === drag.current.id) return
      el.getAnimations?.().forEach((a) => a.cancel()) // 먼저 취소 → 아래 측정이 실제 레이아웃 좌표
      const r = el.getBoundingClientRect()
      const now = { left: r.left + window.scrollX, top: r.top + window.scrollY }
      const prev = flipRects.current.get(id)
      if (dragging && prev && (Math.abs(prev.left - now.left) > 0.5 || Math.abs(prev.top - now.top) > 0.5)) {
        el.animate([{ transform: `translate(${prev.left - now.left}px, ${prev.top - now.top}px)` }, { transform: 'translate(0,0)' }], { duration: MOVE_DURATION, easing: EASING })
      }
      flipRects.current.set(id, now)
    })
  })

  // 낙관적 순서 해제 — 서버 재조회로 순서가 반영되거나 카드 집합이 바뀌면 즉시 해제. 실패로 안 바뀌면 안전 타임아웃(6s).
  useEffect(() => {
    if (!optOrder) return
    const ids = memos.map((m) => m.id)
    const sameSet = ids.length === optOrder.length && ids.every((id) => optOrder.includes(id))
    if (!sameSet || ids.join(',') === optOrder.join(',')) { setOptOrder(null); return }
    const t = window.setTimeout(() => setOptOrder(null), 6000)
    return () => window.clearTimeout(t)
  }, [memos, optOrder])

  const save = async () => { if (!title.trim() || busy) return; try { await onPost(title, draft); setTitle(''); setDraft(''); setAdding(false) } catch { /* 입력 유지 */ } }
  const startEdit = (m: DemoChatMsg) => { setAdding(false); setEditId(m.id); setETitle(m.title); setEBody(m.body) }
  const saveEdit = async () => { if (!eTitle.trim() || editId == null || busy) return; try { await onEdit(editId, eTitle, eBody); setEditId(null) } catch { /* 입력 유지 */ } }

  // ── 드래그(포인터) ──
  const cleanupListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('selectstart', prevent)
  }
  const prevent = (e: Event) => e.preventDefault()

  const beginDrag = (x: number, y: number) => {
    const p = pending.current
    if (!p || drag.current) return
    const baseOrder = memosRef.current.map((m) => m.id)
    const originIndex = baseOrder.indexOf(p.id)
    if (originIndex < 0) return
    // FLIP 기준선 — 현재 모든 카드 위치(문서좌표) 저장
    flipRects.current.clear()
    itemRefs.current.forEach((el, id) => { const r = el.getBoundingClientRect(); flipRects.current.set(id, { left: r.left + window.scrollX, top: r.top + window.scrollY }) })
    drag.current = { id: p.id, baseOrder, width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY }
    overIndexRef.current = originIndex // rest에 dragId를 originIndex로 넣으면 baseOrder와 동일
    switchLockUntil.current = 0
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', prevent)
    document.body.style.cursor = 'grabbing'
    lastPointer.current = { x, y }
    setOverIndex(originIndex)
    setDragId(p.id)
  }

  const updateDrag = (x: number, y: number) => {
    const d = drag.current
    if (!d) return
    if (liftedRef.current) { liftedRef.current.style.left = `${x - d.offsetX}px`; liftedRef.current.style.top = `${y - d.offsetY}px` }
    if (Date.now() < switchLockUntil.current) return
    // 판정점 = 끌리는 카드의 '중심'(커서 끝점 아님) — 카드 몸통이 상대 카드 중앙을 넘으면 바로 자리 교환(밀어내는 감)
    const cx = x - d.offsetX + d.width / 2
    const cy = y - d.offsetY + d.height / 2
    const stack = document.elementsFromPoint(cx, cy)
    let targetId: number | null = null
    let before = true
    for (const el of stack) {
      const cell = (el as HTMLElement).closest?.('[data-memo-id]') as HTMLElement | null
      if (cell) {
        const tid = Number(cell.getAttribute('data-memo-id'))
        if (tid !== d.id) { const r = cell.getBoundingClientRect(); before = cy < r.top + r.height / 2; targetId = tid; break }
      }
    }
    if (targetId == null) return
    const rest = d.baseOrder.filter((id) => id !== d.id)
    const j = rest.indexOf(targetId)
    if (j < 0) return
    const next = before ? j : j + 1
    if (next !== overIndexRef.current) {
      overIndexRef.current = next
      switchLockUntil.current = Date.now() + SWITCH_LOCK_MS
      setOverIndex(next)
    }
  }

  const finishDrag = (commit: boolean) => {
    const d = drag.current
    document.body.style.cursor = ''
    if (!d) return
    const rest = d.baseOrder.filter((id) => id !== d.id)
    const finalOver = commit ? Math.max(0, Math.min(overIndexRef.current, rest.length)) : d.baseOrder.indexOf(d.id)
    const finalOrder = [...rest.slice(0, finalOver), d.id, ...rest.slice(finalOver)]
    const changed = commit && finalOrder.join(',') !== d.baseOrder.join(',')
    if (commit && liftedRef.current) settleFrom.current = { id: d.id, rect: liftedRef.current.getBoundingClientRect() }
    drag.current = null
    flipRects.current.clear()
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    setDragId(null)
    setOverIndex(0)
    if (changed) { setOptOrder(finalOrder); onReorderRef.current(finalOrder) }
  }

  const onMove = (e: PointerEvent) => {
    if (!pending.current) return
    lastPointer.current = { x: e.clientX, y: e.clientY }
    if (!drag.current) {
      const dist = Math.hypot(e.clientX - pending.current.startX, e.clientY - pending.current.startY)
      if (dist < ACTIVATION_DISTANCE) return
      beginDrag(e.clientX, e.clientY)
    }
    if (!drag.current) return
    e.preventDefault()
    updateDrag(e.clientX, e.clientY)
  }
  const onEnd = () => { if (drag.current) finishDrag(true); pending.current = null; cleanupListeners() }
  const onCancel = () => { if (drag.current) finishDrag(false); pending.current = null; cleanupListeners() }
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }

  const onCellPointerDown = (e: React.PointerEvent, id: number) => {
    if (pending.current || drag.current) return
    if (e.button !== 0 || e.pointerType === 'touch') return // 마우스/펜만(터치 드래그 없음)
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [contenteditable="true"]')) return
    const el = itemRefs.current.get(id)
    if (!el) return
    const rect = el.getBoundingClientRect()
    pending.current = { id, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, rect }
    lastPointer.current = { x: e.clientX, y: e.clientY }
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKeyDown)
  }

  // 드래그 중 표시 순서 = 원래 순서에서 드래그 카드를 overIndex 위치로 삽입(원본 기준)
  const baseIds = orderedMemos.map((m) => m.id)
  let displayIds = baseIds
  if (dragId != null) {
    const rest = baseIds.filter((id) => id !== dragId)
    const idx = Math.max(0, Math.min(overIndex, rest.length))
    displayIds = [...rest.slice(0, idx), dragId, ...rest.slice(idx)]
  }
  const dragItem = dragId != null ? memoById.get(dragId) : undefined
  const canDrag = canPost && editId == null

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: `${CARD_GAP}px`, alignItems: 'start', ...(dragId != null ? { userSelect: 'none', WebkitUserSelect: 'none' } : {}) }}>
      {displayIds.map((id) => {
        const m = memoById.get(id)
        if (!m) return null
        // 드래그 중인 카드 자리 = 점선 placeholder(그 높이만큼 공간 확보). 카드 본체는 커서 추적 오버레이로 렌더.
        if (dragId === id) {
          return (
            <Box key={id} aria-hidden sx={(th) => ({ minWidth: 0, minHeight: drag.current?.height ?? 80, border: '2px dashed', borderColor: alpha(th.palette.primary.main, 0.6), bgcolor: alpha(th.palette.primary.main, 0.06), borderRadius: '8px' })} />
          )
        }
        const own = ownOf(m)
        return (
          <Box key={id} data-memo-id={id} ref={setItemRef(id)} sx={{ minWidth: 0, ...(canDrag ? { cursor: 'grab' } : {}) }}
            onPointerDown={canDrag ? (e) => onCellPointerDown(e, id) : undefined}
            onDoubleClick={own && editId == null ? () => { if (Date.now() >= suppressClickUntil.current) startEdit(m) } : undefined}>
            {editId === id ? (
              <ComposeCard accent={memberOf(m.author)?.color || FALLBACK} title={eTitle} body={eBody} busy={busy} saveLabel="수정"
                onTitle={setETitle} onBody={setEBody} onCancel={() => setEditId(null)} onSave={() => void saveEdit()} />
            ) : (
              <MemoCard m={m} own={own} onDelete={() => onDelete(id)} />
            )}
          </Box>
        )
      })}

      {/* 작성/추가 = 보드 하단 전폭(줄 그리드라 자연스러움) */}
      {canPost && (
        <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
          {adding ? (
            <ComposeCard accent={myColor} title={title} body={draft} busy={busy} saveLabel="저장"
              onTitle={setTitle} onBody={setDraft} onCancel={() => { setAdding(false); setTitle(''); setDraft('') }} onSave={() => void save()} />
          ) : (
            <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
              sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 44, border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
              <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
            </Box>
          )}
        </Box>
      )}
      {memos.length === 0 && !adding && !canPost && <Box sx={{ gridColumn: '1 / -1', fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}

      {/* 들어올린 카드 — 커서 추적 오버레이(위치는 ref로 명령형 갱신). 원본 카드 폭 유지 */}
      {dragItem && (
        <Box ref={(el: HTMLDivElement | null) => { liftedRef.current = el; const d = drag.current; if (el && d) { el.style.left = `${lastPointer.current.x - d.offsetX}px`; el.style.top = `${lastPointer.current.y - d.offsetY}px` } }}
          aria-hidden
          sx={(th) => ({ position: 'fixed', zIndex: th.zIndex.modal + 1, width: drag.current?.width, pointerEvents: 'none', opacity: 0.95, borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,.48)' })}>
          <MemoCard m={dragItem} own={ownOf(dragItem)} onDelete={() => {}} />
        </Box>
      )}
    </Box>
  )
}
