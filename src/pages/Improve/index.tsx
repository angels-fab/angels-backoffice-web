import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputBase from '@mui/material/InputBase'
import Popover from '@mui/material/Popover'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { updateImprovement, createImprovement, fetchAuthors } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue, fmtDate } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import { IMP_STATUSES, IMP_TYPE_OPTIONS, impKind, needsReason, remarkOf, normStatus } from './improveMeta'
import type { ImpStatus } from './improveMeta'

const MGR_FALLBACK = ['센터', '신현진', '박주봉', '박세리', '조성범']
const TITLE_W = 320 // 새 제안 제목·개선내용 공통 너비

const kindColor = (t: Theme, kind: StatusKind) =>
  kind === 'success' ? t.palette.accent.green
    : kind === 'info' ? t.palette.accent.blue
      : kind === 'warning' ? t.palette.accent.amber
        : kind === 'error' ? t.palette.accent.red
          : t.palette.text.secondary

const inputSx = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid', borderColor: th.palette.divider, borderRadius: '6px',
  px: 1, py: 0.4, fontSize: 12.5, color: 'text.primary',
  '&.Mui-focused': { borderColor: th.palette.accent.green },
  '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info' }
type ReasonDlg = { row: ImprovementItem; status: string; value: string }

// 관련자료 — 박스 없는 아이콘 + 입력 팝업 (값 있으면 파랑)
function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = !!value.trim()
  return (
    <>
      <Tooltip title={active ? '관련자료 편집' : '관련자료 추가'}>
        <IconButton size="small" aria-label="관련자료" onClick={(e) => setAnchor(e.currentTarget)} sx={(th) => ({ color: active ? th.palette.accent.blue : 'text.disabled', p: 0.5 })}>
          <OpenInNewIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', mt: 0.5 } } }}>
        <Box sx={{ p: 1.5, width: 280 }}>
          <Box sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>관련자료 링크</Box>
          <InputBase autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" inputProps={{ 'aria-label': '관련자료 링크' }} sx={(th) => ({ ...inputSx(th), width: '100%', py: 0.5 })} />
        </Box>
      </Popover>
    </>
  )
}

