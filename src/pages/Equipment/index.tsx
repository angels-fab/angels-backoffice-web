import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
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
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { PageContainer, PageHeader, StatTile, EmptyState, ErrorBanner, SegTabs, Select, SearchBar, useSnack } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData, shiftScheduleStart, resizeScheduleStage, setScheduleStart, setScheduleStage } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import { deleteSchedule, updateSchedule } from '@/api/eq'
import { useRole } from '@/auth/role'
import type { EqGroup, ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip, todayHalfIndex, type StageCode, type StageInfo } from './stageMeta'
import { GanttHeader, GanttBar } from './gantt'
import { calcHalfDelta, shiftStart, fmtStartMonth, halfToStart, startToHalf, itemTimelineForMonths } from './timeline'
import DragTip from './DragTip'
import type { DragTipData } from './DragTip'
import EqProjectDrawer from './EqProjectDrawer'
import ScheduleWrite from './ScheduleWrite'
import EquipmentTabs from './EquipmentTabs'
import DemoResults from './DemoResults'
import { NameWithQty, codeRange } from './batchUtil'
import { useTableSort, sortRows, SortTh } from './sortable'
import { iconSize, radius, shadow } from '@/theme/tokens'

const GANTT_NAME_W = 150 // 장비명 열(축소) — 나머지는 간트가 가변폭으로 채움(가로 스크롤 없음)
// 가변폭 간트에서 반월 1칸의 실제 픽셀폭 = 간트영역 폭 / (월수*2). 드래그/리사이즈 스냅 기준.
const measureHalfPx = (el: Element | null, monthCount: number): number => {
  const w = el?.getBoundingClientRect().width || 0
  return monthCount > 0 && w > 0 ? w / (monthCount * 2) : 28
}
const k = (v: number) => Math.round(v / 1000).toLocaleString()
type IntroView = 'timeline' | 'stage' | 'list' | 'demo'
type Batch = { g: EqGroup; info: StageInfo }

// 'YYYY.M'(dueMonth) → 정렬용 정수(연*12+월). 비어있으면 null
const dueToNum = (due: string): number | null => {
  const m = (due || '').match(/^(\d{4})\.(\d{1,2})/)
  return m ? +m[1] * 12 + +m[2] : null
}
// 도입 목록 정렬 열(수량 열 제거) — 관리번호·장비명·담당자·구분·현재단계·다음일정·총도입금액
type ProjCol = 'code' | 'name' | 'mgr' | 'type' | 'stage' | 'due' | 'price'
const PROJ_COLS: { key: ProjCol; label: string; right?: boolean }[] = [
  { key: 'code', label: '관리번호' }, { key: 'name', label: '장비명' }, { key: 'mgr', label: '담당자' },
  { key: 'type', label: '구분' }, { key: 'stage', label: '현재 단계' }, { key: 'due', label: '다음 일정' },
  { key: 'price', label: '총 도입금액', right: true },
]
const projAccessor = (b: Batch, c: ProjCol): string | number | null => {
  switch (c) {
    case 'code': return b.g.codes[0] || null
    case 'name': return b.g.name
    case 'mgr': return b.g.mgr || null
    case 'type': return b.g.type || null
    case 'stage': return phaseChip(b.info).label
    case 'due': return dueToNum(b.info.dueMonth)
    case 'price': return b.g.price || 0
  }
}

