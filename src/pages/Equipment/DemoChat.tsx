import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'
import ReorderIcon from '@mui/icons-material/Reorder'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { alpha } from '@mui/material/styles'
import { iconSize, radius, shadow, typescale } from '@/theme/tokens'
import { MEMBERS, given } from '@/pages/Calendar/members'
import { RichBodyEditor } from '@/components/richText'
import { RichBodyView } from '@/utils/richBody'
import { type DemoChatMsg } from '@/api/demo'

/** 카드 날짜 — MM.DD (KST 고정, 다른 포매터들과 동일 관례). ko-KR "07. 08." → "07.08" */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const FALLBACK = '#8a8f98'
/** 담당자 색을 밝게 — 어두운 카드 위 제목/칩 글자용 */
const liteC = (c: string) => `color-mix(in srgb, ${c} 55%, #ffffff)`

const CARD_GAP = 10 // 카드 간격(px)
const ADD_KEY = -1  // 추가/작성 칸의 FLIP 측정 키(메모 id와 겹치지 않게 음수)

// ── 부드러운 드래그(포인터 기반 삽입정렬 + FLIP) 상수 ──
const ACTIVATION_DISTANCE = 8   // px 이상 움직여야 드래그 시작
const SWITCH_LOCK_MS = 120      // 재배치 직후 추가 판정 잠금 — 애니 중 미세 왕복만 차단(판정은 구역 기반이라 안정적)
const MOVE_DURATION = 240       // 주변 카드 자리 이동 애니메이션(ms, 업무카드와 동일)
const SETTLE_DURATION = 180     // 드롭 후 정착 애니메이션(ms)
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** 순서 적용 — memos를 id 순서(order)대로 정렬. order에 없는 id는 뒤로(카드 추가/삭제에도 안전) */
const applyOrder = (memos: DemoChatMsg[], order: number[]): DemoChatMsg[] => {
  const pos = new Map(order.map((id, i) => [id, i] as const))
  return [...memos].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9))
}

/** 네온 카드 껍데기 — 제목 띠(담당자 색) + 얇은 구분선 + 본문. 작성/수정/표시 카드가 동일 포맷 공유 */
function neonSx(c: string) {
  return { borderRadius: `${radius.chip}px`, overflow: 'hidden', bgcolor: '#1a1d26', color: '#dfe6f2', border: `1px solid ${alpha(c, 0.85)}`, boxShadow: `0 0 5px ${alpha(c, 0.18)}` } as const
}

/**
 * 코멘트 메모 카드 1장 — 네온(어두운 카드 + 담당자 색 테두리). 표시 전용.
 * 수정 = 카드 더블클릭(본인/관리자, 래퍼가 처리) · 삭제 = X 버튼(본인/관리자) · 순서 = 정렬 모드 핸들 드래그.
 */
