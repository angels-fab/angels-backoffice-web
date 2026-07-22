import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha } from '@mui/material/styles'
import FlagIcon from '@mui/icons-material/Flag'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import PendingActionsIcon from '@mui/icons-material/PendingActions'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import {
  AppCard, CardGrid, ContentSection, EmptyState, ErrorBanner, KpiCard, ListRow,
  LoadingState, PageContainer, PageHeader, RatioBar, SearchBar, SegTabs, Select, StatusChip,
  dataTableHeadSx, dataTableSx, useSnack, type RatioSegment,
} from '@/components/ds'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadMilestones, patchMilestone } from '@/store/slices/milestoneSlice'
import { updateMilestone, type MilestoneRow, type MilestoneStatus } from '@/api/milestones'
import { iconSize, layout, radius, shellMq, typescale } from '@/theme/tokens'
import {
  CATEGORIES, STATUS_KIND, TOTAL_QUARTERS, categoryShort, currentQIndex, deriveStatus,
  isImminent, qAt, qFull, qShort, type DerivedStatus,
} from './model'
import JourneyTimeline from './JourneyTimeline'
import GanttBoard from './GanttBoard'
import DetailDrawer from './DetailDrawer'

/**
 * 마일스톤 — 팹센터 구축~개소(2026.3Q~2029) 실행계획 62건의 살아있는 현황판.
 * v2(UX 진단 반영): 페이지를 [관제판 | 전체 업무] 탭으로 분할해 "누르는 곳과 결과가
 * 다른 화면" 문제를 해소 — 관제판의 모든 클릭(KPI·분기·분야 카드)은 전체 업무 탭
 * 전환+필터로 응답한다. 착수 전 국면에서는 '착수 대기'가 화면의 주인공.
 * 상태 4종만 저장하고 임박·지연은 자동 파생(model.tsx). 정본 = Supabase milestones.
 */

const STATUS_FILTERS: Array<'전체' | DerivedStatus> = ['전체', '예정', '진행중', '완료', '보류', '지연']

const fmtStamp = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
}

/** KPI 0값은 흐리게 — 착수 전 국면에서 살아있는 숫자(앰버)만 도드라지게 */
const dimZero = (n: number) =>
  n > 0 ? n : <Box component="span" sx={{ color: 'text.disabled' }}>0</Box>