// 드래그 종료 후 확인 모달용 (적용 전까지 Redux/시트 미반영). codes=배치 내 전체 관리번호.
type PendingChange = {
  kind: 'move' | 'resize' | 'startResize'
  codes: string[]
  stage?: string
  deltaHalves: number
  title: string
  stageName?: string
  before: string
  after: string
  delta: string
  qty: number
  /** 드롭 지점(포인터) viewport 좌표 — 근처 확인 UI 위치 */
  x: number
  y: number
  /** startResize(첫 단계 시작점) 확정값 — start·첫단계 개월 동시 적용 */
  startPatch?: { start: string; months: string }
}
// Undo/Redo 히스토리 (저장된 변경의 before/after 절대값, 배치 전체 codes)
type HistEntry = {
  codes: string[]
  kind: 'move' | 'resize' | 'startResize'
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
  const { groups, schedule, months, loading, error } = useAppSelector((s) => s.eq)
  const counts = useAppSelector(selectEqCounts)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<IntroView>('stage') // 기본 보기 = 단계별
  // 데모결과 '추가' 버튼 슬롯 — 뷰탭과 같은 행 우측(DemoResults가 포탈로 버튼을 꽂음)
  const [demoSlot, setDemoSlot] = useState<HTMLElement | null>(null)
  const demoSlotRef = useCallback((el: HTMLDivElement | null) => setDemoSlot(el), [])
  const [editMode, setEditMode] = useState(false) // '일정 편집' 토글 — 켤 때만 드래그/리사이즈(실수 방지)
  const [fltStage, setFltStage] = useState('전체')
  const [fltMgr, setFltMgr] = useState('전체')
  const [fltType, setFltType] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Batch | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduleItem | null>(null)
  const [editBatchCodes, setEditBatchCodes] = useState<string[]>([]) // 편집 대상 배치의 전체 관리번호(공통필드 일괄적용용)
  const [deleteTarget, setDeleteTarget] = useState<EqGroup | null>(null)
  const [deleting, setDeleting] = useState(false)
  const snack = useSnack()

  // 실패 상태로 페이지 진입 시 자동 재시도(마운트 1회) — 잠깐 끊겼던 거면 사용자가 아무것도 안 해도 복구됨
  useEffect(() => {
    if (error && !loading) dispatch(loadEqData())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // 목록형 헤더 정렬(검색·필터 적용된 filtered 위에서 수행)
  const listSort = useTableSort<ProjCol>()
  const sortedList = useMemo(() => sortRows(filtered, listSort.col, listSort.dir, projAccessor), [filtered, listSort.col, listSort.dir])

  // ── CRUD ──
  const handleSaved = async (code: string, isEdit: boolean, warning?: string) => {
    setWriteOpen(false)
    setEditTarget(null)
    setEditBatchCodes([])
    setPicked(null) // 배치 구성이 바뀔 수 있어 상세는 닫고 재조회
    if (warning) snack(warning, 'error') // 부분실패 안내(성공분은 이미 반영)
    else snack(isEdit ? '장비 도입 정보를 수정했습니다.' : '장비를 추가했습니다.', 'success')
    void code
    await dispatch(loadEqData()).unwrap().catch(() => null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) return snack('관리자 로그인이 필요합니다.', 'error')
    const codes = deleteTarget.codes.filter(Boolean)
    if (!codes.length) return snack('관리번호가 없어 삭제할 수 없습니다.', 'error')
    setDeleting(true)
    // allSettled — 일부 실패해도 성공분은 이미 삭제됨. 성공/실패 구분해 안내하고 성공분 있으면 재조회.
    const results = await Promise.allSettled(codes.map((code) => deleteSchedule({ code, author: user, key: authKey })))
    const failed = results.filter((r) => r.status === 'rejected').length
    setDeleting(false)
    if (failed === codes.length) {
      // 전부 실패 = 아무것도 안 지워짐 → 확인창 유지해 재시도 가능
      snack('삭제에 실패했습니다.', 'error')
      return
    }
    setDeleteTarget(null)
    setPicked(null)
    if (failed === 0) snack(`장비 ${codes.length}대를 삭제했습니다.`, 'success')
    else snack(`${codes.length}대 중 ${failed}대 삭제 실패 — 나머지는 삭제됨`, 'error')
    await dispatch(loadEqData()).unwrap().catch(() => null)
  }

  // 배치 내 각 code의 스케줄을 변형해 저장 (start/stages 공통 적용)
  const persistBatch = async (codes: string[], mut: (it: ScheduleItem) => { start: string; stages: Record<string, string> }) => {
    const results = await Promise.allSettled(
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
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) throw new Error(`${results.length}건 중 ${failed}건 저장 실패 — 나머지는 저장됨`)
  }

  // ── 드래그(전체 이동) ── 배치 내 모든 code에 동일 delta
  const dragRef = useRef<{ codes: string[]; repStart: string; startX: number; halfPx: number } | null>(null)
  const lastDeltaRef = useRef(0)
  const draggedRef = useRef(false)
  const [preview, setPreview] = useState<{ rep: string; px: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [tip, setTip] = useState<DragTipData | null>(null)
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [undoStack, setUndoStack] = useState<HistEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistEntry[]>([])

  const abortedRef = useRef(false) // Esc 취소 표시 — onUp이 확정을 건너뛰게
  const lastPtRef = useRef({ x: 0, y: 0 }) // 마지막 포인터 좌표(드롭 확인 UI 위치)
  // 편집 세션 원본 스냅샷(편집 시작 시 보관) — 취소 시 복구·저장 시 변경분 판별
  const snapshotRef = useRef<Map<string, { start: string; stages: Record<string, string> }> | null>(null)
  const [exitDlg, setExitDlg] = useState(false) // 편집 종료 → 저장/취소 선택 다이얼로그
  const [savingEdit, setSavingEdit] = useState(false)

  const startDrag = (e: ReactPointerEvent, g: EqGroup) => {
    if (!canEdit || !g.codes.length || pending) return
    dragRef.current = { codes: g.codes, repStart: g.start, startX: e.clientX, halfPx: measureHalfPx(e.currentTarget, months.length) }
    lastDeltaRef.current = 0
    draggedRef.current = false
    abortedRef.current = false
    setPreview({ rep: g.repCode, px: 0 })
    setDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true
      lastPtRef.current = { x: e.clientX, y: e.clientY }
      const dh = calcHalfDelta(px, d.halfPx)
      lastDeltaRef.current = dh
      setPreview({ rep: d.codes[0] ? schedule.find((s) => s.code === d.codes[0])?.code ?? '' : '', px: dh * d.halfPx })
      // 안내: 1줄 단계명+변경량 / 2줄 변경 전후 / 3줄 취소 안내
      setTip({
        x: e.clientX, y: e.clientY,
        lines: [`일정 이동  ${dh > 0 ? '+' : ''}${dh / 2}개월`, `${fmtStartMonth(d.repStart)} → ${fmtStartMonth(shiftStart(d.repStart, dh))}`, '변경 취소: ESC'],
      })
    }
    const onUp = () => {
      const d = dragRef.current
      const dh = lastDeltaRef.current
      dragRef.current = null
      lastDeltaRef.current = 0
      setDragging(false)
      setTip(null)
      if (abortedRef.current) { setPreview(null); return } // Esc 취소 → 확정 안 함(원복)
      if (d && dh) {
        setPending({
          kind: 'move', codes: d.codes, deltaHalves: dh, qty: d.codes.length,
          title: '일정을 이동하시겠습니까?', stageName: '일정 이동',
          before: fmtStartMonth(d.repStart), after: fmtStartMonth(shiftStart(d.repStart, dh)),
          delta: `${dh > 0 ? '+' : ''}${dh / 2}개월`,
          x: lastPtRef.current.x, y: lastPtRef.current.y,
        })
      } else setPreview(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, schedule])

  // (간트는 콘텐츠 폭에 맞춰 가변폭 — 가로 스크롤 없음. 휠→가로스크롤 변환 제거: 상하 스크롤이 좌우로 새지 않음)

  // ── 리사이즈(단계 길이) ── 배치 내 모든 code에 동일 적용. 드래그 중 막대가 실시간 반영.
  const resizeRef = useRef<{ codes: string[]; stage: string; repStart: string; repStages: Record<string, string>; startX: number; halfPx: number; baseHalves: number } | null>(null)
  const lastResizeHalvesRef = useRef(0)
  const [resizing, setResizing] = useState(false)
  const [resizePrev, setResizePrev] = useState<{ rep: string; tl: string[] } | null>(null)

  const startResize = (e: ReactPointerEvent, g: EqGroup, stageCode: string) => {
    if (!canEdit || !g.codes.length || pending) return
    const label = STAGE[stageCode as StageCode]?.label
    if (!label) return
    const baseHalves = Math.max(1, Math.round(Number(g.stages?.[label] || 0) * 2))
    resizeRef.current = { codes: g.codes, stage: label, repStart: g.start, repStages: g.stages, startX: e.clientX, halfPx: measureHalfPx(e.currentTarget.closest('.gantt-wrap'), months.length), baseHalves }
    lastResizeHalvesRef.current = baseHalves
    draggedRef.current = false
    abortedRef.current = false
    setResizePrev({ rep: g.repCode, tl: g.timeline })
    setResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!resizing) return
    const rep = resizeRef.current ? schedule.find((s) => s.code === resizeRef.current!.codes[0]) : undefined
    const onMove = (e: PointerEvent) => {
      const d = resizeRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true
      lastPtRef.current = { x: e.clientX, y: e.clientY }
      const nextHalves = Math.max(1, d.baseHalves + calcHalfDelta(px, d.halfPx))
      lastResizeHalvesRef.current = nextHalves
      const deltaH = nextHalves - d.baseHalves
      // 실시간 미리보기 — 해당 단계 길이만 바꾼 timeline 재계산
      const tl = itemTimelineForMonths(d.repStart, { ...d.repStages, [d.stage]: String(nextHalves / 2) }, months)
      setResizePrev({ rep: rep?.code ?? d.codes[0], tl })
      setTip({
        x: e.clientX, y: e.clientY,
        lines: [`${d.stage}  ${deltaH > 0 ? '+' : ''}${deltaH / 2}개월`, `${d.baseHalves / 2}개월 → ${nextHalves / 2}개월`, '변경 취소: ESC'],
      })
    }
    const onUp = () => {
      const d = resizeRef.current
      const nextHalves = lastResizeHalvesRef.current
      resizeRef.current = null
      lastResizeHalvesRef.current = 0
      setResizing(false)
      setTip(null)
      if (abortedRef.current) { setResizePrev(null); return }
      if (d && nextHalves && nextHalves !== d.baseHalves) {
        const deltaH = nextHalves - d.baseHalves
        setPending({
          kind: 'resize', codes: d.codes, stage: d.stage, deltaHalves: deltaH, qty: d.codes.length,
          title: '기간을 변경하시겠습니까?', stageName: d.stage,
          before: `${d.baseHalves / 2}개월`, after: `${nextHalves / 2}개월`,
          delta: `${deltaH > 0 ? '+' : ''}${deltaH / 2}개월`,
          x: lastPtRef.current.x, y: lastPtRef.current.y,
        })
      } else setResizePrev(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [resizing, schedule, months])

  // ── 첫 단계 시작점 리사이즈 ── 첫 단계만 늘고/줄고(다음 단계 시작=첫 단계 끝 고정). start·첫단계 길이 동시 변경.
  const firstRef = useRef<{ codes: string[]; label: string; repStart: string; repStages: Record<string, string>; startX: number; halfPx: number; baseStartHalf: number; baseDurHalves: number; endHalf: number } | null>(null)
  const lastFirstDeltaRef = useRef(0)
  const [firstResizing, setFirstResizing] = useState(false)

  const startFirstResize = (e: ReactPointerEvent, g: EqGroup, stageCode: string) => {
    if (!canEdit || !g.codes.length || pending) return
    const label = STAGE[stageCode as StageCode]?.label
    if (!label) return
    const baseStartHalf = startToHalf(g.start)
    if (baseStartHalf == null) return
    const baseDurHalves = Math.max(1, Math.round(Number(g.stages?.[label] || 0) * 2))
    firstRef.current = {
      codes: g.codes, label, repStart: g.start, repStages: g.stages,
      startX: e.clientX, halfPx: measureHalfPx(e.currentTarget.closest('.gantt-wrap'), months.length),
      baseStartHalf, baseDurHalves, endHalf: baseStartHalf + baseDurHalves, // 첫 단계 끝(고정 기준)
    }
    lastFirstDeltaRef.current = 0
    draggedRef.current = false
    abortedRef.current = false
    setResizePrev({ rep: g.repCode, tl: g.timeline })
    setFirstResizing(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!firstResizing) return
    const rep = firstRef.current ? schedule.find((s) => s.code === firstRef.current!.codes[0]) : undefined
    const onMove = (e: PointerEvent) => {
      const d = firstRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true
      lastPtRef.current = { x: e.clientX, y: e.clientY }
      // 시작점을 delta 반월 이동하되, 끝(endHalf)은 고정 → 새 시작 ≤ endHalf-1, ≥ 0
      let newStartHalf = d.baseStartHalf + calcHalfDelta(px, d.halfPx)
      newStartHalf = Math.max(0, Math.min(newStartHalf, d.endHalf - 1))
      const delta = newStartHalf - d.baseStartHalf // 음수=앞당김
      lastFirstDeltaRef.current = delta
      const newDurHalves = d.endHalf - newStartHalf // 끝 고정
      const newStart = halfToStart(newStartHalf)
      const tl = itemTimelineForMonths(newStart, { ...d.repStages, [d.label]: String(newDurHalves / 2) }, months)
      setResizePrev({ rep: rep?.code ?? d.codes[0], tl })
      setTip({
        x: e.clientX, y: e.clientY,
        lines: [`첫 단계 시작  ${delta > 0 ? '+' : ''}${delta / 2}개월`, `${fmtStartMonth(d.repStart)} → ${fmtStartMonth(newStart)}`, '변경 취소: ESC'],
      })
    }
    const onUp = () => {
      const d = firstRef.current
      const delta = lastFirstDeltaRef.current
      firstRef.current = null
      lastFirstDeltaRef.current = 0
      setFirstResizing(false)
      setTip(null)
      if (abortedRef.current) { setResizePrev(null); return }
      if (d && delta) {
        const newStartHalf = d.baseStartHalf + delta
        const newDurHalves = d.endHalf - newStartHalf
        setPending({
          kind: 'startResize', codes: d.codes, stage: d.label, deltaHalves: delta, qty: d.codes.length,
          title: '첫 단계 시작일을 변경하시겠습니까?', stageName: `첫 단계(${d.label})`,
          before: fmtStartMonth(d.repStart), after: fmtStartMonth(halfToStart(newStartHalf)),
          delta: `${delta > 0 ? '+' : ''}${delta / 2}개월`,
          startPatch: { start: halfToStart(newStartHalf), months: String(newDurHalves / 2) },
          x: lastPtRef.current.x, y: lastPtRef.current.y,
        })
      } else setResizePrev(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [firstResizing, schedule, months])

  // Esc — 진행 중 제스처 취소(원복)
  useEffect(() => {
    if (!dragging && !resizing && !firstResizing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      abortedRef.current = true
      dragRef.current = null; resizeRef.current = null; firstRef.current = null
      setDragging(false); setResizing(false); setFirstResizing(false)
      setPreview(null); setResizePrev(null); setTip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragging, resizing, firstResizing])

  // ✓ — 개별 변경을 로컬 임시 편집본(Redux)에만 반영. Google Sheets 저장은 '편집 종료 → 저장'에서 일괄.
  const applyPending = () => {
    if (!pending) return
    const p = pending
    const rep = schedule.find((s) => s.code === p.codes[0])
    if (!rep) { setPending(null); setPreview(null); setResizePrev(null); return }
    let entry: HistEntry
    if (p.kind === 'move') {
      const newStart = shiftStart(rep.start, p.deltaHalves)
      dispatch(shiftScheduleStart({ codes: p.codes, deltaHalves: p.deltaHalves }))
      entry = { codes: p.codes, kind: 'move', before: { start: rep.start }, after: { start: newStart } }
    } else if (p.kind === 'resize') {
      const base = Math.max(1, Math.round(Number(rep.stages?.[p.stage!] || 0) * 2))
      const next = Math.max(1, base + p.deltaHalves)
      dispatch(resizeScheduleStage({ codes: p.codes, stage: p.stage!, deltaHalves: p.deltaHalves }))
      entry = { codes: p.codes, kind: 'resize', stage: p.stage, before: { stageMonths: String(base / 2) }, after: { stageMonths: String(next / 2) } }
    } else {
      // startResize — 첫 단계 시작·길이 절대값 동시 적용(배치 공통)
      const sp = p.startPatch!
      const beforeDur = String(Math.max(1, Math.round(Number(rep.stages?.[p.stage!] || 0) * 2)) / 2)
      dispatch(setScheduleStart({ codes: p.codes, start: sp.start }))
      dispatch(setScheduleStage({ codes: p.codes, stage: p.stage!, value: sp.months }))
      entry = { codes: p.codes, kind: 'startResize', stage: p.stage, before: { start: rep.start, stageMonths: beforeDur }, after: { start: sp.start, stageMonths: sp.months } }
    }
    setUndoStack((s) => [...s, entry].slice(-50))
    setRedoStack([])
    setPending(null); setPreview(null); setResizePrev(null)
  }

  // ✗ — 이 변경만 취소(로컬 미반영, 원위치)
  const cancelPending = () => { setPending(null); setPreview(null); setResizePrev(null) }

  // ── Undo/Redo — 로컬 임시 편집본만 변경(저장은 '편집 종료 → 저장'에서 일괄) ──
  const applyHistory = (entry: HistEntry, dir: 'undo' | 'redo') => {
    const target = dir === 'undo' ? entry.before : entry.after
    if (entry.kind === 'move' && target.start != null) {
      dispatch(setScheduleStart({ codes: entry.codes, start: target.start }))
    } else if (entry.kind === 'resize' && entry.stage && target.stageMonths != null) {
      dispatch(setScheduleStage({ codes: entry.codes, stage: entry.stage, value: target.stageMonths }))
    } else if (entry.kind === 'startResize' && entry.stage && target.start != null && target.stageMonths != null) {
      dispatch(setScheduleStart({ codes: entry.codes, start: target.start }))
      dispatch(setScheduleStage({ codes: entry.codes, stage: entry.stage, value: target.stageMonths }))
    }
  }
  const undo = () => {
    if (!undoStack.length) return
    const entry = undoStack[undoStack.length - 1]
    applyHistory(entry, 'undo')
    setUndoStack((s) => s.slice(0, -1)); setRedoStack((s) => [...s, entry])
  }
  const redo = () => {
    if (!redoStack.length) return
    const entry = redoStack[redoStack.length - 1]
    applyHistory(entry, 'redo')
    setRedoStack((s) => s.slice(0, -1)); setUndoStack((s) => [...s, entry])
  }

  // ── 편집 세션(로컬 임시) 시작/종료 — 저장은 '편집 종료 → 저장'에서 변경분만 1회 일괄 ──
  const stagesEq = (a: Record<string, string>, b: Record<string, string>) => {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const key of keys) if (String(a[key] ?? '') !== String(b[key] ?? '')) return false
    return true
  }
  const changedCodes = (): string[] => {
    const snap = snapshotRef.current
    if (!snap) return []
    const out: string[] = []
    for (const it of schedule) {
      const s = snap.get(it.code)
      if (!s) continue
      if (s.start !== it.start || !stagesEq(s.stages, it.stages)) out.push(it.code)
    }
    return out
  }
  const startEditMode = () => {
    snapshotRef.current = new Map(schedule.map((s) => [s.code, { start: s.start, stages: { ...s.stages } }]))
    setUndoStack([]); setRedoStack([])
    setEditMode(true)
  }
  const closeEditSession = () => { snapshotRef.current = null; setUndoStack([]); setRedoStack([]); setExitDlg(false); setEditMode(false) }
  // 편집 종료 버튼 — 미확정 변경 정리 후, 변경 있으면 저장/취소 선택, 없으면 그대로 종료(시트 호출 없음)
  const requestExitEdit = () => {
    cancelPending()
    if (changedCodes().length === 0) closeEditSession()
    else setExitDlg(true)
  }
  // 저장 — 이번 편집의 변경분만 Google Sheets에 한 번에 일괄 저장(현재 로컬 상태 기준)
  const finishEditSave = async () => {
    if (savingEdit) return
    if (!user || !authKey) { snack('관리자 로그인이 필요합니다.', 'error'); return }
    const codes = changedCodes()
    if (!codes.length) { closeEditSession(); return }
    setSavingEdit(true)
    try {
      await persistBatch(codes, (it) => ({ start: it.start, stages: it.stages }))
      setSavingEdit(false)
      closeEditSession()
      snack(`일정 변경 ${codes.length}건을 저장했습니다.`, 'success')
      await dispatch(loadEqData()).unwrap().catch(() => {})
    } catch (err) {
      setSavingEdit(false)
      snack(err instanceof Error ? err.message : '저장 실패', 'error')
      // 부분실패라도 성공분이 DB에 반영됐으므로 재조회해 로컬↔DB 동기화(불일치 방지)
      closeEditSession()
      await dispatch(loadEqData()).unwrap().catch(() => {})
    }
  }
  // 취소 — 이번 편집의 모든 변경을 편집 시작 전 상태로 되돌림(로컬만, 시트 호출 없음)
  const finishEditCancel = () => {
    const snap = snapshotRef.current
    if (snap) {
      for (const it of schedule) {
        const s = snap.get(it.code)
        if (!s) continue
        if (s.start !== it.start) dispatch(setScheduleStart({ codes: [it.code], start: s.start }))
        if (!stagesEq(s.stages, it.stages)) {
          const keys = new Set([...Object.keys(s.stages), ...Object.keys(it.stages)])
          for (const key of keys) if (String(s.stages[key] ?? '') !== String(it.stages[key] ?? '')) {
            dispatch(setScheduleStage({ codes: [it.code], stage: key, value: String(s.stages[key] ?? '0') }))
          }
        }
      }
    }
    closeEditSession()
    snack('변경을 취소했습니다.', 'info')
  }

  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})
  const blockKeyRef = useRef(false)
  undoRef.current = undo
  redoRef.current = redo
  blockKeyRef.current = !!(pending || writeOpen || editTarget || deleteTarget || dragging || resizing)
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

  // 오늘 세로선 위치(간트영역 내 비율 0~1) — months 축 범위 안일 때만(가변폭이라 px 대신 비율)
  const todayFrac = todayHalf >= 0 && todayHalf <= months.length * 2 ? todayHalf / (months.length * 2) : -1

  const openEdit = (g: EqGroup) => {
    const rep = schedule.find((s) => s.code === g.repCode) ?? schedule.find((s) => g.codes.includes(s.code)) ?? null
    if (rep) { setEditBatchCodes(g.codes.filter(Boolean)); setEditTarget(rep) } // 배치 전체 code를 폼에 전달(대표 1행만 반영되던 버그 방지)
    else snack('도입 일정 정보를 찾을 수 없습니다.', 'error')
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<LocalShippingIcon />}
        title="장비 관리"
        updatedAt={error ? '연결 실패' : undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <>
                <IconButton aria-label="실행취소" title="실행취소 (Ctrl+Z)" onClick={undo} disabled={!undoStack.length} size="small" sx={{ color: 'text.secondary' }}>
                  <UndoIcon sx={{ fontSize: iconSize.header }} />
                </IconButton>
                <IconButton aria-label="다시실행" title="다시실행 (Ctrl+Shift+Z)" onClick={redo} disabled={!redoStack.length} size="small" sx={{ color: 'text.secondary' }}>
                  <RedoIcon sx={{ fontSize: iconSize.header }} />
                </IconButton>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditBatchCodes([]); setEditTarget(null); setWriteOpen(true) }}>
                  장비 추가
                </Button>
              </>
            )}
            {/* 편집 중 새로고침 금지 — 서버 원본이 미저장 드래그/리사이즈를 경고 없이 덮어쓰던 문제(백로그 B3).
                「편집 종료」는 이미 저장/취소를 묻는데 새로고침만 그 보호를 우회했다.
                disabled 버튼은 title이 안 뜨므로 span으로 감싸 이유를 보여준다. */}
            <Box
              component="span"
              title={editMode
                ? '편집 중에는 새로고침할 수 없습니다 — 저장 안 된 변경이 사라지지 않도록 막아둡니다. 먼저 「편집 종료」로 저장하거나 취소하세요.'
                : '새로고침'}
              sx={{ display: 'inline-flex' }}
            >
              <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading || editMode} size="small" sx={{ color: 'text.secondary' }}>
                <RefreshIcon sx={{ fontSize: iconSize.header }} />
              </IconButton>
            </Box>
          </Box>
        }
      />

      {/* 불러오기 실패 — 빈 목록을 '장비 없음'으로 오해하지 않게 정직하게 알리고 재시도 제공(백로그 B2·C2).
          기존 목록이 남아 있으면 경고(갱신만 실패), 아예 없으면 오류. */}
      {error && (
        <ErrorBanner
          severity={groups.length > 0 ? 'warning' : 'error'}
          message={
            groups.length > 0
              ? '장비 정보 새로고침에 실패했습니다. 마지막으로 불러온 목록을 표시 중입니다.'
              : '장비 정보를 불러오지 못했습니다.'
          }
          onRetry={() => dispatch(loadEqData())}
        />
      )}

      <EquipmentTabs />

      {/* 요약 (종=고유 장비명 / 대=대수) — 데모결과 뷰에는 도입 KPI가 안 맞아 숨김 */}
      {view !== 'demo' && (
        <Box className="eq-strip" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 1, mb: 2 }}>
          <StatTile value={counts.types} unit="종" label="전체 도입장비" status="info" sub={`총 ${counts.total}대`} />
          <StatTile value={metrics.progress} unit="종" label="진행중" status="warning" sub={metrics.progNote || '진행 중 단계 없음'} />
          <StatTile value={metrics.late} unit="종" label="일정 지연" status={metrics.late ? 'error' : 'neutral'} sub="예정일 경과" />
          <StatTile value={metrics.noSched} unit="종" label="일정 미입력" status={metrics.noSched ? 'warning' : 'neutral'} sub="도입월 확인 필요" />
        </Box>
      )}

      {/* 워크스페이스 */}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Box className="eq-wshead" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          {/* 보기 전환 */}
          <SegTabs
            ariaLabel="장비도입 보기 전환"
            items={[
              { value: 'stage', label: '단계별' },
              { value: 'timeline', label: '타임라인' },
              { value: 'list', label: '목록' },
              { value: 'demo', label: '데모결과' },
            ] as const}
            value={view}
            onChange={setView}
          />
          {/* 필터 — 데모결과 뷰에는 도입용 필터(단계·담당자·구분) 미적용이라 숨김 */}
          {view !== 'demo' && (
          <Box className="eq-filters" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Select value={fltStage} onChange={setFltStage} ariaLabel="단계"
              options={stageOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 단계' : o }))} />
            <Select value={fltMgr} onChange={setFltMgr} ariaLabel="담당자"
              options={mgrOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 담당자' : o }))} />
            <Select value={fltType} onChange={setFltType} ariaLabel="내자/외자"
              options={typeOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 구분' : o }))} />
            <SearchBar value={query} onChange={setQuery} placeholder="장비명·관리번호 검색" width={200} />
            {isAdmin && (
              <Button
                size="small" variant={editMode ? 'contained' : 'outlined'} startIcon={<EditCalendarIcon sx={{ fontSize: iconSize.body }} />}
                onClick={() => (editMode ? requestExitEdit() : startEditMode())}
                sx={{ flexShrink: 0, py: 0.4, fontSize: 13, color: editMode ? undefined : 'text.secondary', borderColor: 'divider' }}
              >
                {editMode ? '편집 종료' : '일정 편집'}
              </Button>
            )}
          </Box>
          )}
          {/* 데모결과 뷰 — '데모결과 추가' 버튼 자리(DemoResults가 포탈로 채움) */}
          {view === 'demo' && <Box ref={demoSlotRef} sx={{ display: 'flex', alignItems: 'center' }} />}
        </Box>

        {view === 'demo' ? (
          /* ── 데모결과 (장비사 데모센터 테스트 결과 — 사진 중심 뷰) ── */
          <DemoResults addSlot={demoSlot} />
        ) : filtered.length === 0 ? (
          <EmptyState size="sm" title="조건에 맞는 도입 장비가 없습니다" />
        ) : view === 'timeline' ? (
          /* ── 타임라인 (가변폭·가로 스크롤 없음·고밀도) ── */
          <Box sx={{ position: 'relative', overflow: 'hidden' }}>
            {/* 헤더 */}
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, px: 1.25, py: 0.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, borderRight: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em', color: 'text.disabled', whiteSpace: 'nowrap' }}>장비</Typography>
                {todayFrac >= 0 && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4, fontSize: 9, fontWeight: 600, color: 'primary.main' }}>
                    <Box sx={{ width: 2, height: 11, borderRadius: 1, bgcolor: 'primary.main' }} /> 오늘
                  </Box>
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <GanttHeader months={months} />
              </Box>
            </Box>
            {/* 오늘 세로선 (간트영역 비율 위치 — 가변폭 calc) */}
            {todayFrac >= 0 && (
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${GANTT_NAME_W}px + ${todayFrac} * (100% - ${GANTT_NAME_W}px))`, width: '1px', bgcolor: 'primary.main', opacity: 0.6, pointerEvents: 'none', zIndex: 2 }} />
            )}
            {/* 행 — 장비명(+2대 이상 수량)만, 보조정보는 상세 드로어로 이관(고밀도) */}
            {filtered.map(({ g, info }, idx) => (
              <Box
                key={g.repCode || idx}
                role="button" tabIndex={0}
                aria-label={`도입배치: ${g.name}${g.count > 1 ? ` ${g.count}대` : ''}`}
                onClick={() => { if (draggedRef.current) { draggedRef.current = false; return } setPicked({ g, info }) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked({ g, info }) } }}
                sx={{ display: 'flex', alignItems: 'center', minHeight: 32, cursor: 'pointer', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.elevated' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
              >
                <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, minWidth: 0, px: 1.25, py: 0.5, borderRight: 1, borderColor: 'divider' }}>
                  <NameWithQty name={g.name} count={g.count} fontSize={12} />
                </Box>
                <Box
                  sx={{ flex: 1, minWidth: 0, py: 0.5, cursor: canEdit ? 'grab' : undefined, userSelect: 'none', touchAction: canEdit ? 'none' : undefined }}
                  onPointerDown={canEdit ? (e) => startDrag(e, g) : undefined}
                >
                  <GanttBar
                    tl={resizePrev?.rep === g.repCode ? resizePrev.tl : g.timeline}
                    months={months}
                    previewPx={preview?.rep === g.repCode ? preview.px : 0}
                    onResizeStart={canEdit ? (e, stageCode) => startResize(e, g, stageCode) : undefined}
                    onStartResize={canEdit ? (e, stageCode) => startFirstResize(e, g, stageCode) : undefined}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        ) : view === 'stage' ? (
          /* ── 단계별 칸반 ── */
          <Box sx={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(180px, 1fr)', gap: 1, p: 1.5, overflowX: 'auto' }}>
            {stageBoard.map((col) => (
              <Box key={col.label} sx={{ minHeight: 360, p: 1, border: 1, borderColor: 'divider', borderRadius: `${radius.chip}px`, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{col.label}</Typography>
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
                      sx={{ p: 1, mb: 0.75, border: 1, borderColor: 'divider', borderRadius: `${radius.chip}px`, bgcolor: 'background.paper', cursor: 'pointer', '&:hover': { borderColor: 'text.disabled' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main' } }}
                    >
                      <Box sx={{ mb: 0.5 }}>
                        <NameWithQty name={g.name} count={g.count} fontSize={12} />
                      </Box>
                      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                        {g.mgr || '미지정'}{info.dueMonth ? ` · ${info.dueMonth}` : ''}{g.variantNames.length ? ` · ${g.variantNames.join('/')}` : ''}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            ))}
          </Box>
        ) : (
          /* ── 목록 (수량 열 없음·헤더 정렬) ── */
          <Box sx={{ overflowX: 'auto' }}>
            {/* sm(≥600)부터 minWidth 720 — 카드화 경계(≤768) 위 구간(769~899)에서도 표 최소폭 유지.
                ≤768은 .rtable가 min-width:0 !important로 덮어 카드로 스택(md=900이라 md 쓰면 769~899 공백 발생). */}
            <Box component="table" className="eq-ledger rtable" sx={{ width: '100%', minWidth: { xs: 0, sm: 720 } }}>
              <Box component="thead">
                <Box component="tr">
                  {PROJ_COLS.map((col) => (
                    <SortTh key={col.key} label={col.label} colKey={col.key} right={col.right} active={listSort.col === col.key} dir={listSort.dir} onSort={(c) => listSort.onSort(c as ProjCol)} />
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {sortedList.map(({ g, info }, idx) => {
                  const chip = phaseChip(info)
                  return (
                    <Box component="tr" key={g.repCode || idx} onClick={() => setPicked({ g, info })} sx={{ cursor: 'pointer' }}>
                      <Box component="td" className="lg-code" data-label="관리번호">{codeRange(g)}</Box>
                      <Box component="td" className="lg-primary rtable-title" data-label="장비명">
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                          <NameWithQty name={g.name} count={g.count} fontSize={12} />
                          {g.variantNames.length ? <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, fontSize: 11, whiteSpace: 'nowrap' }}>{g.variantNames.join('/')}</Box> : null}
                        </Box>
                      </Box>
                      <Box component="td" data-label="담당자">{g.mgr || '-'}</Box>
                      <Box component="td" data-label="구분">{g.type || '-'}</Box>
                      <Box component="td" data-label="현재 단계"><Box component="span" className="lg-chip" sx={{ color: STAGE_DOT(info) }}>{chip.label}</Box></Box>
                      <Box component="td" data-label="다음 일정">{info.dueMonth || '-'}</Box>
                      <Box component="td" data-label="총 도입금액" sx={{ textAlign: 'right' }}>{g.price ? `${k(g.price)} 천원` : '-'}</Box>
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
          batchCodes={editBatchCodes}
          onClose={() => { setWriteOpen(false); setEditTarget(null); setEditBatchCodes([]) }}
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

      {/* 개별 변경 확인 — 포인터 근처 작은 UI(✓ 반영 / ✗ 취소). 큰 중앙 모달 아님. 저장은 편집 종료 시 일괄. */}
      {pending && <PendingConfirm p={pending} onApply={applyPending} onCancel={cancelPending} />}

      {/* 편집 종료 — 저장 / 되돌리기(취소) / 계속 편집 선택 */}
      <Dialog open={exitDlg} onClose={() => !savingEdit && setExitDlg(false)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 380 } } } }}>
        <DialogTitle>일정 편집을 마칠까요?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            변경한 일정을 저장하거나, 편집 시작 전 상태로 되돌릴 수 있습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 0.5, flexWrap: 'wrap' }}>
          <Button onClick={() => setExitDlg(false)} disabled={savingEdit} sx={{ color: 'text.secondary' }}>계속 편집</Button>
          <Box sx={{ flex: 1 }} />
          <Button color="error" onClick={finishEditCancel} disabled={savingEdit}>변경 취소</Button>
          <Button variant="contained" color="success" onClick={finishEditSave} disabled={savingEdit}>{savingEdit ? '저장 중…' : '저장'}</Button>
        </DialogActions>
      </Dialog>

      <DragTip tip={tip} />
    </PageContainer>
  )
}

// 개별 변경 확인 — 드롭 지점(포인터) 근처 소형 UI. 1줄 단계명+변경량 / 2줄 변경 전→후 / ✓ 반영·✗ 취소.
function PendingConfirm({ p, onApply, onCancel }: { p: PendingChange; onApply: () => void; onCancel: () => void }) {
  const flipX = typeof window !== 'undefined' && p.x > window.innerWidth - 220
  const flipY = typeof window !== 'undefined' && p.y > window.innerHeight - 130
  return createPortal(
    <Box
      sx={{
        position: 'fixed',
        left: p.x + (flipX ? -16 : 16),
        top: p.y + (flipY ? -16 : 16),
        transform: `translate(${flipX ? '-100%' : '0'}, ${flipY ? '-100%' : '0'})`,
        zIndex: 2100, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: `${radius.chip}px`,
        boxShadow: shadow.md, p: 1, minWidth: 150,
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {p.stageName ? `${p.stageName}  ` : ''}<Box component="span" sx={{ color: 'primary.main' }}>{p.delta}</Box>
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', mt: 0.25 }}>
        {p.before} → {p.after}{p.qty > 1 ? `  (${p.qty}대)` : ''}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
        <IconButton size="small" color="success" aria-label="변경 반영" onClick={onApply} sx={{ p: 0.5 }}><CheckIcon sx={{ fontSize: iconSize.action }} /></IconButton>
        <IconButton size="small" color="error" aria-label="변경 취소" onClick={onCancel} sx={{ p: 0.5 }}><CloseIcon sx={{ fontSize: iconSize.action }} /></IconButton>
      </Box>
    </Box>,
    document.body,
  )
}

// 현재 단계 칩 글자색 (목록)
function STAGE_DOT(info: StageInfo): string {
  if (info.phase === 'done') return STAGE.설.color
  if (info.phase === 'progress' && info.code) return STAGE[info.code].color
  return 'var(--text3)'
}