function MemoCard({ m, own, onDelete }: { m: DemoChatMsg; own: boolean; onDelete: () => void }) {
  const c = memberOf(m.author)?.color || FALLBACK
  // 제목 도입 전 구버전 글(title='')은 본문을 제목 자리로 올림(빈 띠 방지)
  const title = m.title || m.body
  const body = m.title ? m.body : ''
  return (
    <Box sx={{ ...neonSx(c), height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, p: '6px 10px', bgcolor: alpha(c, 0.14), borderBottom: body ? `1px solid ${alpha(c, 0.28)}` : 'none' }}>
        <Box sx={{ flex: 1, minWidth: 0, fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1.3, color: liteC(c), textShadow: `0 0 3px ${alpha(c, 0.35)}`, wordBreak: 'break-word' }}>{title}</Box>
        <Box component="span" sx={{ flex: 'none', display: 'inline-flex', alignItems: 'center', height: 20, px: 1, fontSize: typescale.caption.size, fontWeight: 600, borderRadius: `${radius.chip}px`, whiteSpace: 'nowrap', border: `1px solid ${alpha(c, 0.85)}`, color: liteC(c) }}>{m.author || '팀원'}</Box>
        <Box component="span" sx={{ flex: 'none', fontSize: typescale.caption.size, fontFamily: 'monospace', color: 'text.disabled', opacity: 0.75 }}>{fmtDay(m.createdAt)}</Box>
        {own && (
          <IconButton size="small" aria-label="코멘트 삭제" onClick={onDelete} sx={(th) => ({ p: '1px', flex: 'none', color: alpha(th.palette.text.primary, 0.45), '&:hover': { color: 'error.main' } })}>
            <CloseIcon sx={{ fontSize: iconSize.caption }} />
          </IconButton>
        )}
      </Box>
      {body && <Box sx={{ p: '7px 10px 10px', fontSize: typescale.body.size, lineHeight: 1.5 }}><RichBodyView html={body} /></Box>}
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
    // 높이 100% + 세로 flex — stretch 행에서 표시 카드처럼 행 높이를 채움(버튼은 하단 정렬)
    <Box sx={{ ...neonSx(c), height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 제목 띠 — 표시 카드의 제목 자리에 인풋 */}
      <Box sx={{ flex: 'none', p: '5px 10px', bgcolor: alpha(c, 0.14), borderBottom: `1px solid ${alpha(c, 0.28)}` }}>
        <InputBase autoFocus value={title} onChange={(e) => onTitle(e.target.value)} placeholder="제목"
          sx={(th) => ({ width: '100%', fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, color: liteC(c), '& input::placeholder': { color: alpha(th.palette.text.primary, 0.45), opacity: 1 } })} />
      </Box>
      {/* 본문 — 공용 리치 에디터(HTML). 어두운 카드라 글자색만 고정. compact=코멘트용 축소 툴바 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: '6px 10px 8px', '& .rb-editor': { color: '#dfe6f2' } }}>
        <RichBodyEditor value={body} onChange={onBody} placeholder="내용 입력… (선택)"
          ariaLabel="코멘트 내용" fontSize={typescale.body.size} minHeight={44} onCtrlEnter={onSave} compact />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 'auto', pt: 0.5 }}>
          <Button size="small" onClick={onCancel} disabled={busy} sx={(th) => ({ color: alpha(th.palette.text.primary, 0.6), fontSize: typescale.small.size, minWidth: 0 })}>취소</Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: typescale.small.size, minWidth: 0 }}>{saveLabel}</Button>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 검토 메모 보드 — 1열 세로 목록(데모 비교가 주인공, 코멘트는 검토 기록). 헤더 = "검토 메모" + (팀원) 코멘트 정렬.
 *
 * 순서 변경은 **명시적 '코멘트 정렬' 모드**에서만 — 각 카드의 DragIndicator 핸들로 드래그(본문 드래그 불가).
 * 정렬 중 순서는 화면 내부(sortDraft)에서만 바뀌고, '완료' 시 한 번 onReorder로 저장 / '취소' 시 서버 순서로 복원.
 * 일반 모드: 수정 = 카드 더블클릭(본인·관리자) · 삭제 = X · 추가 = 하단 바. (정렬 모드에선 이 조작들을 숨김)
 * 드래그 감각(FLIP 자리 이동·Esc 취소·정착 애니메이션)은 업무현황 카드와 동일하게 유지.
 */
export default function DemoChat({ memos, canPost, canModerate = false, user, busy, onPost, onEdit, onDelete, onReorder }: {
  memos: DemoChatMsg[]; canPost: boolean; canModerate?: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
  onReorder: (ids: number[]) => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [draft, setDraft] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eBody, setEBody] = useState('')
  const [optOrder, setOptOrder] = useState<number[] | null>(null) // 저장 후 낙관적 순서(서버 반영 전 유지)
  // ── 코멘트 정렬 모드 ── 팀원이 명시적으로 켜는 순서 변경 모드. sortDraft = 저장 전 화면 내부 순서.
  const [sortMode, setSortMode] = useState(false)
  const [sortDraft, setSortDraft] = useState<number[] | null>(null)
  const [savingSort, setSavingSort] = useState(false)
  const myColor = memberOf(user || '')?.color || FALLBACK

  // 표시 순서 = (정렬 모드) sortDraft > (저장 후) optOrder > 서버 순서. 셋 다 memos를 그 id순서로 정렬.
  const serverOrdered = optOrder ? applyOrder(memos, optOrder) : memos
  const orderedMemos = sortMode && sortDraft ? applyOrder(memos, sortDraft) : serverOrdered
  const memoById = new Map(orderedMemos.map((m) => [m.id, m]))
  const ownOf = (m: DemoChatMsg) => canModerate || (!!user && m.author === user)

  const onReorderRef = useRef(onReorder); onReorderRef.current = onReorder
  const itemRefs = useRef(new Map<number, HTMLElement>())
  const setItemRef = (key: number) => (el: HTMLElement | null) => { if (el) itemRefs.current.set(key, el); else itemRefs.current.delete(key) }

  // 드래그 상태(정렬 모드 전용)
  const [dragId, setDragId] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState(0)
  const memosRef = useRef(orderedMemos); memosRef.current = orderedMemos
  const overIndexRef = useRef(0)
  const switchLockUntil = useRef(0)
  const lastPointer = useRef({ x: 0, y: 0 })
  const pending = useRef<null | { id: number; pid: number; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { id: number; baseOrder: number[]; slotRects: DOMRect[]; scrollY0: number; width: number; height: number; offsetX: number; offsetY: number }>(null)
  const liftedRef = useRef<HTMLDivElement | null>(null)
  const flipRects = useRef(new Map<number, { left: number; top: number }>())
  const settleFrom = useRef<null | { id: number; rect: DOMRect }>(null)
  const dragCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => { dragCleanup.current?.() }, []) // 언마운트 시 리스너·커서 정리

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

  // ── 정렬 모드 진입/취소/완료 ──
  const enterSort = () => { setAdding(false); setEditId(null); setSortDraft(serverOrdered.map((m) => m.id)); setSortMode(true) }
  const cancelSort = () => { if (drag.current || savingSort) return; setSortMode(false); setSortDraft(null) } // 서버 순서로 복원(저장 안 함)
  const completeSort = async () => {
    if (!sortDraft || savingSort || drag.current) return
    const ids = sortDraft
    // '변화 없음' 기준 = 지금 화면에 표시 중인 순서(serverOrdered = optOrder 반영). memos(원본)로 비교하면
    // 저장 직후 optOrder가 떠 있는 창에서 되돌리기가 조용히 누락·화면 튐(리뷰 #1) → serverOrdered로 비교.
    if (ids.join(',') === serverOrdered.map((m) => m.id).join(',')) { setSortMode(false); setSortDraft(null); return }
    setSavingSort(true)
    try {
      await onReorderRef.current(ids)      // 한 번만 저장(reorderDemoChat) — 실패 시 throw
      setOptOrder(ids)                      // 저장 성공 → 서버 재조회 반영 전까지 낙관 순서 유지(깜빡임 방지)
      setSortMode(false); setSortDraft(null)
    } catch { /* 실패 = 정렬 모드 유지, 부모가 스낵바로 알림 */ }
    finally { setSavingSort(false) }
  }

  // ── 드래그(포인터, 정렬 모드 전용) ──
  const cleanupListeners = () => {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onEnd)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('selectstart', prevent)
    dragCleanup.current = null
  }
  const prevent = (e: Event) => e.preventDefault()

  const beginDrag = (x: number, y: number) => {
    const p = pending.current
    if (!p || drag.current) return
    const baseOrder = memosRef.current.map((m) => m.id)
    const originIndex = baseOrder.indexOf(p.id)
    if (originIndex < 0) return
    // 슬롯 좌표 = 드래그 시작 시 1회 고정 캡처(업무카드 방식) — 이동한 카드들의 현재 위치로 재계산하지 않아 왕복 없음
    const slotRects: DOMRect[] = []
    for (const id of baseOrder) {
      const el = itemRefs.current.get(id)
      if (!el) return // 측정 불가 → 시작 안 함
      slotRects.push(el.getBoundingClientRect())
    }
    // FLIP 기준선 — 현재 모든 카드 위치(문서좌표) 저장
    flipRects.current.clear()
    itemRefs.current.forEach((el, id) => { const r = el.getBoundingClientRect(); flipRects.current.set(id, { left: r.left + window.scrollX, top: r.top + window.scrollY }) })
    drag.current = {
      id: p.id, baseOrder, slotRects, scrollY0: window.scrollY, width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY,
    }
    overIndexRef.current = originIndex
    switchLockUntil.current = 0
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', prevent)
    document.body.style.cursor = 'grabbing'
    lastPointer.current = { x, y }
    setOverIndex(originIndex)
    setDragId(p.id)
  }

  // 삽입 위치 판정 — 1열이라 각 카드 = 한 행. 판정점은 '끌리는 카드의 중심'(업무현황 카드와 동일 — 마우스 포인터 아님):
  // 세로로 어느 행인지 찾고, 그 카드의 상/하 절반으로 앞/뒤를 정한다.
  const insertIndexAt = (slots: DOMRect[], y: number, dyScroll: number): number => {
    const rows = slots.map((s, i) => ({ top: s.top - dyScroll, bottom: s.bottom - dyScroll, mid: s.top - dyScroll + s.height / 2, i }))
    if (!rows.length) return 0
    if (y < rows[0].top) return 0
    for (const r of rows) { if (y <= r.bottom + CARD_GAP) return y < r.mid ? r.i : r.i + 1 }
    return slots.length // 모든 카드 아래 = 맨 끝
  }

  const updateDrag = (x: number, y: number) => {
    const d = drag.current
    if (!d) return
    const left = x - d.offsetX
    const top = y - d.offsetY
    if (liftedRef.current) { liftedRef.current.style.left = `${left}px`; liftedRef.current.style.top = `${top}px` }
    // 판정점 = 끌리는 카드의 '중심'(업무현황 카드와 동일). 포인터가 아니라 카드가 놓일 자리를 보고 판정.
    const cy = top + d.height / 2
    if (Date.now() < switchLockUntil.current) return
    const dyScroll = window.scrollY - d.scrollY0 // 드래그 중 페이지 스크롤 보정
    const raw = insertIndexAt(d.slotRects, cy, dyScroll)
    // 원본 슬롯 인덱스 → rest(드래그 카드 제외) 삽입 인덱스 보정
    const originIndex = d.baseOrder.indexOf(d.id)
    const next = Math.max(0, Math.min(raw > originIndex ? raw - 1 : raw, d.baseOrder.length - 1))
    if (next === overIndexRef.current) return
    switchLockUntil.current = Date.now() + SWITCH_LOCK_MS
    overIndexRef.current = next
    setOverIndex(next)
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
    setDragId(null)
    setOverIndex(0)
    // 저장은 여기서 하지 않음 — 화면 내부 순서(sortDraft)만 갱신. 서버 저장은 '완료' 버튼에서 한 번만.
    if (changed) setSortDraft(finalOrder)
  }

  const onMove = (e: PointerEvent) => {
    if (!pending.current || e.pointerId !== pending.current.pid) return // 시작한 포인터만(마우스+펜 혼선 차단)
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
  const onEnd = (e: PointerEvent) => { if (pending.current && e.pointerId !== pending.current.pid) return; if (drag.current) finishDrag(true); pending.current = null; cleanupListeners() }
  const onCancel = (e?: PointerEvent) => { if (e && pending.current && e.pointerId !== pending.current.pid) return; if (drag.current) finishDrag(false); pending.current = null; cleanupListeners() }
  const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }

  // 정렬 모드 핸들에서만 드래그 시작(카드 본문 드래그 없음). 저장(완료) 대기 중엔 시작 금지 —
  // await 도중 드래그를 시작하면 저장 완료 시 sortMode가 꺼지며 드롭이 삭제·카드가 붕 뜨는 글리치(리뷰 #2·#3).
  const onHandlePointerDown = (e: React.PointerEvent, id: number) => {
    if (pending.current || drag.current || savingSort) return
    if (e.button !== 0 || e.pointerType === 'touch') return // 마우스/펜만(터치 드래그 없음)
    e.preventDefault()
    const el = itemRefs.current.get(id)
    if (!el) return
    const rect = el.getBoundingClientRect()
    pending.current = { id, pid: e.pointerId, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, rect }
    lastPointer.current = { x: e.clientX, y: e.clientY }
    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onCancel)
    document.addEventListener('keydown', onKeyDown)
    dragCleanup.current = () => { cleanupListeners(); if (drag.current) finishDrag(false); pending.current = null; document.body.style.cursor = '' }
  }

  // 드래그 중 표시 순서 = 원래 순서에서 드래그 카드를 overIndex 위치로 삽입
  const baseIds = orderedMemos.map((m) => m.id)
  let displayIds = baseIds
  if (dragId != null) {
    const rest = baseIds.filter((id) => id !== dragId)
    const idx = Math.max(0, Math.min(overIndex, rest.length))
    displayIds = [...rest.slice(0, idx), dragId, ...rest.slice(idx)]
  }
  const dragItem = dragId != null ? memoById.get(dragId) : undefined
  const canSort = canPost && orderedMemos.length > 1

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* 헤더 — "검토 메모" + (팀원) 코멘트 정렬 / 정렬 중이면 취소·완료 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 28 }}>
        <Box sx={{ fontSize: typescale.body.size, fontWeight: 800, letterSpacing: '.02em', color: 'text.secondary' }}>검토 메모</Box>
        <Box sx={{ flex: 1 }} />
        {canSort && !sortMode && (
          <Button size="small" startIcon={<ReorderIcon sx={{ fontSize: iconSize.body }} />} onClick={enterSort}
            sx={{ fontSize: typescale.small.size, minWidth: 0, py: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}>코멘트 정렬</Button>
        )}
        {sortMode && (
          <>
            <Button size="small" onClick={cancelSort} disabled={savingSort} sx={{ fontSize: typescale.small.size, minWidth: 0, py: 0.25, color: 'text.secondary' }}>취소</Button>
            <Button size="small" variant="contained" onClick={() => void completeSort()} disabled={savingSort}
              startIcon={savingSort ? <CircularProgress size={14} thickness={5} color="inherit" /> : <CheckIcon sx={{ fontSize: iconSize.body }} />}
              sx={{ fontSize: typescale.small.size, minWidth: 0, py: 0.25 }}>완료</Button>
          </>
        )}
      </Box>
      {sortMode && (
        <Box sx={(th) => ({ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 0.5, px: 1, py: 0.75, borderRadius: `${radius.chip}px`, bgcolor: alpha(th.palette.primary.main, 0.1), fontSize: typescale.caption.size, lineHeight: 1.5, color: 'text.secondary' })}>
          <Box component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>코멘트 정렬 중</Box>
          <Box component="span">· 카드 핸들을 끌어 순서를 바꾸세요. 완료하면 모든 팀원에게 같은 순서로 보입니다.</Box>
        </Box>
      )}

      {/* 목록 — 1열(PC·모바일 공통). 정렬 모드에서만 핸들 드래그로 순서 변경 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: `${CARD_GAP}px`, ...(dragId != null ? { userSelect: 'none', WebkitUserSelect: 'none' } : {}) }}>
        {displayIds.map((id) => {
          const m = memoById.get(id)
          if (!m) return null
          // 드래그 중인 카드 자리 = 점선 placeholder(그 높이만큼 공간 확보). 카드 본체는 커서 추적 오버레이로 렌더.
          if (dragId === id) {
            return (
              <Box key={id} aria-hidden sx={(th) => ({ minWidth: 0, minHeight: drag.current?.height ?? 80, border: '2px dashed', borderColor: alpha(th.palette.primary.main, 0.6), bgcolor: alpha(th.palette.primary.main, 0.06), borderRadius: `${radius.chip}px` })} />
            )
          }
          const own = ownOf(m)
          return (
            <Box key={id} data-memo-id={id} ref={setItemRef(id)} sx={{ position: 'relative', minWidth: 0 }}
              onDoubleClick={!sortMode && own && editId == null ? () => startEdit(m) : undefined}>
              {sortMode ? (
                <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.75 }}>
                  {/* 드래그 핸들 — 이 핸들로만 순서 변경. 카드 본문은 드래그 불가 */}
                  <Box role="button" aria-label="드래그하여 순서 변경" onPointerDown={(e) => onHandlePointerDown(e, id)}
                    sx={(th) => ({ flex: 'none', display: 'flex', alignItems: 'center', px: 0.25, borderRadius: `${radius.chip}px`, cursor: 'grab', touchAction: 'none', color: 'text.disabled', '&:hover': { color: 'text.primary', bgcolor: alpha(th.palette.primary.main, 0.12) }, '&:active': { cursor: 'grabbing' } })}>
                    <DragIndicatorIcon sx={{ fontSize: iconSize.header }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><MemoCard m={m} own={false} onDelete={() => {}} /></Box>
                </Box>
              ) : editId === id ? (
                <ComposeCard accent={memberOf(m.author)?.color || FALLBACK} title={eTitle} body={eBody} busy={busy} saveLabel="수정"
                  onTitle={setETitle} onBody={setEBody} onCancel={() => setEditId(null)} onSave={() => void saveEdit()} />
              ) : (
                <MemoCard m={m} own={own} onDelete={() => onDelete(id)} />
              )}
            </Box>
          )
        })}

        {/* 작성/추가 = 하단 바(일반 모드에서만 — 정렬 모드에선 숨김) */}
        {canPost && !sortMode && (
          <Box ref={setItemRef(ADD_KEY)} sx={{ minWidth: 0 }}>
            {adding ? (
              <ComposeCard accent={myColor} title={title} body={draft} busy={busy} saveLabel="저장"
                onTitle={setTitle} onBody={setDraft} onCancel={() => { setAdding(false); setTitle(''); setDraft('') }} onSave={() => void save()} />
            ) : (
              <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
                sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 36, border: `1px dashed ${th.palette.divider}`, borderRadius: `${radius.button}px`, color: 'text.disabled', cursor: 'pointer', fontSize: typescale.small.size, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
                <AddIcon sx={{ fontSize: iconSize.body }} /> 코멘트 추가
              </Box>
            )}
          </Box>
        )}
        {memos.length === 0 && !adding && !canPost && <Box sx={{ fontSize: typescale.small.size, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}

        {/* 들어올린 카드 — 커서 추적 오버레이(위치는 ref로 명령형 갱신). 원본 카드 폭 유지 */}
        {dragItem && (
          <Box ref={(el: HTMLDivElement | null) => { liftedRef.current = el; const d = drag.current; if (el && d) { el.style.left = `${lastPointer.current.x - d.offsetX}px`; el.style.top = `${lastPointer.current.y - d.offsetY}px` } }}
            aria-hidden
            sx={(th) => ({ position: 'fixed', zIndex: th.zIndex.modal + 1, width: drag.current?.width, height: drag.current?.height, pointerEvents: 'none', opacity: 0.95, borderRadius: `${radius.chip}px`, boxShadow: shadow.lg })}>
            <MemoCard m={dragItem} own={false} onDelete={() => {}} />
          </Box>
        )}
      </Box>
    </Box>
  )
}
