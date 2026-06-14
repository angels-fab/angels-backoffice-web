import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import RefreshIcon from '@mui/icons-material/Refresh'
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
import type { EqGroup } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip, todayHalfIndex, type StageCode, type StageInfo } from './stageMeta'
import { GanttHeader, GanttBar } from './gantt'
import EqProjectDrawer from './EqProjectDrawer'

function ProgressBar({ value }: { value: number }) {
  return (
    <Box sx={{ height: 6, borderRadius: 999, bgcolor: 'background.elevated', overflow: 'hidden' }}>
      <Box sx={{ height: '100%', width: `${Math.round(value * 100)}%`, bgcolor: 'primary.main' }} />
    </Box>
  )
}

const GANTT_NAME_W = 168

export default function Equipment() {
  const dispatch = useAppDispatch()
  const { groups, months, loading, error, updatedAt } = useAppSelector((s) => s.eq)
  const [searchParams, setSearchParams] = useSearchParams()
  const [fltType, setFltType] = useState('전체')
  const [fltMgr, setFltMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<EqGroup | null>(null)

  // 통합검색 딥링크(/equipment?focus=<장비명>) → 해당 도입 프로젝트 상세 Drawer 자동 오픈
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus || !groups.length) return
    const g = groups.find((x) => x.name === focus)
    if (g) setPicked(g)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, groups])

  const todayHalf = useMemo(() => todayHalfIndex(months), [months])
  const infoMap = useMemo(() => {
    const m = new Map<string, StageInfo>()
    groups.forEach((g) => m.set(g.name, groupStage(g.timeline, months, todayHalf)))
    return m
  }, [groups, months, todayHalf])

  // 도입 개요(보조) + 단계 파이프라인
  const overview = useMemo(() => {
    let progress = 0, done = 0, upcoming = 0
    const tally = Object.fromEntries(STAGE_ORDER.map((c) => [c, 0])) as Record<StageCode, number>
    groups.forEach((g) => {
      const info = infoMap.get(g.name)!
      if (info.phase === 'done') { done++; if (info.code) tally[info.code]++ }
      else if (info.phase === 'progress') { progress++; if (info.code) tally[info.code]++ }
      else if (info.phase === 'upcoming') upcoming++
    })
    return { total: groups.length, progress, done, upcoming, tally }
  }, [groups, infoMap])

  // 필터
  const presentTypes = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.type).filter(Boolean))]], [groups])
  const presentMgrs = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [groups])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .filter((g) => fltType === '전체' || g.type === fltType)
      .filter((g) => fltMgr === '전체' || (g.mgr || '') === fltMgr)
      .filter((g) => !q || `${g.name} ${g.codes.join(' ')} ${g.mgr} ${g.maker} ${g.model}`.toLowerCase().includes(q))
  }, [groups, fltType, fltMgr, query])

  return (
    <PageContainer>
      <PageHeader
        icon={<LocalShippingIcon />}
        title="장비도입관리"
        subtitle="장비 도입 프로젝트 진행 — 단계·타임라인"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* ① 도입 개요 (보조 KPI) */}
      <ContentSection>
        <CardGrid columns={4}>
          <StatTile value={overview.total} unit="종" label="전체 도입장비" status="info" />
          <StatTile value={overview.progress} unit="종" label="진행중" status="warning" />
          <StatTile value={overview.done} unit="종" label="설치완료" status="success" />
          <StatTile value={overview.upcoming} unit="종" label="착수 전" status="neutral" />
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
      <ContentSection title="도입 진행 현황" count={`${filtered.length}종`}>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="장비명·담당자 검색" />}>
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
            {filtered.map((g) => {
              const info = infoMap.get(g.name)!
              const chip = phaseChip(info)
              return (
                <AppCard key={g.name} interactive onClick={() => setPicked(g)} padding={16}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <StatusChip status={chip.status} label={chip.label} />
                      {g.type && <StatusChip status="neutral" label={g.type} />}
                    </Box>
                    <Typography variant="subtitle1" sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {g.name}{g.count > 1 ? ` (${g.count}대)` : ''}
                    </Typography>
                    <ProgressBar value={info.progress} />
                    <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{g.mgr || '담당 미지정'}</Typography>
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
                filtered.map((g) => {
                  const chip = phaseChip(infoMap.get(g.name)!)
                  return (
                    <Box
                      key={g.name}
                      role="button"
                      tabIndex={0}
                      aria-label={`도입 프로젝트: ${g.name}`}
                      onClick={() => setPicked(g)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(g) } }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, cursor: 'pointer', borderTop: 1, borderColor: 'divider', '&:hover': { bgcolor: 'background.elevated' }, '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
                    >
                      <Box sx={{ width: GANTT_NAME_W, flexShrink: 0, minWidth: 0, pr: 1 }}>
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</Typography>
                        <StatusChip status={chip.status} label={chip.label} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <GanttBar tl={g.timeline} months={months} />
                      </Box>
                    </Box>
                  )
                })
              )}
            </Box>
          </Box>
        </AppCard>
      </ContentSection>

      <EqProjectDrawer group={picked} months={months} todayHalf={todayHalf} onClose={() => setPicked(null)} />
    </PageContainer>
  )
}
