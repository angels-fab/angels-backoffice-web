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
import Drawer from '@mui/material/Drawer'
import Checkbox from '@mui/material/Checkbox'
import useMediaQuery from '@mui/material/useMediaQuery'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AddIcon from '@mui/icons-material/Add'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import TimelapseIcon from '@mui/icons-material/Timelapse'
import PauseIcon from '@mui/icons-material/Pause'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import { alpha } from '@mui/material/styles'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  CardGrid,
  SearchBar,
  StatusChip,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { isWorkNew } from '@/utils/newPost'
import { useMarkSeen } from '@/layouts/useNavBadges'
import { loadWorkData, patchWorkItems, softDeleteWorkItems, restoreWorkItems } from '@/store/slices/workSlice'
import { createWork, deleteWork, restoreWorks, updateWork, fetchAuthors, updateWorkStatuses } from '@/api/works'
import { putSetting } from '@/store/slices/userSettingsSlice'
import type { WorkStatusChange } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { classify, taskTitle, dashToBullet, bulletToDash, WORK_CAT_OPTIONS, WORK_MGR_OPTIONS, catKind, mgrColor } from './workMeta'
import type { CardTone } from './workMeta'
import { CatFilterChip, MgrFilterChip } from './FilterChips'
import TaskAccordion from './TaskAccordion'
import TaskDetailDrawer from './TaskDetailDrawer'
import WorkWrite from './WorkWrite'
import NewTaskCard from './NewTaskCard'
import { docHasMarks, fmtSignature } from './richContent'
import type { NewTaskForm } from './NewTaskCard'
import ReorderableTaskGrid from './ReorderableTaskGrid'
import KpiSection from './KpiSection'
import StatusDragGrid from './StatusDragGrid'
import type { WorkSwipeConfig } from './SwipeableCard'
import { genieOverlayInto, type DropZone, type StatusDropResult, type WorkView } from './dropZones'

// 통합 Undo/Redo 히스토리 — 순서변경·상태변경을 시간순 하나의 스택으로
interface FieldSnap { status: string; remind: boolean; chief: boolean; end: string }
type HistEntry =
  | { kind: 'order'; before: string[]; after: string[] }
  | { kind: 'status'; changes: { num: string; before: FieldSnap; after: FieldSnap }[] }
// STEP24 — 담당자 현황 섹션 임시 숨김(구조 보존, 추후 재노출 시 true)
const SHOW_MANAGER_STATUS = false

// 업무목록 헤더 — 상태별 제목·아이콘·색(시안 work-list-controls.html stateMeta). 아이콘은 박스 없이 색만.
const VIEW_META: Record<WorkView, { title: string; Icon: React.ElementType; color: string }> = {
  inProgress: { title: '진행중 업무', Icon: TimelapseIcon, color: 'accent.green' },
  hold: { title: '보류 업무', Icon: PauseIcon, color: 'accent.blue' },
  check: { title: '부서장 확인', Icon: FactCheckOutlinedIcon, color: 'accent.purple' },
  done: { title: '완료 업무', Icon: TaskAltIcon, color: 'text.secondary' },
  remind: { title: 'Remind 업무', Icon: TipsAndUpdatesIcon, color: 'accent.amber' },
}

// 스와이프 [상태] 피커의 존별 라벨(목표 상태 표시)
const ZONE_LABELS: Record<DropZone, string> = { inProgress: '진행중으로', hold: '보류로', done: '완료로', remind: 'Remind로' }

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
    bodyFmt: t.contentFmt || '',
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

/**
 * 저장할 '업무내용서식' 값 결정. (기존 행 강제 마이그레이션 없음)
 *  - 'error': 본문은 있는데 서식 직렬화가 실패 → 저장 중단(일반 텍스트도 저장 안 함).
 *  - { value }: 서식 저장(mark 있음) 또는 서식 제거 반영(mark 없음+기존 서식 있었음). value=''이면 '서식 없음' 문서.
 *  - {}: 미전달 → 백엔드가 기존 서식값 보존(빈칸 강제 채움 안 함).
 */
function contentFmtForSave(form: NewTaskForm, hadFmt: boolean): { value?: string } | 'error' {
  const hasText = !!form.body.replace(/\s+$/, '')
  if (hasText && !form.bodyFmt) return 'error'
  if (docHasMarks(form.bodyFmt) || hadFmt) return { value: form.bodyFmt || '' }
  return {}
}

// '+' 새 업무 버튼(42×28) — 제목행 건수 옆, 진행중 뷰에서만. 누르면 카드 그리드 첫 칸에 인라인 작성란.
function NewTaskPlusButton({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label="새 업무 등록"
      sx={(th) => ({
        width: 42, height: 28, flexShrink: 0,
        border: '1px solid', borderColor: alpha(th.palette.accent.green, 0.5),
        borderRadius: '8px', bgcolor: alpha(th.palette.accent.green, 0.12),
        color: th.palette.accent.green,
        transition: 'background-color .15s, border-color .15s',
        '&:hover': { bgcolor: alpha(th.palette.accent.green, 0.2), borderColor: alpha(th.palette.accent.green, 0.7) },
        '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green },
      })}
    >
      <AddIcon sx={{ fontSize: 18 }} />
    </ButtonBase>
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
            px: label ? 1.25 : 0, minWidth: label ? 0 : 34, gap: 0.5,
            fontSize: 12.5, fontWeight: 600, lineHeight: 1,
            color: selected ? th.palette.primary.main : 'text.secondary',
            bgcolor: selected ? alpha(th.palette.primary.main, 0.14) : 'transparent',
            transition: 'background-color .12s',
            '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.06) },
            '&.Mui-disabled': { color: 'text.disabled' },
          })}
        >
          {label}
          {icon}
        </ButtonBase>
      </Box>
    </Tooltip>
  )
}

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info'; retry?: () => void }

