import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { alpha } from '@mui/material/styles'
import FlagIcon from '@mui/icons-material/Flag'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import {
  AppCard, CardGrid, ContentSection, DataTable, EmptyState, ErrorBanner, KpiCard, ListRow,
  LoadingState, PageContainer, PageHeader, RatioBar, SearchBar, SegTabs, Select, StatusChip,
  useSnack, type DataColumn, type RatioSegment,
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
 * 구성: KPI 스트립 → 구축 여정 타임라인(오늘 위치) → 분야별 진행 + 이번 분기 포커스
 *       → 전체 업무(표/간트 지도 토글) → 상세 드로어(상태·담당자 편집, 관리자).
 * 상태 4종만 저장하고 임박·지연은 자동 파생(model.tsx). 데이터 정본 = Supabase milestones.
 */

const STATUS_FILTERS: Array<'전체' | DerivedStatus> = ['전체', '예정', '진행중', '완료', '보류', '지연']

const fmtStamp = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
}

export default function Milestone() {
  const dispatch = useAppDispatch()
  const { items, ready, loading, error } = useAppSelector((s) => s.milestone)
  const { isAdmin, user } = useRole()
  const snack = useSnack()
  const isMobile = useMediaQuery(shellMq, { noSsr: true })

  const curIdx = currentQIndex()
  const curQ = qAt(curIdx)

  const [view, setView] = useState<'table' | 'gantt'>('table')
  const [statusFilter, setStatusFilter] = useState<'전체' | DerivedStatus>('전체')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [qFilter, setQFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ready && !loading) void dispatch(loadMilestones())
  }, [ready, loading, dispatch])

  const openRow = useMemo(() => items.find((r) => r.id === openId) || null, [items, openId])

  // ── 파생 집계 ──
  const stats = useMemo(() => {
    const done = items.filter((r) => r.status === '완료').length
    const inProgress = items.filter((r) => r.status === '진행중').length
    const delayed = items.filter((r) => deriveStatus(r, curIdx) === '지연').length
    // 'YYYYQN' 포맷은 사전순 비교 = 시간순 비교
    const waiting = items.filter((r) => r.status === '예정' && r.startQ <= curQ).length
    return { done, inProgress, delayed, waiting }
  }, [items, curIdx, curQ])

  // 이번 분기 포커스 — 착수 대기(착수분기 도래 + 예정) / 이번 분기 마감(미완료)
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

  const latestUpdate = useMemo(() => {
    const withBy = items.filter((r) => r.updatedBy)
    if (withBy.length === 0) return null
    return withBy.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
  }, [items])

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

  // ── 표 컬럼 ──
  const columns = useMemo<DataColumn<MilestoneRow>[]>(() => [
    {
      key: 'status', label: '상태', align: 'center', width: '1%',
      render: (r) => {
        const s = deriveStatus(r, curIdx)
        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <StatusChip status={STATUS_KIND[s]} label={s} />
            {isImminent(r, curIdx) && (
              <Tooltip title="완료목표가 이번 분기" arrow>
                <Box sx={{ width: 7, height: 7, borderRadius: `${radius.pill}px`, bgcolor: 'accent.amber' }} />
              </Tooltip>
            )}
          </Box>
        )
      },
    },
    {
      key: 'category', label: '분야', align: 'center',
      render: (r) => (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{categoryShort(r.category)}</Typography>
      ),
    },
    {
      key: 'title', label: '업무',
      render: (r) => (
        <Box component="span" sx={{ display: 'inline-block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>
          {r.title}
        </Box>
      ),
    },
    {
      key: 'period', label: '기간', align: 'center',
      render: (r) => (
        <Tooltip title={`${r.startLabel} → ${r.endLabel}${r.fuzzy ? ' (추정 분기 매핑)' : ''}`} arrow>
          <Box component="span" sx={{ fontFamily: 'monospace', color: 'text.disabled' }}>
            {qShort(r.startQ)}→{qShort(r.endQ)}{r.fuzzy ? '≈' : ''}
          </Box>
        </Tooltip>
      ),
    },
    {
      key: 'deliverable', label: '핵심 산출물',
      render: (r) => (
        <Box component="span" sx={{ display: 'inline-block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom', color: 'text.secondary' }}>
          {r.deliverable || '—'}
        </Box>
      ),
    },
    { key: 'coop', label: '협조', align: 'center', render: (r) => r.coop || '—' },
    {
      key: 'owner', label: '담당자', align: 'center',
      render: (r) => (
        <Box component="span" sx={{ color: r.owner ? 'text.primary' : 'text.disabled' }}>{r.owner || '—'}</Box>
      ),
    },
  ], [curIdx])

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
      />
      {error && <ErrorBanner message="마일스톤을 불러오지 못했습니다" onRetry={() => void dispatch(loadMilestones())} />}

      {/* KPI 스트립 */}
      <ContentSection>
        <CardGrid minColWidth={150} gap={layout.kpiStripGap}>
          <KpiCard value={stats.done} unit={`/ ${items.length}`} label="완료" accentColor="blue" onClick={() => setStatusFilter(statusFilter === '완료' ? '전체' : '완료')} />
          <KpiCard value={stats.inProgress} label="진행중" accentColor="green" onClick={() => setStatusFilter(statusFilter === '진행중' ? '전체' : '진행중')} />
          <KpiCard value={stats.waiting} label="이번 분기 착수 대기" sub="착수 분기가 됐는데 아직 예정" accentColor="amber" />
          <KpiCard value={stats.delayed} label="지연" accentColor={stats.delayed > 0 ? 'red' : 'blue'} onClick={() => setStatusFilter(statusFilter === '지연' ? '전체' : '지연')} />
          <KpiCard value={`D-${TOTAL_QUARTERS - 1 - curIdx}`} unit="분기" label="개소까지" sub={`지금 · ${qFull(curQ)}`} accentColor="purple" />
        </CardGrid>
      </ContentSection>

      {/* 구축 여정 타임라인 */}
      <ContentSection title="구축 여정" description="분기별 완료목표 물량과 현재 위치 — 분기 클릭 시 아래 목록이 그 분기 마감으로 필터됩니다">
        <JourneyTimeline
          items={items}
          curIdx={curIdx}
          selectedQ={qFilter}
          onSelectQuarter={(q) => {
            setQFilter(q)
            if (q) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      </ContentSection>

      {/* 분야별 진행 + 이번 분기 포커스 */}
      <ContentSection>
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
                const pct = Math.round((done / rows.length) * 100)
                const imminentCnt = rows.filter((r) => isImminent(r, curIdx)).length
                const segments: RatioSegment[] = [
                  { label: '완료', value: done, status: 'info' },
                  { label: '진행중', value: counts.get('진행중') || 0, status: 'success' },
                  { label: '보류', value: counts.get('보류') || 0, status: 'warning' },
                  { label: '지연', value: counts.get('지연') || 0, status: 'error' },
                  { label: '예정', value: counts.get('예정') || 0, status: 'neutral' },
                ]
                const selected = catFilter === cat.full
                return (
                  <AppCard
                    key={cat.full}
                    padding={layout.cardPaddingSm}
                    onClick={() => {
                      setCatFilter(selected ? null : cat.full)
                      if (!selected) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
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
                          color: done > 0 ? 'accent.blue' : 'text.disabled',
                        }}
                      >
                        {pct}%
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      <RatioBar segments={segments} height={7} showLegend={false} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        완료 {done} · 진행 {counts.get('진행중') || 0} · 남음 {rows.length - done}
                      </Typography>
                      {imminentCnt > 0 && (
                        <Typography variant="caption" sx={{ ml: 'auto', color: 'accent.amber', fontWeight: typescale.emphasis.weight }}>
                          이번 분기 {imminentCnt}
                        </Typography>
                      )}
                    </Box>
                  </AppCard>
                )
              })}
            </CardGrid>
          </Box>

          <Box sx={{ order: { xs: 1, md: 2 } }}>
            <Typography variant="h3" sx={{ mb: 1.5 }}>
              이번 분기 포커스
              <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.disabled' }}>
                {qFull(curQ)}
              </Typography>
            </Typography>
            <AppCard padding={0}>
              <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                <Box sx={{ px: 2, py: 1.25, bgcolor: 'background.elevated', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>
                    지금 착수할 일
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: typescale.cardTitle.weight, color: 'accent.amber' }}>
                    {focusStart.length}
                  </Typography>
                </Box>
                {focusStart.length === 0 ? (
                  <EmptyState size="sm" title="착수 대기 항목이 없습니다" />
                ) : (
                  focusStart.map((r) => focusRow(r, '착수'))
                )}
                <Box sx={{ px: 2, py: 1.25, bgcolor: 'background.elevated', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>
                    이번 분기 완료 목표
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: typescale.cardTitle.weight, color: 'accent.amber' }}>
                    {focusDue.length}
                  </Typography>
                  {doneThisQ > 0 && (
                    <Typography variant="caption" sx={{ ml: 'auto', color: 'accent.blue' }}>
                      완료 처리 {doneThisQ}건
                    </Typography>
                  )}
                </Box>
                {focusDue.length === 0 ? (
                  <EmptyState size="sm" title="이번 분기 마감 항목이 없습니다" />
                ) : (
                  focusDue.map((r) => focusRow(r, '완료'))
                )}
              </Box>
            </AppCard>
          </Box>
        </Box>
      </ContentSection>

      {/* 전체 업무 — 표 / 간트 지도 */}
      <Box ref={listRef} sx={{ scrollMarginTop: `${layout.pageTop}px` }}>
        <ContentSection
          title="전체 업무"
          count={filtered.length}
          action={
            !isMobile ? (
              <SegTabs
                items={[{ value: 'table', label: '표' }, { value: 'gantt', label: '간트 지도' }]}
                value={view}
                onChange={setView}
                ariaLabel="보기 전환"
              />
            ) : undefined
          }
          last
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: `${layout.filterGap}px` }}>
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
            {qFilter && (
              <StatusChip status="info" label={`${qFull(qFilter)} 마감 ×`} selected onClick={() => setQFilter(null)} />
            )}
            <SearchBar value={search} onChange={setSearch} placeholder="업무·산출물·담당자 검색" width={200} sx={{ ml: 'auto' }} />
          </Box>

          {view === 'table' || isMobile ? (
            <AppCard padding={0}>
              <DataTable
                columns={columns}
                rows={filtered}
                rowKey={(r) => r.id}
                onRowClick={(r) => setOpenId(r.id)}
                emptyTitle="조건에 맞는 업무가 없습니다"
              />
            </AppCard>
          ) : (
            <GanttBoard items={filtered} curIdx={curIdx} onOpen={(r) => setOpenId(r.id)} />
          )}
        </ContentSection>
      </Box>

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
