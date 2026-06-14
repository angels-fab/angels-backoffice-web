import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import MonitorIcon from '@mui/icons-material/Monitor'
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
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'
import EqDetailDrawer from './EqDetailDrawer'

const k = (v: number) => Math.round(v / 1000).toLocaleString()

/** 장비 카드(전체 목록). 장비명·담당자·종류·도입금액·관리번호 Compact. */
function EqCard({ g, onPick }: { g: EqGroup; onPick: (g: EqGroup) => void }) {
  const meta = EQ_STATE[eqStateKey(g.state)]
  const code = g.codes.filter(Boolean)[0]
  const codeLabel = code ? `${code}${g.count > 1 ? ` 외 ${g.count - 1}` : ''}` : ''
  return (
    <AppCard interactive onClick={() => onPick(g)} padding={16}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <StatusChip status={meta.status} label={meta.label} />
          {g.cat && <StatusChip status="neutral" label={g.cat} />}
        </Box>
        <Typography variant="subtitle1" sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {g.name}
        </Typography>
        <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25, pt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {g.mgr || '담당 미지정'}{g.type ? ` · ${g.type}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700 }}>
              {g.price ? `${k(g.price)} 천원` : '금액 미정'}
            </Typography>
            {codeLabel && <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{codeLabel}</Typography>}
          </Box>
        </Box>
      </Box>
    </AppCard>
  )
}

const STATE_TABS: ('전체' | EqStateKey)[] = ['전체', '가동중', '도입중', '도입예정', '비가동']

export default function EquipmentOps() {
  const dispatch = useAppDispatch()
  const { raw, groups, loading, error, updatedAt } = useAppSelector((s) => s.eq)
  const c = useAppSelector(selectEqCounts)
  const [searchParams, setSearchParams] = useSearchParams()
  const [stateTab, setStateTab] = useState<'전체' | EqStateKey>('전체')
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<EqGroup | null>(null)

  // 통합검색 딥링크(/equipment-ops?focus=<장비명>) → 해당 장비 상세 Drawer 자동 오픈
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

  // 예산 (천원)
  const budget = useMemo(() => {
    const won = raw.reduce((s, e) => s + (e.price || 0), 0)
    const local = raw.filter((e) => (e.fund || '').includes('지방비')).reduce((s, e) => s + (e.price || 0), 0)
    const nat = raw.filter((e) => (e.fund || '').includes('국비')).reduce((s, e) => s + (e.price || 0), 0)
    return { won, local, nat }
  }, [raw])

  // 카테고리별 현황 (raw 단위 집계 + 예산)
  const categories = useMemo(() => {
    const map = new Map<string, { cat: string; total: number; op: number; install: number; plan: number; down: number; budget: number }>()
    for (const e of raw) {
      const name = e.cat || '기타'
      const m = map.get(name) ?? { cat: name, total: 0, op: 0, install: 0, plan: 0, down: 0, budget: 0 }
      m.total++
      m.budget += e.price || 0
      const key = eqStateKey(e.state)
      if (key === '가동중') m.op++
      else if (key === '도입중') m.install++
      else if (key === '도입예정') m.plan++
      else m.down++
      map.set(name, m)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [raw])

  // 담당자별 장비 현황 (raw 단위)
  const managers = useMemo(() => {
    const map = new Map<string, { mgr: string; total: number; op: number; install: number; plan: number; down: number }>()
    for (const e of raw) {
      const name = e.mgr || '미지정'
      const m = map.get(name) ?? { mgr: name, total: 0, op: 0, install: 0, plan: 0, down: 0 }
      m.total++
      const key = eqStateKey(e.state)
      if (key === '가동중') m.op++
      else if (key === '도입중') m.install++
      else if (key === '도입예정') m.plan++
      else m.down++
      map.set(name, m)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [raw])

  // 전체 목록 필터
  const presentCats = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.cat).filter(Boolean))]], [groups])
  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .filter((g) => stateTab === '전체' || eqStateKey(g.state) === stateTab)
      .filter((g) => cat === '전체' || g.cat === cat)
      .filter((g) => !q || `${g.name} ${g.codes.join(' ')} ${g.mgr} ${g.maker} ${g.model}`.toLowerCase().includes(q))
  }, [groups, stateTab, cat, query])

  const tabCount = (s: '전체' | EqStateKey) => (s === '전체' ? c.total : c.units[s])

  return (
    <PageContainer>
      <PageHeader
        icon={<MonitorIcon />}
        title="장비운영관리"
        subtitle="장비 총괄 현황 — 전체 자산·상태·담당"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* ① KPI — 총 장비 / 상태별 (대수 + 종 보조) */}
      <ContentSection>
        <CardGrid columns={5}>
          <StatTile value={c.total} unit="대" label="총 장비" status="info" sub={`${c.types}종`} />
          <StatTile value={c.units['가동중']} unit="대" label="운영중" status="success" sub={`${c.typesBy['가동중']}종`} />
          <StatTile value={c.units['도입중']} unit="대" label="설치중" status="teal" sub={`${c.typesBy['도입중']}종`} />
          <StatTile value={c.units['도입예정']} unit="대" label="도입예정" status="info" sub={`${c.typesBy['도입예정']}종`} />
          <StatTile value={c.units['비가동']} unit="대" label="비가동" status="error" sub={`${c.typesBy['비가동']}종`} />
        </CardGrid>
      </ContentSection>

      {/* ② 카테고리 현황 */}
      <ContentSection title="카테고리 현황" description="분류별 장비 수 · 도입예산 · 상태">
        <CardGrid minColWidth={220}>
          {categories.map((m) => (
            <AppCard key={m.cat} padding={16}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="subtitle1">{m.cat}</Typography>
                <Typography variant="body2"><Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{m.total}</Box>대</Typography>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.25, color: 'text.secondary' }}>
                도입예산 <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{k(m.budget)}</Box> 천원
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {m.op > 0 && <StatusChip status="success" label={`운영 ${m.op}`} />}
                {m.install > 0 && <StatusChip status="teal" label={`설치 ${m.install}`} />}
                {m.plan > 0 && <StatusChip status="info" label={`예정 ${m.plan}`} />}
                {m.down > 0 && <StatusChip status="error" label={`비가동 ${m.down}`} />}
              </Box>
            </AppCard>
          ))}
        </CardGrid>
      </ContentSection>

      {/* ③ 담당자별 장비 현황 */}
      <ContentSection title="담당자별 장비 현황">
        <CardGrid minColWidth={200}>
          {managers.map((m) => (
            <AppCard key={m.mgr} padding={16}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="subtitle1">{m.mgr}</Typography>
                <Typography variant="body2"><Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>{m.total}</Box>대</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {m.op > 0 && <StatusChip status="success" label={`운영 ${m.op}`} />}
                {m.install > 0 && <StatusChip status="teal" label={`설치 ${m.install}`} />}
                {m.plan > 0 && <StatusChip status="info" label={`예정 ${m.plan}`} />}
                {m.down > 0 && <StatusChip status="error" label={`비가동 ${m.down}`} />}
              </Box>
            </AppCard>
          ))}
        </CardGrid>
      </ContentSection>

      {/* ④ 예산 현황 (compact) */}
      <ContentSection title="예산 현황" description="단위: 천원">
        <CardGrid columns={3}>
          <AppCard padding={16}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>총 도입예산</Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5 }}>{k(budget.won)}</Typography>
          </AppCard>
          <AppCard padding={16}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>지방비 예산</Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5 }}>{k(budget.local)}</Typography>
          </AppCard>
          <AppCard padding={16}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>국비 예산 <Box component="span" sx={{ color: 'text.disabled' }}>(예상)</Box></Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, mt: 0.5 }}>{k(budget.nat)}</Typography>
          </AppCard>
        </CardGrid>
      </ContentSection>

      {/* ⑤ 전체 장비 목록 */}
      <ContentSection title="전체 장비 목록" count={listed.length} last>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {STATE_TABS.map((s) => (
            <StatusChip
              key={s}
              status={s === '전체' ? 'neutral' : EQ_STATE[s].status}
              label={`${s === '전체' ? '전체' : EQ_STATE[s].label} ${tabCount(s)}`}
              selected={stateTab === s}
              onClick={() => setStateTab(s)}
            />
          ))}
        </Box>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="장비명·관리번호·담당자 검색" />}>
          {presentCats.map((cName) => (
            <StatusChip key={cName} status="neutral" label={cName} selected={cat === cName} onClick={() => setCat(cName)} />
          ))}
        </FilterBar>

        {listed.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 장비가 없습니다" /></AppCard>
        ) : (
          <CardGrid minColWidth={260}>
            {listed.map((g) => (
              <EqCard key={g.name} g={g} onPick={setPicked} />
            ))}
          </CardGrid>
        )}
      </ContentSection>

      <EqDetailDrawer group={picked} onClose={() => setPicked(null)} />
    </PageContainer>
  )
}
