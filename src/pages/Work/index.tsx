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
import AssessmentIcon from '@mui/icons-material/Assessment'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddIcon from '@mui/icons-material/Add'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  CardGrid,
  FilterBar,
  SearchBar,
  StatusChip,
  StatTile,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadWorkData } from '@/store/slices/workSlice'
import { deleteWork } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue, fmtDate } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskLink, taskTitle, type WStatus } from './workMeta'
import TaskCard from './TaskCard'
import TaskAccordion from './TaskAccordion'
import TaskDetailDrawer from './TaskDetailDrawer'
import WorkWrite from './WorkWrite'

type StatusTab = 'all' | WStatus
// STEP24 — 담당자 현황 섹션 임시 숨김(구조 보존, 추후 재노출 시 true)
const SHOW_MANAGER_STATUS = false

// 발의일자 최신순 (최근 업무가 위)
const cmp = (a: WorkItem, b: WorkItem) => dateSortValue(b.start) - dateSortValue(a.start)

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector((s) => s.work)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<StatusTab>('inProgress') // STEP24 — 회의 뷰: 기본 진행중
  const [chiefOnly, setChiefOnly] = useState(false)
  const [remindOpen, setRemindOpen] = useState(false) // STEP25 — Remind 토글(KPI Remind 타일 클릭 시 KPI 아래 펼침)
  const [cat, setCat] = useState('전체')
  const [mgr, setMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<WorkItem | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WorkItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

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
  // Remind 업무 = Remind 체크 (상태와 별개) — 최근 발의순
  const urgent = useMemo(
    () => items.filter((t) => t.remind).sort((a, b) => dateSortValue(b.start) - dateSortValue(a.start)),
    [items],
  )

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

  const pool = useMemo(() => {
    let p = tab === 'all' ? items : items.filter((t) => classify(t) === tab)
    if (chiefOnly) p = p.filter((t) => t.chief)
    return p
  }, [items, tab, chiefOnly])

  const presentMgrs = useMemo(() => ['전체', ...[...new Set(pool.map((t) => t.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [pool])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pool
      .filter((t) => cat === '전체' || normCat(t.cat) === normCat(cat))
      .filter((t) => mgr === '전체' || (t.mgr || '') === mgr)
      .filter((t) => !q || `${t.task} ${t.mgr} ${t.dept} ${t.cat} ${t.loc}`.toLowerCase().includes(q))
      .sort(cmp)
  }, [pool, cat, mgr, query])

  const pickStatus = (k: StatusTab) => {
    setTab((prev) => (prev === k ? 'all' : k))
    setMgr('전체')
  }

  // ── CRUD ──
  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaved = async (num: number, isEdit: boolean) => {
    setWriteOpen(false)
    setEditTarget(null)
    showSnack(isEdit ? '업무를 수정했습니다.' : '업무를 등록했습니다.', 'success')
    const list = await dispatch(loadWorkData()).unwrap().catch(() => null)
    if (isEdit && num && Array.isArray(list)) {
      setPicked(list.find((t) => String(t.num) === String(num)) ?? null)
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

  // 그 외 상태 탭 — 컴팩트 행 1줄
  const compactRow = (t: WorkItem) => {
    const st = W_STATUS[classify(t)]
    const link = taskLink(t)
    return (
      <Box
        key={t.id}
        role="button"
        tabIndex={0}
        aria-label={`업무: ${taskTitle(t)}`}
        onClick={() => setPicked(t)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setPicked(t)
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          borderBottom: 1,
          borderColor: 'divider',
          '&:last-of-type': { borderBottom: 0 },
          '&:hover': { bgcolor: 'background.elevated' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <StatusChip status={st.status} label={st.label} />
        {t.cat && <StatusChip status="neutral" label={t.cat} />}
        {t.chief && <StatusChip status="purple" label="Check" />}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 140, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {taskTitle(t)}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.mgr || '미지정'}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(t.start)}</Typography>
        {link && (
          <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="링크 열기" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
            <OpenInNewIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
      </Box>
    )
  }

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

      {/* ① KPI — 상태별 건수(클릭 시 해당 상태로 필터) */}
      <ContentSection>
        <CardGrid columns={5}>
          <StatTile value={counts.inProgress} unit="건" label="진행중" status="success" selected={tab === 'inProgress'} onClick={() => pickStatus('inProgress')} />
          <StatTile value={counts.done} unit="건" label="완료" status="neutral" selected={tab === 'done'} onClick={() => pickStatus('done')} />
          <StatTile value={counts.total} unit="건" label="전체" status="info" selected={tab === 'all'} onClick={() => pickStatus('all')} />
          <StatTile value={counts.chief} unit="건" label="Check" status="purple" selected={chiefOnly} onClick={() => setChiefOnly((v) => !v)} />
          <StatTile value={counts.remind} unit="건" label="Remind" status="warning" selected={remindOpen} onClick={() => setRemindOpen((v) => !v)} />
        </CardGrid>
      </ContentSection>

      {/* ①-b Remind — KPI 'Remind' 타일 클릭 시 KPI 바로 아래(업무목록 사이)에 펼침/접힘 */}
      {remindOpen && (
        <ContentSection title="Remind" description="Remind 체크 업무" count={urgent.length}>
          {urgent.length === 0 ? (
            <AppCard padding={0}><EmptyState size="sm" title="Remind된 업무가 없습니다" /></AppCard>
          ) : (
            <CardGrid minColWidth={260}>
              {urgent.map((t) => (
                <TaskCard key={t.id} t={t} onPick={setPicked} />
              ))}
            </CardGrid>
          )}
        </ContentSection>
      )}

      {/* ② 업무 목록 — KPI(또는 Remind 펼침) 바로 아래. 기본 진행중, 진행중은 아코디언(모두 펼침) */}
      <ContentSection title="업무 목록" count={listed.length} last={!SHOW_MANAGER_STATUS}>
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

        {listed.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 업무가 없습니다" /></AppCard>
        ) : (chiefOnly || tab === 'inProgress' || tab === 'done') ? (
          // 진행중·완료·Check — 2열 아코디언 그리드(진행중=기본 펼침, 완료/Check=접힘). 좁아지면 1열.
          <CardGrid columns={2}>
            {listed.map((t) => (
              <TaskAccordion key={t.id} t={t} onPick={setPicked} defaultExpanded={tab === 'inProgress'} />
            ))}
          </CardGrid>
        ) : (
          // 전체 — 컴팩트 행 목록
          <AppCard padding={0}>
            <Box>{listed.map(compactRow)}</Box>
          </AppCard>
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
