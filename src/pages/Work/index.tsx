import { useEffect, useMemo, useState } from 'react'
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
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import AssessmentIcon from '@mui/icons-material/Assessment'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
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
import { loadWorkData } from '@/store/slices/workSlice'
import { createWork, deleteWork, updateWork, fetchAuthors } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { classify, taskTitle, dashToBullet, bulletToDash, WORK_CAT_OPTIONS, WORK_MGR_OPTIONS } from './workMeta'
import TaskCard from './TaskCard'
import TaskAccordion from './TaskAccordion'
import TaskDetailDrawer from './TaskDetailDrawer'
import WorkWrite from './WorkWrite'
import NewTaskCard from './NewTaskCard'
import type { NewTaskForm } from './NewTaskCard'

// 상단 KPI 단일 선택 뷰 (진행중/Remind/완료 중 하나만 선택)
type KpiView = 'inProgress' | 'remind' | 'done'
// STEP24 — 담당자 현황 섹션 임시 숨김(구조 보존, 추후 재노출 시 true)
const SHOW_MANAGER_STATUS = false

// 발의일자 최신순 (최근 업무가 위)
const cmp = (a: WorkItem, b: WorkItem) => dateSortValue(b.start) - dateSortValue(a.start)

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

// KPI 카드의 라운드 정사각 칩 (진행중=초록·Remind=앰버·완료=회색)
function SquareChip({ label, tone }: { label: string; tone: 'green' | 'amber' | 'gray' }) {
  return (
    <Box
      sx={(t) => {
        const c = tone === 'green' ? t.palette.accent.green : tone === 'amber' ? t.palette.accent.amber : t.palette.text.secondary
        return {
          width: 116, height: 116, flexShrink: 0, borderRadius: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: alpha(c, 0.15), color: c,
          fontWeight: 800, fontSize: 23, lineHeight: 1.1, px: 0.5, textAlign: 'center',
        }
      }}
    >
      {label}
    </Box>
  )
}

