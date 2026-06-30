import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import EditCalendarIcon from '@mui/icons-material/EditCalendar'
import { PageContainer, PageHeader, StatTile, EmptyState } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData, shiftScheduleStart, resizeScheduleStage, setScheduleStart, setScheduleStage } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import { deleteSchedule, updateSchedule } from '@/api/sheets'
import { useRole } from '@/auth/role'
import type { EqGroup, ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip, todayHalfIndex, type StageCode, type StageInfo } from './stageMeta'
import { GanttHeader, GanttBar } from './gantt'
import { calcHalfDelta, shiftStart, fmtStartMonth, MONTH_WIDTH, HALF_MONTH_WIDTH } from './timeline'
import DragTip from './DragTip'
import type { DragTipData } from './DragTip'
import EqProjectDrawer from './EqProjectDrawer'
import ScheduleWrite from './ScheduleWrite'
import EquipmentTabs from './EquipmentTabs'
import { QtyBadge, codeRange } from './batchUtil'

const GANTT_NAME_W = 220
const k = (v: number) => Math.round(v / 1000).toLocaleString()
type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }
type IntroView = 'timeline' | 'stage' | 'list'
type Batch = { g: EqGroup; info: StageInfo }

// 드래그 종료 후 확인 모달용 (적용 전까지 Redux/시트 미반영). codes=배치 내 전체 관리번호.
type PendingChange = {
  kind: 'move' | 'resize'
  codes: string[]
  stage?: string
  deltaHalves: number
  title: string
  stageName?: string
  before: string
  after: string
  delta: string
  qty: number
}
// Undo/Redo 히스토리 (저장된 변경의 before/after 절대값, 배치 전체 codes)
type HistEntry = {
  codes: string[]
  kind: 'move' | 'resize'
  stage?: string
  before: { start?: string; stageMonths?: string }
  after: { start?: string; stageMonths?: string }
}

// 단계별 보드 컬럼 — 착수 전(예정) + 6단계 + 설치완료. phaseChip 라벨로 분류.
const STAGE_COLUMNS = ['착수 전', ...STAGE_ORDER.map((c) => STAGE[c].label), '설치완료'] as const

// 'YYYY.M' (dueMonth) 이 현재월보다 과거인지 — 일정 지연 판정
function isPastMonth(due: string): boolean {
  const m = due.match(/^(\d{4})\.(\d{1,2})/)
  if (!m) return false
  const now = new Date()
  return +m[1] * 12 + +m[2] < (now.getFullYear() * 12 + now.getMonth() + 1)
}

