import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import AssessmentIcon from '@mui/icons-material/Assessment'
import RefreshIcon from '@mui/icons-material/Refresh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
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
import { loadWorkData } from '@/store/slices/workSlice'
import { dateSortValue, fmtDate, parseStartDate } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskLink, taskTitle } from './workMeta'
import TaskCard from './TaskCard'
import TaskDetailDrawer from './TaskDetailDrawer'

type Tab = 'inProgress' | 'past' | 'remind' | 'chief'
const TABS: { key: Tab; label: string }[] = [
  { key: 'inProgress', label: '진행중' },
  { key: 'past', label: '지난' },
  { key: 'remind', label: 'Remind' },
  { key: 'chief', label: '센터장 Check' },
]

const MD = (s: string) => {
  const d = parseStartDate(s)
  return d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}` : ''
}
// 구분 우선순위 → 시작일자 최근순
const cmp = (a: WorkItem, b: WorkItem) => {
  const ra = workCatRank(a.cat)
  const rb = workCatRank(b.cat)
  return ra !== rb ? ra - rb : dateSortValue(b.start) - dateSortValue(a.start)
}

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector((s) => s.work)
  const [tab, setTab] = useState<Tab>('inProgress')
  const [cat, setCat] = useState('전체')
  const [mgr, setMgr] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<WorkItem | null>(null)

  // ── 전체 집계(Command Center용, 필터 무관) ──
  const counts = useMemo(() => {
    let inProgress = 0, remind = 0, past = 0, chief = 0
    for (const t of items) {
      const c = classify(t)
      if (c === 'inProgress') inProgress++
      else if (c === 'remind') remind++
      else past++
      if (t.chief) chief++
    }
    return { inProgress, remind, past, chief, total: items.length }
  }, [items])

  // 긴급: 센터장 Check + Remind (센터장 우선 → 최근 발의)
  const urgent = useMemo(
    () =>
      items
        .filter((t) => t.chief || t.remind)
        .sort((a, b) => (a.chief === b.chief ? dateSortValue(b.start) - dateSortValue(a.start) : a.chief ? -1 : 1))
        .slice(0, 5),
    [items],
  )

  // (마감 기반 '이번주 마감' 섹션은 실제 '마감일' 컬럼 추가 후 STEP10+에서 구현)

  // 담당자별 집계
  const managers = useMemo(() => {
    const map = new Map<string, { mgr: string; inProgress: number; remind: number; chief: number; total: number }>()
    for (const t of items) {
      const name = t.mgr || '미지정'
      const m = map.get(name) ?? { mgr: name, inProgress: 0, remind: 0, chief: 0, total: 0 }
      const c = classify(t)
      if (c === 'inProgress') m.inProgress++
      else if (c === 'remind') m.remind++
      if (t.chief) m.chief++
      m.total++
      map.set(name, m)
    }
    return [...map.values()].sort((a, b) => b.inProgress - a.inProgress || b.total - a.total)
  }, [items])
  const busiest = managers.find((m) => m.mgr !== '미지정' && m.inProgress > 0) ?? managers[0]

  // ── 전체 목록(탭 + 필터) ──
  const presentCats = useMemo(() => ['전체', ...[...new Set(items.map((t) => t.cat).filter(Boolean))].sort((a, b) => workCatRank(a) - workCatRank(b))], [items])

  const tabPool = useMemo(() => {
    if (tab === 'chief') return items.filter((t) => t.chief)
    return items.filter((t) => classify(t) === tab)
  }, [items, tab])

  const presentMgrs = useMemo(() => ['전체', ...[...new Set(tabPool.map((t) => t.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [tabPool])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tabPool
      .filter((t) => cat === '전체' || normCat(t.cat) === normCat(cat))
      .filter((t) => mgr === '전체' || (t.mgr || '') === mgr)
      .filter((t) => !q || `${t.task} ${t.mgr} ${t.cat} ${t.dept} ${t.num}`.toLowerCase().includes(q))
      .sort(cmp)
  }, [tabPool, cat, mgr, query])

  const switchTab = (k: Tab) => {
    setTab(k)
    setMgr('전체')
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<AssessmentIcon />}
        title="업무현황"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadWorkData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* ① KPI + 상태 비율 */}
      <ContentSection>
        <AppCard padding={18} sx={{ mb: 2 }}>
          <RatioBar
            segments={[
              { label: '진행중', value: counts.inProgress, status: 'success' },
              { label: 'Remind', value: counts.remind, status: 'warning' },
              { label: '지난', value: counts.past, status: 'neutral' },
            ]}
          />
        </AppCard>
        <CardGrid columns={4}>
          <StatTile value={counts.inProgress} unit="건" label="진행중" status="success" selected={tab === 'inProgress'} onClick={() => switchTab('inProgress')} />
          <StatTile value={counts.past} unit="건" label="지난" status="neutral" selected={tab === 'past'} onClick={() => switchTab('past')} />
          <StatTile value={counts.remind} unit="건" label="Remind" status="warning" selected={tab === 'remind'} onClick={() => switchTab('remind')} />
          <StatTile value={counts.chief} unit="건" label="센터장 Check" status="purple" selected={tab === 'chief'} onClick={() => switchTab('chief')} />
        </CardGrid>
      </ContentSection>

      {/* ② 긴급 업무 */}
      <ContentSection title="긴급 업무" description="센터장 Check · Remind 상위 5건" count={urgent.length}>
        {urgent.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="긴급 업무가 없습니다" /></AppCard>
        ) : (
          <CardGrid minColWidth={260}>
            {urgent.map((t) => (
              <TaskCard key={t.id} t={t} right={`발의 ${MD(t.start)}`} onPick={setPicked} />
            ))}
          </CardGrid>
        )}
      </ContentSection>

      {/* ③ 담당자 현황 */}
      <ContentSection title="담당자 현황">
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
                {m.chief > 0 && <StatusChip status="purple" label={`센터장 ${m.chief}`} />}
              </Box>
            </AppCard>
          ))}
        </CardGrid>
      </ContentSection>

      {/* ④ 전체 업무 목록 */}
      <ContentSection title="전체 업무 목록" count={listed.length} last>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {TABS.map((tb) => (
            <StatusChip key={tb.key} status="neutral" label={`${tb.label} ${tb.key === 'chief' ? counts.chief : counts[tb.key]}`} selected={tab === tb.key} onClick={() => switchTab(tb.key)} />
          ))}
        </Box>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="업무·담당자 검색" />}>
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

        <AppCard padding={0}>
          {listed.length === 0 ? (
            <EmptyState size="sm" title="해당 업무가 없습니다" />
          ) : (
            <Box>
              {listed.map((t) => {
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
                    }}
                  >
                    <StatusChip status={st.status} label={st.label} />
                    {t.cat && <StatusChip status="neutral" label={t.cat} />}
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
              })}
            </Box>
          )}
        </AppCard>
      </ContentSection>

      <TaskDetailDrawer task={picked} onClose={() => setPicked(null)} />
    </PageContainer>
  )
}
