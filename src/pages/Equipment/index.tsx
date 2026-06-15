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
import { loadEqData, shiftScheduleStart, resizeScheduleStage } from '@/store/slices/eqSlice'
import { deleteSchedule, updateSchedule } from '@/api/sheets'
import { useRole } from '@/auth/role'
import type { ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip, todayHalfIndex, type StageCode } from './stageMeta'
import { GanttHeader, GanttBar } from './gantt'
import { calcHalfDelta, itemTimelineForMonths, shiftStart, fmtStartMonth, MONTH_WIDTH, HALF_MONTH_WIDTH } from './timeline'
import DragTip from './DragTip'
import type { DragTipData } from './DragTip'
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
// STEP18B: 드래그 종료 후 확인 모달용 변경 기술자 (적용 전까지 Redux/시트 미반영)
type PendingChange = {
  kind: 'move' | 'resize'
  code: string
  stage?: string
  deltaHalves: number
  title: string
  stageName?: string
  before: string
  after: string
  delta: string
}

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

  // 간트 가로 스크롤 컨테이너 — 마우스 휠을 가로 스크롤로 변환(마우스 사용자도 좌우 이동 가능)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── STEP15: 타임라인 전체 이동 (드래그) ── 단계 길이는 불변, start만 반월 단위로 이동
  const dragRef = useRef<{ code: string; startX: number; halfPx: number } | null>(null)
  const lastDeltaRef = useRef(0)
  const draggedRef = useRef(false)
  const [preview, setPreview] = useState<{ code: string; px: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [tip, setTip] = useState<DragTipData | null>(null) // STEP18A: 드래그 프리뷰 툴팁(표시 전용)
  const [pending, setPending] = useState<PendingChange | null>(null) // STEP18B: 드래그 후 확인 모달
  const [applying, setApplying] = useState(false)

  const startDrag = (e: ReactMouseEvent, code: string) => {
    if (!isAdmin || !code || pending) return // 모달 열려 있으면 추가 드래그 금지
    const halfPx = HALF_MONTH_WIDTH // 고정 반월 너비 — 헤더/바/리사이즈와 동일 기준
    dragRef.current = { code, startX: e.clientX, halfPx }
    lastDeltaRef.current = 0
    draggedRef.current = false
    setPreview({ code, px: 0 })
    setDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const px = e.clientX - d.startX
      if (Math.abs(px) > 3) draggedRef.current = true // 3px 이상 움직이면 클릭(상세 열기) 억제
      const dh = calcHalfDelta(px, d.halfPx)
      lastDeltaRef.current = dh
      setPreview({ code: d.code, px: dh * d.halfPx }) // 반월 스냅된 위치로만 미리보기
      const it = schedule.find(s => s.code === d.code)
      if (it) {
        setTip({
          x: e.clientX,
          y: e.clientY,
          lines: [`${dh > 0 ? '+' : ''}${dh / 2}개월`, `${fmtStartMonth(it.start)} → ${fmtStartMonth(shiftStart(it.start, dh))}`],
        })
      }
    }
    const onUp = () => {
      const d = dragRef.current
      const dh = lastDeltaRef.current
      dragRef.current = null
      lastDeltaRef.current = 0
      setDragging(false)
      setTip(null)
      const it = d ? schedule.find(s => s.code === d.code) : undefined
      if (d && dh && it) {
        // 프리뷰(translateX)는 유지한 채 확인 모달 — 적용 전까지 Redux/시트 미변경
        setPending({
          kind: 'move', code: d.code, deltaHalves: dh,
          title: '일정을 이동하시겠습니까?',
          before: fmtStartMonth(it.start), after: fmtStartMonth(shiftStart(it.start, dh)),
          delta: `${dh > 0 ? '+' : ''}${dh / 2}개월`,
        })
      } else {
        setPreview(null) // 변경 없음 → 프리뷰 정리
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, dispatch, schedule])

  // 마우스 휠 → 가로 스크롤 (가로 overflow가 있을 때만; 없으면 페이지 세로 스크롤 그대로)
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
  }, [])

  // ── STEP16: 단계 길이 리사이즈 (오른쪽 핸들) ── stages만 변경, buildTimelines로 재파생
  const resizeRef = useRef<{ code: string; stage: string; startX: number; halfPx: number; baseHalves: number } | null>(null)
  const lastResizeHalvesRef = useRef(0)
  const [resizing, setResizing] = useState(false)
  const [resizePrev, setResizePrev] = useState<{ code: string; tl: string[] } | null>(null)

  const startResize = (e: ReactMouseEvent, code: string, stageCode: string) => {
    if (!isAdmin || !code || pending) return // 모달 열려 있으면 추가 드래그 금지
    const label = STAGE[stageCode as StageCode]?.label
    if (!label) return
    const halfPx = HALF_MONTH_WIDTH // 고정 반월 너비 — 이동/헤더/바와 동일 기준
    const it = schedule.find(s => s.code === code)
    const baseHalves = Math.max(1, Math.round(Number(it?.stages?.[label] || 0) * 2))
    resizeRef.current = { code, stage: label, startX: e.clientX, halfPx, baseHalves }
    lastResizeHalvesRef.current = baseHalves
    draggedRef.current = false
    setResizePrev({ code, tl: it ? itemTimelineForMonths(it.start, it.stages, months) : [] })
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
      const nextHalves = Math.max(1, d.baseHalves + calcHalfDelta(px, d.halfPx)) // 최소 0.5개월
      lastResizeHalvesRef.current = nextHalves
      const it = schedule.find(s => s.code === d.code)
      if (it) {
        const stagesPrev = { ...it.stages, [d.stage]: String(nextHalves / 2) }
        setResizePrev({ code: d.code, tl: itemTimelineForMonths(it.start, stagesPrev, months) })
      }
      const deltaH = nextHalves - d.baseHalves
      setTip({
        x: e.clientX,
        y: e.clientY,
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
        // 프리뷰(tl 오버라이드) 유지한 채 확인 모달 — 적용 전까지 Redux/시트 미변경
        const deltaH = nextHalves - d.baseHalves
        setPending({
          kind: 'resize', code: d.code, stage: d.stage, deltaHalves: deltaH,
          title: '기간을 변경하시겠습니까?', stageName: d.stage,
          before: `${d.baseHalves / 2}개월`, after: `${nextHalves / 2}개월`,
          delta: `${deltaH > 0 ? '+' : ''}${deltaH / 2}개월`,
        })
      } else {
        setResizePrev(null) // 변경 없음 → 프리뷰 정리
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, dispatch, schedule, months])

  // STEP18B 적용 — 기존 reducer로 낙관적 반영 + 기존 updateSchedule 저장 + 재fetch (새 저장 로직 없음)
  const applyPending = async () => {
    if (!pending || applying) return
    if (!user || !authKey) { showSnack('관리자 로그인이 필요합니다.', 'error'); return }
    const p = pending
    const it = schedule.find(s => s.code === p.code)
    if (!it) { setPending(null); setPreview(null); setResizePrev(null); return }
    setApplying(true)
    let newStart = it.start
    let newStages = it.stages
    if (p.kind === 'move') {
      newStart = shiftStart(it.start, p.deltaHalves)
      dispatch(shiftScheduleStart({ code: p.code, deltaHalves: p.deltaHalves }))
    } else if (p.stage) {
      const base = Math.max(1, Math.round(Number(it.stages?.[p.stage] || 0) * 2))
      const next = Math.max(1, base + p.deltaHalves)
      newStages = { ...it.stages, [p.stage]: String(next / 2) }
      dispatch(resizeScheduleStage({ code: p.code, stage: p.stage, deltaHalves: p.deltaHalves }))
    }
    setPreview(null)
    setResizePrev(null)
    try {
      await updateSchedule({
        origCode: it.code, code: it.code, author: user, key: authKey,
        name: it.name, mgr: it.mgr, status: it.status, start: newStart,
        stages: newStages, cat: it.cat, method: it.method, price: it.price,
      })
      setApplying(false)
      setPending(null)
      showSnack(p.kind === 'move' ? '일정을 이동·저장했습니다.' : '기간을 변경·저장했습니다.', 'success')
      dispatch(loadEqData())
    } catch (err) {
      setApplying(false)
      setPending(null)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
      dispatch(loadEqData()) // 저장 실패 → 시트 기준으로 재동기화(낙관적 변경 되돌림)
    }
  }

  // 취소 — 프리뷰만 폐기(드래그 이전 상태로 즉시 복원, Redux/시트 무변경)
  const cancelPending = () => {
    if (applying) return
    setPending(null)
    setPreview(null)
    setResizePrev(null)
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
      <ContentSection title="도입 타임라인" description={isAdmin ? '구매 절차 단계 간트 — 막대 드래그로 전체 이동, 단계 끝 핸들로 기간 조절 (드래그 후 확인 시 저장 · 가로 스크롤)' : '구매 절차 단계 간트 (가로 스크롤)'} last>
        <AppCard padding={12}>
          <Box ref={scrollRef} sx={{ overflowX: 'auto' }}>
            <Box sx={{ minWidth: GANTT_NAME_W + Math.max(months.length, 8) * MONTH_WIDTH }}>
              {/* 헤더 */}
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 0.5 }}>
                <Box sx={{ width: GANTT_NAME_W, flexShrink: 0 }} />
                <Box sx={{ width: months.length * MONTH_WIDTH, flexShrink: 0 }}>
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
                      onClick={() => { if (draggedRef.current) { draggedRef.current = false; return } setPicked(it) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(it) } }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.elevated' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
                    >
                      <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, minWidth: 0, pr: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name || it.code}</Typography>
                        <StatusChip status={chip.status} label={chip.label} />
                      </Box>
                      <Box
                        sx={{ width: months.length * MONTH_WIDTH, flexShrink: 0, cursor: isAdmin ? 'grab' : undefined, userSelect: 'none' }}
                        onMouseDown={isAdmin ? (e) => startDrag(e, it.code) : undefined}
                      >
                        <GanttBar
                          tl={resizePrev?.code === it.code ? resizePrev.tl : it.timeline}
                          months={months}
                          previewPx={preview?.code === it.code ? preview.px : 0}
                          onResizeStart={isAdmin ? (e, stageCode) => startResize(e, it.code, stageCode) : undefined}
                        />
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

      {/* STEP18B: 드래그 변경 확인 모달 — 적용 시 저장, 취소 시 원복 */}
      <Dialog open={!!pending} onClose={cancelPending} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>{pending?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
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

      {/* STEP18A: 드래그 중 실시간 프리뷰 툴팁 (표시 전용) */}
      <DragTip tip={tip} />
    </PageContainer>
  )
}
