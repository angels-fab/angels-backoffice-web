import { useMemo, useState } from 'react'
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
  RatioBar,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'
import EqDetailDrawer from './EqDetailDrawer'

const k = (v: number) => Math.round(v / 1000).toLocaleString()

/** 장비 카드(도입 우선/목록 공용). 장비명·담당자·종류·도입금액·관리번호 Compact 표시. */
function EqCard({ g, onPick, emphasis }: { g: EqGroup; onPick: (g: EqGroup) => void; emphasis?: boolean }) {
  const meta = EQ_STATE[eqStateKey(g.state)]
  const code = g.codes.filter(Boolean)[0]
  const codeLabel = code ? `${code}${g.count > 1 ? ` 외 ${g.count - 1}` : ''}` : ''
  return (
    <AppCard interactive onClick={() => onPick(g)} padding={16} sx={emphasis ? { bgcolor: 'background.elevated' } : undefined}>
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
  const [stateTab, setStateTab] = useState<'전체' | EqStateKey>('전체')
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<EqGroup | null>(null)

  // 예산 (천원)
  const budget = useMemo(() => {
    const won = raw.reduce((s, e) => s + (e.price || 0), 0)
    const local = raw.filter((e) => (e.fund || '').includes('지방비')).reduce((s, e) => s + (e.price || 0), 0)
    const nat = raw.filter((e) => (e.fund || '').includes('국비')).reduce((s, e) => s + (e.price || 0), 0)
    return { won, local, nat }
  }, [raw])

  // 도입 우선 장비: 상태 우선순위(비가동>설치중>도입예정) → 같은 단계면 도입금액 큰 순, 상위 5
  const attention = useMemo(
    () =>
      groups
        .filter((g) => eqStateKey(g.state) !== '가동중')
        .sort((a, b) => {
          const pa = EQ_STATE[eqStateKey(a.state)].priority
          const pb = EQ_STATE[eqStateKey(b.state)].priority
          return pa !== pb ? pa - pb : (b.price || 0) - (a.price || 0)
        })
        .slice(0, 5),
    [groups],
  )

  // 카테고리 현황 (raw 단위 집계)
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

  // 전체 목록 필터
  const presentCats = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.cat).filter(Boolean))]], [groups])
  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .filter((g) => stateTab === '전체' || eqStateKey(g.state) === stateTab)
      .filter((g) => cat === '전체' || g.cat === cat)
      .filter((g) => !q || `${g.name} ${g.codes.join(' ')} ${g.mgr} ${g.maker} ${g.model}`.toLowerCase().includes(q))
  }, [groups, stateTab, cat, query])

  return (
    <PageContainer>
      <PageHeader
        icon={<MonitorIcon />}
        title="장비운영관리"
        subtitle="FAB 구축 준비 현황 — 장비 도입 진행 상황 요약"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      {/* ① 구축 단계 현황 (KPI) */}
      <ContentSection title="구축 단계 현황" description="현재 전 장비가 도입예정 — FAB 구축 준비 단계">
        <CardGrid columns={5}>
          <StatTile value={c.total} unit="대" label="총 장비" status="info" sub={`${c.types}종`} />
          <StatTile value={c.units['가동중']} unit="대" label="운영중" status="success" sub="가동 단계" />
          <StatTile value={c.units['도입중']} unit="대" label="설치중" status="teal" sub="설치 단계" />
          <StatTile value={c.units['도입예정']} unit="대" label="도입예정" status="info" sub="구축 준비중" />
          <StatTile value={c.units['비가동']} unit="대" label="비가동" status="error" sub="점검 필요" />
        </CardGrid>
      </ContentSection>

      {/* ② 도입 단계 비율 */}
      <ContentSection title="도입 단계 비율">
        <AppCard padding={18}>
          <RatioBar
            segments={[
              { label: '운영중', value: c.units['가동중'], status: 'success' },
              { label: '설치중', value: c.units['도입중'], status: 'teal' },
              { label: '도입예정', value: c.units['도입예정'], status: 'info' },
              { label: '비가동', value: c.units['비가동'], status: 'error' },
            ]}
          />
        </AppCard>
      </ContentSection>

      {/* ③ 도입 우선 장비 (도입금액 큰 순) */}
      <ContentSection title="도입 우선 장비" description="도입금액 큰 순 · 상위 5건" count={attention.length}>
        {attention.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="도입 예정 장비가 없습니다" /></AppCard>
        ) : (
          <CardGrid minColWidth={260}>
            {attention.map((g) => (
              <EqCard key={g.name} g={g} onPick={setPicked} emphasis />
            ))}
          </CardGrid>
        )}
      </ContentSection>

      {/* ④ 카테고리 현황 */}
      <ContentSection title="카테고리 현황">
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
                <StatusChip status="success" label={`운영 ${m.op}`} />
                <StatusChip status="teal" label={`설치 ${m.install}`} />
                {m.plan > 0 && <StatusChip status="info" label={`예정 ${m.plan}`} />}
                {m.down > 0 && <StatusChip status="error" label={`비가동 ${m.down}`} />}
              </Box>
            </AppCard>
          ))}
        </CardGrid>
      </ContentSection>

      {/* ⑤ 예산 현황 (compact) */}
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

      {/* ⑥ 전체 장비 목록 */}
      <ContentSection title="전체 장비 목록" count={listed.length} last>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {STATE_TABS.map((s) => (
            <StatusChip
              key={s}
              status={s === '전체' ? 'neutral' : EQ_STATE[s].status}
              label={s === '전체' ? '전체' : EQ_STATE[s].label}
              selected={stateTab === s}
              onClick={() => setStateTab(s)}
            />
          ))}
        </Box>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="장비명·관리번호 검색" />}>
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
