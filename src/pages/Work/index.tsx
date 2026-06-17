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
import { deleteWork } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { classify, taskTitle } from './workMeta'
import TaskCard from './TaskCard'
import TaskAccordion from './TaskAccordion'
import TaskDetailDrawer from './TaskDetailDrawer'
import WorkWrite from './WorkWrite'

// 상단 KPI 단일 선택 뷰 (진행중/Remind/완료 중 하나만 선택)
type KpiView = 'inProgress' | 'remind' | 'done'
// STEP24 — 담당자 현황 섹션 임시 숨김(구조 보존, 추후 재노출 시 true)
const SHOW_MANAGER_STATUS = false

// 발의일자 최신순 (최근 업무가 위)
const cmp = (a: WorkItem, b: WorkItem) => dateSortValue(b.start) - dateSortValue(a.start)

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

// 목록 끝 'Add 카드' — 미선택 카드 톤(점선) + 호버 시 채움 미리보기. 누르면 새 업무 작성.
function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="새 업무 등록"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={(th) => ({
        minHeight: 120,
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
    setView(v)
    setMgr('전체')
    setSelectedTask(null)
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

  // 보관 — 동작 미정(준비 중). 버튼/알림만 우선 제공.
  const handleArchive = (item: WorkItem) => {
    showSnack(`'${taskTitle(item)}' 보관 — 동작은 곧 추가됩니다`, 'info')
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
        ) : view === 'remind' ? (
          // Remind — 압정 카드 그리드 (앰버 톤, 선택 시 테두리)
          <CardGrid minColWidth={260}>
            {listed.map((t) => (
              <TaskCard key={t.id} t={t} onPick={setPicked} selected={selectedTask === t.id} onSelect={() => setSelectedTask(t.id)} />
            ))}
            {isAdmin && <AddCard onClick={() => { setEditTarget(null); setWriteOpen(true) }} />}
          </CardGrid>
        ) : (
          // 진행중(초록)·완료(회색) — 2열 그리드. 채움=항상, 테두리=선택 카드만. 좁아지면 1열.
          <CardGrid columns={2}>
            {listed.map((t) => (
              <TaskAccordion
                key={t.id}
                t={t}
                tone={view === 'done' ? 'gray' : 'green'}
                selected={selectedTask === t.id}
                onSelect={() => setSelectedTask(t.id)}
                isAdmin={isAdmin}
                onEdit={(it) => setEditTarget(it)}
                onArchive={handleArchive}
              />
            ))}
            {isAdmin && <AddCard onClick={() => { setEditTarget(null); setWriteOpen(true) }} />}
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
