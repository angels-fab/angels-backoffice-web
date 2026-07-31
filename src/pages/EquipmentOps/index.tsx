import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material/styles'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import MonitorIcon from '@mui/icons-material/Monitor'
import RefreshIcon from '@mui/icons-material/Refresh'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { PageContainer, PageHeader, AppCard, StatusChip, EmptyState, ErrorBanner, LoadingState, Select, SearchBar, dataTableSx } from '@/components/ds'
import { iconSize, radius, control, typescale } from '@/theme/tokens'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import { useRole } from '@/auth/role'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'
import EqDetailDrawer from './EqDetailDrawer'
import EquipmentTabs from '@/pages/Equipment/EquipmentTabs'
import { NameWithQty, codeRange, missingLabels, isRegRequired } from '@/pages/Equipment/batchUtil'
import { useTableSort, sortRows, SortHeadCell } from '@/pages/Equipment/sortable'

const STATE_ORDER: EqStateKey[] = ['운영중', '도입중', '도입예정', '비가동', '미분류']

// 장비대장 정렬 열 — 관리번호·장비명·분류·담당자·운영상태·설치장소·누락정보·최근이력
type OpsCol = 'code' | 'name' | 'cat' | 'mgr' | 'state' | 'installLoc' | 'missing' | 'recent'
/**
 * 열 정렬 규칙(2026-07-13 확정, 2026-08-01 재확인):
 * 긴 본문성 텍스트 = 좌측 / 짧은 값·칩·코드 = 가운데 / 숫자·금액 = 우측.
 * 여기선 장비명만 좌측이고 나머지는 전부 짧은 값이라 가운데.
 */
const OPS_COLS: { key: OpsCol; label: string; align: 'left' | 'center' | 'right' }[] = [
  // 관리번호는 좌측 — 'AN-001 외 1'처럼 뒤에 건수가 붙는 행이 섞여 있어, 가운데로 두면
  // 코드 자릿수가 행마다 어긋나 한 번에 안 읽힌다(사용자 지적 2026-08-01).
  { key: 'code', label: '관리번호', align: 'left' }, { key: 'name', label: '장비명', align: 'left' },
  { key: 'cat', label: '분류', align: 'center' }, { key: 'mgr', label: '담당자', align: 'center' },
  { key: 'state', label: '운영상태', align: 'center' }, { key: 'installLoc', label: '설치장소', align: 'center' },
  { key: 'missing', label: '누락정보', align: 'center' }, { key: 'recent', label: '최근 이력', align: 'center' },
]
/**
 * 구 `.eq-ledger .lg-code` / `.lg-primary`(index.css)를 sx로 옮긴 값 — 화면값 그대로 보존.
 *
 * ★ 사다리 구멍: 굵기 500이 typescale 에 없다(400 → 600으로 건너뛴다). 그런데 '행 식별자'의
 *   실화면 값은 5표 모두 14/500이고(공지 제목 Notice/index.tsx:265 포함), 사다리의
 *   emphasis 는 14/600이라 문서와 화면이 어긋나 있다. 여기서 임의로 600으로 올리면
 *   다른 표와 어긋나므로 500을 유지하고, 사다리 정정은 별건으로 남긴다.
 */
const codeCellSx = { color: 'text.secondary', fontFamily: '"IBM Plex Mono", ui-monospace, monospace', fontWeight: 500, whiteSpace: 'nowrap' } as const
const nameCellSx = { color: 'text.primary', fontWeight: 500, fontSize: typescale.emphasis.size, whiteSpace: 'nowrap' } as const

/**
 * 모바일(≤768) 표 → 세로 카드 변환.
 *
 * 레거시 .rtable(index.css)과 같은 결과를 sx로 구현한 것 — className 을 새로 늘리지 않기 위해서다
 * (레거시 CSS 의존을 걷어내는 중이고, className 은 design-lint 위반 항목이기도 하다).
 * 열 이름은 ::before content:attr() 대신 실제 <span>으로 렌더한다(OpsCell) — emotion 의
 * content 처리에 기대지 않아 결과가 확정적이다.
 */
const mobileCardSx = (th: Theme) => ({
  [th.breakpoints.down('shell')]: {
    display: 'block',
    minWidth: 0,
    '& thead': { display: 'none' },
    '& tbody': { display: 'block' },
    '& tbody tr': {
      display: 'flex', flexDirection: 'column', gap: '5px',
      bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      borderRadius: `${radius.card}px`, p: '11px 14px', mb: '10px',
    },
    '& tbody td': {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px',
      border: 0, p: '2px 0', textAlign: 'left', whiteSpace: 'normal',
    },
    // 대표 셀(장비명)은 카드 제목처럼 맨 위로
    '& tbody td[data-title="1"]': {
      order: -1, justifyContent: 'flex-start', gap: '6px',
      fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight,
      p: '0 0 6px 0', mb: '3px', borderBottom: '1px solid', borderColor: 'divider',
    },
  },
})