// 삭제 요청(메뉴·휴지통 드롭 공용) — token이 있으면 휴지통 플로: 확인창 → (동의 시) 지니 흡입 → 실제 삭제.
// token = 드롭 시점 오버레이 기하(중심·원본 크기·축소율) — 같은 자리·크기로 카드를 고정 표시.
// phase: confirm=확인창 표시 / suck=흡입 중(확인창 닫힘·카드 흐림 유지) / clearing=삭제 처리(카드 숨김)
type DeleteReq = {
  items: WorkItem[]
  token?: { cx: number; cy: number; w: number; h: number; scale: number }
  phase: 'confirm' | 'suck' | 'clearing'
}

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, trashed, error, errorMsg, loading: workLoading, updatedAt } = useAppSelector((s) => s.work)
  const workReady = useAppSelector((s) => s.work.ready)
  const { isAdmin, user, authKey } = useRole()
  // 내 기준 새 글 배지(개인화) — 페이지 진입 시 현재 새 업무를 읽음 처리.
  // error 게이트 필수: 로드 실패도 ready=true라, 없으면 실패(빈 목록)를 '새 글 0'으로 오인해 seen을 지움
  useMarkSeen('work', useMemo(() => items.filter(isWorkNew).map((t) => String(t.num)), [items]), workReady && !error)
  const [searchParams, setSearchParams] = useSearchParams()
  // KPI 버튼이 전환하는 메인 목록 — 마지막 보던 뷰 기억(개인화)
  const [view, setView] = useState<WorkView>(() => {
    const s = localStorage.getItem('work:view')
    return s === 'inProgress' || s === 'hold' || s === 'check' || s === 'done' || s === 'remind' ? s : 'inProgress'
  })
  // 계정 개인화 뷰 — 설정 로드되면 서버 저장값으로 1회 동기화(기기 넘나들며 유지)
  const usReady = useAppSelector((s) => s.userSettings.ready)
  const svWorkView = useAppSelector((s) => s.userSettings.settings['work.view'] as string | undefined)
  const svViewApplied = useRef(false)
  useEffect(() => {
    if (!usReady || svViewApplied.current) return
    svViewApplied.current = true
    if (svWorkView === 'inProgress' || svWorkView === 'hold' || svWorkView === 'check' || svWorkView === 'done' || svWorkView === 'remind') setView(svWorkView)
  }, [usReady, svWorkView])
  // 뷰 변경 시 저장 — 로컬 캐시(즉시) + 계정 서버(디바운스, 기기 동기화)
  useEffect(() => {
    try { localStorage.setItem('work:view', view) } catch { /* 저장 불가 무시 */ }
    dispatch(putSetting({ key: 'work.view', value: view }))
  }, [view, dispatch])
  // 구분·담당자 필터 — 업무일정 규칙(전체 칩 없음·빈 Set=전체·일반클릭 단독/재클릭 해제·Shift 복수). 구분은 normCat 키.
  const [selCats, setSelCats] = useState<Set<string>>(new Set())
  const [selMgrs, setSelMgrs] = useState<Set<string>>(new Set())
  // 필터 계정 기억(개인화 Stage 2) — 로드 '성공'(loadedOk) 후 1회 복원(실패 세션은 복원·저장 모두 안 함).
  // 사용자가 복원 전에 이미 칩을 만졌으면 늦게 온 서버값으로 방금 조작을 되돌리지 않게 스킵.
  // 저장은 toggleCat/toggleMgr(사용자 토글)에서만 — 복원·0건 프룬의 setSel은 저장 안 함
  // (프룬이 뷰 따라 계정 저장값을 지우는 회귀 방지: 화면에서만 걷히고 서버값은 보존).
  const svCats = useAppSelector((s) => s.userSettings.settings['work.filter.cats'] as string[] | undefined)
  const svMgrs = useAppSelector((s) => s.userSettings.settings['work.filter.mgrs'] as string[] | undefined)
  const usLoadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const svFilterApplied = useRef(false)
  const filterTouched = useRef(false)
  useEffect(() => {
    if (!usLoadedOk || svFilterApplied.current) return
    svFilterApplied.current = true
    if (filterTouched.current) return
    if (Array.isArray(svCats) && svCats.length) setSelCats(new Set(svCats.map(String)))
    if (Array.isArray(svMgrs) && svMgrs.length) setSelMgrs(new Set(svMgrs.map(String)))
  }, [usLoadedOk, svCats, svMgrs])
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<WorkItem | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkItem | null>(null)
  const [deleteReq, setDeleteReq] = useState<DeleteReq | null>(null) // 삭제 확인·흡입·처리 라이프사이클
  const [deleting, setDeleting] = useState(false)
  const [trashHover, setTrashHover] = useState(false) // 드래그 카드가 휴지통 드롭영역 접촉
  // 우측 드웰 휴지통 — 드래그 중 포인터가 화면 오른쪽 공간에 일정시간(500ms) 머물면 무장(armed)되어
  // 우측 중앙에 휴지통이 등장하고, 카드를 놓으면 확인창 없이 소프트삭제(10초 실행취소로 복구).
  const [trashArmed, setTrashArmed] = useState(false)
  // 무장 시 패널 세로 범위 — 업무카드 영역(보이는 셀들의 상하 union)을 뷰포트·KPI 하단으로 클램프
  const [trashPanelBox, setTrashPanelBox] = useState<{ top: number; height: number }>({ top: 180, height: 320 })
  const trashDwellTimer = useRef<number | null>(null)
  const [undoSnack, setUndoSnack] = useState<{ nums: string[]; count: number } | null>(null) // 삭제 직후 10초 실행 취소
  const [trashOpen, setTrashOpen] = useState(false) // 휴지통 드로어
  const [trashSel, setTrashSel] = useState<Set<string>>(new Set()) // 휴지통 복수선택(선택 복원)
  const [composing, setComposing] = useState(false) // 새 업무 카드 → 인라인 편집 모드
  const [composeDirty, setComposeDirty] = useState(false) // 인라인 편집 중 입력값 존재 여부
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null) // 업무카드 in-place 편집 대상(팝업 대신)
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<{ item: WorkItem; form: NewTaskForm } | null>(null) // 수정 확인 대기
  const [authors, setAuthors] = useState<string[] | null>(null) // 담당자 시트 이름 명단(자동완성)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  // 진행중 카드 수동 정렬 — 팀 공유 순서(works.sort_order)는 '기준선'(신규·복원 시 서버가 부여),
  // 드래그 순서는 개인화 Stage 3부터 계정별(user_settings 'work.order'). orderMap은 낙관 오버레이
  // 겸 설정 로드실패 세션의 로컬 폴백.
  const [orderMap, setOrderMap] = useState<Record<string, number>>({})
  // 표시 전용 정렬 — 시트·포털정렬순서 미변경, Undo/Redo 이력 미포함. null=기본(진행중=수동순서, 그 외=최신순)
  const [listSort, setListSort] = useState<{ key: 'date' | 'mgr' | 'cat'; dir: 'asc' | 'desc' } | null>(null)
  const authRef = useRef({ user, authKey })
  authRef.current = { user, authKey }

  // 복수선택(Cmd/Ctrl·Shift·모바일 롱프레스) + KPI 드롭존 드래그 상태 + 상태 저장 직렬화 큐
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selMode, setSelMode] = useState(false) // 모바일 선택모드
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true }) // 모바일=카드 스와이프 액션 활성
  const [reorderMode, setReorderMode] = useState(false) // 진행중 순서 편집(흔들림) 모드 — 모바일 액션 시트에서 진입
  const selAnchor = useRef<string | null>(null)
  const [dragUi, setDragUi] = useState<{ dragging: boolean; zone: DropZone | null }>({ dragging: false, zone: null })
  const [pulse, setPulse] = useState<{ zone: DropZone; tick: number } | null>(null)
  const zoneClickSuppress = useRef(0) // 드롭 직후 존 클릭(목록 열림) 억제
  const saveChain = useRef<Promise<void>>(Promise.resolve()) // 배치 저장 직렬화(응답 역전 방지)
  const trashElRef = useRef<HTMLDivElement | null>(null) // KPI 위 휴지통 정사각 버튼(드롭 판정·흡입 목적지 rect)
  const frozenTokenRef = useRef<HTMLDivElement | null>(null) // 휴지통 드롭 후 확인창 동안 고정된 토큰

  // 실패 상태로 페이지 재진입 시 자동 재시도(마운트 1회) — 성공하면 배너 제거·updatedAt 갱신
  useEffect(() => {
    if (error && !workLoading) dispatch(loadWorkData())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // 필터 술어 — 구분(normCat 키)·담당자·검색. 빈 선택 = 전체.
  const q = query.trim().toLowerCase()
  const matchCat = useCallback((t: WorkItem) => selCats.size === 0 || selCats.has(normCat(t.cat)), [selCats])
  const matchMgr = useCallback((t: WorkItem) => selMgrs.size === 0 || selMgrs.has(t.mgr || ''), [selMgrs])
  const matchQuery = useCallback(
    (t: WorkItem) => !q || `${t.task} ${t.mgr} ${t.dept} ${t.cat} ${t.loc}`.toLowerCase().includes(q),
    [q],
  )

  // 필터 후보(칩 표시 여부) — '현재 KPI 상태의 전체 업무'(pool) 기준. 처음부터 0건인 구분·담당자만
  // 숨기고, KPI 상태 변경·데이터 변화(신규/삭제/복원) 때만 재계산 — 필터·검색 변경으로는 불변이라
  // 실시간 건수가 0이 된 칩도 그대로 남는다(선택·해제 가능). 삭제 업무는 items에서 이미 제외.
  const poolCatCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of pool) { const k = normCat(t.cat); if (k) m[k] = (m[k] || 0) + 1 }
    return m
  }, [pool])
  const poolMgrCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of pool) { const k = t.mgr || ''; if (k) m[k] = (m[k] || 0) + 1 }
    return m
  }, [pool])
  // 칩 옆 건수 — 실시간 교차 집계(자기 그룹 선택은 제외): 구분 = KPI+담당자+검색 반영,
  // 담당자 = KPI+구분+검색 반영. '이 칩을 선택하면 몇 건이 보일지'를 나타낸다.
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of pool) {
      if (!matchMgr(t) || !matchQuery(t)) continue
      const k = normCat(t.cat)
      if (k) m[k] = (m[k] || 0) + 1
    }
    return m
  }, [pool, matchMgr, matchQuery])
  const mgrCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of pool) {
      if (!matchCat(t) || !matchQuery(t)) continue
      const k = t.mgr || ''
      if (k) m[k] = (m[k] || 0) + 1
    }
    return m
  }, [pool, matchCat, matchQuery])
  const presentCats = useMemo(
    () => [...new Set(items.map((t) => t.cat).filter(Boolean))]
      .filter((c) => (poolCatCounts[normCat(c)] || 0) > 0)
      .sort((a, b) => workCatRank(a) - workCatRank(b)),
    [items, poolCatCounts],
  )
  const presentMgrs = useMemo(
    () => [...new Set(items.map((t) => t.mgr).filter(Boolean))]
      .filter((m) => (poolMgrCounts[m] || 0) > 0)
      .sort((a, b) => a.localeCompare(b, 'ko')),
    [items, poolMgrCounts],
  )
  // 숨겨진(0건) 후보에 남은 선택 정리 — 보이지 않는 활성 필터 방지
  useEffect(() => {
    setSelCats((prev) => {
      const avail = new Set(presentCats.map((c) => normCat(c)))
      const next = new Set([...prev].filter((c) => avail.has(c)))
      return next.size === prev.size ? prev : next
    })
  }, [presentCats])
  useEffect(() => {
    setSelMgrs((prev) => {
      const avail = new Set(presentMgrs)
      const next = new Set([...prev].filter((m) => avail.has(m)))
      return next.size === prev.size ? prev : next
    })
  }, [presentMgrs])

  // 표시 전용 정렬 적용(안정 정렬 — 동률은 기존 순서 유지). 시트·포털정렬순서 미변경.
  const applyListSort = useCallback((arr: WorkItem[]) => {
    if (!listSort) return arr
    const mul = listSort.dir === 'asc' ? 1 : -1
    return [...arr].sort((a, b) => {
      if (listSort.key === 'date') return (dateSortValue(a.start) - dateSortValue(b.start)) * mul
      if (listSort.key === 'mgr') return (a.mgr || '').localeCompare(b.mgr || '', 'ko') * mul
      return (workCatRank(a.cat) - workCatRank(b.cat)) * mul
    })
  }, [listSort])

  const listed = useMemo(
    () => applyListSort(pool.filter((t) => matchCat(t) && matchMgr(t) && matchQuery(t)).sort(cmpChief)),
    [pool, matchCat, matchMgr, matchQuery, applyListSort],
  )

  // 진행중 카드 표시 순서(개인화 Stage 3) — 내 계정의 저장 순서('work.order', num 배열)가 있으면 그 순서.
  // 목록에 없는 카드(이후 신규·복원)는 맨 아래(기존 미지정=Infinity 관례와 동일). 개인 순서가 없으면
  // (한 번도 드래그 안 함·설정 로드실패) 종전 팀 기준선(orderMap 낙관 → works.sort_order) 폴백 — 화면 무변화.
  const svOrder = useAppSelector((s) => s.userSettings.settings['work.order'] as string[] | undefined)
  const personalOrder = usLoadedOk && Array.isArray(svOrder) ? svOrder : null
  const inProgressList = useMemo(() => {
    const pIdx = new Map((personalOrder || []).map((n, i) => [String(n), i]))
    const rank = (t: WorkItem) => {
      if (personalOrder) {
        const i = pIdx.get(t.num)
        return i !== undefined ? i : Infinity
      }
      const o = orderMap[t.num]
      if (o !== undefined) return o
      const n = Number(t.order)
      return t.order !== '' && !isNaN(n) ? n : Infinity
    }
    return items
      .filter((t) => classify(t) === 'inProgress')
      .sort((a, b) => rank(a) - rank(b) || cmpChief(a, b))
  }, [items, orderMap, personalOrder])
  // 진행중 표시 목록 — 탭필터·검색 적용 + 표시 전용 정렬(기본은 포털정렬순서 유지)
  const inProgressListed = useMemo(
    () => applyListSort(inProgressList.filter((t) => matchCat(t) && matchMgr(t) && matchQuery(t))),
    [inProgressList, matchCat, matchMgr, matchQuery, applyListSort],
  )

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
    setComposing(false)
    setEditingId(null)
  }

  // '+' 버튼(진행중 뷰 전용) — 카드 그리드 첫 칸에 인라인 작성카드 표시
  const startCompose = () => {
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
    const cf = contentFmtForSave(form, false)
    if (cf === 'error') return showSnack('본문 서식 처리에 실패했습니다. 다시 시도해주세요.', 'error')
    setSavingNew(true)
    try {
      await createWork({
        author: user, key: authKey,
        cat: form.cat.trim(), task,
        dept: form.dept.trim(), start: form.start, plan: form.plan,
        time: form.time.trim(), loc: form.loc.trim(), mgr: form.mgr.trim(),
        status: '진행중', link: form.link.trim(),
        remind: false, chief: form.chief,
        contentFmt: cf.value,
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
      fmtSignature(form.bodyFmt) !== fmtSignature(item.contentFmt) ||
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
    const hadFmt = !!(item.contentFmt && item.contentFmt.trim())
    const cf = contentFmtForSave(form, hadFmt)
    if (cf === 'error') return showSnack('본문 서식 처리에 실패했습니다. 다시 시도해주세요.', 'error')
    setSavingEdit(true)
    try {
      await updateWork({
        num: item.num, author: user, key: authKey,
        cat: form.cat.trim(), task, status: item.status,
        dept: form.dept.trim(), mat: item.mat, start: form.start, plan: form.plan,
        time: form.time.trim(), loc: form.loc.trim(), mgr: form.mgr.trim(),
        link: form.link.trim(), remind: item.remind, chief: form.chief,
        contentFmt: cf.value,
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

  // 소프트 삭제 실행(공용) — 시트 행을 지우지 않고 '삭제일시' 기록. token이 있으면(드웰 휴지통 드롭)
  // 고정 카드가 휴지통으로 지니 흡입된 뒤 낙관 제거 → API 기록. 실패 시 롤백, 성공 시 10초 '실행 취소'.
  const executeDelete = async (targets: WorkItem[], token?: DeleteReq['token']) => {
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (deleting) return
    setDeleting(true)
    const nums = targets.map((t) => t.num)
    try {
      if (token) {
        setDeleteReq({ items: targets, token, phase: 'suck' })
        // 고정 카드·휴지통 패널이 마운트될 프레임 대기(백그라운드 탭 대비 타이머 안전망 포함)
        await new Promise<void>((res) => {
          let done = false
          const fin = () => { if (!done) { done = true; res() } }
          requestAnimationFrame(() => requestAnimationFrame(fin))
          window.setTimeout(fin, 150)
        })
        const rect = trashElRef.current?.getBoundingClientRect()
        if (frozenTokenRef.current && rect) await genieOverlayInto(frozenTokenRef.current, rect, trashElRef.current)
      }
      // 낙관 반영 — 화면에서 즉시 제거(items → 휴지통). 스탬프는 백엔드와 같은 형식(KST yyyy-MM-dd HH:mm)
      const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
      dispatch(softDeleteWorkItems({ nums, deletedAt: stamp }))
      if (picked && targets.some((i) => i.num === picked.num)) setPicked(null)
      setDeleteReq(null)
      setTrashArmed(false)
      clearSelection()
      try {
        await deleteWork({ nums, author: user, key: authKey })
        setUndoSnack({ nums, count: nums.length })
      } catch (err) {
        // 기록 실패 — 화면 롤백(휴지통 → 목록) + 오류 안내
        dispatch(restoreWorkItems({ nums }))
        showSnack(err instanceof Error ? err.message : '삭제 기록에 실패해 되돌렸습니다.', 'error')
      }
    } finally {
      setDeleting(false)
      setDeleteReq(null)
      setTrashArmed(false)
    }
  }

  // 삭제 확인창 동의(상세 Drawer 등 비드래그 경로 전용 — 드웰 휴지통 드롭은 확인창 없이 executeDelete 직행)
  const confirmDelete = async () => {
    const req = deleteReq
    if (!req || deleting || req.phase !== 'confirm') return
    await executeDelete(req.items, req.token)
  }

  // 삭제 실행 취소(10초 스낵바) — 삭제일시를 비우고 원래 상태로 복원. 실패 시 휴지통에 유지.
  const undoDelete = async (nums: string[]) => {
    setUndoSnack(null)
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    try {
      const { orders } = await restoreWorks({ nums, author: user, key: authKey })
      dispatch(restoreWorkItems({ nums, orders }))
      showSnack('삭제를 취소했습니다.', 'success')
    } catch (err) {
      showSnack(err instanceof Error ? err.message : '실행 취소에 실패했습니다. 휴지통에서 복원할 수 있습니다.', 'error')
    }
  }

  // 휴지통 복원(개별·선택) — 상태·Remind·Check 유지, 진행중은 수동정렬 맨 아래(백엔드가 순서 부여)
  const [restoring, setRestoring] = useState(false)
  const restoreFromTrash = async (nums: string[]) => {
    if (!user || !authKey || restoring || nums.length === 0) return
    setRestoring(true)
    try {
      const { orders } = await restoreWorks({ nums, author: user, key: authKey })
      dispatch(restoreWorkItems({ nums, orders }))
      setTrashSel(new Set())
      showSnack(nums.length > 1 ? `업무 ${nums.length}건을 복원했습니다.` : '업무를 복원했습니다.', 'success')
    } catch (err) {
      showSnack(err instanceof Error ? err.message : '복원에 실패했습니다.', 'error')
    } finally {
      setRestoring(false)
    }
  }

  // 수정 폼의 구분 옵션 — 기존 값이 표준 6개에 없으면 그 값도 선택 가능하게 포함(데이터 손실 방지)
  const editOptionsFor = (t: WorkItem) =>
    t.cat && !fieldOptions.cats.includes(t.cat) ? { ...fieldOptions, cats: [t.cat, ...fieldOptions.cats] } : fieldOptions

  // ── 진행중 카드 순서변경 확정(드래그·Undo/Redo 공용) — 개인화 Stage 3: 계정별 저장 ──
  // 팀 works.sort_order는 더 이상 드래그로 갱신하지 않음(신규·복원 시 서버 부여 기준선으로만 유지).
  // putSetting = 낙관 즉시 반영 + 0.8s 디바운스 병합 저장(work.order 키만 — 타 세션 값 안 건드림).
  // usLoadedOk 게이트 없음(적대적 리뷰 반영): 드래그는 사용자 명시 조작이라 로드 전/실패여도 저장이
  // 의도 반영이고, 게이트하면 ① 로드 완료 순간 서버 구 순서가 방금 드래그를 화면에서 되돌리고
  // ② 그 드래그가 유실됨. setSetting이 로컬 키를 심으므로 fulfilled 병합({...서버,...로컬})도 화면을 보존.
  const commitOrder = (orderedNums: string[]) => {
    const map: Record<string, number> = {}
    orderedNums.forEach((num, i) => { map[num] = (i + 1) * 10 })
    setOrderMap((prev) => ({ ...prev, ...map }))
    dispatch(putSetting({ key: 'work.order', value: orderedNums }))
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
    // 드래그 = 수동 정렬 의도 — 표시 정렬을 해제하고 보이는 배치 그대로 포털정렬순서로 확정(시각적 점프 없음)
    setListSort(null); commitOrder(finalOrder); bumpHist()
  }

  // 정렬 버튼 — 표시 전용(시트·포털정렬순서 미변경, 이력 미포함). 같은 키 재클릭 = 방향 전환.
  // 날짜는 최신순(↓)부터, 담당자·구분은 오름차순(↑)부터 시작.
  const toggleListSort = (key: 'date' | 'mgr' | 'cat') => {
    setListSort((prev) => {
      if (prev?.key === key) return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
      return { key, dir: key === 'date' ? 'desc' : 'asc' }
    })
  }
  // 정렬 버튼 라벨·화살표 — 활성 버튼에만 방향 화살표
  const sortArrow = (key: 'date' | 'mgr' | 'cat') =>
    listSort?.key === key
      ? (listSort.dir === 'desc' ? <ArrowDownwardIcon sx={{ fontSize: 13 }} /> : <ArrowUpwardIcon sx={{ fontSize: 13 }} />)
      : undefined

  // 구분·담당자 필터 토글 — 일반클릭: 단독 선택/단독 재클릭 해제(전체) · Shift: 기존 유지 + 추가/해제
  const nextFilterSet = (prev: Set<string>, value: string, additive: boolean): Set<string> => {
    if (!additive) {
      if (prev.size === 1 && prev.has(value)) return new Set<string>()
      return new Set([value])
    }
    const next = new Set(prev)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }
  // 계정 저장은 여기(사용자 토글)에서만. 설정 로드 실패 세션(usLoadedOk=false)은 화면만 바꾸고 저장 안 함.
  const toggleCat = (value: string, additive: boolean) => {
    filterTouched.current = true
    const next = nextFilterSet(selCats, value, additive)
    setSelCats(next)
    if (usLoadedOk) dispatch(putSetting({ key: 'work.filter.cats', value: [...next].sort() }))
  }
  const toggleMgr = (value: string, additive: boolean) => {
    filterTouched.current = true
    const next = nextFilterSet(selMgrs, value, additive)
    setSelMgrs(next)
    if (usLoadedOk) dispatch(putSetting({ key: 'work.filter.mgrs', value: [...next].sort() }))
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
    if (e.kind === 'order') { setListSort(null); commitOrder(e.before) } else applyStatusEntry(e, 'back')
    bumpHist()
  }
  const doRedo = () => {
    const e = redoStack.current.pop()
    if (!e) return
    undoStack.current.push(e)
    if (e.kind === 'order') { setListSort(null); commitOrder(e.after) } else applyStatusEntry(e, 'forward')
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
  useEffect(() => { clearSelection() }, [view, selCats, selMgrs, query, user, clearSelection])
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

  // 우측 드웰 존 알림(그리드) — 진입 유지 500ms 후 휴지통 무장, 이탈·드래그 종료 시 즉시 해제.
  // 무장 시 패널 세로 범위 = 업무카드가 차지하는 영역(보이는 카드 셀들의 상하 union, KPI 하단~뷰포트로 클램프)
  const onRightEdge = useCallback((inZone: boolean) => {
    if (inZone) {
      if (trashDwellTimer.current == null) {
        trashDwellTimer.current = window.setTimeout(() => {
          trashDwellTimer.current = null
          let top = Infinity
          let bottom = -Infinity
          document.querySelectorAll('.reorder-cell, .sdg-cell').forEach((el) => {
            const r = el.getBoundingClientRect()
            top = Math.min(top, r.top)
            bottom = Math.max(bottom, r.bottom)
          })
          const kpiBottom = document.querySelector('[data-dropzone="remind"]')?.getBoundingClientRect().bottom ?? 80
          const vTop = Math.max(isFinite(top) ? top : 180, kpiBottom + 12, 80)
          const vBottom = Math.min(isFinite(bottom) ? bottom : window.innerHeight - 14, window.innerHeight - 14)
          setTrashPanelBox({ top: vTop, height: Math.max(180, vBottom - vTop) })
          setTrashArmed(true)
        }, 500)
      }
    } else {
      if (trashDwellTimer.current != null) {
        window.clearTimeout(trashDwellTimer.current)
        trashDwellTimer.current = null
      }
      setTrashArmed(false)
    }
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
  // 휴지통 드롭(단일·복수) — 흡입 없이 확인창부터. 드래그하던 카드를 드롭 자리·크기 그대로 고정 표시,
  // 취소 시 원상 복원. 진행 중 삭제 라이프사이클 동안 새 요청은 무시 — deleteReq 덮어쓰기 방지.
  // 수정모드(in-place 편집) 카드는 대상에서 제외(존 드롭과 동일 가드).
  const handleDeleteDrop = (nums: string[], at: { cx: number; cy: number; w: number; h: number; scale: number }) => {
    if (!isAdmin || !user || !authKey) return
    if (deleting || deleteReq) return
    const targets = nums
      .map((n) => items.find((x) => x.num === n))
      .filter((t): t is WorkItem => !!t && editingId !== t.id)
    if (targets.length === 0) return
    setTrashHover(false)
    // 드웰 휴지통 드롭 = 확인창 없이 즉시 소프트삭제 — 드웰 500ms가 의도 게이트,
    // 10초 실행 취소 스낵바 + 휴지통 드로어 복원이 안전망.
    void executeDelete(targets, at)
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

  // ── 모바일 카드 왼쪽 스와이프 액션(상태·수정·삭제) — PC 드래그 3종을 터치에서 대체 ──
  // 그 카드에서 실제로 변화가 생기는 상태 존만(무반응 옵션·취소 카드의 죽은 액션 방지)
  const zonesForTask = (t: WorkItem): DropZone[] => {
    if (!['inProgress', 'hold', 'done'].includes(classify(t))) return [] // 취소·기타는 상태변경 불가(무반응)
    const before = { status: (t.status || '').trim(), remind: !!t.remind }
    return (['inProgress', 'hold', 'done', 'remind'] as DropZone[]).filter((z) => {
      const after = zoneFields(t, z)
      return before.status !== after.status || before.remind !== after.remind
    })
  }
  // 모바일에서만 스와이프 래핑(PC는 undefined → 그리드가 카드 직접 렌더, 무회귀)
  const swipeConfig: WorkSwipeConfig | undefined = isMobile
    ? {
        enabled: isAdmin,
        buildActions: (num: string) => {
          const t = items.find((x) => x.num === num)
          const statusOptions = t
            ? zonesForTask(t).map((z) => ({ key: z, label: ZONE_LABELS[z], onPress: () => handleStatusDrop([num], z)?.finalize() }))
            : []
          return {
            statusOptions,
            onEdit: () => handleCardDoubleClick(num),
            onDelete: () => { if (t) requestDelete(t) },
          }
        },
      }
    : undefined
  // KPI 뷰가 바뀌면 순서 편집 모드 해제(진행중 전용). 수정 진입 시에도 해제(편집 셀 touch-action 충돌 방지).
  useEffect(() => { setReorderMode(false) }, [view])
  useEffect(() => { if (editingId != null) setReorderMode(false) }, [editingId])

  // 업무 행 — 수정 중이면 그 자리에서 인라인 편집(전폭), 아니면 카드.
  // tone = 상태 계층 색(KPI 대표색), selected = 카드가 직접 상태색으로 선택 효과를 그림(셀 outline 없음)
  const renderTask = (t: WorkItem, tone: CardTone) =>
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
      <TaskAccordion key={t.id} t={t} tone={tone} selected={selected.has(t.num)} />
    )

  return (
    <PageContainer>
      <PageHeader
        icon={<AssessmentIcon />}
        title="업무현황"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
      />

      {/* 업무 목록 불러오기 최종 실패 — 빈 화면 대신 오류 안내 + 다시 시도. 기존 목록이 있으면 유지 표시 */}
      {error && (
        <Alert
          severity={items.length > 0 ? 'warning' : 'error'}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => dispatch(loadWorkData())} disabled={workLoading}>
              {workLoading ? '불러오는 중…' : '다시 시도'}
            </Button>
          }
        >
          {items.length > 0
            ? `업무 목록 새로고침에 실패했습니다. 마지막으로 불러온 목록(${updatedAt || '이전'})을 표시 중입니다.`
            : '업무 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
          {errorMsg ? ` — ${errorMsg}` : ''}
        </Alert>
      )}

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

      {/* ② 업무 목록 — 4개 상태 뷰 공통 인터페이스(제목행 + 2열 필터·조작부) */}
      <ContentSection last={!SHOW_MANAGER_STATUS}>
        {/* 제목행: [상태 아이콘] 상태별 제목 N건 [+](진행중·관리자만) — 그 외 요소 없음 */}
        {(() => {
          const meta = VIEW_META[view]
          const ViewIcon = meta.Icon
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5, minWidth: 0 }}>
              <ViewIcon sx={{ fontSize: 22, color: meta.color, flexShrink: 0 }} />
              <Typography variant="h2" component="h2" sx={{ color: meta.color }}>{meta.title}</Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                {view === 'inProgress' ? inProgressListed.length : listed.length}건
              </Typography>
              {view === 'inProgress' && isAdmin && <NewTaskPlusButton onClick={startCompose} />}
            </Box>
          )
        })()}

        {/* 필터·조작부 카드(A안 — 업무일정 필터바와 동일한 테두리 카드 문법).
            PC 2행 그리드: [담당자|Undo·정렬·휴지통] / [구분|검색], 모바일 단일 열: 담당자 → 구분 → 정렬 → 검색.
            우측 열 폭은 두 행이 공유(grid auto column)해 오른쪽 끝선 일정. */}
        <Box
          sx={(th) => ({
            bgcolor: 'background.paper',
            border: `1px solid ${th.palette.divider}`,
            borderRadius: '12px',
            p: '10px 14px',
            mb: 2.5,
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
            gridTemplateAreas: {
              xs: '"mgrs" "cats" "controls" "search"',
              md: presentMgrs.length > 0 ? '"mgrs controls" "cats search"' : '"cats controls" "cats search"',
            },
            columnGap: { md: 2.5 }, rowGap: 1,
            alignItems: 'center',
          })}
        >
          {/* 1행 좌: 담당자 필터 — 업무일정 팀원 알약과 동일(선택=고유색 솔리드, 호버에도 선택 모습 유지, 건수 미표시) */}
          {presentMgrs.length > 0 && (
            <Box sx={{ gridArea: 'mgrs', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: 'text.disabled', flexShrink: 0, width: 44 }}>담당자</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
                {presentMgrs.map((m) => (
                  <MgrFilterChip
                    key={m}
                    color={mgrColor(m)}
                    label={m}
                    count={mgrCounts[m] || 0}
                    on={selMgrs.size === 0 || selMgrs.has(m)}
                    onToggle={(additive) => toggleMgr(m, additive)}
                  />
                ))}
              </Box>
            </Box>
          )}
          {/* 2행 좌: 구분 필터 — 업무일정 종류 칩과 동일(빈 선택=전체가 선택된 모습, 해제=dim) */}
          <Box sx={{ gridArea: 'cats', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: 'text.disabled', flexShrink: 0, width: 44 }}>구분</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
              {presentCats.map((c) => (
                <CatFilterChip
                  key={c}
                  kind={catKind(c)}
                  label={c}
                  count={catCounts[normCat(c)] || 0}
                  on={selCats.size === 0 || selCats.has(normCat(c))}
                  onToggle={(additive) => toggleCat(normCat(c), additive)}
                />
              ))}
            </Box>
          </Box>
          {/* 1행 우: 선택 도구 + Undo/Redo + 정렬 */}
          <Box sx={{ gridArea: 'controls', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            {isAdmin && selected.size > 0 && (
              <>
                <StatusChip status="info" label={`${selected.size}건 선택`} />
                <StatusChip status="neutral" label="선택 해제" onClick={clearSelection} />
              </>
            )}
            {isAdmin && (
              <BtnGroup>
                <GroupBtn title="실행취소 (Ctrl/Cmd+Z)" icon={<UndoIcon sx={{ fontSize: 16 }} />} disabled={!canUndo} onClick={doUndo} />
                <GroupBtn title="다시실행 (Ctrl/Cmd+Shift+Z)" icon={<RedoIcon sx={{ fontSize: 16 }} />} disabled={!canRedo} onClick={doRedo} />
              </BtnGroup>
            )}
            {/* 순서 편집 토글 — 모바일 진행중 뷰 전용. 켜면 카드를 끌어 순서변경(그동안 스와이프 비활성) */}
            {isAdmin && isMobile && view === 'inProgress' && (
              <BtnGroup>
                <GroupBtn title="순서 편집 (카드를 끌어 순서변경)" label="순서" icon={<SwapVertIcon sx={{ fontSize: 16 }} />} selected={reorderMode} onClick={() => { clearSelection(); setReorderMode((v) => !v) }} />
              </BtnGroup>
            )}
            <BtnGroup>
              <GroupBtn title="날짜 정렬(재클릭 시 방향 전환)" label="날짜" icon={sortArrow('date')} selected={listSort?.key === 'date'} onClick={() => toggleListSort('date')} />
              <GroupBtn title="담당자 가나다 정렬(재클릭 시 방향 전환)" label="담당자" icon={sortArrow('mgr')} selected={listSort?.key === 'mgr'} onClick={() => toggleListSort('mgr')} />
              <GroupBtn title="업무구분 정렬(재클릭 시 방향 전환)" label="구분" icon={sortArrow('cat')} selected={listSort?.key === 'cat'} onClick={() => toggleListSort('cat')} />
            </BtnGroup>
            {/* 휴지통 드로어 열기 — 복원용(삭제 건이 있을 때만). 삭제 드롭은 우측 드웰 휴지통이 담당 */}
            {isAdmin && trashed.length > 0 && (
              <ButtonBase
                aria-label={`휴지통 열기 (삭제 업무 ${trashed.length}건)`}
                onClick={() => setTrashOpen(true)}
                sx={(th) => ({
                  height: 30, px: 1.25, gap: 0.5, flexShrink: 0,
                  border: '1px solid', borderColor: 'divider', borderRadius: '8px',
                  bgcolor: alpha(th.palette.text.primary, 0.03),
                  color: th.palette.accent.red,
                  fontSize: 12.5, fontWeight: 600, lineHeight: 1,
                  '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.06) },
                })}
              >
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                휴지통 {trashed.length}
              </ButtonBase>
            )}
          </Box>
          {/* 2행 우: 검색창 — 위 조작행과 같은 grid 열을 공유해 전체 폭·오른쪽 끝선이 자동 일치
              (고정 px 강제 없음 — 열 폭은 조작행 내용이 결정, 휴지통 제거만큼 자연 축소) */}
          <Box sx={{ gridArea: 'search', minWidth: 0 }}>
            <SearchBar value={query} onChange={setQuery} width="100%" placeholder="업무명·담당자·부서·구분·장소 검색" sx={{ minWidth: { md: 230 } }} />
          </Box>
        </Box>

        {view === 'inProgress' ? (
          inProgressListed.length === 0 && !composing ? (
            <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
          ) : (
            <ReorderableTaskGrid
              items={inProgressListed}
              canDrag={(t) => isAdmin && !!user && !!authKey && editingId !== t.id}
              reorderMode={reorderMode}
              swipe={swipeConfig}
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
              onRightEdge={onRightEdge}
              awaitingNums={awaitingNums}
              awaitingHidden={awaitingHidden}
              leading={isAdmin && composing ? (
                <Box sx={{ minWidth: 0 }}>
                  <NewTaskCard saving={savingNew} options={fieldOptions} onCancel={() => setComposing(false)} onSave={handleSaveNew} onDirtyChange={setComposeDirty} />
                </Box>
              ) : undefined}
            />
          )
        ) : listed.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
        ) : (
          <StatusDragGrid
            key={view}
            items={listed}
            renderCard={(t) => renderTask(t, view === 'remind' ? 'purple' : classify(t) === 'done' ? 'blue' : classify(t) === 'hold' ? 'amber' : 'green')}
            canDrag={(t) => isAdmin && !!user && !!authKey && editingId !== t.id}
            selectedNums={selected}
            selMode={selMode}
            onSelectToggle={toggleSelect}
            swipe={swipeConfig}
            onDragStartCard={selectOnly}
            onStatusDrop={handleStatusDrop}
            onZoneChange={onZoneChange}
            onCardDoubleClick={handleCardDoubleClick}
            onDeleteDrop={handleDeleteDrop}
            onTrashHover={setTrashHover}
            onRightEdge={onRightEdge}
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

      {/* 순서 편집(흔들림) 모드 배너 — 진행중 뷰, 툴바의 '순서' 토글로 진입 */}
      {reorderMode && view === 'inProgress' && (
        <Box
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
            bgcolor: 'primary.main', color: 'primary.contrastText',
            px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5,
            boxShadow: '0 -2px 12px rgba(0,0,0,.3)',
            pb: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Typography sx={{ flex: 1, fontSize: 13.5 }}>왼쪽 손잡이(≡)를 끌어 순서를 바꾸세요 · 목록은 그대로 스크롤됩니다</Typography>
          <Button size="small" variant="contained" onClick={() => setReorderMode(false)} sx={{ bgcolor: '#fff', color: 'primary.main', '&:hover': { bgcolor: '#f0f0f0' } }}>
            완료
          </Button>
        </Box>
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

      {/* 우측 드웰 휴지통 — 드래그 중 포인터가 화면 오른쪽 공간에 500ms 머물면 '선택된(무장)' 모습으로 등장.
          카드 실영역 접촉 시 접촉 강조 + 카드 축소(trashShrinkByCard), 놓으면 확인창 없이 소프트삭제
          (10초 실행 취소·드로어 복원이 안전망). 삭제 흡입(suck) 동안 지니 목적지로 유지. */}
      {isAdmin && (trashArmed || (!!deleteReq?.token && deleteReq.phase !== 'clearing')) && (
        <Box
          data-trashzone
          ref={trashElRef}
          aria-hidden
          sx={(th) => {
            const contact = trashHover || (!!deleteReq?.token && deleteReq.phase !== 'clearing')
            return {
              position: 'fixed', zIndex: th.zIndex.modal - 1,
              right: 14, top: trashPanelBox.top,
              width: 74, height: trashPanelBox.height, borderRadius: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75,
              border: '1.5px solid #f07a74',
              bgcolor: 'rgba(148,43,43,.92)',
              color: '#fff',
              fontSize: 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.25,
              transform: contact ? 'scale(1.02)' : 'none',
              transformOrigin: 'right center',
              boxShadow: contact
                ? '0 0 0 7px rgba(230,103,97,.16), 0 14px 38px rgba(0,0,0,.5)'
                : '0 12px 32px rgba(0,0,0,.45)',
              transition: 'box-shadow .14s, transform .14s',
              animation: 'workTrashFade .18s ease',
              '@keyframes workTrashFade': { from: { opacity: 0 }, to: { opacity: 1 } },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 26 }} />
          놓으면 삭제
        </Box>
      )}

      {/* 휴지통 드롭 후 고정 카드 — 드래그하던 카드가 드롭 자리·축소 크기 그대로 확인창 동안 유지, 동의 시 지니 흡입의 원본 */}
      {deleteReq?.token && deleteReq.phase !== 'clearing' && (() => {
        const t0 = deleteReq.items[0]
        // D3 전역 배정: 진행중=그린 · 완료=파랑 · 보류=앰버 · Remind(플래그)=퍼플
        const tone: CardTone = view === 'remind' ? 'purple' : classify(t0) === 'done' ? 'blue' : classify(t0) === 'hold' ? 'amber' : 'green'
        const n = deleteReq.items.length
        const tk = deleteReq.token
        return (
          <Box
            ref={frozenTokenRef}
            aria-hidden
            sx={(th) => ({
              position: 'fixed', zIndex: th.zIndex.modal - 1,
              left: tk.cx - tk.w / 2, top: tk.cy - tk.h / 2,
              width: tk.w, height: tk.h, pointerEvents: 'none',
              transform: `scale(${tk.scale})`, transformOrigin: '50% 50%',
              opacity: 0.92, borderRadius: 1,
              outline: '2px dashed rgba(224,91,84,.95)', outlineOffset: '3px',
              '--stack-gap': `${Math.max(2, 10 * tk.scale).toFixed(1)}px`,
            })}
          >
            {n > 2 && (
              <Box sx={(th) => ({ position: 'absolute', inset: 0, transform: 'translate(calc(var(--stack-gap) * 2), calc(var(--stack-gap) * 2))', bgcolor: 'background.elevated', border: `1px solid ${th.palette.divider}`, borderRadius: 1 })} />
            )}
            {n > 1 && (
              <Box sx={(th) => ({ position: 'absolute', inset: 0, transform: 'translate(var(--stack-gap), var(--stack-gap))', bgcolor: 'background.elevated', border: `1px solid ${th.palette.divider}`, borderRadius: 1 })} />
            )}
            <Box sx={{ position: 'relative', height: '100%', boxShadow: '0 20px 50px rgba(0,0,0,.48)', borderRadius: 1, overflow: 'hidden', '& > *': { height: '100%' } }}>
              <TaskAccordion t={t0} tone={tone} />
              {n > 1 && (
                <Box sx={(th) => ({
                  position: 'absolute', top: 6, right: 6, zIndex: 2,
                  px: 1, py: 0.4, borderRadius: '999px',
                  bgcolor: th.palette.accent.blue, color: '#fff',
                  fontSize: 12.5, fontWeight: 700, lineHeight: 1,
                })}>
                  {n}건
                </Box>
              )}
            </Box>
          </Box>
        )
      })()}

      {/* 삭제 직후 10초 실행 취소 스낵바 */}
      <Snackbar
        open={!!undoSnack}
        autoHideDuration={10000}
        onClose={(_, reason) => { if (reason !== 'clickaway') setUndoSnack(null) }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          variant="filled"
          action={
            <Button color="inherit" size="small" onClick={() => undoSnack && void undoDelete(undoSnack.nums)}>
              실행 취소
            </Button>
          }
          onClose={() => setUndoSnack(null)}
          sx={{ width: '100%' }}
        >
          {undoSnack && undoSnack.count > 1 ? `업무 ${undoSnack.count}건을 삭제했습니다.` : '업무를 삭제했습니다.'}
        </Alert>
      </Snackbar>

      {/* 휴지통 드로어 — 삭제일시 내림차순, 개별/선택 복원(영구삭제 없음) */}
      <Drawer anchor="right" open={trashOpen} onClose={() => { setTrashOpen(false); setTrashSel(new Set()) }}>
        <Box sx={{ width: { xs: '88vw', sm: 400 }, p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteOutlineIcon sx={(th) => ({ fontSize: 20, color: th.palette.accent.red })} />
            <Typography variant="h3" component="h3" sx={{ fontWeight: 800 }}>휴지통</Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>{trashed.length}건</Typography>
            <Box sx={{ ml: 'auto' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={trashSel.size === 0 || restoring}
                onClick={() => void restoreFromTrash([...trashSel])}
              >
                {restoring ? '복원 중…' : `선택 복원${trashSel.size ? ` (${trashSel.size})` : ''}`}
              </Button>
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            복원하면 삭제 전 상태 그대로 목록에 돌아갑니다. 진행중 업무는 목록 맨 아래에 배치됩니다.
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {trashed.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 6 }}>삭제된 업무가 없습니다</Typography>
            )}
            {[...trashed]
              .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''))
              .map((t) => {
                const checked = trashSel.has(t.num)
                const stateLabel = `${(t.status || '').trim() || '미정'}${t.remind ? ' · Remind' : ''}${t.chief ? ' · Check' : ''}`
                return (
                  <Box
                    key={t.num}
                    sx={(th) => ({
                      p: 1.25, border: '1px solid', borderColor: checked ? alpha(th.palette.accent.blue, 0.8) : 'divider',
                      borderRadius: 1.5, bgcolor: checked ? alpha(th.palette.accent.blue, 0.08) : 'background.paper',
                      display: 'flex', gap: 1, alignItems: 'flex-start', cursor: 'pointer',
                    })}
                    onClick={() => setTrashSel((prev) => { const n = new Set(prev); if (n.has(t.num)) n.delete(t.num); else n.add(t.num); return n })}
                  >
                    <Checkbox size="small" checked={checked} sx={{ p: 0.25, mt: 0.1 }} onClick={(e) => e.stopPropagation()} onChange={() => setTrashSel((prev) => { const n = new Set(prev); if (n.has(t.num)) n.delete(t.num); else n.add(t.num); return n })} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, alignItems: 'center' }}>
                        <StatusChip status={classify(t) === 'done' ? 'neutral' : classify(t) === 'hold' ? 'info' : 'success'} label={stateLabel} />
                        {t.cat && <StatusChip status="neutral" label={t.cat} />}
                        {t.mgr && <StatusChip status="info" label={t.mgr} />}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>삭제 {t.deletedAt}</Typography>
                    </Box>
                    <Button size="small" disabled={restoring} onClick={(e) => { e.stopPropagation(); void restoreFromTrash([t.num]) }} sx={{ flexShrink: 0 }}>
                      복원
                    </Button>
                  </Box>
                )
              })}
          </Box>
        </Box>
      </Drawer>
    </PageContainer>
  )
}