export default function Improve() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector((s) => s.improve)
  const { isAdmin, user, authKey } = useRole()

  const [selected, setSelected] = useState<Set<ImpStatus>>(new Set()) // 비었으면 전체
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [reasonDlg, setReasonDlg] = useState<ReasonDlg | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  // 새 제안 인라인 작성
  const [composing, setComposing] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [cUrgent, setCUrgent] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cLoc, setCLoc] = useState('')
  const [cType, setCType] = useState('')
  const [cMgr, setCMgr] = useState('')
  const [cLink, setCLink] = useState('')
  const [cContent, setCContent] = useState('')
  const [authors, setAuthors] = useState<string[] | null>(null)

  useEffect(() => {
    fetchAuthors().then(setAuthors).catch(() => setAuthors(null))
  }, [])

  const showSnack = (msg: string, severity: Snack['severity'] = 'success') => setSnack({ open: true, msg, severity })

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of items) { const s = normStatus(t.status); c[s] = (c[s] || 0) + 1 }
    return c
  }, [items])

  const listed = useMemo(() => {
    const base = selected.size === 0 ? items : items.filter((t) => selected.has(normStatus(t.status) as ImpStatus))
    return [...base].sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.num) || 0) - (Number(a.num) || 0))
  }, [items, selected])

  const typeOptions = useMemo(() => [...new Set([...IMP_TYPE_OPTIONS, ...items.map((t) => t.type).filter(Boolean)])], [items])
  const locOptions = useMemo(() => [...new Set(items.map((t) => t.loc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [items])
  const mgrOptions = authors && authors.length ? authors : MGR_FALLBACK

  const onTab = (s: ImpStatus, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift) { next.has(s) ? next.delete(s) : next.add(s); return next }
      if (next.size === 1 && next.has(s)) return new Set()
      return new Set([s])
    })
  }

  const canManage = (t: ImprovementItem) => isAdmin && !!user && user === (t.mgr || '').trim()

  const saveStatus = async (row: ImprovementItem, status: string, reason: string) => {
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    setSavingId(row.id)
    try {
      await updateImprovement({ author: user, key: authKey, num: row.num, status, reason })
      setSavingId(null)
      setReasonDlg(null)
      showSnack('상태를 변경했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSavingId(null)
      showSnack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }

  const onStatusChange = (row: ImprovementItem, status: string) => {
    if (status === normStatus(row.status)) return
    if (needsReason(status)) setReasonDlg({ row, status, value: row.reason || '' }) // 사유 팝업
    else void saveStatus(row, status, '')
  }

  const commitReason = () => {
    if (!reasonDlg) return
    if (!reasonDlg.value.trim()) return showSnack('사유를 입력해주세요.', 'error')
    void saveStatus(reasonDlg.row, reasonDlg.status, reasonDlg.value.trim())
  }

  const startCompose = () => {
    setCUrgent(false); setCTitle(''); setCLoc(''); setCType(''); setCMgr(user || ''); setCLink(''); setCContent('')
    setComposing(true)
  }

  const handleSaveNew = async () => {
    if (savingNew) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!cTitle.trim()) return showSnack('제목을 입력해주세요.', 'error')
    if (!cMgr.trim()) return showSnack('담당자를 선택해주세요.', 'error')
    setSavingNew(true)
    try {
      await createImprovement({ author: user, key: authKey, urgent: cUrgent, type: cType.trim(), loc: cLoc.trim(), title: cTitle.trim(), content: cContent.trim(), mgr: cMgr.trim(), link: cLink.trim() })
      setSavingNew(false)
      setComposing(false)
      showSnack('개선제안을 등록했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSavingNew(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <PageContainer>
      <PageHeader
        icon={<LightbulbOutlinedIcon />}
        title="개선제안"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={() => dispatch(loadImproveData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      <ContentSection last>
        {/* 상태 필터 탭 (전체 탭 없음 · 기본 전체 · 재클릭=전체 · Shift=중복) */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          {IMP_STATUSES.map((s) => {
            const on = selected.has(s)
            return (
              <Chip
                key={s}
                label={`${s} ${counts[s] || 0}`}
                onClick={(e) => onTab(s, (e as React.MouseEvent).shiftKey)}
                variant="outlined"
                sx={(t) => {
                  const c = kindColor(t, impKind(s))
                  return {
                    fontWeight: 500,
                    color: on ? t.palette.common.white : c,
                    bgcolor: on ? c : alpha(c, 0.12),
                    borderColor: on ? c : alpha(c, 0.32),
                    cursor: 'pointer',
                    '&:hover': { bgcolor: on ? c : alpha(c, 0.2) },
                  }
                }}
              />
            )
          })}
        </Box>

        <AppCard padding={0} sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& td, & th': { borderColor: 'divider', whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow sx={{ '& th': { textAlign: 'center', color: 'text.secondary', fontWeight: 600, fontSize: 12.5 } }}>
                <TableCell sx={{ width: '1%' }}>번호</TableCell>
                <TableCell sx={{ width: '100%' }}>제목</TableCell>
                <TableCell sx={{ width: '1%' }}>개선위치</TableCell>
                <TableCell sx={{ width: '1%' }}>유형</TableCell>
                <TableCell sx={{ width: '1%' }}>작성자</TableCell>
                <TableCell sx={{ width: '1%' }}>제안일자</TableCell>
                <TableCell sx={{ width: '1%' }}>담당자</TableCell>
                <TableCell sx={{ width: '1%' }}>상태</TableCell>
                <TableCell sx={{ width: '1%' }}>비고</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>해당 개선제안이 없습니다</TableCell>
                </TableRow>
              )}
              {listed.map((t) => {
                const open = expanded.has(t.id)
                const rm = remarkOf(t)
                const st = normStatus(t.status)
                const manage = canManage(t)
                return [
                  <TableRow
                    key={`${t.id}-r`}
                    hover
                    onClick={() => setExpanded((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
                    sx={{ cursor: 'pointer', '& td': { textAlign: 'center', fontSize: 12.5 } }}
                  >
                    <TableCell sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{t.num}</TableCell>
                    <TableCell sx={{ textAlign: 'left !important', whiteSpace: 'normal' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {t.urgent && <Tooltip title="긴급"><PriorityHighIcon sx={{ fontSize: 18, color: 'error.main', flexShrink: 0 }} /></Tooltip>}
                        <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{t.title}</Box>
                        {t.link && (
                          <IconButton component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련자료" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                            <OpenInNewIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>{t.loc || '-'}</TableCell>
                    <TableCell>{t.type || '-'}</TableCell>
                    <TableCell>{t.author || '-'}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{fmtDate(t.date)}</TableCell>
                    <TableCell>{t.mgr || '-'}</TableCell>
                    <TableCell onClick={stop} sx={{ cursor: manage ? 'default' : 'not-allowed' }}>
                      {manage ? (
                        <Select
                          value={st}
                          onChange={(e) => onStatusChange(t, e.target.value)}
                          disabled={savingId === t.id}
                          variant="standard"
                          disableUnderline
                          IconComponent={() => null}
                          renderValue={(v) => <StatusChip status={impKind(v)} label={v} />}
                          sx={{ '& .MuiSelect-select': { p: 0, pr: '0 !important' } }}
                        >
                          {IMP_STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>)}
                        </Select>
                      ) : (
                        <Box component="span" sx={{ cursor: 'not-allowed' }}><StatusChip status={impKind(st)} label={st || '-'} /></Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ textAlign: 'left !important' }}>
                      {rm.kind === 'date' ? (
                        <Box component="span" sx={{ color: 'info.main', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(rm.text)}</Box>
                      ) : rm.kind === 'reason' ? (
                        <Box
                          component="span"
                          onClick={manage ? (e) => { stop(e); setReasonDlg({ row: t, status: st, value: t.reason || '' }) } : undefined}
                          sx={{ color: 'text.secondary', whiteSpace: 'normal', cursor: manage ? 'pointer' : 'default' }}
                        >
                          {rm.text || (manage ? '사유 입력' : '-')}
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
                      )}
                    </TableCell>
                  </TableRow>,
                  open ? (
                    <TableRow key={`${t.id}-a`} sx={{ '& td': { borderTop: 0 } }}>
                      <TableCell />
                      <TableCell colSpan={8} sx={{ bgcolor: (th) => alpha(th.palette.text.primary, 0.03), textAlign: 'left' }}>
                        <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.secondary', lineHeight: 1.7, py: 0.5 }}>{t.content || '내용 없음'}</Box>
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })}

              {/* 새 제안 인라인 작성 행 (긴급 토글은 번호 열 위치) */}
              {isAdmin && composing && (
                <TableRow sx={{ '& td': { bgcolor: (th) => alpha(th.palette.accent.green, 0.06) } }}>
                  <TableCell sx={{ verticalAlign: 'top', textAlign: 'center', pt: 1.5 }}>
                    <Tooltip title={cUrgent ? '긴급 해제' : '긴급'}>
                      <IconButton
                        aria-label="긴급"
                        onClick={() => setCUrgent((v) => !v)}
                        sx={(th) => ({
                          width: 30, height: 30, borderRadius: '6px', border: '1px solid',
                          ...(cUrgent
                            ? { borderColor: th.palette.accent.red, bgcolor: alpha(th.palette.accent.red, 0.16), color: th.palette.accent.red }
                            : { borderColor: th.palette.divider, color: 'text.disabled' }),
                        })}
                      >
                        <PriorityHighIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell colSpan={8} sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
                    {/* 취소·저장 우측 상단 */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
                      <Button size="small" color="error" onClick={() => setComposing(false)} disabled={savingNew}>취소</Button>
                      <Button size="small" variant="contained" color="success" onClick={handleSaveNew} disabled={savingNew}>{savingNew ? '저장 중…' : '저장'}</Button>
                    </Box>
                    {/* 제목(좌측 정렬·게시글 제목칸과 시작 일치) + 개선위치·유형·담당자·관련자료 */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                      <InputBase value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="제목" inputProps={{ 'aria-label': '제목' }} sx={(th) => ({ ...inputSx(th), width: TITLE_W, maxWidth: '100%' })} />
                      <InputBase value={cLoc} onChange={(e) => setCLoc(e.target.value)} placeholder="개선위치" inputProps={{ 'aria-label': '개선위치', list: 'imp-locs' }} sx={(th) => ({ ...inputSx(th), width: 120 })} />
                      <InputBase value={cType} onChange={(e) => setCType(e.target.value)} placeholder="유형" inputProps={{ 'aria-label': '유형', list: 'imp-types' }} sx={(th) => ({ ...inputSx(th), width: 110 })} />
                      <Box
                        component="select"
                        value={cMgr}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCMgr(e.target.value)}
                        aria-label="담당자"
                        sx={(th) => ({ ...inputSx(th), width: 110, cursor: 'pointer', height: 30 })}
                      >
                        <option value="">담당자</option>
                        {mgrOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                      </Box>
                      <LinkField value={cLink} onChange={setCLink} />
                    </Box>
                    {/* 개선내용 — 제목폭과 동일, 높이 2배 */}
                    <Box sx={{ mt: 1 }}>
                      <InputBase value={cContent} onChange={(e) => setCContent(e.target.value)} placeholder="개선내용" inputProps={{ 'aria-label': '개선내용' }} multiline minRows={2} sx={(th) => ({ ...inputSx(th), width: TITLE_W, maxWidth: '100%', alignItems: 'flex-start' })} />
                    </Box>
                  </TableCell>
                </TableRow>
              )}

              {/* + 새 제안 (인라인 작성 토글) */}
              {isAdmin && !composing && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    onClick={startCompose}
                    sx={(th) => ({ textAlign: 'center', cursor: 'pointer', color: 'text.secondary', fontWeight: 500, py: 1.5, borderTop: `1px dashed ${th.palette.divider}`, '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.04), color: 'text.primary' } })}
                  >
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><AddIcon sx={{ fontSize: 18 }} /> 새 제안</Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </AppCard>
        <datalist id="imp-types">{typeOptions.map((o) => <option key={o} value={o} />)}</datalist>
        <datalist id="imp-locs">{locOptions.map((o) => <option key={o} value={o} />)}</datalist>
      </ContentSection>

      {/* 보류·불가 사유 입력 팝업 */}
      <Dialog open={!!reasonDlg} onClose={() => savingId === null && setReasonDlg(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>{reasonDlg?.status} 사유 입력</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth multiline minRows={3}
            value={reasonDlg?.value || ''}
            onChange={(e) => setReasonDlg((p) => (p ? { ...p, value: e.target.value } : p))}
            placeholder={reasonDlg ? `「${reasonDlg.row.title}」 ${reasonDlg.status} 사유를 입력해주세요.` : ''}
            disabled={savingId !== null}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="error" onClick={() => setReasonDlg(null)} disabled={savingId !== null}>취소</Button>
          <Button variant="contained" color="success" onClick={commitReason} disabled={savingId !== null}>{savingId !== null ? '저장 중…' : '저장'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