/** 표 셀 + 모바일 카드용 열 이름. 데스크톱에선 열 이름이 숨겨져 지금과 동일하게 보인다. */
function OpsCell({ label, align = 'center', title, sx, children }: {
  label?: string
  align?: 'left' | 'center' | 'right'
  /** 대표 셀(카드 제목이 되는 열) */
  title?: boolean
  sx?: SxProps<Theme>
  children: ReactNode
}) {
  return (
    <TableCell align={align} data-title={title ? '1' : undefined} sx={sx}>
      {label && (
        <Box
          component="span"
          sx={(th) => ({
            display: 'none', flex: 'none', color: 'text.disabled',
            fontWeight: typescale.emphasis.weight, fontSize: typescale.caption.size,
            [th.breakpoints.down('shell')]: { display: 'inline' },
          })}
        >
          {label}
        </Box>
      )}
      {children}
    </TableCell>
  )
}
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
  const { raw, groups, loading, error } = useAppSelector((s) => s.eq)
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

  // 실패 상태로 페이지 진입 시 자동 재시도(마운트 1회) — 잠깐 끊겼던 거면 사용자가 아무것도 안 해도 복구됨
  useEffect(() => {
    if (error && !loading) dispatch(loadEqData())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        title="장비관리"
        updatedAt={error ? '연결 실패' : undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadEqData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: iconSize.header }} />
          </IconButton>
        }
      />

      {/* 불러오기 실패 — 빈 목록을 '장비 없음'으로 오해하지 않게 정직하게 알리고 재시도 제공(백로그 B2·C2).
          기존 목록이 남아 있으면 경고(갱신만 실패), 아예 없으면 오류. */}
      {error && (
        <ErrorBanner
          severity={raw.length > 0 ? 'warning' : 'error'}
          message={
            raw.length > 0
              ? '장비 정보 새로고침에 실패했습니다. 마지막으로 불러온 목록을 표시 중입니다.'
              : '장비 정보를 불러오지 못했습니다.'
          }
          onRetry={() => dispatch(loadEqData())}
        />
      )}

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
            <Button size="small" variant={missingOnly ? 'contained' : 'outlined'} onClick={() => setMissingOnly((m) => !m)} sx={{ flexShrink: 0, py: 0.4, fontSize: 13, minHeight: control.height, color: missingOnly ? undefined : 'text.secondary', borderColor: 'divider' }}>
              누락정보만
            </Button>
          </Box>
        </Box>

        {loading && listed.length === 0 ? (
          /* 첫 로딩 — 빈 상태 문구('없습니다')가 먼저 뜨지 않게 로딩을 우선 렌더.
             이미 목록이 있는 새로고침 중에는 기존 표를 유지한다. */
          <LoadingState label="장비를 불러오는 중…" />
        ) : listed.length === 0 ? (
          <EmptyState size="sm" title="조건에 맞는 장비가 없습니다" />
        ) : (
          /* 레거시 .eq-ledger → MUI Table 이관(2026-08-01 파일럿).
             셀 여백·글자·헤더 룩은 theme MuiTableCell 정본이 담당하므로 여기선 선언하지 않는다.
             정렬은 셀 align prop 으로만 — 표·행 레벨 '& th' sx 는 특이도로 셀 선언을 죽인다. */
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={(th) => ({ ...dataTableSx, minWidth: 880, ...mobileCardSx(th) })}>
              <TableHead>
                <TableRow>
                  {OPS_COLS.map((col) => (
                    <SortHeadCell key={col.key} label={col.label} colKey={col.key} align={col.align} active={sort.col === col.key} dir={sort.dir} onSort={(c) => sort.onSort(c as OpsCol)} />
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((g, idx) => {
                  const meta = EQ_STATE[eqStateKey(g.state)]
                  const miss = missingLabels(g)
                  const req = isRegRequired(g.state)
                  return (
                    <TableRow hover key={g.repCode || g.name + idx} onClick={() => setPicked(g)} sx={{ cursor: 'pointer' }}>
                      <OpsCell label="관리번호" align="left" sx={codeCellSx}>{codeRange(g)}</OpsCell>
                      <OpsCell align="left" title sx={nameCellSx}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                          <NameWithQty name={g.name} count={g.count} fontSize={14} />
                          {/* 변형명 부제 — 장비도입 표(Equipment/index.tsx)와 같은 열·같은 역할이라 값도 같게(12/보조톤) */}
                          {g.variantNames.length ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, fontSize: typescale.small.size, whiteSpace: 'nowrap' }}>{g.variantNames.join('/')}</Box> : null}
                        </Box>
                      </OpsCell>
                      <OpsCell label="분류">{g.cat || '-'}</OpsCell>
                      <OpsCell label="담당자">{g.mgr || '-'}</OpsCell>
                      <OpsCell label="운영상태"><StatusChip status={meta.status} label={meta.label} /></OpsCell>
                      <OpsCell label="설치장소" sx={{ color: g.installLoc ? 'text.secondary' : req ? 'warning.main' : 'text.disabled' }}>{g.installLoc || '미등록'}</OpsCell>
                      <OpsCell label="누락정보">
                        {miss.length === 0 ? (
                          <Box component="span" sx={{ color: 'text.disabled' }}>{req ? '없음' : '—'}</Box>
                        ) : (
                          <Box className="lg-miss" sx={{ justifyContent: 'center' }}>
                            {miss.slice(0, 2).map((m) => (
                              <Box component="span" key={m} className="lg-chip" sx={{ color: 'warning.main', borderColor: (t) => t.palette.warning.main + '66' }}>{m}</Box>
                            ))}
                            {miss.length > 2 && <Box component="span" sx={{ color: 'text.disabled', fontSize: typescale.caption.size }}>+{miss.length - 2}</Box>}
                          </Box>
                        )}
                      </OpsCell>
                      <OpsCell label="최근 이력" sx={{ color: 'text.disabled' }}>-</OpsCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
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
