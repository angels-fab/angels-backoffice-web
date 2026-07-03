import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import AssessmentIcon from '@mui/icons-material/Assessment'
import ChecklistIcon from '@mui/icons-material/Checklist'
import AddIcon from '@mui/icons-material/Add'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha } from '@mui/material/styles'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  CardGrid,
  FilterBar,
  SearchBar,
  StatusChip,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadWorkData, patchWorkItems } from '@/store/slices/workSlice'
import { createWork, deleteWork, updateWork, fetchAuthors, updateWorkOrder, beaconWorkOrder, updateWorkStatuses, type WorkOrderEntry, type WorkStatusChange } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { classify, taskTitle, dashToBullet, bulletToDash, WORK_CAT_OPTIONS, WORK_MGR_OPTIONS } from './workMeta'
import TaskAccordion from './TaskAccordion'
import TaskDetailDrawer from './TaskDetailDrawer'
import WorkWrite from './WorkWrite'
import NewTaskCard from './NewTaskCard'
import type { NewTaskForm } from './NewTaskCard'
import ReorderableTaskGrid from './ReorderableTaskGrid'
import KpiSection from './KpiSection'
import StatusDragGrid from './StatusDragGrid'
import DragToken from './DragToken'
import { genieOverlayInto, TOKEN_SIZE, TOKEN_SCALE, type DropZone, type StatusDropResult, type WorkView } from './dropZones'

// 통합 Undo/Redo 히스토리 — 순서변경·상태변경을 시간순 하나의 스택으로
interface FieldSnap { status: string; remind: boolean; chief: boolean; end: string }
type HistEntry =
  | { kind: 'order'; before: string[]; after: string[] }
  | { kind: 'status'; changes: { num: string; before: FieldSnap; after: FieldSnap }[] }
// STEP24 — 담당자 현황 섹션 임시 숨김(구조 보존, 추후 재노출 시 true)
const SHOW_MANAGER_STATUS = false

// 발의일자 최신순 (최근 업무가 위)
const cmp = (a: WorkItem, b: WorkItem) => dateSortValue(b.start) - dateSortValue(a.start)
// 진행중: Check(chief) 선택 카드 우선, 그다음 최신순
const cmpChief = (a: WorkItem, b: WorkItem) => (b.chief ? 1 : 0) - (a.chief ? 1 : 0) || cmp(a, b)

// 업무 → 인라인 편집 폼 값 (task 첫 줄=제목, 나머지=본문 / 본문 글머리 '- ' → 화면 '• ')
function toForm(t: WorkItem): NewTaskForm {
  const lines = String(t.task || '').split(/\r?\n/)
  return {
    cat: t.cat || '',
    title: lines[0] || '',
    body: dashToBullet(lines.slice(1).join('\n')),
    mgr: t.mgr || '',
    start: t.start || '',
    plan: t.plan || '',
    dept: t.dept || '',
    time: t.time || '',
    loc: t.loc || '',
    link: t.link || '',
    chief: !!t.chief,
  }
}

// 'Add 카드' — 미선택 카드 톤(점선) + 호버 시 채움 미리보기. 누르면 새 업무 작성.
// height는 고정 높이(평균 카드 높이) — alignSelf:start로 그리드 행에 끌려 늘어나지 않음.
function AddCard({ onClick, height = 120 }: { onClick: () => void; height?: number }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="새 업무 등록"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={(th) => ({
        height, alignSelf: 'start',
        border: '1.5px dashed', borderColor: alpha(th.palette.accent.green, 0.45), borderRadius: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        color: th.palette.accent.green, fontWeight: 600, cursor: 'pointer',
        transition: 'background-color .15s, border-color .15s',
        '&:hover': { bgcolor: alpha(th.palette.accent.green, 0.08), borderColor: alpha(th.palette.accent.green, 0.6) },
        '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green },
      })}
    >
      <AddIcon sx={{ fontSize: 22 }} /> 새 업무
    </Box>
  )
}

// 헤더 컨트롤용 버튼그룹 — Undo/Redo 그룹과 최신순/오래된순 그룹이 같은 스타일·크기를 공유
function BtnGroup({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={(th) => ({
        display: 'flex', alignItems: 'stretch', height: 30, flexShrink: 0,
        border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden',
        bgcolor: alpha(th.palette.text.primary, 0.03),
        '& > *:not(:first-of-type)': { borderLeft: '1px solid', borderLeftColor: 'divider' },
      })}
    >
      {children}
    </Box>
  )
}

function GroupBtn({ label, icon, selected, disabled, onClick, title }: {
  label?: string; icon?: React.ReactNode; selected?: boolean; disabled?: boolean; onClick: () => void; title: string
}) {
  return (
    <Tooltip title={title}>
      <Box component="span" sx={{ display: 'flex' }}>
        <ButtonBase
          aria-label={title}
          aria-pressed={selected}
          disabled={disabled}
          onClick={onClick}
          sx={(th) => ({
            px: icon ? 0 : 1.25, minWidth: icon ? 34 : 0,
            fontSize: 12.5, fontWeight: 600, lineHeight: 1,
            color: selected ? th.palette.primary.main : 'text.secondary',
            bgcolor: selected ? alpha(th.palette.primary.main, 0.14) : 'transparent',
            transition: 'background-color .12s',
            '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.06) },
            '&.Mui-disabled': { color: 'text.disabled' },
          })}
        >
          {icon ?? label}
        </ButtonBase>
      </Box>
    </Tooltip>
  )
}

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info'; retry?: () => void }

