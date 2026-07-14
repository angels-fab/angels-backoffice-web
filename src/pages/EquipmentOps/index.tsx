import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MonitorIcon from '@mui/icons-material/Monitor'
import RefreshIcon from '@mui/icons-material/Refresh'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { PageContainer, PageHeader, AppCard, StatusChip, EmptyState, Select, SearchBar } from '@/components/ds'
import { iconSize, radius } from '@/theme/tokens'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import { useRole } from '@/auth/role'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'
import EqDetailDrawer from './EqDetailDrawer'
import EquipmentTabs from '@/pages/Equipment/EquipmentTabs'
import { NameWithQty, codeRange, missingLabels, isRegRequired } from '@/pages/Equipment/batchUtil'
import { useTableSort, sortRows, SortTh } from '@/pages/Equipment/sortable'

const STATE_ORDER: EqStateKey[] = ['운영중', '도입중', '도입예정', '비가동', '미분류']

// 장비대장 정렬 열 — 관리번호·장비명·분류·담당자·운영상태·설치장소·누락정보·최근이력
type OpsCol = 'code' | 'name' | 'cat' | 'mgr' | 'state' | 'installLoc' | 'missing' | 'recent'
const OPS_COLS: { key: OpsCol; label: string }[] = [
  { key: 'code', label: '관리번호' }, { key: 'name', label: '장비명' }, { key: 'cat', label: '분류' },
  { key: 'mgr', label: '담당자' }, { key: 'state', label: '운영상태' }, { key: 'installLoc', label: '설치장소' },
  { key: 'missing', label: '누락정보' }, { key: 'recent', label: '최근 이력' },
]
const opsAccessor = (g: EqGroup, c: OpsCol): string | number | null => {
  switch (c) {
    case 'code': return g.codes[0] || null
    case 'name': return g.name
    case 'cat': return g.cat || null
    case 'mgr': return g.mgr || null
    case 'state': return EQ_STATE[eqStateKey(g.state)].label
    case 'installLoc': return g.installLoc || null
    case 'missing': return missingLabels(g).length
    case 'recent': return null
  }
}