// 'Add 카드' — 미선택 카드 톤(점선) + 호버 시 채움 미리보기. 누르면 새 업무 작성.
function AddCard({ onClick, height = 120 }: { onClick: () => void; height?: number }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="새 업무 등록"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={(th) => ({
        minHeight: height,
        border: '1.5px dashed', borderColor: 'divider', borderRadius: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
        color: 'text.secondary', fontWeight: 600, cursor: 'pointer',
        transition: 'background-color .15s, border-color .15s',
        '&:hover': { bgcolor: alpha(th.palette.text.secondary, 0.08), borderColor: alpha(th.palette.text.secondary, 0.55) },
        '&:focus-visible': { outline: 'none', borderColor: th.palette.primary.main },
      })}
    >
      <AddIcon sx={{ fontSize: 22 }} /> 새 업무
    </Box>
  )
}

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info' }

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector((s) => s.work)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<KpiView>('inProgress') // 단일 선택: 진행중/Remind/완료
  const [selectedTask, setSelectedTask] = useState<number | null>(null) // 업무카드 단일 선택(테두리)
  const [cat, setCat] = useState('전체')
  const [mgr, setMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<WorkItem | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<WorkItem | null>(null)
  const [completing, setCompleting] = useState(false)
  const [remindOnComplete, setRemindOnComplete] = useState(false) // 완료 시 Remind 업무로 설정 체크박스
  const [composing, setComposing] = useState(false) // 새 업무 카드 → 인라인 편집 모드
  const [composeDirty, setComposeDirty] = useState(false) // 인라인 편집 중 입력값 존재 여부
  const [savingNew, setSavingNew] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null) // 업무카드 in-place 편집 대상(팝업 대신)
  const [savingEdit, setSavingEdit] = useState(false)
  const [pendingEdit, setPendingEdit] = useState<{ item: WorkItem; form: NewTaskForm } | null>(null) // 수정 확인 대기
  const [authors, setAuthors] = useState<string[] | null>(null) // 담당자 시트 이름 명단(자동완성)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

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

  const pool = useMemo(
    () => (view === 'remind' ? items.filter((t) => t.remind) : items.filter((t) => classify(t) === view)),
    [items, view],
  )

  const presentMgrs = useMemo(() => ['전체', ...[...new Set(pool.map((t) => t.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [pool])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pool
      .filter((t) => cat === '전체' || normCat(t.cat) === normCat(cat))
      .filter((t) => mgr === '전체' || (t.mgr || '') === mgr)
      .filter((t) => !q || `${t.task} ${t.mgr} ${t.dept} ${t.cat} ${t.loc}`.toLowerCase().includes(q))
      .sort(cmp)
  }, [pool, cat, mgr, query])

  // 단일 선택 — 같은 카드를 다시 눌러도 해제되지 않음(계속 선택), 다른 카드 선택 시 자동 전환
  const selectView = (v: KpiView) => {
    // 인라인 작성 중 내용이 있으면 뷰 전환으로 사라지기 전에 확인
    if (composing && composeDirty && !window.confirm('작성 중인 새 업무가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?')) return
    setView(v)
    setMgr('전체')
    setSelectedTask(null)
    setComposing(false)
    setEditingId(null)
  }

  // '새 업무' 카드 클릭 → 진행중 뷰에서 인라인 편집 카드 펼침(별도 창 없음)
  const startCompose = () => {
    setView('inProgress')
    setSelectedTask(null)
    setEditingId(null)
    setComposing(true)
  }

  // 업무카드 수정 아이콘 → 그 자리에서 in-place 편집(팝업 없음)
  const startEdit = (t: WorkItem) => {
    setComposing(false)
    setSelectedTask(t.id)
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

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    setDeleting(true)
    try {
      await deleteWork({ num: deleteTarget.num, author: user, key: authKey })
      setDeleting(false)
      setDeleteTarget(null)
      setPicked(null)
      showSnack('업무를 삭제했습니다.', 'success')
      dispatch(loadWorkData())
    } catch (err) {
      setDeleting(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
    }
  }

  // 수정 폼의 구분 옵션 — 기존 값이 표준 6개에 없으면 그 값도 선택 가능하게 포함(데이터 손실 방지)
  const editOptionsFor = (t: WorkItem) =>
    t.cat && !fieldOptions.cats.includes(t.cat) ? { ...fieldOptions, cats: [t.cat, ...fieldOptions.cats] } : fieldOptions

  // 업무 행 — 수정 중이면 그 자리에서 인라인 편집(전폭), 아니면 카드
  const renderTask = (t: WorkItem, tone: 'green' | 'gray') =>
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
        selected={selectedTask === t.id}
        onSelect={() => setSelectedTask(t.id)}
        isAdmin={isAdmin}
        onEdit={startEdit}
        onComplete={(it) => setCompleteTarget(it)}
        onDelete={(it) => setDeleteTarget(it)}
      />
    )

  return (
    <PageContainer>
      <PageHeader
        icon={<AssessmentIcon />}
        title="업무현황"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setWriteOpen(true) }}>
                업무 등록
              </Button>
            )}
            <IconButton aria-label="새로고침" onClick={() => dispatch(loadWorkData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      {/* ① KPI — 진행중(내부 Check) / Remind / 완료. 동일 너비(3열) · 단일 선택(선택색=칩 색, 옅은 채움) */}
      <ContentSection>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '4fr 3fr 3fr' }, gap: 2 }}>
          {/* 진행중 (메인, 4) — 정사각 칩 + 건수 + 우측 보라 박스(1건+Check) */}
          <AppCard
            interactive
            onClick={() => selectView('inProgress')}
            ariaLabel="진행중 업무 보기"
            padding={18}
            sx={{
              ...(view === 'inProgress'
                ? { borderColor: (t) => t.palette.accent.green, bgcolor: (t) => alpha(t.palette.accent.green, 0.12) }
                : {}),
              '&:hover': { borderColor: (t) => t.palette.accent.green, bgcolor: (t) => alpha(t.palette.accent.green, view === 'inProgress' ? 0.18 : 0.08) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, minHeight: 116 }}>
              <SquareChip label="진행중" tone="green" />
              {/* 칩 바로 오른쪽: 건수 */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexShrink: 0, alignSelf: 'center', ml: '36px' }}>
                <Typography component="span" sx={{ fontSize: 60, fontWeight: 800, lineHeight: 1 }}>{counts.inProgress}</Typography>
                <Typography component="span" sx={{ fontSize: 20, fontWeight: 600, color: 'text.secondary' }}>건</Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              {/* 우측 보라 박스 — 1건 + Check 한 박스 (표시 전용, 클릭은 진행중 카드로 위임) */}
              <Box
                aria-hidden
                sx={(t) => ({
                  flexShrink: 0, width: 104,
                  border: 1, borderColor: alpha(t.palette.accent.purple, 0.55), bgcolor: alpha(t.palette.accent.purple, 0.14),
                  borderRadius: '16px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75,
                  color: t.palette.accent.purple,
                })}
              >
                <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{counts.chief}건</Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>Check</Typography>
              </Box>
            </Box>
          </AppCard>

          {/* Remind — 정사각 칩 + 건수(좌 묶음). 선택색 amber */}
          <AppCard
            interactive
            onClick={() => selectView('remind')}
            ariaLabel="Remind 업무 보기"
            padding={18}
            sx={{
              ...(view === 'remind'
                ? { borderColor: (t) => t.palette.accent.amber, bgcolor: (t) => alpha(t.palette.accent.amber, 0.12) }
                : {}),
              '&:hover': { borderColor: (t) => t.palette.accent.amber, bgcolor: (t) => alpha(t.palette.accent.amber, view === 'remind' ? 0.18 : 0.08) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%', minHeight: 116 }}>
              <SquareChip label="Remind" tone="amber" />
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, ml: '36px' }}>
                <Typography component="span" sx={{ fontSize: 60, fontWeight: 800, lineHeight: 1 }}>{counts.remind}</Typography>
                <Typography component="span" sx={{ fontSize: 20, fontWeight: 600, color: 'text.secondary' }}>건</Typography>
              </Box>
            </Box>
          </AppCard>

          {/* 완료 — 정사각 회색 칩 + 완료/전체 건수(좌 묶음). 선택색 gray */}
          <AppCard
            interactive
            onClick={() => selectView('done')}
            ariaLabel="완료 업무 보기"
            padding={18}
            sx={{
              ...(view === 'done'
                ? { borderColor: (t) => t.palette.text.secondary, bgcolor: (t) => alpha(t.palette.text.secondary, 0.1) }
                : {}),
              '&:hover': { borderColor: (t) => t.palette.text.secondary, bgcolor: (t) => alpha(t.palette.text.secondary, view === 'done' ? 0.16 : 0.07) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%', minHeight: 116 }}>
              <SquareChip label="완료" tone="gray" />
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, ml: '16px' }}>
                <Typography component="span" sx={{ fontSize: 48, fontWeight: 800, lineHeight: 1 }}>{counts.done}</Typography>
                <Typography component="span" sx={{ fontSize: 26, fontWeight: 700, color: 'text.disabled' }}>/{counts.total}</Typography>
                <Typography component="span" sx={{ fontSize: 18, fontWeight: 600, color: 'text.secondary' }}>건</Typography>
              </Box>
            </Box>
          </AppCard>
        </Box>
      </ContentSection>

      {/* ② 업무 목록 — 선택된 KPI(진행중/Remind/완료)에 따라 표시 */}
      <ContentSection title={view === 'inProgress' ? undefined : '업무 목록'} count={view === 'inProgress' ? undefined : `${listed.length}`} last={!SHOW_MANAGER_STATUS}>
        {/* 진행중 뷰는 회의용으로 깔끔하게 — 구분 필터·검색·담당자 필터 숨김 */}
        {view !== 'inProgress' && (
          <>
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
          </>
        )}

        {listed.length === 0 && view !== 'inProgress' ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
        ) : view === 'remind' ? (
          // Remind — 압정 카드 그리드 (앰버 톤, 선택 시 테두리)
          <CardGrid minColWidth={260}>
            {listed.map((t) => (
              <TaskCard key={t.id} t={t} onPick={setPicked} selected={selectedTask === t.id} onSelect={() => setSelectedTask(t.id)} />
            ))}
            {isAdmin && <AddCard onClick={startCompose} />}
          </CardGrid>
        ) : view === 'inProgress' ? (
          // 진행중 — 최상단 행: [업무 목록 제목] [+ 새 업무 카드]. 새 업무 클릭 시 인라인 편집 카드(전폭).
          <CardGrid columns={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 64 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>업무 목록</Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled' }}>{listed.length}</Typography>
            </Box>
            {isAdmin && !composing
              ? <AddCard key="add" height={64} onClick={startCompose} />
              : <Box key="add-spacer" />}
            {isAdmin && composing && (
              <Box key="composer" sx={{ gridColumn: '1 / -1' }}>
                <NewTaskCard saving={savingNew} options={fieldOptions} onCancel={() => setComposing(false)} onSave={handleSaveNew} onDirtyChange={setComposeDirty} />
              </Box>
            )}
            {listed.map((t) => renderTask(t, 'green'))}
          </CardGrid>
        ) : (
          // 완료(회색) — 2열 그리드. 새 업무 카드 없음, 카드의 완료 버튼도 없음(이미 완료).
          <CardGrid columns={2}>
            {listed.map((t) => renderTask(t, 'gray'))}
          </CardGrid>
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
        onClose={() => setPicked(null)}
        isAdmin={isAdmin}
        onEdit={(t) => setEditTarget(t)}
        onDelete={(t) => setDeleteTarget(t)}
      />

      {isAdmin && (
        <WorkWrite
          open={writeOpen || !!editTarget}
          editing={editTarget}
          onClose={() => { setWriteOpen(false); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* 삭제 확인 Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>정말 삭제하시겠습니까?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{deleteTarget ? taskTitle(deleteTarget) : ''}」 업무를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
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

      {/* 결과 Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