// 삭제 요청(메뉴·휴지통 드롭 공용) — token이 있으면 휴지통 플로: 확인창 → (동의 시) 지니 흡입 → 실제 삭제.
// phase: confirm=확인창 표시 / suck=흡입 중(확인창 닫힘·카드 흐림 유지) / clearing=삭제 처리(카드 숨김)
type DeleteReq = {
  items: WorkItem[]
  token?: { x: number; y: number; cat?: string; title: string }
  phase: 'confirm' | 'suck' | 'clearing'
}

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, error, updatedAt } = useAppSelector((s) => s.work)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<WorkView>('inProgress') // KPI 버튼이 전환하는 메인 목록
  const [cat, setCat] = useState('전체')
  const [mgr, setMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<WorkItem | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkItem | null>(null)
  const [deleteReq, setDeleteReq] = useState<DeleteReq | null>(null) // 삭제 확인·흡입·처리 라이프사이클
  const [deleting, setDeleting] = useState(false)
  const [trashHover, setTrashHover] = useState(false) // 드래그 토큰이 휴지통 위
  const [completeTarget, setCompleteTarget] = useState<WorkItem | null>(null)
  const [completing, setCompleting] = useState(false)
  const [remindOnComplete, setRemindOnComplete] = useState(false) // 완료 시 Remind 업무로 설정 체크박스
  const [revertTarget, setRevertTarget] = useState<WorkItem | null>(null) // 진행중 되돌리기 확인 대상
  const [reverting, setReverting] = useState(false)
  const [revertChief, setRevertChief] = useState(false) // 되돌릴 때 Check 여부
  const [composing, setComposing] = useState(false) // 새 업무 카드 → 인라인 편집 모드
  const [composeDirty, setComposeDirty] = useState(false) // 인라인 편집 중 입력값 존재 여부
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null) // 업무카드 in-place 편집 대상(팝업 대신)
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<{ item: WorkItem; form: NewTaskForm } | null>(null) // 수정 확인 대기
  const [authors, setAuthors] = useState<string[] | null>(null) // 담당자 시트 이름 명단(자동완성)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  // 진행중 카드 수동 정렬(포털정렬순서) — 낙관적 오버레이(저장 후 재로딩 안 하므로 로컬 유지) + 디바운스 저장
  const [orderMap, setOrderMap] = useState<Record<string, number>>({})
  const [orderError, setOrderError] = useState(false)
  const [dateSort, setDateSort] = useState<'none' | 'latest' | 'oldest'>('none') // 발의일 정렬 강조(직접 드래그 시 해제)
  const orderTimer = useRef<number | null>(null)
  const pendingOrderRef = useRef<WorkOrderEntry[] | null>(null)
  const savingRef = useRef(false) // 저장 POST 진행 중 여부(동시 저장 방지)
  const authRef = useRef({ user, authKey })
  authRef.current = { user, authKey }

  // 복수선택(Cmd/Ctrl·Shift·모바일 롱프레스) + KPI 드롭존 드래그 상태 + 상태 저장 직렬화 큐
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selMode, setSelMode] = useState(false) // 모바일 선택모드
  const selAnchor = useRef<string | null>(null)
  const [dragUi, setDragUi] = useState<{ dragging: boolean; zone: DropZone | null }>({ dragging: false, zone: null })
  const [pulse, setPulse] = useState<{ zone: DropZone; tick: number } | null>(null)
  const zoneClickSuppress = useRef(0) // 드롭 직후 존 클릭(목록 열림) 억제
  const saveChain = useRef<Promise<void>>(Promise.resolve()) // 배치 저장 직렬화(응답 역전 방지)
  const trashElRef = useRef<HTMLDivElement | null>(null) // 하단 중앙 휴지통(흡입 목적지 rect)
  const frozenTokenRef = useRef<HTMLDivElement | null>(null) // 휴지통 드롭 후 확인창 동안 고정된 토큰

  // 담당자 시트('이름' 열, 헤더 자동 인식)에서 명단 로드 — 새 담당자 추가 시 자동 반영
  useEffect(() => {
    fetchAuthors().then(setAuthors).catch(() => setAuthors(null))
  }, [])

  // 통합검색 딥링크(/work?focus=<id>) → 해당 업무 상세 Drawer 자동 오픈
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus || !items.length) return
    const item = items.find((t) => String(t.id) === focus)
    if (item) setPicked(item)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, items])

  // ── 전체 집계(필터 무관) ──
  const counts = useMemo(() => {
    let inProgress = 0, done = 0, hold = 0, cancelled = 0, etc = 0, chief = 0, remind = 0
    for (const t of items) {
      const c = classify(t)
      if (c === 'inProgress') inProgress++
      else if (c === 'done') done++
      else if (c === 'hold') hold++
      else if (c === 'cancelled') cancelled++
      else etc++
      if (t.chief) chief++
      if (t.remind) remind++
    }
    return { inProgress, done, hold, cancelled, etc, chief, remind, total: items.length }
  }, [items])
  // 담당자별 집계 (STEP24: 현재 섹션 숨김 — 집계는 보존)
  const managers = useMemo(() => {
    const map = new Map<string, { mgr: string; inProgress: number; remind: number; chief: number; total: number }>()
    for (const t of items) {
      const name = t.mgr || '미지정'
      const m = map.get(name) ?? { mgr: name, inProgress: 0, remind: 0, chief: 0, total: 0 }
      if (classify(t) === 'inProgress') m.inProgress++
      if (t.remind) m.remind++
      if (t.chief) m.chief++
      m.total++
      map.set(name, m)
    }
    return [...map.values()].sort((a, b) => b.inProgress - a.inProgress || b.total - a.total)
  }, [items])
  const busiest = managers.find((m) => m.mgr !== '미지정' && m.inProgress > 0) ?? managers[0]

  // ── 목록(상태 탭 + 검토필요 + 필터 + 검색) ──
  const presentCats = useMemo(() => ['전체', ...[...new Set(items.map((t) => t.cat).filter(Boolean))].sort((a, b) => workCatRank(a) - workCatRank(b))], [items])

  // 새 업무 폼 후보 — 구분은 고정 목록, 담당자는 담당자 시트 명단(실패 시 기본값), 부서/장소는 업무 히스토리
  const fieldOptions = useMemo(() => {
    const uniq = (sel: (t: WorkItem) => string) =>
      [...new Set(items.map((t) => (sel(t) || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
    return {
      cats: WORK_CAT_OPTIONS,
      mgrs: authors && authors.length ? authors : WORK_MGR_OPTIONS,
      depts: uniq((t) => t.dept),
      locs: uniq((t) => t.loc),
    }
  }, [items, authors])

  const pool = useMemo(() => {
    if (view === 'remind') return items.filter((t) => t.remind)
    if (view === 'check') return items.filter((t) => t.chief && (classify(t) === 'inProgress' || classify(t) === 'hold'))
    return items.filter((t) => classify(t) === view)
  }, [items, view])

  const presentMgrs = useMemo(() => ['전체', ...[...new Set(pool.map((t) => t.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [pool])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pool
      .filter((t) => cat === '전체' || normCat(t.cat) === normCat(cat))
      .filter((t) => mgr === '전체' || (t.mgr || '') === mgr)
      .filter((t) => !q || `${t.task} ${t.mgr} ${t.dept} ${t.cat} ${t.loc}`.toLowerCase().includes(q))
      .sort(cmpChief)
  }, [pool, cat, mgr, query])

  // 진행중 카드 표시 순서 = 포털정렬순서(낙관적 orderMap 우선) 오름차순, 미지정은 Check우선·최신순 뒤로.
  // (진행중 뷰는 필터를 숨기므로 전체 진행중 대상. 드래그 순서변경은 이 목록에만 적용.)
  const inProgressList = useMemo(() => {
    const rank = (t: WorkItem) => {
      const o = orderMap[t.num]
      if (o !== undefined) return o
      const n = Number(t.order)
      return t.order !== '' && !isNaN(n) ? n : Infinity
    }
    return items
      .filter((t) => classify(t) === 'inProgress')
      .sort((a, b) => rank(a) - rank(b) || cmpChief(a, b))
  }, [items, orderMap])
  // 진행중 표시 목록 — 탭필터·검색 적용(순서는 포털정렬순서 유지)
  const inProgressListed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inProgressList
      .filter((t) => cat === '전체' || normCat(t.cat) === normCat(cat))
      .filter((t) => mgr === '전체' || (t.mgr || '') === mgr)
      .filter((t) => !q || `${t.task} ${t.mgr} ${t.dept} ${t.cat} ${t.loc}`.toLowerCase().includes(q))
  }, [inProgressList, cat, mgr, query])

  // 통합 Undo/Redo — 순서변경·상태변경 히스토리(HistEntry) 스택
  const undoStack = useRef<HistEntry[]>([])
  const redoStack = useRef<HistEntry[]>([])
  const [, forceHist] = useState(0)
  const bumpHist = () => forceHist((v) => v + 1)
  const inProgressListRef = useRef(inProgressList)
  inProgressListRef.current = inProgressList
  const currentOrderNums = () => inProgressListRef.current.map((t) => t.num)
  // 서버 재조회(등록/수정/삭제 등 loadWorkData) 시 히스토리 초기화 — 외부 변경 뒤 되돌림은 무의미
  useEffect(() => { undoStack.current = []; redoStack.current = []; bumpHist() }, [updatedAt])

  // KPI 파생 목록 — 보류 / Check(진행중·보류 통합, Check는 완료 시 자동 해제라 이 둘로 전수)
  const holdList = useMemo(() => items.filter((t) => classify(t) === 'hold').sort(cmp), [items])
  const checkInProg = useMemo(() => items.filter((t) => t.chief && classify(t) === 'inProgress').sort(cmp), [items])
  const checkHold = useMemo(() => items.filter((t) => t.chief && classify(t) === 'hold').sort(cmp), [items])

  // KPI 버튼 → 목록 전환(드롭 직후 존 클릭은 억제)
  const openView = (v: WorkView) => {
    if (Date.now() < zoneClickSuppress.current) return
    // 인라인 작성 중 내용이 있으면 뷰 전환으로 사라지기 전에 확인
    if (composing && composeDirty && !window.confirm('작성 중인 새 업무가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?')) return
    setView(v)
    setMgr('전체')
    setComposing(false)
    setEditingId(null)
  }

  // '새 업무' 카드 클릭 → 진행중 뷰에서 인라인 편집 카드 펼침(별도 창 없음)
  const startCompose = () => {
    setView('inProgress')
    setEditingId(null)
    setComposing(true)
  }

  // 업무카드 수정 아이콘 → 그 자리에서 in-place 편집(팝업 없음)
  const startEdit = (t: WorkItem) => {
    setComposing(false)
    setEditingId(t.id)
  }

  // ── CRUD ──
  const showSnack = (msg: string, severity: 'success' | 'error' | 'info' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaved = async (num: number, isEdit: boolean) => {
    setWriteOpen(false)
    setEditTarget(null)
    showSnack(isEdit ? '업무를 수정했습니다.' : '업무를 등록했습니다.', 'success')
    const list = await dispatch(loadWorkData()).unwrap().catch(() => null)
    if (isEdit && num && Array.isArray(list)) {
      setPicked(list.find((t) => String(t.num) === String(num)) ?? null)
    }
  }

  // 인라인 새 업무 저장 — 제목+내용 → task(첫 줄=제목), 상태=진행중. 성공 시 인라인 카드 닫고 새로고침.
  const handleSaveNew = async (form: NewTaskForm) => {
    if (savingNew) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    const titleLine = form.title.trim()
    if (!titleLine) return showSnack('업무 제목을 입력해주세요.', 'error')
    // 화면의 글머리 '• '는 시트엔 dash '- '로 저장(관례 유지)
    const bodyText = bulletToDash(form.body.replace(/\s+$/, ''))
    const task = bodyText ? `${titleLine}\n${bodyText}` : titleLine
    setSavingNew(true)
    try {
      await createWork({
        author: user, key: authKey,
        cat: form.cat.trim(), task,
        dept: form.dept.trim(), start: form.start, plan: form.plan,
        time: form.time.trim(), loc: form.loc.trim(), mgr: form.mgr.trim(),
        status: '진행중', link: form.link.trim(),
        remind: false, chief: form.chief,
      })
      setSavingNew(false)
      setComposing(false)
      showSnack('업무를 등록했습니다.', 'success')
      dispatch(loadWorkData())
    } catch (err) {
      setSavingNew(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  // 줄 끝 공백 무시 비교용 정규화 (업무 내용 변경 여부 판정)
  const normTask = (s: string) =>
    String(s || '').split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\s+$/, '')

  // 폼이 원본과 달라졌는지 (변경 없으면 확인 팝업/저장 생략)
  const isEditDirty = (item: WorkItem, form: NewTaskForm) => {
    const titleLine = form.title.trim()
    const bodyText = bulletToDash(form.body.replace(/\s+$/, ''))
    const task = bodyText ? `${titleLine}\n${bodyText}` : titleLine
    return (
      normTask(task) !== normTask(item.task) ||
      form.cat.trim() !== (item.cat || '') ||
      form.dept.trim() !== (item.dept || '') ||
      form.start !== (item.start || '') ||
      form.plan !== (item.plan || '') ||
      form.time.trim() !== (item.time || '') ||
      form.loc.trim() !== (item.loc || '') ||
      form.mgr.trim() !== (item.mgr || '') ||
      form.link.trim() !== (item.link || '') ||
      form.chief !== !!item.chief
    )
  }

  // 인라인 수정 '확인' → 변경 없으면 그냥 닫기, 변경 있으면 확인 팝업
  const handleSaveEdit = (item: WorkItem, form: NewTaskForm) => {
    if (!form.title.trim()) return showSnack('업무 제목을 입력해주세요.', 'error')
    if (!isEditDirty(item, form)) { setEditingId(null); return } // 수정 사항 없음 → 팝업 없이 닫기
    setPendingEdit({ item, form })
  }

  // 수정 확인 팝업의 '수정' → 실제 저장(폼 외 항목은 기존 값 유지, task=제목+본문(• → -))
  const confirmEdit = async () => {
    if (!pendingEdit || savingEdit) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    const { item, form } = pendingEdit
    const titleLine = form.title.trim()
    const bodyText = bulletToDash(form.body.replace(/\s+$/, ''))
    const task = bodyText ? `${titleLine}\n${bodyText}` : titleLine
    setSavingEdit(true)
    try {
      await updateWork({
        num: item.num, author: user, key: authKey,
        cat: form.cat.trim(), task, status: item.status,
        dept: form.dept.trim(), mat: item.mat, start: form.start, plan: form.plan,
        time: form.time.trim(), loc: form.loc.trim(), mgr: form.mgr.trim(),
        link: form.link.trim(), remind: item.remind, chief: form.chief,
      })
      setSavingEdit(false)
      setPendingEdit(null)
      setEditingId(null)
      showSnack('업무를 수정했습니다.', 'success')
      dispatch(loadWorkData())
    } catch (err) {
      setSavingEdit(false)
      showSnack(err instanceof Error ? err.message : '수정 실패', 'error')
    }
  }

  // 완료 다이얼로그가 열릴 때 Remind 체크박스를 현재 업무의 Remind 상태로 초기화
  useEffect(() => {
    setRemindOnComplete(completeTarget?.remind ?? false)
  }, [completeTarget])

  // 완료 아이콘 → 확인 Dialog 후 상태를 '완료'로 변경(시트 반영). 체크박스 값으로 Remind도 함께 반영.
  const confirmComplete = async () => {
    if (!completeTarget || completing) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    const item = completeTarget
    setCompleting(true)
    try {
      await updateWork({
        num: item.num, author: user, key: authKey,
        cat: item.cat, task: item.task, status: '완료',
        dept: item.dept, mat: item.mat, start: item.start, plan: item.plan,
        time: item.time, loc: item.loc, mgr: item.mgr, link: item.link,
        remind: remindOnComplete, chief: item.chief,
      })
      setCompleting(false)
      setCompleteTarget(null)
      showSnack('완료로 변경했습니다.', 'success')
      dispatch(loadWorkData())
    } catch (err) {
      setCompleting(false)
      showSnack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }

  // 되돌리기 확인 다이얼로그가 열릴 때 Check 체크박스를 현재 업무의 Check 상태로 초기화
  useEffect(() => {
    setRevertChief(revertTarget?.chief ?? false)
  }, [revertTarget])

  // 진행중으로 되돌리기(확인 후) — 상태 '진행중' + Remind 해제(진행중 목록 편입) + Check는 체크박스 값.
  const confirmRevert = async () => {
    if (!revertTarget || reverting) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    const item = revertTarget
    setReverting(true)
    try {
      await updateWork({
        num: item.num, author: user, key: authKey,
        cat: item.cat, task: item.task, status: '진행중',
        dept: item.dept, mat: item.mat, start: item.start, plan: item.plan,
        time: item.time, loc: item.loc, mgr: item.mgr, link: item.link,
        remind: false, chief: revertChief,
      })
      setReverting(false)
      setRevertTarget(null)
      showSnack('진행중 업무로 되돌렸습니다.', 'success')
      dispatch(loadWorkData())
    } catch (err) {
      setReverting(false)
      showSnack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }

  // 삭제 동의 — 휴지통 플로(token)는 확인창을 먼저 닫고 토큰이 휴지통으로 지니 흡입된 뒤 실제 삭제.
  // 메뉴 삭제(token 없음)는 기존처럼 확인창을 유지한 채 바로 삭제. 목록 갱신 완료까지 카드 숨김 유지.
  const confirmDelete = async () => {
    const req = deleteReq
    if (!req || deleting || req.phase !== 'confirm') return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    setDeleting(true)
    try {
      if (req.token) {
        setDeleteReq({ ...req, phase: 'suck' }) // 확인창 닫힘 — 토큰·휴지통은 유지
        const rect = trashElRef.current?.getBoundingClientRect()
        if (frozenTokenRef.current && rect) await genieOverlayInto(frozenTokenRef.current, rect, trashElRef.current)
        setDeleteReq({ ...req, phase: 'clearing' }) // 흡입 끝 — 카드 화면 제거
      }
      let failed = 0
      for (const it of req.items) {
        try {
          await deleteWork({ num: it.num, author: user, key: authKey })
        } catch { failed++ }
      }
      if (picked && req.items.some((i) => i.num === picked.num)) setPicked(null)
      if (failed > 0) showSnack(`${req.items.length - failed}건 삭제, ${failed}건은 실패했습니다.`, 'error')
      else showSnack(req.items.length > 1 ? `업무 ${req.items.length}건을 삭제했습니다.` : '업무를 삭제했습니다.', 'success')
      await dispatch(loadWorkData()) // 새 목록 도착까지 숨김 유지(깜빡임 방지)
    } catch (err) {
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
      dispatch(loadWorkData())
    } finally {
      setDeleting(false)
      setDeleteReq(null)
      clearSelection()
    }
  }

  // 수정 폼의 구분 옵션 — 기존 값이 표준 6개에 없으면 그 값도 선택 가능하게 포함(데이터 손실 방지)
  const editOptionsFor = (t: WorkItem) =>
    t.cat && !fieldOptions.cats.includes(t.cat) ? { ...fieldOptions, cats: [t.cat, ...fieldOptions.cats] } : fieldOptions

  // ── 진행중 카드 순서변경 저장 (포털정렬순서만 갱신 · 3초 디바운스 · 성공은 무표시 · 실패만 안내) ──
  // 동시 저장 방지(savingRef): 저장 중이면 새로 시작하지 않고, 진행 중 요청의 finally가 최신 순서를 이어서 저장.
  // pendingOrderRef는 저장 성공(그 사이 새 순서 없음) 시에만 비움 → 비행 중 언로드 시 beacon이 그대로 백업.
  const flushOrderSave = useCallback(async () => {
    if (orderTimer.current) { clearTimeout(orderTimer.current); orderTimer.current = null }
    if (savingRef.current) return
    const orders = pendingOrderRef.current
    const { user: u, authKey: k } = authRef.current
    if (!orders || !u || !k) return
    savingRef.current = true
    try {
      await updateWorkOrder({ author: u, key: k, orders })
      setOrderError(false)
      if (pendingOrderRef.current === orders) pendingOrderRef.current = null // 비행 중 새 순서 없으면 클리어
    } catch {
      setOrderError(true) // pendingOrderRef 유지(재시도)
    } finally {
      savingRef.current = false
      // 비행 중 도착한 최신 순서가 있으면 이어서 저장(항상 마지막 순서가 최종 기록)
      if (pendingOrderRef.current && pendingOrderRef.current !== orders) void flushOrderSave()
    }
  }, [])

  // 최종 순서 확정 → 낙관적 반영(orderMap) + 최종 순서만 3초 뒤 한 번에 저장(재변경 시 타이머 리셋). 드래그·날짜정렬 공용.
  const commitOrder = (orderedNums: string[]) => {
    const map: Record<string, number> = {}
    const orders: WorkOrderEntry[] = orderedNums.map((num, i) => {
      const v = (i + 1) * 10
      map[num] = v
      return { num, order: v }
    })
    setOrderMap((prev) => ({ ...prev, ...map }))
    pendingOrderRef.current = orders
    setOrderError(false)
    if (orderTimer.current) clearTimeout(orderTimer.current)
    orderTimer.current = window.setTimeout(() => { void flushOrderSave() }, 3000)
  }

  // 새 히스토리 항목 적재(다시실행 스택은 비움)
  const pushEntry = (e: HistEntry) => {
    undoStack.current.push(e)
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
  }

  // 드래그 드롭으로 순서가 실제 바뀜 → 사용자 지정 순서(발의일 정렬 강조 해제)
  // 필터·검색으로 부분 목록만 보이는 상태에서 드래그하면, 부분 순서를 전체 순서에 병합해
  // 나머지 카드의 상대 순서를 보존한다(부분만 재부여 시 전체 순서 붕괴 방지).
  const handleReorder = (orderedNums: string[]) => {
    const full = currentOrderNums()
    let finalOrder = orderedNums
    if (orderedNums.length !== full.length) {
      const inSet = new Set(orderedNums)
      let i = 0
      finalOrder = full.map((n) => (inSet.has(n) ? orderedNums[i++] : n))
    }
    pushEntry({ kind: 'order', before: full, after: finalOrder })
    setDateSort('none'); commitOrder(finalOrder); bumpHist()
  }

  // 발의일자 기준 정렬(최신순=내림차순 / 오래된순=오름차순). 같은 날짜는 stable sort로 현재 표시순서 유지.
  // 결과를 새 사용자 지정 순서로 취급해 포털정렬순서를 재계산·저장(3초 디바운스).
  const applyDateSort = (dir: 'latest' | 'oldest') => {
    const sorted = [...inProgressList].sort((a, b) => {
      const d = dateSortValue(a.start) - dateSortValue(b.start)
      return dir === 'latest' ? -d : d
    })
    pushEntry({ kind: 'order', before: currentOrderNums(), after: sorted.map((t) => t.num) })
    setDateSort(dir)
    commitOrder(sorted.map((t) => t.num))
    bumpHist()
  }

  // ── 상태 배치 저장 — 직렬화 큐(연속 드롭·Undo/Redo 응답 역전 방지). 성공 무표시, 실패만 롤백+재시도 ──
  const enqueueStatusSave = (changes: WorkStatusChange[], onFail: () => void, retry: () => void) => {
    const { user: u, authKey: k } = authRef.current
    if (!u || !k || changes.length === 0) return
    const job = async () => {
      try {
        await updateWorkStatuses({ author: u, key: k, changes })
      } catch (err) {
        onFail()
        setSnack({ open: true, msg: err instanceof Error ? err.message : '상태 변경 저장 실패', severity: 'error', retry })
      }
    }
    saveChain.current = saveChain.current.then(job, job)
  }
  const snapToChange = (num: string, snap: FieldSnap, prevStatus: string): WorkStatusChange =>
    ({ num, status: snap.status, remind: snap.remind, chief: snap.chief, end: snap.end || undefined, prevStatus })

  // 히스토리 상태 항목을 앞/뒤 방향으로 적용(Undo/Redo 공용) — 로컬 패치 + 배치 저장, 실패 시 반대 방향 복구
  const applyStatusEntry = (e: Extract<HistEntry, { kind: 'status' }>, dir: 'forward' | 'back') => {
    const side = dir === 'forward' ? ('after' as const) : ('before' as const)
    const other = dir === 'forward' ? ('before' as const) : ('after' as const)
    dispatch(patchWorkItems(e.changes.map((c) => ({ num: c.num, patch: c[side] }))))
    enqueueStatusSave(
      e.changes.map((c) => snapToChange(c.num, c[side], c[other].status)),
      () => dispatch(patchWorkItems(e.changes.map((c) => ({ num: c.num, patch: c[other] })))),
      () => applyStatusEntry(e, dir),
    )
  }

  // 실행취소/다시실행 — 순서·상태 공용. 복수 상태변경은 항목 하나로 전체 복구/재적용.
  const canUndo = undoStack.current.length > 0
  const canRedo = redoStack.current.length > 0
  const doUndo = () => {
    const e = undoStack.current.pop()
    if (!e) return
    redoStack.current.push(e)
    if (e.kind === 'order') { setDateSort('none'); commitOrder(e.before) } else applyStatusEntry(e, 'back')
    bumpHist()
  }
  const doRedo = () => {
    const e = redoStack.current.pop()
    if (!e) return
    undoStack.current.push(e)
    if (e.kind === 'order') { setDateSort('none'); commitOrder(e.after) } else applyStatusEntry(e, 'forward')
    bumpHist()
  }
  // 키보드 단축키(Ctrl/Cmd+Z=실행취소, +Shift=다시실행). 입력란 포커스 중엔 가로채지 않음. 관리자만.
  const undoRef = useRef(doUndo); undoRef.current = doUndo
  const redoRef = useRef(doRedo); redoRef.current = doRedo
  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if ((e.key || '').toLowerCase() !== 'z') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      e.preventDefault()
      if (e.shiftKey) redoRef.current(); else undoRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdmin])

  // ── 복수선택 ──
  const clearSelection = useCallback(() => { setSelected(new Set()); setSelMode(false); selAnchor.current = null }, [])
  // 목록 이동·필터·검색 변경·로그아웃 시 해제
  useEffect(() => { clearSelection() }, [view, cat, mgr, query, user, clearSelection])
  // ESC — 선택/선택모드 종료(입력란 포커스 제외)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      clearSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearSelection])

  const visibleList = view === 'inProgress' ? inProgressListed : listed
  const visibleRef = useRef(visibleList); visibleRef.current = visibleList
  // 일반 클릭=그 카드만 선택(기존 해제) / Cmd·Ctrl=개별 토글 / Shift=앵커(최초 선택)부터 시각적 순서 범위 선택.
  // Shift 범위는 기존 선택을 대체(+Cmd·Ctrl이면 합집합) — 앵커는 항상 범위에 포함되어 선택에서 빠지지 않는다.
  const toggleSelect = (num: string, mods: { shift: boolean; toggle: boolean }) => {
    setSelected((prev) => {
      if (mods.shift && selAnchor.current) {
        const nums = visibleRef.current.map((t) => t.num)
        const a = nums.indexOf(selAnchor.current)
        const b = nums.indexOf(num)
        if (a >= 0 && b >= 0) {
          const [s, e] = a < b ? [a, b] : [b, a]
          const range = nums.slice(s, e + 1)
          return mods.toggle ? new Set([...prev, ...range]) : new Set(range)
        }
      }
      if (mods.toggle) {
        const next = new Set(prev)
        if (next.has(num)) next.delete(num)
        else next.add(num)
        selAnchor.current = num
        return next
      }
      selAnchor.current = num
      return new Set([num]) // 일반 클릭 — 단일 선택
    })
  }
  // 모바일 롱프레스 — 선택모드 진입 + 해당 카드 선택
  const enterSelMode = (num: string) => {
    setSelMode(true)
    selAnchor.current = num
    setSelected((prev) => { const n = new Set(prev); n.add(num); return n })
  }
  // 선택 안 된 카드를 드래그로 잡음 — 그 카드만 선택(기존 복수선택 해제)
  const selectOnly = useCallback((num: string) => {
    selAnchor.current = num
    setSelected(new Set([num]))
    setSelMode(false)
  }, [])
  // 카드 주변 빈 공간 클릭 = 전체 선택 해제(카드·버튼·입력·드롭존·팝업 제외 — 카드 클릭은 캡처에서 전파 중단됨)
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      // 드래그 드롭·중단 직후 브라우저 합성 click(공통 조상 target) 무시 — 선택 유지.
      // zoneClickSuppress는 onZoneChange(드래그 종료)에서 +350ms로 세팅됨.
      if (Date.now() < zoneClickSuppress.current) return
      const t = e.target as HTMLElement | null
      if (t && t.closest('.reorder-cell, .sdg-cell, button, a, input, textarea, [data-dropzone], [data-trashzone], .MuiModal-root, .MuiPopover-root')) return
      clearSelection()
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [clearSelection])

  // ── KPI 드롭존 ──
  const onZoneChange = useCallback((dragging: boolean, zone: DropZone | null) => {
    if (!dragging) zoneClickSuppress.current = Date.now() + 350
    setDragUi((p) => (p.dragging === dragging && p.zone === zone ? p : { dragging, zone }))
  }, [])

  // 존별 목표 필드 — 진행중↔보류는 Check 유지 / 완료·Remind는 Check 해제 / 복귀는 완료일자 비움(자동 규칙)
  const zoneFields = (t: WorkItem, zone: DropZone): FieldSnap => {
    const c = classify(t)
    const activeSide = c === 'inProgress' || c === 'hold'
    if (zone === 'inProgress') return { status: '진행중', remind: false, chief: activeSide ? !!t.chief : false, end: '' }
    if (zone === 'hold') return { status: '보류', remind: false, chief: activeSide ? !!t.chief : false, end: '' }
    // done/remind: Remind 업무를 완료에 놓으면 완료 유지+Remind만 해제(완료일자 보존)
    return { status: '완료', remind: zone === 'remind', chief: false, end: c === 'done' ? (t.end || '') : '' }
  }

  // 드롭 처리 — null=변경 없음(원위치·호출/이력 없음). finalize는 흡입 애니메이션 후 그리드가 호출.
  const handleStatusDrop = (nums: string[], zone: DropZone): StatusDropResult => {
    const { user: u, authKey: k } = authRef.current
    if (!isAdmin || !u || !k) return null
    const targets = nums
      .map((n) => items.find((t) => t.num === n))
      .filter((t): t is WorkItem => !!t && editingId !== t.id && ['inProgress', 'hold', 'done'].includes(classify(t)))
    const changes = targets
      .map((t) => ({
        num: t.num,
        before: { status: (t.status || '').trim(), remind: !!t.remind, chief: !!t.chief, end: t.end || '' },
        after: zoneFields(t, zone),
      }))
      .filter((c) => c.before.status !== c.after.status || c.before.remind !== c.after.remind)
    if (changes.length === 0) return null
    const entry: HistEntry = { kind: 'status', changes }
    const finalize = () => {
      const applyAfter = () => dispatch(patchWorkItems(changes.map((c) => ({ num: c.num, patch: c.after }))))
      const rollback = () => {
        dispatch(patchWorkItems(changes.map((c) => ({ num: c.num, patch: c.before }))))
        undoStack.current = undoStack.current.filter((x) => x !== entry)
        redoStack.current = redoStack.current.filter((x) => x !== entry)
        bumpHist()
      }
      function send() {
        enqueueStatusSave(changes.map((c) => snapToChange(c.num, c.after, c.before.status)), rollback, retryDrop)
      }
      function retryDrop() {
        applyAfter(); pushEntry(entry); bumpHist(); send()
      }
      applyAfter()
      pushEntry(entry)
      bumpHist()
      clearSelection()
      setPulse((p) => ({ zone, tick: (p?.tick ?? 0) + 1 }))
      send()
    }
    return { changedNums: changes.map((c) => c.num), finalize }
  }

  // 카드 더블클릭 → in-place 수정모드(관리자)
  const handleCardDoubleClick = (num: string) => {
    if (!isAdmin || !user || !authKey) return
    const t = items.find((x) => x.num === num)
    if (t && editingId !== t.id) startEdit(t)
  }
  // 휴지통 드롭(단일·복수) — 흡입 없이 확인창부터. 토큰은 드롭 지점에 고정 표시, 취소 시 원상 복원.
  // 진행 중 삭제 라이프사이클(확인창·흡입·API) 동안 새 요청은 무시 — deleteReq 덮어쓰기 방지.
  // 수정모드(in-place 편집) 카드는 대상에서 제외(존 드롭과 동일 가드).
  const handleDeleteDrop = (nums: string[], at: { x: number; y: number }) => {
    if (!isAdmin || !user || !authKey) return
    if (deleting || deleteReq) return
    const targets = nums
      .map((n) => items.find((x) => x.num === n))
      .filter((t): t is WorkItem => !!t && editingId !== t.id)
    if (targets.length === 0) return
    setTrashHover(false)
    setDeleteReq({
      items: targets,
      token: { x: at.x, y: at.y, cat: targets[0].cat, title: taskTitle(targets[0]) },
      phase: 'confirm',
    })
  }
  // 카드 메뉴·상세 Drawer의 삭제 — 확인창만(토큰·흡입 없음). 진행 중 라이프사이클 보호 동일.
  const requestDelete = (t: WorkItem) => {
    if (deleting || deleteReq) return
    setDeleteReq({ items: [t], phase: 'confirm' })
  }
  // 삭제 확인 대기 카드(휴지통 플로만) — 확인창 동안 흐림, 흡입 후 숨김
  const awaitingNums = useMemo(
    () => (deleteReq?.token ? new Set(deleteReq.items.map((i) => i.num)) : undefined),
    [deleteReq],
  )
  const awaitingHidden = deleteReq?.phase === 'clearing'

  // 페이지 종료·이탈·라우트 이동 직전 미저장 순서 flush(best-effort, sendBeacon)
  useEffect(() => {
    const beacon = () => {
      const orders = pendingOrderRef.current
      const { user: u, authKey: k } = authRef.current
      // sendBeacon이 큐잉을 수락한 경우에만 비움 — 실패 시 유지해 남은 fetch 타이머가 이어서 저장
      if (orders && u && k && beaconWorkOrder({ author: u, key: k, orders })) pendingOrderRef.current = null
    }
    const onVis = () => { if (document.visibilityState === 'hidden') beacon() }
    window.addEventListener('pagehide', beacon)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', beacon)
      document.removeEventListener('visibilitychange', onVis)
      if (orderTimer.current) clearTimeout(orderTimer.current)
      beacon()
    }
  }, [])

  // 업무 행 — 수정 중이면 그 자리에서 인라인 편집(전폭), 아니면 카드
  const renderTask = (t: WorkItem, tone: 'green' | 'amber' | 'gray') =>
    editingId === t.id ? (
      <NewTaskCard
        key={t.id}
        saving={savingEdit}
        options={editOptionsFor(t)}
        initial={toForm(t)}
        onCancel={() => setEditingId(null)}
        onSave={(form) => handleSaveEdit(t, form)}
      />
    ) : (
      <TaskAccordion
        key={t.id}
        t={t}
        tone={tone}
        isAdmin={isAdmin}
        onEdit={startEdit}
        onComplete={(it) => setCompleteTarget(it)}
        onDelete={requestDelete}
      />
    )

  return (
    <PageContainer>
      <PageHeader
        icon={<AssessmentIcon />}
        title="업무현황"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
      />

      {/* ① KPI — 2열. 명시적 버튼(링/Check 필/보관함/완료 박스/Remind 필)만 목록을 열고, 드래그 드롭존을 겸함 */}
      <KpiSection
        inProgressCount={counts.inProgress}
        holdCount={holdList.length}
        checkInProgCount={checkInProg.length}
        checkHoldCount={checkHold.length}
        doneCount={counts.done}
        totalCount={counts.total}
        remindCount={counts.remind}
        view={view}
        onOpenView={openView}
        dragging={dragUi.dragging}
        activeZone={dragUi.zone}
        pulse={pulse}
      />

      {/* ② 업무 목록 — 4개 상태 뷰 공통 인터페이스(동일 헤더·필터·검색·새 업무) */}
      <ContentSection last={!SHOW_MANAGER_STATUS}>
        {/* 헤더 1행: 아이콘+제목+건수+선택도구+Undo/Redo(+진행중 정렬) | 새 업무 */}
        <CardGrid columns={2} sx={{ mb: 2 }}>
          <Box sx={{ gridColumn: { sm: '1' }, gridRow: { sm: '1' }, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: 40, height: 40, borderRadius: 2, bgcolor: 'background.elevated', color: 'primary.main',
                '& svg': { fontSize: 22 },
              }}
            >
              <ChecklistIcon />
            </Box>
            <Typography variant="h2" component="h2">업무 목록</Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              {view === 'inProgress' ? inProgressListed.length : listed.length}
            </Typography>
            {isAdmin && (
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {selected.size > 0 && (
                  <>
                    <StatusChip status="info" label={`${selected.size}건 선택`} />
                    <StatusChip status="neutral" label="선택 해제" onClick={clearSelection} />
                  </>
                )}
                <BtnGroup>
                  <GroupBtn title="실행취소 (Ctrl/Cmd+Z)" icon={<UndoIcon sx={{ fontSize: 16 }} />} disabled={!canUndo} onClick={doUndo} />
                  <GroupBtn title="다시실행 (Ctrl/Cmd+Shift+Z)" icon={<RedoIcon sx={{ fontSize: 16 }} />} disabled={!canRedo} onClick={doRedo} />
                </BtnGroup>
                {view === 'inProgress' && (
                  <BtnGroup>
                    <GroupBtn title="발의일 최신순 정렬" label="최신순" selected={dateSort === 'latest'} onClick={() => applyDateSort('latest')} />
                    <GroupBtn title="발의일 오래된순 정렬" label="오래된순" selected={dateSort === 'oldest'} onClick={() => applyDateSort('oldest')} />
                  </BtnGroup>
                )}
              </Box>
            )}
          </Box>
          {/* 새 업무 칸 — 모든 상태 뷰에서 노출. 작성은 진행중 뷰의 인라인 카드에서(startCompose가 전환). */}
          <Box key="new" sx={{ gridColumn: { sm: '2' }, gridRow: { sm: '1' } }}>
            {isAdmin && (
              view === 'inProgress' ? (
                <>
                  {!composing && <AddCard height={64} onClick={startCompose} />}
                  <Collapse in={composing} unmountOnExit>
                    <NewTaskCard saving={savingNew} options={fieldOptions} onCancel={() => setComposing(false)} onSave={handleSaveNew} onDirtyChange={setComposeDirty} />
                  </Collapse>
                </>
              ) : (
                <AddCard height={64} onClick={startCompose} />
              )
            )}
          </Box>
        </CardGrid>

        {/* 탭필터 + 검색 — 모든 상태 뷰 공통 */}
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="업무명·담당자·부서·구분·장소 검색" />}>
          {presentCats.map((c) => (
            <StatusChip key={c} status="neutral" label={c} selected={cat === c} onClick={() => setCat(c)} />
          ))}
        </FilterBar>
        {presentMgrs.length > 1 && (
          <FilterBar>
            {presentMgrs.map((m) => (
              <StatusChip key={m} status="info" label={m} selected={mgr === m} onClick={() => setMgr(m)} />
            ))}
          </FilterBar>
        )}

        {view === 'inProgress' ? (
          inProgressListed.length === 0 ? (
            <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
          ) : (
            <ReorderableTaskGrid
              items={inProgressListed}
              canDrag={(t) => isAdmin && !!user && !!authKey && editingId !== t.id}
              onReorder={handleReorder}
              renderCard={(t) => renderTask(t, 'green')}
              selectedNums={selected}
              onSelectToggle={toggleSelect}
              onDragStartCard={selectOnly}
              onStatusDrop={handleStatusDrop}
              onZoneChange={onZoneChange}
              onCardDoubleClick={handleCardDoubleClick}
              onDeleteDrop={handleDeleteDrop}
              onTrashHover={setTrashHover}
              awaitingNums={awaitingNums}
              awaitingHidden={awaitingHidden}
            />
          )
        ) : listed.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
        ) : (
          <StatusDragGrid
            items={listed}
            renderCard={(t) => renderTask(t, classify(t) === 'done' ? 'gray' : classify(t) === 'hold' ? 'amber' : 'green')}
            canDrag={(t) => isAdmin && !!user && !!authKey && editingId !== t.id}
            selectedNums={selected}
            selMode={selMode}
            onSelectToggle={toggleSelect}
            onLongPress={enterSelMode}
            onDragStartCard={selectOnly}
            onStatusDrop={handleStatusDrop}
            onZoneChange={onZoneChange}
            onCardDoubleClick={handleCardDoubleClick}
            onDeleteDrop={handleDeleteDrop}
            onTrashHover={setTrashHover}
            awaitingNums={awaitingNums}
            awaitingHidden={awaitingHidden}
          />
        )}
      </ContentSection>

      {/* 담당자 현황 — STEP24 임시 숨김(SHOW_MANAGER_STATUS=false). 코드/집계 보존, 추후 재노출. */}
      {SHOW_MANAGER_STATUS && (
        <ContentSection title="담당자 현황" last>
          {busiest && busiest.inProgress > 0 && (
            <AppCard padding={18} sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>가장 바쁜 담당자</Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography variant="h3" sx={{ fontWeight: 800 }}>{busiest.mgr}</Typography>
                <Typography variant="body2">진행중 {busiest.inProgress}건</Typography>
              </Box>
            </AppCard>
          )}
          <CardGrid minColWidth={200}>
            {managers.map((m) => (
              <AppCard key={m.mgr} padding={16}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>{m.mgr}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  <StatusChip status="success" label={`진행중 ${m.inProgress}`} />
                  {m.remind > 0 && <StatusChip status="warning" label={`Remind ${m.remind}`} />}
                  {m.chief > 0 && <StatusChip status="purple" label={`Check ${m.chief}`} />}
                </Box>
              </AppCard>
            ))}
          </CardGrid>
        </ContentSection>
      )}

      <TaskDetailDrawer
        task={picked}
        nonModal
        onClose={() => setPicked(null)}
        isAdmin={isAdmin}
        onEdit={(t) => setEditTarget(t)}
        onDelete={requestDelete}
      />

      {isAdmin && (
        <WorkWrite
          open={writeOpen || !!editTarget}
          editing={editTarget}
          onClose={() => { setWriteOpen(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* 삭제 확인 Dialog — 휴지통 드롭은 흡입 전에 이 확인창부터. 취소 시 토큰·카드 원상 복원 */}
      <Dialog open={deleteReq?.phase === 'confirm'} onClose={() => !deleting && setDeleteReq(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>
          {deleteReq && deleteReq.items.length > 1 ? `선택한 업무 ${deleteReq.items.length}건을 삭제할까요?` : '정말 삭제하시겠습니까?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            {deleteReq && deleteReq.items.length > 1
              ? '삭제를 누르면 선택한 카드가 휴지통으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.'
              : `「${deleteReq ? taskTitle(deleteReq.items[0]) : ''}」 업무를 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteReq(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? '삭제 중…' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 완료 확인 Dialog */}
      <Dialog open={!!completeTarget} onClose={() => !completing && setCompleteTarget(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>업무를 완료하시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{completeTarget ? taskTitle(completeTarget) : ''}」 업무를 완료 상태로 변경합니다.
          </DialogContentText>
          <FormControlLabel
            sx={{ mt: 1.5 }}
            control={<Checkbox checked={remindOnComplete} onChange={(e) => setRemindOnComplete(e.target.checked)} disabled={completing} />}
            label="Remind 업무로 설정"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompleteTarget(null)} disabled={completing} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="success" variant="contained" onClick={confirmComplete} disabled={completing}>
            {completing ? '변경 중…' : '확인'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 진행중 되돌리기 확인 Dialog (Check 여부 선택) */}
      <Dialog open={!!revertTarget} onClose={() => !reverting && setRevertTarget(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>진행중 업무로 되돌리시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{revertTarget ? taskTitle(revertTarget) : ''}」 업무를 진행중 상태로 되돌립니다. (Remind 해제)
          </DialogContentText>
          <FormControlLabel
            sx={{ mt: 1.5 }}
            control={<Checkbox checked={revertChief} onChange={(e) => setRevertChief(e.target.checked)} disabled={reverting} />}
            label="Check 표시"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevertTarget(null)} disabled={reverting} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="success" variant="contained" onClick={confirmRevert} disabled={reverting}>
            {reverting ? '되돌리는 중…' : '되돌리기'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 수정 확인 Dialog (in-place 편집 → 확인 시 저장) */}
      <Dialog open={!!pendingEdit} onClose={() => !savingEdit && setPendingEdit(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>수정하시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{pendingEdit ? (pendingEdit.form.title.trim() || taskTitle(pendingEdit.item)) : ''}」 업무를 수정합니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPendingEdit(null)} disabled={savingEdit} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="success" variant="contained" onClick={confirmEdit} disabled={savingEdit}>
            {savingEdit ? '수정 중…' : '수정'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 결과 Snackbar — 상태 저장 실패 시에는 '다시 시도' 제공 */}
      <Snackbar
        open={snack.open}
        autoHideDuration={snack.retry ? 8000 : 3000}
        onClose={() => setSnack((s) => ({ ...s, open: false, retry: undefined }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          action={snack.retry ? (
            <Button color="inherit" size="small" onClick={() => { const r = snack.retry; setSnack((s) => ({ ...s, open: false, retry: undefined })); r?.() }}>
              다시 시도
            </Button>
          ) : undefined}
          onClose={() => setSnack((s) => ({ ...s, open: false, retry: undefined }))}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>

      {/* 휴지통 — 드래그 중·삭제 확인 동안만 하단 중앙 고정. 활성화는 색·밝기만(위치·크기 불변) */}
      {isAdmin && (dragUi.dragging || (deleteReq?.token && deleteReq.phase !== 'clearing')) && (
        <Box
          data-trashzone
          ref={trashElRef}
          aria-hidden
          sx={(th) => {
            const active = trashHover || (!!deleteReq?.token && deleteReq.phase !== 'clearing')
            return {
              position: 'fixed', zIndex: th.zIndex.modal - 1,
              left: 0, right: 0, mx: 'auto', bottom: { xs: 86, md: 28 },
              width: 'min(244px, calc(100vw - 32px))', height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.25,
              borderRadius: '17px',
              border: active ? '1.5px solid #f07a74' : `1.5px dashed ${alpha(th.palette.error.main, 0.56)}`,
              bgcolor: active ? 'rgba(148,43,43,.82)' : 'rgba(26,21,25,.94)',
              color: active ? '#fff' : '#ef9995',
              backdropFilter: 'blur(14px)',
              boxShadow: active
                ? '0 0 0 7px rgba(230,103,97,.12), 0 18px 50px rgba(0,0,0,.5)'
                : '0 18px 50px rgba(0,0,0,.42)',
              transition: 'background-color .14s, border-color .14s, box-shadow .14s, color .14s',
              animation: 'workTrashIn .18s ease both',
              '@keyframes workTrashIn': { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 27 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
            <Box sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>휴지통으로 이동</Box>
            <Box sx={{ fontSize: 10.5, opacity: 0.75, lineHeight: 1.2 }}>
              {trashHover || deleteReq?.token ? '놓아서 삭제 확인' : '여기에 놓으면 삭제 확인'}
            </Box>
          </Box>
        </Box>
      )}

      {/* 휴지통 드롭 후 고정 토큰 — 확인창 동안 드롭 지점에 유지, 동의 시 지니 흡입의 원본 */}
      {deleteReq?.token && deleteReq.phase !== 'clearing' && (
        <Box
          ref={frozenTokenRef}
          aria-hidden
          sx={(th) => ({
            position: 'fixed', zIndex: th.zIndex.modal - 1,
            left: deleteReq.token!.x, top: deleteReq.token!.y,
            width: TOKEN_SIZE, height: TOKEN_SIZE, pointerEvents: 'none',
            transform: `translate(-50%, -50%) scale(${TOKEN_SCALE})`, transformOrigin: '50% 50%',
            opacity: 0.96,
          })}
        >
          <DragToken cat={deleteReq.token.cat} title={deleteReq.token.title} count={deleteReq.items.length} danger />
        </Box>
      )}

      {/* 순서 저장 실패 — 이때만 안내 + 재시도(정상 저장은 무표시) */}
      <Snackbar open={orderError} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity="error"
          variant="filled"
          action={<Button color="inherit" size="small" onClick={() => void flushOrderSave()}>다시 시도</Button>}
          onClose={() => setOrderError(false)}
          sx={{ width: '100%' }}
        >
          카드 순서 저장에 실패했습니다.
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