export default function EquipmentOps() {
  const dispatch = useAppDispatch()
  const { raw, groups, loading, error, updatedAt } = useAppSelector((s) => s.eq)
  const c = useAppSelector(selectEqCounts)
  const [searchParams, setSearchParams] = useSearchParams()
  const [stateF, setStateF] = useState('전체')
  const [catF, setCatF] = useState('전체')
  const [mgrF, setMgrF] = useState('전체')
  const [query, setQuery] = useState('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [picked, setPicked] = useState<EqGroup | null>(null)
  const { isAdmin, user, authKey } = useRole()
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })
  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaved = async (name: string) => {
    const payload = await dispatch(loadEqData()).unwrap().catch(() => null)
    if (payload && Array.isArray(payload.groups)) setPicked(payload.groups.find((g) => g.name === name) ?? null)
  }

  // 딥링크(/equipment-ops?focus=<장비명|관리번호>)
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (!focus || !groups.length) return
    const g = groups.find((x) => x.name === focus || x.codes.includes(focus))
    if (g) setPicked(g)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, groups])

  // ── 요약: 분류·담당자 breakdown / 상태 / 필수정보 누락 ──
  const overview = useMemo(() => {
    const catUnits: Record<string, number> = {}
    const mgrs = new Set<string>()
    let missUnits = 0
    const missTypes = new Set<string>()
    const baseOf = (n: string) => { const m = String(n || '').trim().match(/^([^(]+)\s*\(/); return m ? m[1].trim() : String(n || '').trim() }
    raw.forEach((e) => {
      if (e.cat) catUnits[e.cat] = (catUnits[e.cat] || 0) + 1
      if (e.mgr) mgrs.add(e.mgr)
      if (missingLabels(e).length) { missUnits++; if (e.name) missTypes.add(baseOf(e.name)) }
    })
    return { catUnits, mgrCount: mgrs.size, missUnits, missTypes: missTypes.size }
  }, [raw])

  const dominant = useMemo(() => {
    let best: EqStateKey = '도입예정', bestN = -1
    STATE_ORDER.forEach((s) => { if (c.units[s] > bestN) { bestN = c.units[s]; best = s } })
    return best
  }, [c])

  // ── 필터 ──
  const catOpts = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.cat).filter(Boolean))]], [groups])
  const mgrOpts = useMemo(() => ['전체', ...[...new Set(groups.map((g) => g.mgr).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))], [groups])
  const stateOpts = useMemo(() => ['전체', ...STATE_ORDER.filter((s) => groups.some((g) => eqStateKey(g.state) === s))], [groups])

  const listed = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups.filter((g) => {
      if (stateF !== '전체' && eqStateKey(g.state) !== stateF) return false
      if (catF !== '전체' && g.cat !== catF) return false
      if (mgrF !== '전체' && (g.mgr || '') !== mgrF) return false
      if (missingOnly && missingLabels(g).length === 0) return false
      if (q && !`${g.name} ${g.codes.join(' ')} ${g.mgr} ${g.maker} ${g.model} ${g.variantNames.join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [groups, stateF, catF, mgrF, missingOnly, query])

  // 헤더 정렬(검색·필터 적용된 결과 위에서 수행)
  const sort = useTableSort<OpsCol>()
  const sorted = useMemo(() => sortRows(listed, sort.col, sort.dir, opsAccessor), [listed, sort.col, sort.dir])

  return (
    <PageContainer>
      <PageHeader
        icon={<MonitorIcon />}
        title="장비 관리"
        subtitle="장비 총괄 — 자산정보·운영상태·이력"
        updatedAt={error ? '연결 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: iconSize.header }} />
          </IconButton>
        }
      />

      <EquipmentTabs />

      {/* 요약 3카드 */}
      <Box className="eq-strip" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1.4fr 1fr 1fr' }, gap: 1, mb: 2 }}>
        <AppCard padding={16}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>전체 장비</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{c.total}<Box component="span" sx={{ fontSize: 11, color: 'text.disabled', fontWeight: 600, ml: 0.5 }}>대 · {c.types}종</Box></Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.25, flexWrap: 'wrap', color: 'text.disabled', fontSize: 11 }}>
            {Object.entries(overview.catUnits).map(([cat, n]) => (
              <span key={cat}>{cat} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>{n}</Box></span>
            ))}
            <span>담당자 <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>{overview.mgrCount}명</Box></span>
          </Box>
        </AppCard>

        <AppCard padding={16}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>운영 상태</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{c.units[dominant]}<Box component="span" sx={{ fontSize: 11, color: 'text.disabled', fontWeight: 600, ml: 0.5 }}>대 {EQ_STATE[dominant].label}</Box></Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1.25, flexWrap: 'wrap', color: 'text.disabled', fontSize: 11 }}>
            {STATE_ORDER.filter((s) => s !== dominant && c.units[s] > 0).map((s) => (
              <span key={s}>{EQ_STATE[s].label} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700 }}>{c.units[s]}</Box></span>
            ))}
          </Box>
        </AppCard>

        <AppCard padding={16} sx={{ borderColor: overview.missTypes ? 'warning.main' : undefined }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>필수정보 누락</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: overview.missTypes ? 'warning.main' : 'text.primary' }}>
            {overview.missTypes}<Box component="span" sx={{ fontSize: 11, color: 'text.disabled', fontWeight: 600, ml: 0.5 }}>종 · {overview.missUnits}대</Box>
          </Typography>
          <Typography sx={{ mt: 1.25, fontSize: 11, color: 'warning.main' }}>제조사·모델명·설치장소·NFEC 확인 필요</Typography>
        </AppCard>
      </Box>

      {/* 장비대장 */}
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
        <Box className="eq-wshead" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>장비대장 <Box component="span" sx={{ fontSize: 11, color: 'text.disabled', fontWeight: 500 }}>전체 {c.types}종 · {c.total}대</Box></Typography>
          <Box className="eq-filters" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Select value={stateF} onChange={setStateF} ariaLabel="운영상태"
              options={stateOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 상태' : (EQ_STATE[o as EqStateKey]?.label || o) }))} />
            <Select value={catF} onChange={setCatF} ariaLabel="분류"
              options={catOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 분류' : o }))} />
            <Select value={mgrF} onChange={setMgrF} ariaLabel="담당자"
              options={mgrOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 담당자' : o }))} />
            <SearchBar value={query} onChange={setQuery} placeholder="장비명·관리번호·제조사 검색" width={220} />
            <Button size="small" variant={missingOnly ? 'contained' : 'outlined'} onClick={() => setMissingOnly((m) => !m)} sx={{ flexShrink: 0, py: 0.4, fontSize: 13, color: missingOnly ? undefined : 'text.secondary', borderColor: 'divider' }}>
              누락정보만
            </Button>
          </Box>
        </Box>

        {listed.length === 0 ? (
          <EmptyState size="sm" title="조건에 맞는 장비가 없습니다" />
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" className="eq-ledger" sx={{ width: '100%', minWidth: 880 }}>
              <Box component="thead">
                <Box component="tr">
                  {OPS_COLS.map((col) => (
                    <SortTh key={col.key} label={col.label} colKey={col.key} active={sort.col === col.key} dir={sort.dir} onSort={(c) => sort.onSort(c as OpsCol)} />
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {sorted.map((g, idx) => {
                  const meta = EQ_STATE[eqStateKey(g.state)]
                  const miss = missingLabels(g)
                  const req = isRegRequired(g.state)
                  return (
                    <Box component="tr" key={g.repCode || g.name + idx} onClick={() => setPicked(g)} sx={{ cursor: 'pointer' }}>
                      <Box component="td" className="lg-code">{codeRange(g)}</Box>
                      <Box component="td" className="lg-primary">
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                          <NameWithQty name={g.name} count={g.count} fontSize={12} />
                          {g.variantNames.length ? <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400, fontSize: 11, whiteSpace: 'nowrap' }}>{g.variantNames.join('/')}</Box> : null}
                        </Box>
                      </Box>
                      <Box component="td">{g.cat || '-'}</Box>
                      <Box component="td">{g.mgr || '-'}</Box>
                      <Box component="td"><StatusChip status={meta.status} label={meta.label} /></Box>
                      <Box component="td" sx={{ color: g.installLoc ? 'text.secondary' : req ? 'warning.main' : 'text.disabled' }}>{g.installLoc || '미등록'}</Box>
                      <Box component="td">
                        {miss.length === 0 ? (
                          <Box component="span" sx={{ color: 'text.disabled' }}>{req ? '없음' : '—'}</Box>
                        ) : (
                          <Box className="lg-miss">
                            {miss.slice(0, 2).map((m) => (
                              <Box component="span" key={m} className="lg-chip" sx={{ color: 'warning.main', borderColor: (t) => t.palette.warning.main + '66' }}>{m}</Box>
                            ))}
                            {miss.length > 2 && <Box component="span" sx={{ color: 'text.disabled', fontSize: 11 }}>+{miss.length - 2}</Box>}
                          </Box>
                        )}
                      </Box>
                      <Box component="td" sx={{ color: 'text.disabled' }}>-</Box>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      <EqDetailDrawer
        group={picked}
        onClose={() => setPicked(null)}
        isAdmin={isAdmin}
        user={user}
        authKey={authKey}
        onSaved={handleSaved}
        showSnack={showSnack}
      />

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </PageContainer>
  )
}