export default function Milestone() {
  const dispatch = useAppDispatch()
  const { items, ready, loading, error } = useAppSelector((s) => s.milestone)
  const { isAdmin, user } = useRole()
  const snack = useSnack()
  const isMobile = useMediaQuery(shellMq, { noSsr: true })

  const curIdx = currentQIndex()
  const curQ = qAt(curIdx)

  const [pageTab, setPageTab] = useState<'dash' | 'list'>('dash')
  const [view, setView] = useState<'table' | 'gantt'>('table')
  const [statusFilter, setStatusFilter] = useState<'전체' | DerivedStatus>('전체')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [qFilter, setQFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  // 그룹 표 펼침 — 필터·검색이 걸리면 전체 강제 펼침(결과가 접힘에 가려지는 것 방지)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [CATEGORIES[0].full]: true })
  const focusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ready && !loading) void dispatch(loadMilestones())
  }, [ready, loading, dispatch])

  const openRow = useMemo(() => items.find((r) => r.id === openId) || null, [items, openId])

  // ── 파생 집계 ── ('YYYYQN' 포맷은 사전순 비교 = 시간순 비교)
  const stats = useMemo(() => {
    const done = items.filter((r) => r.status === '완료').length
    const inProgress = items.filter((r) => r.status === '진행중').length
    const delayed = items.filter((r) => deriveStatus(r, curIdx) === '지연').length
    const waiting = items.filter((r) => r.status === '예정' && r.startQ <= curQ).length
    return { done, inProgress, delayed, waiting }
  }, [items, curIdx, curQ])

  const focusStart = useMemo(
    () => items.filter((r) => r.status === '예정' && r.startQ <= curQ),
    [items, curQ],
  )
  const focusDue = useMemo(
    () => items.filter((r) => r.endQ === curQ && r.status !== '완료'),
    [items, curQ],
  )
  const doneThisQ = useMemo(
    () => items.filter((r) => r.status === '완료' && r.endQ === curQ).length,
    [items, curQ],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((r) => {
      if (statusFilter !== '전체' && deriveStatus(r, curIdx) !== statusFilter) return false
      if (catFilter && r.category !== catFilter) return false
      if (qFilter && r.endQ !== qFilter) return false
      if (q && !`${r.title} ${r.content} ${r.deliverable} ${r.owner}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [items, statusFilter, catFilter, qFilter, search, curIdx])

  const filterActive = statusFilter !== '전체' || !!catFilter || !!qFilter || !!search.trim()

  const latestUpdate = useMemo(() => {
    const withBy = items.filter((r) => r.updatedBy)
    if (withBy.length === 0) return null
    return withBy.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
  }, [items])

  // ── 탭 전환 동선 — 관제판 클릭은 전체 업무 탭 + 필터로 응답(인과 가시화) ──
  const goList = (patch?: { status?: '전체' | DerivedStatus; cat?: string | null; q?: string | null }) => {
    if (patch) {
      if (patch.status !== undefined) setStatusFilter(patch.status)
      if (patch.cat !== undefined) setCatFilter(patch.cat)
      if (patch.q !== undefined) setQFilter(patch.q)
    }
    setPageTab('list')
    window.scrollTo({ top: 0 })
  }
  const goFocus = () => {
    setPageTab('dash')
    setTimeout(() => focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }

  // ── 상태·담당자 갱신(낙관적 + 실패 롤백) ──
  const changeStatus = async (row: MilestoneRow, status: MilestoneStatus) => {
    if (!isAdmin) return
    const by = user || ''
    const prev = { status: row.status, completedAt: row.completedAt, updatedBy: row.updatedBy, updatedAt: row.updatedAt }
    dispatch(patchMilestone({ id: row.id, status, updatedBy: by, updatedAt: new Date().toISOString() }))
    try {
      const { completedAt } = await updateMilestone({ id: row.id, status, updatedBy: by })
      dispatch(patchMilestone({ id: row.id, completedAt }))
      snack(`'${row.title}' → ${status}`)
    } catch (e) {
      dispatch(patchMilestone({ id: row.id, ...prev }))
      snack(e instanceof Error ? e.message : '변경에 실패했습니다', 'error')
    }
  }

  const saveOwner = async (row: MilestoneRow, owner: string) => {
    if (!isAdmin) return
    const by = user || ''
    const prev = { owner: row.owner, updatedBy: row.updatedBy, updatedAt: row.updatedAt }
    dispatch(patchMilestone({ id: row.id, owner, updatedBy: by, updatedAt: new Date().toISOString() }))
    try {
      await updateMilestone({ id: row.id, owner, updatedBy: by })
      snack(`담당자 저장: ${owner || '미지정'}`)
    } catch (e) {
      dispatch(patchMilestone({ id: row.id, ...prev }))
      snack(e instanceof Error ? e.message : '저장에 실패했습니다', 'error')
    }
  }

  if (!ready) {
    return (
      <PageContainer>
        <PageHeader icon={<FlagIcon />} title="마일스톤" subtitle="팹센터 구축 → 개소 · 2026.3Q ~ 2029" />
        <LoadingState />
      </PageContainer>
    )
  }

  const focusRow = (r: MilestoneRow, action: '착수' | '완료') => (
    <ListRow
      key={r.id}
      dense
      divider
      onClick={() => setOpenId(r.id)}
      leading={
        <Box
          sx={{
            width: 8, height: 8, borderRadius: `${radius.pill}px`, flexShrink: 0,
            bgcolor: (t) => (action === '완료' ? t.palette.accent.amber : alpha(t.palette.text.secondary, 0.5)),
          }}
        />
      }
      title={r.title}
      subtitle={categoryShort(r.category)}
      trailing={
        isAdmin ? (
          <Button
            size="small"
            variant="outlined"
            startIcon={action === '착수' ? <PlayArrowIcon /> : <CheckIcon />}
            onClick={(e) => {
              e.stopPropagation()
              void changeStatus(r, action === '착수' ? '진행중' : '완료')
            }}
          >
            {action}
          </Button>
        ) : undefined
      }
    />
  )

  // 포커스 소제목 줄 — 두 섹션(착수/마감)의 존재를 처음부터 보이게
  const focusSubHeader = (label: string, count: number, extra?: React.ReactNode) => (
    <Box sx={{ px: 2, py: 1.25, bgcolor: 'background.elevated', display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Typography variant="caption" sx={{ fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: typescale.cardTitle.weight, color: 'accent.amber' }}>
        {count}
      </Typography>
      {extra}
    </Box>
  )

  const periodCell = (r: MilestoneRow) => (
    <Tooltip title={`원문: ${r.startLabel} → ${r.endLabel}${r.fuzzy ? ' (분기는 추정 표기)' : ''}`} arrow>
      <Box component="span" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>
        {qShort(r.startQ)}→{qShort(r.endQ)}{r.fuzzy ? '≈' : ''}
      </Box>
    </Tooltip>
  )

  return (
    <PageContainer>
      <PageHeader
        icon={<FlagIcon />}
        title="마일스톤"
        subtitle="팹센터 구축 → 개소 · 2026.3Q ~ 2029 실행계획 62건"
        updatedAt={
          latestUpdate
            ? `마지막 갱신 ${fmtStamp(latestUpdate.updatedAt)} · ${latestUpdate.updatedBy}`
            : '2026-07-22 엑셀 계획 이식 — 이후 상태 갱신은 이 페이지에서'
        }
        actions={
          stats.waiting > 0 ? (
            <Button
              variant="outlined"
              startIcon={<PlayArrowIcon />}
              onClick={goFocus}
              sx={{ borderColor: 'accent.amber', color: 'accent.amber', '&:hover': { borderColor: 'accent.amber', bgcolor: (t) => alpha(t.palette.accent.amber, 0.08) } }}
            >
              착수할 일 {stats.waiting}건
            </Button>
          ) : undefined
        }
      />
      {error && <ErrorBanner message="마일스톤을 불러오지 못했습니다" onRetry={() => void dispatch(loadMilestones())} />}

      {/* 페이지 탭 — 관제판(현황) / 전체 업무(대장) */}
      <Box sx={{ mb: `${layout.pageHeaderGap}px` }}>
        <SegTabs
          items={[
            { value: 'dash', label: '관제판' },
            { value: 'list', label: `전체 업무 ${items.length}` },
          ]}
          value={pageTab}
          onChange={setPageTab}
          ariaLabel="페이지 보기 전환"
        />
      </Box>

      {pageTab === 'dash' ? (
        <>
          {/* KPI 스트립 — 5등분, 착수 전 국면의 주인공은 앰버 '착수 대기' */}
          <ContentSection>
            <CardGrid columns={5} gap={layout.kpiStripGap}>
              <KpiCard
                value={dimZero(stats.done)}
                unit={`/ ${items.length}`}
                label="완료"
                sub={stats.done === 0 ? '착수 전 · 이번 분기부터 시작' : undefined}
                accentColor="blue"
                icon={<TaskAltIcon />}
                onClick={stats.done > 0 ? () => goList({ status: statusFilter === '완료' ? '전체' : '완료' }) : undefined}
                sx={statusFilter === '완료' ? { borderColor: 'primary.main' } : undefined}
              />
              <KpiCard
                value={dimZero(stats.inProgress)}
                label="진행중"
                accentColor="green"
                icon={<AutorenewIcon />}
                onClick={stats.inProgress > 0 ? () => goList({ status: statusFilter === '진행중' ? '전체' : '진행중' }) : undefined}
                sx={statusFilter === '진행중' ? { borderColor: 'primary.main' } : undefined}
              />
              <KpiCard
                value={dimZero(stats.waiting)}
                label="이번 분기 착수 대기"
                sub={stats.waiting > 0 ? `→ 착수할 ${stats.waiting}건 보기` : '모두 착수했습니다'}
                accentColor="amber"
                icon={<PendingActionsIcon />}
                onClick={stats.waiting > 0 ? goFocus : undefined}
                sx={stats.waiting > 0 ? { borderColor: 'accent.amber' } : undefined}
              />
              <KpiCard
                value={dimZero(stats.delayed)}
                label="지연"
                accentColor={stats.delayed > 0 ? 'red' : 'blue'}
                icon={<ErrorOutlineIcon />}
                onClick={stats.delayed > 0 ? () => goList({ status: statusFilter === '지연' ? '전체' : '지연' }) : undefined}
                sx={statusFilter === '지연' ? { borderColor: 'primary.main' } : undefined}
              />
              <KpiCard
                value={`D-${TOTAL_QUARTERS - 1 - curIdx}`}
                unit="분기"
                label="개소까지"
                sub={`지금 · ${qFull(curQ)}`}
                accentColor="purple"
                icon={<RocketLaunchIcon />}
              />
            </CardGrid>
          </ContentSection>

          {/* 구축 여정 타임라인 — 범례·건수는 카드 안에 상시 표시 */}
          <ContentSection title="구축 여정">
            <JourneyTimeline
              items={items}
              curIdx={curIdx}
              selectedQ={qFilter}
              onSelectQuarter={(q) => {
                setQFilter(q)
                if (q) goList()
              }}
            />
          </ContentSection>

          {/* 분야별 진행 + 이번 분기 포커스 */}
          <ContentSection last>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr 1fr' }, gap: `${layout.cardGap}px` }}>
              <Box sx={{ order: { xs: 2, md: 1 } }}>
                <Typography variant="h3" sx={{ mb: 1.5 }}>분야별 진행</Typography>
                <CardGrid columns={3} gap={12}>
                  {CATEGORIES.map((cat) => {
                    const rows = items.filter((r) => r.category === cat.full)
                    if (rows.length === 0) return null
                    const counts = new Map<DerivedStatus, number>()
                    rows.forEach((r) => {
                      const s = deriveStatus(r, curIdx)
                      counts.set(s, (counts.get(s) || 0) + 1)
                    })
                    const done = counts.get('완료') || 0
                    const prog = counts.get('진행중') || 0
                    const startWait = rows.filter((r) => r.status === '예정' && r.startQ <= curQ).length
                    const notStarted = done + prog === 0
                    // 착수 전 분야는 %(항상 0) 대신 건수와 "언제 시작"을 말해준다
                    const futureStarts = rows.filter((r) => r.startQ > curQ).map((r) => r.startQ).sort()
                    const segments: RatioSegment[] = [
                      { label: '완료', value: done, status: 'info' },
                      { label: '진행중', value: prog, status: 'success' },
                      { label: '보류', value: counts.get('보류') || 0, status: 'warning' },
                      { label: '지연', value: counts.get('지연') || 0, status: 'error' },
                      { label: '예정', value: counts.get('예정') || 0, status: 'neutral' },
                    ]
                    const selected = catFilter === cat.full
                    return (
                      <AppCard
                        key={cat.full}
                        padding={layout.cardPaddingSm}
                        onClick={() => goList({ cat: selected ? null : cat.full })}
                        ariaLabel={`${cat.short} 업무만 보기`}
                        sx={selected ? { borderColor: 'primary.main' } : undefined}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', fontSize: iconSize.body, color: 'text.secondary', flexShrink: 0 }}>{cat.icon}</Box>
                          <Typography
                            component="span"
                            sx={{
                              fontSize: typescale.body.size, fontWeight: typescale.emphasis.weight,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {cat.short}
                          </Typography>
                          <Typography
                            component="span"
                            sx={{
                              ml: 'auto', flexShrink: 0,
                              fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight,
                              color: notStarted ? 'text.disabled' : 'accent.blue',
                            }}
                          >
                            {notStarted ? `0/${rows.length}` : `${Math.round((done / rows.length) * 100)}%`}
                          </Typography>
                        </Box>
                        <Box sx={{ mt: 1 }}>
                          <RatioBar segments={segments} height={7} showLegend={false} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                          {notStarted ? (
                            startWait > 0 ? (
                              <Typography variant="caption" sx={{ color: 'accent.amber', fontWeight: typescale.emphasis.weight }}>
                                이번 분기 {startWait}건 착수
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                {futureStarts.length > 0 ? `${qFull(futureStarts[0])} 시작` : '착수 대기 없음'}
                              </Typography>
                            )
                          ) : (
                            <>
                              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                완료 {done} · 진행 {prog} · 남음 {rows.length - done}
                              </Typography>
                              {startWait > 0 && (
                                <Typography variant="caption" sx={{ ml: 'auto', color: 'accent.amber', fontWeight: typescale.emphasis.weight }}>
                                  착수 대기 {startWait}
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </AppCard>
                    )
                  })}
                </CardGrid>
              </Box>

              <Box ref={focusRef} sx={{ order: { xs: 1, md: 2 }, scrollMarginTop: `${layout.pageTop}px` }}>
                <Typography variant="h3" sx={{ mb: 1.5 }}>
                  이번 분기 포커스
                  <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
                    {qFull(curQ)} · 착수 {focusStart.length} · 마감 {focusDue.length}
                  </Typography>
                </Typography>
                <AppCard padding={0}>
                  {focusSubHeader('지금 착수할 일', focusStart.length)}
                  {focusStart.length === 0 ? (
                    <EmptyState size="sm" title="착수 대기 항목이 없습니다" />
                  ) : (
                    <>
                      {focusStart.slice(0, 6).map((r) => focusRow(r, '착수'))}
                      {focusStart.length > 6 && (
                        <Box
                          component="button"
                          onClick={() => goList({ status: '예정' })}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                            width: '100%', py: 1, border: 'none', cursor: 'pointer',
                            bgcolor: 'transparent', color: 'primary.main', fontFamily: 'inherit',
                            fontSize: typescale.small.size,
                            '&:hover': { bgcolor: 'background.elevated' },
                          }}
                        >
                          전체 {focusStart.length}건 보기
                          <ChevronRightIcon sx={{ fontSize: iconSize.body }} />
                        </Box>
                      )}
                    </>
                  )}
                  {focusSubHeader(
                    '이번 분기 완료 목표',
                    focusDue.length,
                    doneThisQ > 0 ? (
                      <Typography variant="caption" sx={{ ml: 'auto', color: 'accent.blue' }}>
                        완료 처리 {doneThisQ}건
                      </Typography>
                    ) : undefined,
                  )}
                  {focusDue.length === 0 ? (
                    <EmptyState size="sm" title="이번 분기 마감 항목이 없습니다" />
                  ) : (
                    <>
                      {focusDue.slice(0, 6).map((r) => focusRow(r, '완료'))}
                      {focusDue.length > 6 && (
                        <Box
                          component="button"
                          onClick={() => goList({ q: curQ })}
                          sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                            width: '100%', py: 1, border: 'none', cursor: 'pointer',
                            bgcolor: 'transparent', color: 'primary.main', fontFamily: 'inherit',
                            fontSize: typescale.small.size,
                            '&:hover': { bgcolor: 'background.elevated' },
                          }}
                        >
                          전체 {focusDue.length}건 보기
                          <ChevronRightIcon sx={{ fontSize: iconSize.body }} />
                        </Box>
                      )}
                    </>
                  )}
                </AppCard>
              </Box>
            </Box>
          </ContentSection>
        </>
      ) : (
        <>
          {/* 전체 업무 탭 — 필터줄은 스크롤해도 고정(맥락 유지) */}
          <Box
            sx={{
              position: 'sticky', top: 0, zIndex: 5,
              bgcolor: 'background.default',
              py: 1, mb: 1,
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1,
            }}
          >
            {!isMobile && (
              <SegTabs
                items={[{ value: 'table', label: '표' }, { value: 'gantt', label: '간트 지도' }]}
                value={view}
                onChange={setView}
                ariaLabel="표·간트 전환"
              />
            )}
            {STATUS_FILTERS.map((s) => (
              <StatusChip
                key={s}
                status={s === '전체' ? 'neutral' : STATUS_KIND[s]}
                label={s}
                selected={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              />
            ))}
            <Select
              value={catFilter || '전체'}
              onChange={(v) => setCatFilter(v === '전체' ? null : v)}
              ariaLabel="분야 필터"
              minWidth={130}
              options={[
                { value: '전체', label: '전체 분야' },
                ...CATEGORIES.map((c) => ({ value: c.full, label: c.short })),
              ]}
            />
            {catFilter && (
              <StatusChip status="info" label={`${categoryShort(catFilter)} ×`} selected onClick={() => setCatFilter(null)} />
            )}
            {qFilter && (
              <StatusChip status="info" label={`${qFull(qFilter)} 마감 ×`} selected onClick={() => setQFilter(null)} />
            )}
            <SearchBar value={search} onChange={setSearch} placeholder="업무·산출물·담당자 검색" width={190} sx={{ ml: 'auto' }} />
          </Box>

          {view === 'table' || isMobile ? (
            <>
              <AppCard padding={0}>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ ...dataTableSx, '& th, & td': { borderColor: 'divider', whiteSpace: 'nowrap' } }}>
                    <TableHead>
                      <TableRow sx={dataTableHeadSx}>
                        <TableCell sx={{ width: 70 }}>상태</TableCell>
                        <TableCell sx={{ textAlign: 'left' }}>업무</TableCell>
                        <TableCell sx={{ width: 120 }}>기간</TableCell>
                        <TableCell sx={{ textAlign: 'left', width: 230 }}>핵심 산출물</TableCell>
                        <TableCell sx={{ width: 80 }}>협조</TableCell>
                        <TableCell sx={{ width: 80 }}>담당자</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ border: 0 }}>
                            <EmptyState size="sm" title="조건에 맞는 업무가 없습니다" />
                          </TableCell>
                        </TableRow>
                      )}
                      {CATEGORIES.map((cat) => {
                        const rows = filtered.filter((r) => r.category === cat.full)
                        if (rows.length === 0) return null
                        const open = filterActive || !!openGroups[cat.full]
                        const startWait = rows.filter((r) => r.status === '예정' && r.startQ <= curQ).length
                        const counts = new Map<DerivedStatus, number>()
                        rows.forEach((r) => {
                          const s = deriveStatus(r, curIdx)
                          counts.set(s, (counts.get(s) || 0) + 1)
                        })
                        const segments: RatioSegment[] = [
                          { label: '완료', value: counts.get('완료') || 0, status: 'info' },
                          { label: '진행중', value: counts.get('진행중') || 0, status: 'success' },
                          { label: '보류', value: counts.get('보류') || 0, status: 'warning' },
                          { label: '지연', value: counts.get('지연') || 0, status: 'error' },
                          { label: '예정', value: counts.get('예정') || 0, status: 'neutral' },
                        ]
                        return (
                          <Fragment key={cat.full}>
                            {/* 분야 그룹 머리글 — 62행 벽을 9개 묶음으로 끊는다 */}
                            <TableRow
                              onClick={filterActive ? undefined : () => setOpenGroups((g) => ({ ...g, [cat.full]: !open }))}
                              sx={{
                                cursor: filterActive ? 'default' : 'pointer',
                                '& td': { bgcolor: 'background.elevated' },
                                ...(filterActive ? {} : { '&:hover td': { bgcolor: 'background.paper' } }),
                              }}
                            >
                              <TableCell colSpan={6}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {!filterActive && (
                                    <ExpandMoreIcon
                                      sx={{
                                        fontSize: iconSize.action, color: 'text.secondary',
                                        transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s',
                                      }}
                                    />
                                  )}
                                  <Box sx={{ display: 'flex', fontSize: iconSize.body, color: 'text.secondary' }}>{cat.icon}</Box>
                                  <Typography component="span" sx={{ fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight }}>
                                    {cat.short}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                    {rows.length}건{startWait > 0 ? ` · 이번 분기 착수 ${startWait}` : ''}
                                  </Typography>
                                  <Box sx={{ ml: 'auto', width: 90 }}>
                                    <RatioBar segments={segments} height={5} showLegend={false} />
                                  </Box>
                                </Box>
                              </TableCell>
                            </TableRow>
                            {open &&
                              rows.map((r) => {
                                const s = deriveStatus(r, curIdx)
                                return (
                                  <TableRow key={r.id} hover onClick={() => setOpenId(r.id)} sx={{ cursor: 'pointer' }}>
                                    <TableCell align="center">
                                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                        <StatusChip status={STATUS_KIND[s]} label={s} />
                                        {isImminent(r, curIdx) && (
                                          <Tooltip title="완료목표가 이번 분기" arrow>
                                            <Box sx={{ width: 7, height: 7, borderRadius: `${radius.pill}px`, bgcolor: 'accent.amber' }} />
                                          </Tooltip>
                                        )}
                                      </Box>
                                    </TableCell>
                                    <TableCell>
                                      <Box component="span" sx={{ display: 'inline-block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>
                                        {r.title}
                                      </Box>
                                    </TableCell>
                                    <TableCell align="center">{periodCell(r)}</TableCell>
                                    <TableCell>
                                      <Box component="span" sx={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom', color: 'text.secondary' }}>
                                        {r.deliverable || '—'}
                                      </Box>
                                    </TableCell>
                                    <TableCell align="center">{r.coop || '—'}</TableCell>
                                    <TableCell align="center">
                                      <Box component="span" sx={{ color: r.owner ? 'text.primary' : 'text.disabled' }}>{r.owner || '—'}</Box>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                          </Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </AppCard>
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled' }}>
                ≈ = 원문 일정("착공 전" 등)을 분기로 추정 표기 — 행에 마우스를 올리면 원문이 보입니다
              </Typography>
            </>
          ) : (
            <GanttBoard items={filtered} curIdx={curIdx} onOpen={(r) => setOpenId(r.id)} />
          )}
        </>
      )}

      <DetailDrawer
        row={openRow}
        curIdx={curIdx}
        canEdit={isAdmin}
        onClose={() => setOpenId(null)}
        onChangeStatus={(r, s) => void changeStatus(r, s)}
        onSaveOwner={(r, o) => void saveOwner(r, o)}
      />
    </PageContainer>
  )
}
