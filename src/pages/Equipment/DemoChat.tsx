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
import { decodeCardWidth, type DemoChatMsg } from '@/api/demo'

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
const ACTIVATION_DISTANCE = 8   // px 이상 움직여야 드래그 시작(제자리 더블클릭=수정과 구분)
const SWITCH_LOCK_MS = 120      // 재배치 직후 추가 판정 잠금 — 애니 중 미세 왕복만 차단(판정은 구역 기반이라 안정적)
const MOVE_DURATION = 240       // 주변 카드 자리 이동 애니메이션(ms, 업무카드와 동일)
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
    // 높이 100% + 세로 flex — stretch 행에서 표시 카드처럼 행 높이를 채움(버튼은 하단 정렬)
    <Box sx={{ ...neonSx(c), height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 제목 띠 — 표시 카드의 제목 자리에 인풋 */}
      <Box sx={{ flex: 'none', p: '5px 10px', bgcolor: alpha(c, 0.14), borderBottom: `1px solid ${alpha(c, 0.28)}` }}>
        <InputBase autoFocus value={title} onChange={(e) => onTitle(e.target.value)} placeholder="제목"
          sx={{ width: '100%', fontSize: 13, fontWeight: 700, color: liteC(c), '& input::placeholder': { color: 'rgba(255,255,255,.45)', opacity: 1 } }} />
      </Box>
      {/* 본문 — 공용 리치 에디터(HTML). 어두운 카드라 글자색만 고정. compact=코멘트용 축소 툴바 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: '6px 10px 8px', '& .rb-editor': { color: '#dfe6f2' } }}>
        <RichBodyEditor value={body} onChange={onBody} placeholder="내용 입력… (선택)"
          ariaLabel="코멘트 내용" fontSize={12.5} minHeight={44} onCtrlEnter={onSave} compact />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 'auto', pt: 0.5 }}>
          <Button size="small" onClick={onCancel} disabled={busy} sx={{ color: 'rgba(255,255,255,.6)', fontSize: 11.5, minWidth: 0 }}>취소</Button>
          <Button size="small" variant="contained" onClick={onSave} disabled={busy || !title.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>{saveLabel}</Button>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * 코멘트 보드 — 일반 2열 그리드(모바일 1열), 같은 행 카드 높이 통일(stretch). 순서 변경 = 부드러운 포인터
 * 드래그(삽입정렬 + FLIP, 팀원) · 수정 = 카드 더블클릭(본인·관리자) · 삭제 = X ·
 * 폭 = 오른쪽 엣지 드래그로 1↔2열 스냅(기본 1열, DB width) · 추가/작성 = 다음 카드 자리(1열).
 *
 * masonry(dense)가 아니라 줄 단위 그리드 → 순서 변경 시 카드가 한 칸씩 밀려 자연스럽다(업무카드와 동일 모델).
 * 드래그: 마우스/펜만(터치 제외) — 8px 이동 시 들어올려 커서추적 오버레이. 목적지 판정은 업무카드와
 * 동일하게 시작 시 고정 캡처한 슬롯 좌표 vs 이동 카드 중심의 최근접 매칭(MARGIN 히스테리시스) — 즉시 비켜줌.
 * 주변 카드 FLIP 이동, Esc/취소 시 원위치, 드롭 시 순서 저장(onReorder) + 낙관적 순서로 즉시 반영.
 */
export default function DemoChat({ memos, canPost, canModerate = false, user, busy, onPost, onEdit, onDelete, onReorder, onWidth }: {
  memos: DemoChatMsg[]; canPost: boolean; canModerate?: boolean; user: string | null; busy: boolean
  onPost: (title: string, body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
  onReorder: (ids: number[]) => void
  onWidth: (id: number, width: number) => void
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

  // ── 카드 폭 — 좌/우 엣지 드래그. 잡은 반대쪽 엣지가 고정(창 리사이즈 감각):
  //   오른쪽 핸들 = 왼쪽 고정 / 왼쪽 핸들 = 오른쪽 고정(2열을 왼쪽에서 좁히면 우측 1열이 됨).
  //   1·2열 폭 ±SNAP 안 = 자석처럼 그 폭에 딱 붙음(놓기 전에 결과가 보임), 사이 구간 = 자유 폭(% 저장).
  //   인코딩(decodeCardWidth): 1=1열좌 · 2=2열 · 3=1열우 · 1050+pct=자유폭 좌고정 · 2050+pct=자유폭 우고정
  const [wOverride, setWOverride] = useState<Map<number, number>>(new Map()) // 리사이즈 중·저장 대기 낙관값(인코딩 값)
  const widthValOf = (m: DemoChatMsg) => wOverride.get(m.id) ?? (m.width || 1)
  const onWidthRef = useRef(onWidth); onWidthRef.current = onWidth
  const resizing = useRef<null | { id: number; pid: number; startX: number; startVal: number; preview: number; livePx: number; desiredPx: number; snapped: boolean; dir: 1 | -1 }>(null)
  const resizeCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => { resizeCleanup.current?.() }, []) // 언마운트 시 리스너·커서 정리
  // 서버 데이터가 낙관값을 따라잡으면 오버라이드 해제(리사이즈 중인 카드는 건드리지 않음)
  useEffect(() => {
    setWOverride((prev) => {
      if (!prev.size) return prev
      const next = new Map(prev)
      let changed = false
      memos.forEach((m) => {
        if (resizing.current?.id === m.id) return
        const ov = next.get(m.id)
        if (ov !== undefined && (m.width || 1) === ov) { next.delete(m.id); changed = true }
      })
      return changed ? next : prev
    })
  }, [memos])
  // 저장 실패 등으로 남은 오버라이드 안전 해제(6s) — optOrder와 동일한 안전망
  useEffect(() => {
    if (!wOverride.size) return
    const t = window.setTimeout(() => { if (!resizing.current) setWOverride(new Map()) }, 6000)
    return () => window.clearTimeout(t)
  }, [wOverride, memos])
  const areaCatOf = (val: number) => { const c = decodeCardWidth(val); return c.span === 2 ? 2 : c.right ? 3 : 1 }
  const startResize = (e: React.PointerEvent, id: number, dir: 1 | -1) => {
    e.stopPropagation(); e.preventDefault()
    if (e.pointerType === 'touch') return
    if (resizing.current || pending.current || drag.current) return // 다른 제스처 진행 중엔 시작 안 함
    const m = memoById.get(id)
    const cell = itemRefs.current.get(id)
    const grid = cell?.parentElement
    if (!m || !cell || !grid) return
    const oneCol = (grid.clientWidth - CARD_GAP) / 2
    const full = grid.clientWidth
    const SNAP = 36 // 1·2열 자동맞춤 반경(px)
    const startVal = widthValOf(m)
    const startPx = cell.getBoundingClientRect().width
    const startSpan2 = decodeCardWidth(startVal).span === 2
    resizing.current = { id, pid: e.pointerId, startX: e.clientX, startVal, preview: areaCatOf(startVal), livePx: startPx, desiredPx: startPx, snapped: true, dir }
    document.body.style.cursor = 'col-resize'
    cell.style.zIndex = '5' // 실시간 확장 중 이웃 카드 위로
    cell.style.justifySelf = dir === -1 ? 'end' : 'start' // 잡은 반대쪽 엣지 고정
    const clearCellStyle = () => { cell.style.transition = ''; cell.style.width = ''; cell.style.zIndex = ''; cell.style.justifySelf = '' }
    // 1열 확정 시 어느 열인가 — 2열류에서 줄였으면 핸들 반대쪽 열. 1열 카드는 '최소폭 넘어 안쪽으로 50px+ 슬라이드'해야
    // 반대 열로 이동(왼 핸들을 오른쪽으로 계속 끌면 카드가 우측 열로), 살짝 움직인 건 제자리 유지.
    const oneColVal = (desired: number): number => (startSpan2 || desired < oneCol - 50) ? (dir === -1 ? 3 : 1) : startVal
    // live px → 인코딩 값(스냅존 = 1열/2열, 사이 = 자유폭 %)
    const encodeLive = (live: number, desired: number): number => {
      if (live >= full - SNAP) return 2
      if (live <= oneCol + SNAP) return oneColVal(desired)
      const pct = Math.max(50, Math.min(100, Math.round((live / full) * 100)))
      return (dir === -1 ? 2000 : 1000) + pct
    }
    const move = (ev: PointerEvent) => {
      const r = resizing.current
      if (!r || ev.pointerId !== r.pid) return
      const desired = startPx + (ev.clientX - r.startX) * r.dir // 클램프 전 원시 폭(안쪽 초과 = 슬라이드 판정)
      const raw = Math.max(oneCol * 0.7, Math.min(full, desired))
      // 자석 스냅 — 1열·2열 폭 근처(±SNAP)면 그 폭에 딱 붙어 "이러면 1열/2열이 되겠구나"가 놓기 전에 보임
      const live = Math.abs(raw - oneCol) < SNAP ? oneCol : Math.abs(raw - full) < SNAP ? full : raw
      const snapped = live !== raw
      if (snapped !== r.snapped) {
        cell.style.transition = 'width .12s cubic-bezier(0.22, 1, 0.36, 1)' // 스냅 진입/이탈만 부드럽게, 자유 구간은 즉시 추적
        window.setTimeout(() => { if (resizing.current === r) cell.style.transition = '' }, 130)
        r.snapped = snapped
      }
      r.desiredPx = desired
      r.livePx = live
      cell.style.width = `${live}px`
      // 그리드 자리(영역) 미리보기만 상태로 — 자유폭의 미세 % 변화는 인라인 style이 담당(리렌더 없음)
      const cat = live > oneCol + SNAP ? 2 : areaCatOf(oneColVal(desired))
      if (cat !== r.preview) { r.preview = cat; setWOverride((prev) => new Map(prev).set(r.id, cat)) }
    }
    const cleanup = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('keydown', key)
      document.body.style.cursor = ''
      resizeCleanup.current = null
    }
    // commit=true(pointerup)만 저장, 취소(Esc·pointercancel)·8px 미만 이동은 시작 값 복원. 사이드이펙트는 setState 밖에서.
    const finish = (commit: boolean) => {
      cleanup()
      const r = resizing.current
      resizing.current = null
      if (!r) return
      const slide = !startSpan2 && r.desiredPx < oneCol - 50 // 1열 카드를 안쪽으로 초과 드래그 = 반대 열로 이동
      const moved = Math.abs(r.livePx - startPx) >= 8 || slide
      const finalVal = commit && moved ? encodeLive(r.livePx, r.desiredPx) : r.startVal
      const cw = decodeCardWidth(finalVal)
      const settlePx = cw.pct != null ? (full * cw.pct) / 100 : cw.span === 2 ? full : oneCol
      // 놓으면 목표 폭으로 부드럽게 정착 → 정착 후 인라인 정리(그리드/sx가 이어받음)
      cell.style.transition = 'width .16s cubic-bezier(0.22, 1, 0.36, 1)'
      cell.style.justifySelf = cw.right ? 'end' : 'start'
      cell.style.width = `${settlePx}px`
      window.setTimeout(clearCellStyle, 200)
      const server = memosRef.current.find((mm) => mm.id === r.id)?.width || 1
      setWOverride((prev) => {
        const n = new Map(prev)
        if (finalVal !== server) n.set(r.id, finalVal)
        else n.delete(r.id)
        return n
      })
      if (commit && finalVal !== server) onWidthRef.current(r.id, finalVal) // 저장 — 반영/6s 안전망이 오버라이드 정리
    }
    const up = (ev: PointerEvent) => { if (resizing.current && ev.pointerId !== resizing.current.pid) return; finish(true) }
    const cancel = () => finish(false)
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(false) }
    resizeCleanup.current = () => { cleanup(); clearCellStyle(); resizing.current = null }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', key)
  }

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
  const pending = useRef<null | { id: number; pid: number; startX: number; startY: number; offsetX: number; offsetY: number; rect: DOMRect }>(null)
  const drag = useRef<null | { id: number; baseOrder: number[]; slotRects: DOMRect[]; scrollY0: number; width: number; height: number; offsetX: number; offsetY: number; span: 1 | 2; gridCx: number; alignPreview: number | null }>(null)
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
    const gridRect = itemRefs.current.get(p.id)?.parentElement?.getBoundingClientRect()
    const dragged = memosRef.current.find((m) => m.id === p.id)
    drag.current = {
      id: p.id, baseOrder, slotRects, scrollY0: window.scrollY, width: p.rect.width, height: p.rect.height, offsetX: p.offsetX, offsetY: p.offsetY,
      span: dragged ? decodeCardWidth(widthValOf(dragged)).span : 1,
      gridCx: gridRect ? gridRect.left + gridRect.width / 2 : 0,
      alignPreview: null,
    }
    overIndexRef.current = originIndex // rest에 dragId를 originIndex로 넣으면 baseOrder와 동일
    switchLockUntil.current = 0
    try { window.getSelection()?.removeAllRanges() } catch { /* noop */ }
    document.addEventListener('selectstart', prevent)
    document.body.style.cursor = 'grabbing'
    lastPointer.current = { x, y }
    setOverIndex(originIndex)
    setDragId(p.id)
  }

  // 삽입 위치 판정 — '행 밴드 + 좌/우 절반'(원본 슬롯 고정 좌표). 판정점은 updateDrag가 넘기는
  // '끌리는 카드의 중심'(업무현황 카드와 동일 — 마우스 포인터 아님): 세로로 어느 행인지 찾고,
  // 행 안에서 각 슬롯 중심 x보다 왼쪽이면 그 앞, 다 지나면 행 끝. 혼합 폭(1·2열)에서도 의도대로.
  const insertIndexAt = (slots: DOMRect[], x: number, y: number, dyScroll: number): number => {
    const rows: { top: number; bottom: number; idxs: number[] }[] = []
    slots.forEach((s, i) => {
      const top = s.top - dyScroll
      const bottom = s.bottom - dyScroll
      const row = rows.find((r) => Math.abs(r.top - top) < 8)
      if (row) { row.idxs.push(i); row.bottom = Math.max(row.bottom, bottom) }
      else rows.push({ top, bottom, idxs: [i] })
    })
    rows.sort((a, b) => a.top - b.top)
    if (!rows.length) return 0
    if (y < rows[0].top) return 0
    const row = rows.find((r) => y <= r.bottom + CARD_GAP)
    if (!row) return slots.length // 모든 행 아래 = 맨 끝
    if (row.idxs.length === 1) {
      // 행에 슬롯 하나(전폭 카드 등) — 좌/우가 아니라 위/아래 절반으로 앞/뒤 판정(중심 x가 같아 x 비교 불가)
      const s = slots[row.idxs[0]]
      return y < s.top - dyScroll + s.height / 2 ? row.idxs[0] : row.idxs[0] + 1
    }
    for (const i of row.idxs) { if (x < slots[i].left + slots[i].width / 2) return i }
    return row.idxs[row.idxs.length - 1] + 1
  }

  const updateDrag = (x: number, y: number) => {
    const d = drag.current
    if (!d) return
    const left = x - d.offsetX
    const top = y - d.offsetY
    if (liftedRef.current) { liftedRef.current.style.left = `${left}px`; liftedRef.current.style.top = `${top}px` }
    // 판정점 = 끌리는 카드의 '중심'(업무현황 카드와 동일). 포인터가 아니라 카드가 놓일 자리를 보고 판정 —
    // 카드 모서리를 잡아도 눈에 보이는 카드 위치 그대로 판정된다.
    const cx = left + d.width / 2
    const cy = top + d.height / 2
    // 1열 카드 좌/우 자석 정렬 — 카드 중심이 보드 중앙의 왼쪽이면 좌측 열, 오른쪽이면 우측 열로
    // placeholder가 즉시 따라붙어(미리보기) 놓기 전에 어느 열로 갈지 보인다(폭 조절 자석 스냅과 동일 감각)
    if (d.span === 1) {
      const alignVal = cx > d.gridCx ? 3 : 1
      if (alignVal !== d.alignPreview) { d.alignPreview = alignVal; setWOverride((prev) => new Map(prev).set(d.id, alignVal)) }
    }
    if (Date.now() < switchLockUntil.current) return
    const dyScroll = window.scrollY - d.scrollY0 // 드래그 중 페이지 스크롤 보정
    const raw = insertIndexAt(d.slotRects, cx, cy, dyScroll)
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
    suppressClickUntil.current = Date.now() + CLICK_SUPPRESS_MS
    setDragId(null)
    setOverIndex(0)
    // 1열 카드 좌/우 정렬 커밋 — 드롭한 쪽 열로 저장(취소·변경 없음이면 미리보기 해제)
    if (d.span === 1 && d.alignPreview != null) {
      const server = memosRef.current.find((mm) => mm.id === d.id)?.width || 1
      if (commit && d.alignPreview !== server) onWidthRef.current(d.id, d.alignPreview) // 오버라이드는 반영/6s 안전망이 정리
      else setWOverride((prev) => { if (!prev.has(d.id)) return prev; const n = new Map(prev); n.delete(d.id); return n })
    }
    if (changed) { setOptOrder(finalOrder); onReorderRef.current(finalOrder) }
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

  const onCellPointerDown = (e: React.PointerEvent, id: number) => {
    if (pending.current || drag.current) return
    if (e.button !== 0 || e.pointerType === 'touch') return // 마우스/펜만(터치 드래그 없음)
    if ((e.target as HTMLElement).closest('button, a, input, textarea, [contenteditable="true"]')) return
    const el = itemRefs.current.get(id)
    if (!el) return
    const rect = el.getBoundingClientRect()
    pending.current = { id, pid: e.pointerId, startX: e.clientX, startY: e.clientY, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top, rect }
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

  // dense = 우측 정렬 카드가 만든 왼쪽 빈 칸을 뒤 카드가 되채움(1열 카드 좌/우 나란히 배치 가능)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gridAutoFlow: 'row dense', gap: `${CARD_GAP}px`, alignItems: 'stretch', ...(dragId != null ? { userSelect: 'none', WebkitUserSelect: 'none' } : {}) }}>
      {displayIds.map((id) => {
        const m = memoById.get(id)
        if (!m) return null
        // 폭 인코딩 디코드 → 그리드 자리·정렬·폭: 2열=span 2 / 1열 우측=col 2 명시 / 1열 좌측=auto / 자유폭=span 2 영역 + %폭 + 좌우 고정
        const cw = decodeCardWidth(widthValOf(m))
        const wSx = {
          gridColumn: { xs: 'auto', sm: cw.span === 2 ? 'span 2' : cw.right ? '2' : 'auto' },
          ...(cw.pct != null ? { justifySelf: { xs: 'stretch', sm: cw.right ? 'end' : 'start' }, width: { xs: '100%', sm: `${cw.pct}%` } } : {}),
        }
        // 드래그 중인 카드 자리 = 점선 placeholder(그 폭·높이만큼 공간 확보). 카드 본체는 커서 추적 오버레이로 렌더.
        if (dragId === id) {
          return (
            <Box key={id} aria-hidden sx={(th) => ({ ...wSx, minWidth: 0, minHeight: drag.current?.height ?? 80, border: '2px dashed', borderColor: alpha(th.palette.primary.main, 0.6), bgcolor: alpha(th.palette.primary.main, 0.06), borderRadius: '8px' })} />
          )
        }
        const own = ownOf(m)
        return (
          <Box key={id} data-memo-id={id} ref={setItemRef(id)} sx={{ position: 'relative', ...wSx, minWidth: 0, ...(canDrag ? { cursor: 'grab' } : {}) }}
            onPointerDown={canDrag ? (e) => onCellPointerDown(e, id) : undefined}
            onDoubleClick={own && editId == null ? () => { if (Date.now() >= suppressClickUntil.current) startEdit(m) } : undefined}>
            {editId === id ? (
              <ComposeCard accent={memberOf(m.author)?.color || FALLBACK} title={eTitle} body={eBody} busy={busy} saveLabel="수정"
                onTitle={setETitle} onBody={setEBody} onCancel={() => setEditId(null)} onSave={() => void saveEdit()} />
            ) : (
              <MemoCard m={m} own={own} onDelete={() => onDelete(id)} />
            )}
            {/* 좌/우 엣지 리사이즈 그립 — 그 엣지에 다가가면(한쪽만) 카드 모서리 라운드를 감싸는 엣지 글로우가 떠오름.
                잡고 끌면 창처럼 실시간, 1·2열 근처 자석 스냅, 1열 카드를 안쪽으로 계속 끌면 반대 열로 이동(팀원, PC 전용) */}
            {canPost && editId !== id && ([-1, 1] as const).map((dir) => (
              <Box key={dir} data-resize role="separator" aria-label="카드 폭 조절"
                onPointerDown={(ev) => startResize(ev, id, dir)} onDoubleClick={(ev) => ev.stopPropagation()}
                sx={{ position: 'absolute', top: 0, bottom: 0, ...(dir === 1 ? { right: -7 } : { left: -7 }), width: 14, cursor: 'col-resize', zIndex: 2, display: { xs: 'none', sm: 'block' }, opacity: 0, transition: 'opacity .18s', '&:hover': { opacity: 1 },
                  '&::before': { content: '""', position: 'absolute', top: 0, bottom: 0, width: '8px', ...(dir === 1
                    ? { right: 7, borderRadius: '0 8px 8px 0', background: 'linear-gradient(270deg, rgba(255,255,255,.5), rgba(255,255,255,.04))' }
                    : { left: 7, borderRadius: '8px 0 0 8px', background: 'linear-gradient(90deg, rgba(255,255,255,.5), rgba(255,255,255,.04))' }) } }} />
            ))}
          </Box>
        )
      })}

      {/* 작성/추가 = 다음 카드가 생길 자리(1열 좁은 너비 기본). itemRefs 등록 = 드래그 중 FLIP으로 함께 이동 */}
      {canPost && (
        <Box ref={setItemRef(ADD_KEY)} sx={{ minWidth: 0 }}>
          {adding ? (
            <ComposeCard accent={myColor} title={title} body={draft} busy={busy} saveLabel="저장"
              onTitle={setTitle} onBody={setDraft} onCancel={() => { setAdding(false); setTitle(''); setDraft('') }} onSave={() => void save()} />
          ) : (
            <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
              sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 44, height: '100%', border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
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
          sx={(th) => ({ position: 'fixed', zIndex: th.zIndex.modal + 1, width: drag.current?.width, height: drag.current?.height, pointerEvents: 'none', opacity: 0.95, borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,.48)' })}>
          <MemoCard m={dragItem} own={ownOf(dragItem)} onDelete={() => {}} />
        </Box>
      )}
    </Box>
  )
}