export default function Equipment() {
  const dispatch = useAppDispatch()
  const { groups, schedule, months, loading, error, updatedAt } = useAppSelector((s) => s.eq)
  const counts = useAppSelector(selectEqCounts)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<IntroView>('timeline')
  const [editMode, setEditMode] = useState(false) // '일정 편집' 토글 — 켤 때만 드래그/리사이즈(실수 방지)
  const [fltStage, setFltStage] = useState('전체')
  const [fltMgr, setFltMgr] = useState('전체')
  const [fltType, setFltType] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Batch | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduleItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EqGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const canEdit = isAdmin && editMode
  const todayHalf = useMemo(() => todayHalfIndex(months), [months])

  // 도입배치 + 단계 정보
  const enriched = useMemo<Batch[]>(
    () =>
      groups
        .map((g) => ({ g, info: groupStage(g.timeline, months, todayHalf) }))
        .sort((a, b) => (a.g.start || '9999').localeCompare(b.g.start || '9999') || a.g.name.localeCompare(b.g.name, 'ko')),
    [groups, months, todayHalf],
  )

  // 통합검색 딥링크(/equipment?focus=<장비명|관리번호>) → 해당 배치 상세 Drawer
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus || !enriched.length) return
    const b = enriched.find((x) => x.g.name === focus || x.g.codes.includes(focus))
    if (b) setPicked(b)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, enriched])

  // ── 요약 지표 (종=고유 장비명 기준, 대=raw) ──
  const metrics = useMemo(() => {
    const progress = new Set<string>(), late = new Set<string>(), noSched = new Set<string>()
    const progStage: Record<string, number> = {}
    enriched.forEach(({ g, info }) => {
      if (!g.start || info.phase === 'none') noSched.add(g.name)
      else if (info.phase !== 'done' && isPastMonth(info.dueMonth)) late.add(g.name)
      else if (info.phase === 'progress') {
        progress.add(g.name)
        const lbl = info.code ? STAGE[info.code].label : '진행'
        progStage[lbl] = (progStage[lbl] || 0) + 1
      }
    })
    const progNote = Object.entries(progStage).map(([s, n]) => `${s} ${n}`).join(' · ')
    return { progress: progress.size, late: late.size, noSched: noSched.size, progNote }
  }, [enriched])

  // 필터 옵션
  const stageOpts = useMemo(() => ['전체', ...STAGE_COLUMNS.filter((c) => enriched.some(({ info }) => phaseChip(info).label === c))], [enriched])
  const mgrOpts = useMemo(() => ['전체', ...[...new Set(enriched.map(({ g }) => g.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [enriched])
  const typeOpts = useMemo(() => ['전체', ...[...new Set(enriched.map(({ g }) => g.type).filter(Boolean))]], [enriched])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enriched.filter(({ g, info }) => {
      if (fltStage !== '전체' && phaseChip(info).label !== fltStage) return false
      if (fltMgr !== '전체' && (g.mgr || '') !== fltMgr) return false
      if (fltType !== '전체' && (g.type || '') !== fltType) return false
      if (q && !`${g.name} ${g.codes.join(' ')} ${g.mgr} ${g.maker} ${g.model} ${g.variantNames.join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [enriched, fltStage, fltMgr, fltType, query])

  // ── CRUD ──
  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaved = async (code: string, isEdit: boolean) => {
    setWriteOpen(false)
    setEditTarget(null)
    setPicked(null) // 배치 구성이 바뀔 수 있어 상세는 닫고 재조회
    showSnack(isEdit ? '장비 도입 정보를 수정했습니다.' : '장비를 추가했습니다.', 'success')
    void code
    await dispatch(loadEqData()).unwrap().catch(() => null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    const codes = deleteTarget.codes.filter(Boolean)
    if (!codes.length) return showSnack('관리번호가 없어 삭제할 수 없습니다.', 'error')
    setDeleting(true)
    try {
      await Promise.all(codes.map((code) => deleteSchedule({ code, author: user, key: authKey })))
      setDeleting(false)
      setDeleteTarget(null)
      setPicked(null)
      showSnack(`장비 ${codes.length}대를 삭제했습니다.`, 'success')
      dispatch(loadEqData())
    } catch (err) {
      setDeleting(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
    }
  }

  // 배치 내 각 code의 스케줄을 변형해 저장 (start/stages 공통 적용)
  const persistBatch = async (codes: string[], mut: (it: ScheduleItem) => { start: string; stages: Record<string, string> }) => {
    await Promise.all(
      codes.map((code) => {
        const it = schedule.find((s) => s.code === code)
        if (!it) return Promise.resolve()
        const { start, stages } = mut(it)
        return updateSchedule({
          origCode: it.code, code: it.code, author: user!, key: authKey!,
          name: it.name, mgr: it.mgr, status: it.status, start, stages, cat: it.cat, method: it.method, price: it.price,
        })
      }),
    )
  }

  // 간트 가로 스크롤 컨테이너
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 드래그(전체 이동) ── 배치 내 모든 code에 동일 delta
  const dragRef = useRef<{ codes: string[]; repStart: string; startX: number; halfPx: number } | null>(null)
  const lastDeltaRef = useRef(0)
  const draggedRef = useRef(false)
  const [preview, setPreview] = useState<{ rep: string; px: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [tip, setTip] = useState<DragTipData | null>(null)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [applying, setApplying] = useState(false)
  const [undoStack, setUndoStack] = useState<HistEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistEntry[]>([])
  const [histBusy, setHistBusy] = useState(false)

  const startDrag = (e: ReactMouseEvent, g: EqGroup) => {
    if (!canEdit || !g.codes.length || pending || histBusy) return
    dragRef.current = { codes: g.codes, repStart: g.start, startX: e.clientX, halfPx: HALF_MONTH_WIDTH }
    lastDeltaRef.current = 0
    draggedRef.current = false
    setPreview({ rep: g.repCode, px: 0 })
    setDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true
      const dh = calcHalfDelta(px, d.halfPx)
      lastDeltaRef.current = dh
      setPreview({ rep: d.codes[0] ? schedule.find((s) => s.code === d.codes[0])?.code ?? '' : '', px: dh * d.halfPx })
      setTip({
        x: e.clientX, y: e.clientY,
        lines: [`${dh > 0 ? '+' : ''}${dh / 2}개월`, `${fmtStartMonth(d.repStart)} → ${fmtStartMonth(shiftStart(d.repStart, dh))}`],
      })
    }
    const onUp = () => {
      const d = dragRef.current
      const dh = lastDeltaRef.current
      dragRef.current = null
      lastDeltaRef.current = 0
      setDragging(false)
      setTip(null)
      if (d && dh) {
        setPending({
          kind: 'move', codes: d.codes, deltaHalves: dh, qty: d.codes.length,
          title: '일정을 이동하시겠습니까?',
          before: fmtStartMonth(d.repStart), after: fmtStartMonth(shiftStart(d.repStart, dh)),
          delta: `${dh > 0 ? '+' : ''}${dh / 2}개월`,
        })
      } else setPreview(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, schedule])

  // 마우스 휠 → 가로 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || !e.deltaY) return
      el.scrollLeft += e.deltaY
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view])

  // ── 리사이즈(단계 길이) ── 배치 내 모든 code에 동일 적용
  const resizeRef = useRef<{ codes: string[]; stage: string; startX: number; halfPx: number; baseHalves: number } | null>(null)
  const lastResizeHalvesRef = useRef(0)
  const [resizing, setResizing] = useState(false)
  const [resizePrev, setResizePrev] = useState<{ rep: string; tl: string[] } | null>(null)

  const startResize = (e: ReactMouseEvent, g: EqGroup, stageCode: string) => {
    if (!canEdit || !g.codes.length || pending || histBusy) return
    const label = STAGE[stageCode as StageCode]?.label
    if (!label) return
    const baseHalves = Math.max(1, Math.round(Number(g.stages?.[label] || 0) * 2))
    resizeRef.current = { codes: g.codes, stage: label, startX: e.clientX, halfPx: HALF_MONTH_WIDTH, baseHalves }
    lastResizeHalvesRef.current = baseHalves
    draggedRef.current = false
    setResizePrev({ rep: g.repCode, tl: g.timeline })
    setResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!resizing) return
    const onMove = (e: MouseEvent) => {
      const d = resizeRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true
      const nextHalves = Math.max(1, d.baseHalves + calcHalfDelta(px, d.halfPx))
      lastResizeHalvesRef.current = nextHalves
      const deltaH = nextHalves - d.baseHalves
      setTip({
        x: e.clientX, y: e.clientY,
        lines: [d.stage, `${d.baseHalves / 2}개월 → ${nextHalves / 2}개월`, `(${deltaH > 0 ? '+' : ''}${deltaH / 2}개월)`],
      })
    }
    const onUp = () => {
      const d = resizeRef.current
      const nextHalves = lastResizeHalvesRef.current
      resizeRef.current = null
      lastResizeHalvesRef.current = 0
      setResizing(false)
      setTip(null)
      if (d && nextHalves && nextHalves !== d.baseHalves) {
        const deltaH = nextHalves - d.baseHalves
        setPending({
          kind: 'resize', codes: d.codes, stage: d.stage, deltaHalves: deltaH, qty: d.codes.length,
          title: '기간을 변경하시겠습니까?', stageName: d.stage,
          before: `${d.baseHalves / 2}개월`, after: `${nextHalves / 2}개월`,
          delta: `${deltaH > 0 ? '+' : ''}${deltaH / 2}개월`,
        })
      } else setResizePrev(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing])

  // 적용 — 낙관적 reducer + 배치 전체 저장 + 재fetch
  const applyPending = async () => {
    if (!pending || applying) return
    if (!user || !authKey) { showSnack('관리자 로그인이 필요합니다.', 'error'); return }
    const p = pending
    const rep = schedule.find((s) => s.code === p.codes[0])
    if (!rep) { setPending(null); setPreview(null); setResizePrev(null); return }
    setApplying(true)
    let entry: HistEntry
    if (p.kind === 'move') {
      const newStart = shiftStart(rep.start, p.deltaHalves)
      dispatch(shiftScheduleStart({ codes: p.codes, deltaHalves: p.deltaHalves }))
      entry = { codes: p.codes, kind: 'move', before: { start: rep.start }, after: { start: newStart } }
    } else {
      const base = Math.max(1, Math.round(Number(rep.stages?.[p.stage!] || 0) * 2))
      const next = Math.max(1, base + p.deltaHalves)
      dispatch(resizeScheduleStage({ codes: p.codes, stage: p.stage!, deltaHalves: p.deltaHalves }))
      entry = { codes: p.codes, kind: 'resize', stage: p.stage, before: { stageMonths: String(base / 2) }, after: { stageMonths: String(next / 2) } }
    }
    setPreview(null)
    setResizePrev(null)
    try {
      await persistBatch(p.codes, (it) =>
        p.kind === 'move'
          ? { start: shiftStart(it.start, p.deltaHalves), stages: it.stages }
          : { start: it.start, stages: { ...it.stages, [p.stage!]: String(Math.max(1, Math.max(1, Math.round(Number(it.stages?.[p.stage!] || 0) * 2)) + p.deltaHalves) / 2) } },
      )
      setUndoStack((s) => [...s, entry].slice(-50))
      setRedoStack([])
      setApplying(false)
      setPending(null)
      showSnack(p.kind === 'move' ? `일정을 이동·저장했습니다${p.qty > 1 ? ` (${p.qty}대)` : ''}.` : `기간을 변경·저장했습니다${p.qty > 1 ? ` (${p.qty}대)` : ''}.`, 'success')
      await dispatch(loadEqData()).unwrap().catch(() => {})
    } catch (err) {
      setApplying(false)
      setPending(null)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
      await dispatch(loadEqData()).unwrap().catch(() => {})
    }
  }

  const cancelPending = () => {
    if (applying) return
    setPending(null)
    setPreview(null)
    setResizePrev(null)
  }

  // ── Undo/Redo ──
  const histBusyRef = useRef(false)
  const applyHistory = async (entry: HistEntry, dir: 'undo' | 'redo'): Promise<boolean> => {
    if (histBusyRef.current) return false
    if (!user || !authKey) { showSnack('관리자 로그인이 필요합니다.', 'error'); return false }
    histBusyRef.current = true
    setHistBusy(true)
    const target = dir === 'undo' ? entry.before : entry.after
    try {
      if (entry.kind === 'move' && target.start != null) {
        dispatch(setScheduleStart({ codes: entry.codes, start: target.start }))
        await persistBatch(entry.codes, (it) => ({ start: target.start!, stages: it.stages }))
      } else if (entry.kind === 'resize' && entry.stage && target.stageMonths != null) {
        dispatch(setScheduleStage({ codes: entry.codes, stage: entry.stage, value: target.stageMonths }))
        await persistBatch(entry.codes, (it) => ({ start: it.start, stages: { ...it.stages, [entry.stage!]: target.stageMonths! } }))
      }
      await dispatch(loadEqData()).unwrap().catch(() => {})
      return true
    } catch (err) {
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
      await dispatch(loadEqData()).unwrap().catch(() => {})
      return false
    } finally {
      histBusyRef.current = false
      setHistBusy(false)
    }
  }

  const undo = async () => {
    if (!undoStack.length || histBusy) return
    const entry = undoStack[undoStack.length - 1]
    if (await applyHistory(entry, 'undo')) {
      setUndoStack((s) => s.slice(0, -1))
      setRedoStack((s) => [...s, entry])
      showSnack('실행취소했습니다.', 'success')
    }
  }
  const redo = async () => {
    if (!redoStack.length || histBusy) return
    const entry = redoStack[redoStack.length - 1]
    if (await applyHistory(entry, 'redo')) {
      setRedoStack((s) => s.slice(0, -1))
      setUndoStack((s) => [...s, entry])
      showSnack('다시실행했습니다.', 'success')
    }
  }

  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})
  const blockKeyRef = useRef(false)
  undoRef.current = undo
  redoRef.current = redo
  blockKeyRef.current = !!(pending || writeOpen || editTarget || deleteTarget || dragging || resizing || histBusy)
  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      const t = document.activeElement as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (blockKeyRef.current) return
      e.preventDefault()
      if (e.shiftKey) redoRef.current()
      else undoRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdmin])

  // 단계별 보드 데이터
  const stageBoard = useMemo(() => {
    const cols = STAGE_COLUMNS.map((label) => ({ label, items: [] as Batch[] }))
    const byLabel = Object.fromEntries(cols.map((c) => [c.label, c])) as Record<string, { label: string; items: Batch[] }>
    // phaseChip 라벨이 컬럼에 없으면(예: 일정 미입력 '미정') '착수 전'으로 — 어떤 배치도 누락되지 않게
    filtered.forEach((b) => { (byLabel[phaseChip(b.info).label] || byLabel['착수 전']).items.push(b) })
    return cols
  }, [filtered])

  // 오늘 세로선 위치(px) — months 축 범위 안일 때만
  const todayLeft = todayHalf >= 0 && todayHalf <= months.length * 2 ? todayHalf * HALF_MONTH_WIDTH : -1

  const openEdit = (g: EqGroup) => {
    const rep = schedule.find((s) => s.code === g.repCode) ?? schedule.find((s) => g.codes.includes(s.code)) ?? null
    if (rep) setEditTarget(rep)
    else showSnack('도입 일정 정보를 찾을 수 없습니다.', 'error')
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<LocalShippingIcon />}
        title="장비 관리"
        subtitle="장비 도입 프로젝트 — 도입배치 일정·단계"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <>
                <IconButton aria-label="실행취소" title="실행취소 (Ctrl+Z)" onClick={undo} disabled={!undoStack.length || histBusy} size="small" sx={{ color: 'text.secondary' }}>
                  <UndoIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton aria-label="다시실행" title="다시실행 (Ctrl+Shift+Z)" onClick={redo} disabled={!redoStack.length || histBusy} size="small" sx={{ color: 'text.secondary' }}>
                  <RedoIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setWriteOpen(true) }}>
                  장비 추가
                </Button>
              </>
            )}
            <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      <EquipmentTabs />

      {/* 요약 (종=고유 장비명 / 대=대수) */}
      <Box className="eq-strip" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 1, mb: 2 }}>
        <StatTile value={counts.types} unit="종" label="전체 도입장비" status="info" sub={`총 ${counts.total}대`} />
        <StatTile value={metrics.progress} unit="종" label="진행중" status="warning" sub={metrics.progNote || '진행 중 단계 없음'} />
        <StatTile value={metrics.late} unit="종" label="일정 지연" status={metrics.late ? 'error' : 'neutral'} sub="예정일 경과" />
        <StatTile value={metrics.noSched} unit="종" label="일정 미입력" status={metrics.noSched ? 'warning' : 'neutral'} sub="도입월 확인 필요" />
      </Box>

      {/* 워크스페이스 */}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Box className="eq-wshead" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          {/* 보기 전환 */}
          <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
            {([['timeline', '타임라인'], ['stage', '단계별'], ['list', '목록']] as [IntroView, string][]).map(([v, label]) => (
              <Button
                key={v} size="small" disableElevation variant={view === v ? 'contained' : 'text'}
                onClick={() => setView(v)}
                sx={{ minWidth: 0, px: 1.5, py: 0.5, fontSize: 13, color: view === v ? undefined : 'text.secondary' }}
              >
                {label}
              </Button>
            ))}
          </Box>
          {/* 필터 */}
          <Box className="eq-filters" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <select className="eq-select" value={fltStage} onChange={(e) => setFltStage(e.target.value)} aria-label="단계">
              {stageOpts.map((o) => <option key={o} value={o}>{o === '전체' ? '전체 단계' : o}</option>)}
            </select>
            <select className="eq-select" value={fltMgr} onChange={(e) => setFltMgr(e.target.value)} aria-label="담당자">
              {mgrOpts.map((o) => <option key={o} value={o}>{o === '전체' ? '전체 담당자' : o}</option>)}
            </select>
            <select className="eq-select" value={fltType} onChange={(e) => setFltType(e.target.value)} aria-label="내자/외자">
              {typeOpts.map((o) => <option key={o} value={o}>{o === '전체' ? '전체 구분' : o}</option>)}
            </select>
            <Box component="input" className="eq-search" value={query} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)} placeholder="장비명·관리번호 검색" aria-label="도입장비 검색" />
            {isAdmin && (
              <Button
                size="small" variant={editMode ? 'contained' : 'outlined'} startIcon={<EditCalendarIcon sx={{ fontSize: 16 }} />}
                onClick={() => setEditMode((m) => !m)}
                sx={{ flexShrink: 0, py: 0.4, fontSize: 12.5, color: editMode ? undefined : 'text.secondary', borderColor: 'divider' }}
              >
                {editMode ? '편집 종료' : '일정 편집'}
              </Button>
            )}
          </Box>
        </Box>

        {filtered.length === 0 ? (
          <EmptyState size="sm" title="조건에 맞는 도입 장비가 없습니다" />
        ) : view === 'timeline' ? (
          /* ── 타임라인 ── */
          <Box ref={scrollRef} sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: GANTT_NAME_W + Math.max(months.length, 8) * MONTH_WIDTH, position: 'relative' }}>
              {/* 헤더 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
                <Box className="eq-tl-namehead" sx={{ width: GANTT_NAME_W, flexShrink: 0, px: 1.5, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRight: 1, borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled' }}>장비 · 단계 · 담당자</Typography>
                  {todayLeft >= 0 && (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 9, fontWeight: 600, color: 'primary.main' }}>
                      <Box sx={{ width: 2, height: 12, borderRadius: 1, bgcolor: 'primary.main' }} /> 오늘
                    </Box>
                  )}
                </Box>
                <Box sx={{ width: months.length * MONTH_WIDTH, flexShrink: 0 }}>
                  <GanttHeader months={months} />
                </Box>
              </Box>
              {/* 오늘 세로선 (범위 내일 때만) */}
              {todayLeft >= 0 && (
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: GANTT_NAME_W + todayLeft, width: '1px', bgcolor: 'primary.main', opacity: 0.65, pointerEvents: 'none', zIndex: 2 }} />
              )}
              {/* 행 */}
              {filtered.map(({ g, info }, idx) => {
                const chip = phaseChip(info)
                const sColor = info.phase === 'done' ? STAGE.설.color : info.phase === 'progress' ? (info.code ? STAGE[info.code].color : undefined) : undefined
                return (
                  <Box
                    key={g.repCode || idx}
                    role="button" tabIndex={0}
                    aria-label={`도입배치: ${g.name} ${g.count}대`}
                    onClick={() => { if (draggedRef.current) { draggedRef.current = false; return } setPicked({ g, info }) }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked({ g, info }) } }}
                    sx={{ display: 'flex', alignItems: 'center', minHeight: 44, cursor: 'pointer', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.elevated' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
                  >
                    <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, minWidth: 0, px: 1.5, py: 0.75, borderRight: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</Typography>
                        <QtyBadge n={g.count} />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, color: 'text.disabled', fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
                          <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: sColor || 'text.disabled', flexShrink: 0 }} />
                          {chip.label}
                        </Box>
                        <span>·</span><span>{g.mgr || '미지정'}</span>
                        <span>·</span><span>{codeRange(g)}</span>
                      </Box>
                    </Box>
                    <Box
                      sx={{ width: months.length * MONTH_WIDTH, flexShrink: 0, cursor: canEdit ? 'grab' : undefined, userSelect: 'none' }}
                      onMouseDown={canEdit ? (e) => startDrag(e, g) : undefined}
                    >
                      <GanttBar
                        tl={resizePrev?.rep === g.repCode ? resizePrev.tl : g.timeline}
                        months={months}
                        previewPx={preview?.rep === g.repCode ? preview.px : 0}
                        onResizeStart={canEdit ? (e, stageCode) => startResize(e, g, stageCode) : undefined}
                      />
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        ) : view === 'stage' ? (
          /* ── 단계별 칸반 ── */
          <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(180px, 1fr)', gap: 1, p: 1.5, overflowX: 'auto' }}>
            {stageBoard.map((col) => (
              <Box key={col.label} sx={{ minHeight: 360, p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{col.label}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{col.items.length}건</Typography>
                </Box>
                {col.items.length === 0 ? (
                  <Typography sx={{ mt: 4, textAlign: 'center', color: 'text.disabled', fontSize: 11 }}>해당 장비 없음</Typography>
                ) : (
                  col.items.map(({ g, info }, i) => (
                    <Box
                      key={g.repCode || i} role="button" tabIndex={0}
                      onClick={() => setPicked({ g, info })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked({ g, info }) } }}
                      sx={{ p: 1, mb: 0.75, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper', cursor: 'pointer', '&:hover': { borderColor: 'text.disabled' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main' } }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</Typography>
                        <QtyBadge n={g.count} />
                      </Box>
                      <Typography sx={{ fontSize: 10.5, color: 'text.disabled' }}>
                        {g.mgr || '미지정'}{info.dueMonth ? ` · ${info.dueMonth}` : ''}{g.variantNames.length ? ` · ${g.variantNames.join('/')}` : ''}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            ))}
          </Box>
        ) : (
          /* ── 목록 ── */
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" className="eq-ledger" sx={{ width: '100%', minWidth: 760 }}>
              <Box component="thead">
                <Box component="tr">
                  {['관리번호', '장비명', '수량', '담당자', '구분', '현재 단계', '다음 일정', '총 도입금액'].map((h) => (
                    <Box component="th" key={h}>{h}</Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map(({ g, info }, idx) => {
                  const chip = phaseChip(info)
                  return (
                    <Box component="tr" key={g.repCode || idx} onClick={() => setPicked({ g, info })} sx={{ cursor: 'pointer' }}>
                      <Box component="td" className="lg-code">{codeRange(g)}</Box>
                      <Box component="td" className="lg-primary">
                        {g.name}{g.variantNames.length ? <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}> · {g.variantNames.join('/')}</Box> : null}
                      </Box>
                      <Box component="td"><QtyBadge n={g.count} /></Box>
                      <Box component="td">{g.mgr || '-'}</Box>
                      <Box component="td">{g.type || '-'}</Box>
                      <Box component="td"><Box component="span" className="lg-chip" sx={{ color: STAGE_DOT(info) }}>{chip.label}</Box></Box>
                      <Box component="td">{info.dueMonth || '-'}</Box>
                      <Box component="td">{g.price ? `${k(g.price)} 천원` : '-'}</Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <EqProjectDrawer
        group={picked?.g ?? null}
        info={picked?.info ?? null}
        onClose={() => setPicked(null)}
        isAdmin={isAdmin}
        onEdit={openEdit}
        onDelete={(g) => setDeleteTarget(g)}
      />

      {isAdmin && (
        <ScheduleWrite
          open={writeOpen || !!editTarget}
          editing={editTarget}
          onClose={() => { setWriteOpen(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* 삭제 확인 */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>정말 삭제하시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{deleteTarget?.name}」 도입배치 {deleteTarget?.count}대({deleteTarget?.codes.join(', ')})를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>{deleting ? '삭제 중…' : '삭제'}</Button>
        </DialogActions>
      </Dialog>

      {/* 드래그 변경 확인 */}
      <Dialog open={!!pending} onClose={cancelPending} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>{pending?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
            {pending && pending.qty > 1 && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.secondary' }}>대상</Typography>
                <Typography variant="body2">{pending.qty}대 (배치 전체)</Typography>
              </Box>
            )}
            {pending?.stageName && (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.secondary' }}>단계</Typography>
                <Typography variant="body2">{pending.stageName}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.secondary' }}>변경 전</Typography>
              <Typography variant="body2">{pending?.before}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.secondary' }}>변경 후</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{pending?.after}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.secondary' }}>변경량</Typography>
              <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 600 }}>{pending?.delta}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={cancelPending} disabled={applying} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" onClick={applyPending} disabled={applying}>{applying ? '적용 중…' : '적용'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>

      <DragTip tip={tip} />
    </PageContainer>
  )
}

// 현재 단계 칩 글자색 (목록)
function STAGE_DOT(info: StageInfo): string {
  if (info.phase === 'done') return STAGE.설.color
  if (info.phase === 'progress' && info.code) return STAGE[info.code].color
  return '#7d8899'
}
