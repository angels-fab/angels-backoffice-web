import { useMemo, useState } from 'react'
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
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { updateImprovement } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue, fmtDate } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import { IMP_STATUSES, impKind, needsReason, remarkOf } from './improveMeta'
import type { ImpStatus } from './improveMeta'
import ImproveWrite from './ImproveWrite'

const kindColor = (t: Theme, kind: StatusKind) =>
  kind === 'success' ? t.palette.accent.green
    : kind === 'info' ? t.palette.accent.blue
      : kind === 'warning' ? t.palette.accent.amber
        : kind === 'error' ? t.palette.accent.red
          : t.palette.text.secondary

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info' }
type ReasonEdit = { row: ImprovementItem; status: string; value: string }

export default function Improve() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector((s) => s.improve)
  const { isAdmin, user, authKey } = useRole()

  const [selected, setSelected] = useState<Set<ImpStatus>>(new Set(['접수중'])) // 필터(비었으면 전체)
  const [expanded, setExpanded] = useState<number | null>(null) // 아코디언
  const [writeOpen, setWriteOpen] = useState(false)
  const [reasonEdit, setReasonEdit] = useState<ReasonEdit | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const showSnack = (msg: string, severity: Snack['severity'] = 'success') => setSnack({ open: true, msg, severity })

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of items) c[(t.status || '').trim()] = (c[(t.status || '').trim()] || 0) + 1
    return c
  }, [items])

  const listed = useMemo(() => {
    const base = selected.size === 0 ? items : items.filter((t) => selected.has((t.status || '').trim() as ImpStatus))
    return [...base].sort((a, b) => dateSortValue(b.date) - dateSortValue(a.date) || (Number(b.num) || 0) - (Number(a.num) || 0))
  }, [items, selected])

  const typeOptions = useMemo(() => [...new Set(items.map((t) => t.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [items])
  const locOptions = useMemo(() => [...new Set(items.map((t) => t.loc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [items])

  // 탭: 일반 클릭 = 단일 선택(다시 누르면 전체) / Shift+클릭 = 중복 토글
  const onTab = (s: ImpStatus, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift) {
        if (next.has(s)) next.delete(s)
        else next.add(s)
        return next
      }
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
      setReasonEdit(null)
      showSnack('상태를 변경했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSavingId(null)
      showSnack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }

  const onStatusChange = (row: ImprovementItem, status: string) => {
    if (status === (row.status || '').trim()) return
    if (needsReason(status)) setReasonEdit({ row, status, value: row.reason || '' }) // 비고 인라인 사유 입력
    else void saveStatus(row, status, '')
  }

  const commitReason = () => {
    if (!reasonEdit) return
    if (!reasonEdit.value.trim()) return showSnack('사유를 입력해주세요.', 'error')
    void saveStatus(reasonEdit.row, reasonEdit.status, reasonEdit.value.trim())
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <PageContainer>
      <PageHeader
        icon={<LightbulbOutlinedIcon />}
        title="개선제안"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setWriteOpen(true)}>제안 등록</Button>
            )}
            <IconButton aria-label="새로고침" onClick={() => dispatch(loadImproveData())} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      <ContentSection last>
        {/* 상태 필터 탭 (전체 탭 없음 · 기본 접수중 · 재클릭=전체 · Shift=중복) */}
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

        {listed.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="해당 개선제안이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0} sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& td, & th': { borderColor: 'divider', whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow sx={{ '& th': { textAlign: 'center', color: 'text.secondary', fontWeight: 600, fontSize: 12.5 } }}>
                  <TableCell>번호</TableCell>
                  <TableCell>유형</TableCell>
                  <TableCell>개선위치</TableCell>
                  <TableCell sx={{ textAlign: 'left !important' }}>제목</TableCell>
                  <TableCell>작성자</TableCell>
                  <TableCell>제안일자</TableCell>
                  <TableCell>담당자</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell sx={{ textAlign: 'left !important' }}>비고</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listed.map((t) => {
                  const open = expanded === t.id
                  const rm = remarkOf(t)
                  const editing = reasonEdit?.row.id === t.id
                  const stUI = editing ? reasonEdit!.status : (t.status || '').trim()
                  const manage = canManage(t)
                  return [
                    <TableRow
                      key={`${t.id}-r`}
                      hover
                      onClick={() => setExpanded(open ? null : t.id)}
                      sx={{ cursor: 'pointer', '& td': { textAlign: 'center', fontSize: 12.5 } }}
                    >
                      <TableCell sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{t.num}</TableCell>
                      <TableCell>{t.type || '-'}</TableCell>
                      <TableCell>{t.loc || '-'}</TableCell>
                      <TableCell sx={{ textAlign: 'left !important' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'normal' }}>
                          {t.urgent && (
                            <Tooltip title="긴급"><PriorityHighIcon sx={{ fontSize: 18, color: 'error.main', flexShrink: 0 }} /></Tooltip>
                          )}
                          <Box component="span" sx={{ fontWeight: 500, color: 'text.primary' }}>{t.title}</Box>
                          {t.link && (
                            <IconButton component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련자료" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                              <OpenInNewIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>{t.author || '-'}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{fmtDate(t.date)}</TableCell>
                      <TableCell>{t.mgr || '-'}</TableCell>
                      <TableCell onClick={stop} sx={{ cursor: 'default' }}>
                        {manage ? (
                          <Select
                            value={stUI}
                            onChange={(e) => onStatusChange(t, e.target.value)}
                            disabled={savingId === t.id}
                            variant="standard"
                            disableUnderline
                            renderValue={(v) => <StatusChip status={impKind(v)} label={v} />}
                            sx={{ '& .MuiSelect-select': { p: 0, pr: '18px !important' } }}
                          >
                            {IMP_STATUSES.map((s) => (
                              <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
                            ))}
                          </Select>
                        ) : (
                          <StatusChip status={impKind(stUI)} label={stUI || '-'} />
                        )}
                      </TableCell>
                      <TableCell onClick={editing ? stop : undefined} sx={{ textAlign: 'left !important' }}>
                        {editing ? (
                          <InputBase
                            autoFocus
                            value={reasonEdit!.value}
                            onChange={(e) => setReasonEdit({ ...reasonEdit!, value: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitReason() } else if (e.key === 'Escape') setReasonEdit(null) }}
                            placeholder={`${reasonEdit!.status} 사유 입력 후 Enter`}
                            disabled={savingId === t.id}
                            sx={(th) => ({ bgcolor: alpha(th.palette.text.primary, 0.05), border: '1px solid', borderColor: th.palette.divider, borderRadius: '6px', px: 1, py: 0.25, fontSize: 12.5, minWidth: 180 })}
                          />
                        ) : rm.kind === 'date' ? (
                          <Box component="span" sx={{ color: 'info.main', fontVariantNumeric: 'tabular-nums' }}>완료 {fmtDate(rm.text)}</Box>
                        ) : rm.kind === 'reason' ? (
                          <Box
                            component="span"
                            onClick={manage ? (e) => { stop(e); setReasonEdit({ row: t, status: (t.status || '').trim(), value: t.reason || '' }) } : undefined}
                            sx={{ color: 'text.secondary', whiteSpace: 'normal', cursor: manage ? 'text' : 'default' }}
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
                        <TableCell colSpan={9} sx={{ bgcolor: (th) => alpha(th.palette.text.primary, 0.03) }}>
                          <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.secondary', lineHeight: 1.7, py: 0.5, px: 1 }}>
                            {t.content || '내용 없음'}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ]
                })}
              </TableBody>
            </Table>
          </AppCard>
        )}
      </ContentSection>

      {isAdmin && (
        <ImproveWrite
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onSaved={() => { setWriteOpen(false); showSnack('개선제안을 등록했습니다.', 'success'); dispatch(loadImproveData()) }}
          typeOptions={typeOptions}
          locOptions={locOptions}
        />
      )}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
