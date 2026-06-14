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
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import RefreshIcon from '@mui/icons-material/Refresh'
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
  RatioBar,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { deleteSchedule } from '@/api/sheets'
import { useRole } from '@/auth/role'
import type { ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip, todayHalfIndex, type StageCode } from './stageMeta'
import { GanttHeader, GanttBar } from './gantt'
import EqProjectDrawer from './EqProjectDrawer'
import ScheduleWrite from './ScheduleWrite'

function ProgressBar({ value }: { value: number }) {
  return (
    <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'background.elevated', overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${Math.round(value * 100)}%`, bgcolor: 'primary.main' }} />
    </Box>
  )
}

const GANTT_NAME_W = 168
type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

export default function Equipment() {
  const dispatch = useAppDispatch()
  const { schedule, months, loading, error, updatedAt } = useAppSelector((s) => s.eq)
  const { isAdmin, user, authKey } = useRole()
  const [searchParams, setSearchParams] = useSearchParams()
  const [fltType, setFltType] = useState('전체')
  const [fltMgr, setFltMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ScheduleItem | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ScheduleItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const todayHalf = useMemo(() => todayHalfIndex(months), [months])

  // 통합검색 딥링크(/equipment?focus=<장비명|관리번호>) → 해당 도입 상세 Drawer 자동 오픈
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus || !schedule.length) return
    const it = schedule.find((x) => x.name === focus || x.code === focus)
    if (it) setPicked(it)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, schedule])

  // 각 행 + 단계 정보
  const enriched = useMemo(
    () => schedule.map((it) => ({ it, info: groupStage(it.timeline, months, todayHalf) })),
    [schedule, months, todayHalf],
  )

  // 도입 개요(보조) + 단계 파이프라인
  const overview = useMemo(() => {
    let progress = 0, done = 0, upcoming = 0
    const tally = Object.fromEntries(STAGE_ORDER.map((c) => [c, 0])) as Record<StageCode, number>
    enriched.forEach(({ info }) => {
      if (info.phase === 'done') { done++; if (info.code) tally[info.code]++ }
      else if (info.phase === 'progress') { progress++; if (info.code) tally[info.code]++ }
      else if (info.phase === 'upcoming') upcoming++
    })
    return { total: enriched.length, progress, done, upcoming, tally }
  }, [enriched])

  // 필터 (구분·담당자·검색)
  const presentTypes = useMemo(() => ['전체', ...[...new Set(schedule.map((s) => s.cat).filter(Boolean))]], [schedule])
  const presentMgrs = useMemo(() => ['전체', ...[...new Set(schedule.map((s) => s.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [schedule])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return enriched
      .filter(({ it }) => fltType === '전체' || it.cat === fltType)
      .filter(({ it }) => fltMgr === '전체' || (it.mgr || '') === fltMgr)
      .filter(({ it }) => !q || `${it.name} ${it.code} ${it.mgr} ${it.cat} ${it.method}`.toLowerCase().includes(q))
  }, [enriched, fltType, fltMgr, query])

  // ── CRUD ──
  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaved = async (code: string, isEdit: boolean) => {
    setWriteOpen(false)
    setEditTarget(null)
    showSnack(isEdit ? '장비 도입 정보를 수정했습니다.' : '장비를 추가했습니다.', 'success')
    const payload = await dispatch(loadEqData()).unwrap().catch(() => null)
    if (isEdit && code && payload && Array.isArray(payload.schedule)) {
      setPicked(payload.schedule.find((x) => x.code === code) ?? null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (!deleteTarget.code) return showSnack('관리번호가 없어 삭제할 수 없습니다.', 'error')
    setDeleting(true)
    try {
      await deleteSchedule({ code: deleteTarget.code, author: user, key: authKey })
      setDeleting(false)
      setDeleteTarget(null)
      setPicked(null)
      showSnack('장비를 삭제했습니다.', 'success')
      dispatch(loadEqData())
    } catch (err) {
      setDeleting(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
    }
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<LocalShippingIcon />}
        title="장비도입관리"
        subtitle="장비 도입 프로젝트 진행 — 단계·타임라인"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setWriteOpen(true) }}>
                장비 추가
              </Button>
            )}
            <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      {/* ① 도입 개요 (보조 KPI) */}
      <ContentSection>
        <CardGrid columns={4}>
          <StatTile value={overview.total} unit="건" label="전체 도입장비" status="info" />
          <StatTile value={overview.progress} unit="건" label="진행중" status="warning" />
          <StatTile value={overview.done} unit="건" label="설치완료" status="success" />
          <StatTile value={overview.upcoming} unit="건" label="착수 전" status="neutral" />
        </CardGrid>
      </ContentSection>

      {/* ② 단계 파이프라인 */}
      <ContentSection title="단계 파이프라인" description="구매 절차 단계별 현재 장비 수">
        <AppCard padding={18}>
          <RatioBar
            segments={STAGE_ORDER.map((c) => ({ label: STAGE[c].label, value: overview.tally[c], status: STAGE[c].status }))}
          />
        </AppCard>
      </ContentSection>

      {/* ③ 도입 진행 현황 (메인) */}
      <ContentSection title="도입 진행 현황" count={`${filtered.length}건`}>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="장비명·관리번호·담당자 검색" />}>
          {presentTypes.map((t) => (
            <StatusChip key={t} status="neutral" label={t} selected={fltType === t} onClick={() => setFltType(t)} />
          ))}
        </FilterBar>
        {presentMgrs.length > 1 && (
          <FilterBar>
            {presentMgrs.map((m) => (
              <StatusChip key={m} status="info" label={m} selected={fltMgr === m} onClick={() => setFltMgr(m)} />
            ))}
          </FilterBar>
        )}

        {filtered.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="조건에 맞는 장비가 없습니다" /></AppCard>
        ) : (
          <CardGrid minColWidth={280}>
            {filtered.map(({ it, info }, idx) => {
              const chip = phaseChip(info)
              return (
                <AppCard key={it.code || idx} interactive onClick={() => setPicked(it)} padding={16}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <StatusChip status={chip.status} label={chip.label} />
                      {it.cat && <StatusChip status="neutral" label={it.cat} />}
                    </Box>
                    <Typography variant="subtitle1" sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {it.name || it.code || '(이름 없음)'}
                    </Typography>
                    <ProgressBar value={info.progress} />
                    <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{it.mgr || '담당 미지정'}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{info.dueMonth ? `도입 ${info.dueMonth}` : ''}</Typography>
                    </Box>
                  </Box>
                </AppCard>
              )
            })}
          </CardGrid>
        )}
      </ContentSection>

      {/* ④ 도입 타임라인 (간트) */}
      <ContentSection title="도입 타임라인" description="구매 절차 단계 간트 (가로 스크롤)" last>
        <AppCard padding={12}>
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: GANTT_NAME_W + Math.max(months.length, 8) * 38 }}>
              {/* 헤더 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: GANTT_NAME_W, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <GanttHeader months={months} />
                </Box>
              </Box>
              {/* 행 */}
              {filtered.length === 0 ? (
                <EmptyState size="sm" title="조건에 맞는 장비가 없습니다" />
              ) : (
                filtered.map(({ it, info }, idx) => {
                  const chip = phaseChip(info)
                  return (
                    <Box
                      key={it.code || idx}
                      role="button"
                      tabIndex={0}
                      aria-label={`도입 프로젝트: ${it.name || it.code}`}
                      onClick={() => setPicked(it)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(it) } }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.elevated' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
                    >
                      <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, minWidth: 0, pr: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || it.code}</Typography>
                        <StatusChip status={chip.status} label={chip.label} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <GanttBar tl={it.timeline} months={months} />
                      </Box>
                    </Box>
                  )
                })
              )}
            </Box>
          </Box>
        </AppCard>
      </ContentSection>

      <EqProjectDrawer
        item={picked}
        months={months}
        todayHalf={todayHalf}
        onClose={() => setPicked(null)}
        isAdmin={isAdmin}
        onEdit={(it) => setEditTarget(it)}
        onDelete={(it) => setDeleteTarget(it)}
      />

      {isAdmin && (
        <ScheduleWrite
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
            「{deleteTarget?.name || deleteTarget?.code}」 도입 항목을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
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
