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
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { updateImprovement, createImprovement, deleteImprovement } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { dateSortValue, fmtDate } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import { IMP_STATUSES, IMP_TYPE_OPTIONS, impKind, needsReason, remarkOf, normStatus } from './improveMeta'
import type { ImpStatus } from './improveMeta'

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

// 위치/유형 드롭다운 — 화살표 버튼, 클릭 시 시트 목록 표시 (선택만)
function DropField({ value, onChange, options, placeholder, width }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; width: number }) {
  return (
    <Select
      value={options.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      variant="standard"
      disableUnderline
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      renderValue={(v) => (v ? <span>{v}</span> : <Box component="span" sx={{ color: 'text.disabled' }}>{placeholder}</Box>)}
      sx={(th) => ({
        ...inputSx(th), width, maxWidth: '100%',
        '& .MuiSelect-select': { p: 0, pr: '20px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
    </Select>
  )
}

type ComposeData = { urgent: boolean; title: string; loc: string; type: string; link: string; content: string }

// 새 제안/수정 공용 작성 카드 — 자체 상태 보유. 제목줄 배경(또는 ▲) 클릭 시 접힘(onCancel).
function ComposeCard({ initial, locOptions, typeOptions, saving, editing, onCancel, onSave }: {
  initial?: ComposeData
  locOptions: string[]
  typeOptions: string[]
  saving: boolean
  editing?: boolean
  onCancel: () => void
  onSave: (d: ComposeData) => void
}) {
  const [urgent, setUrgent] = useState(initial?.urgent ?? false)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [loc, setLoc] = useState(initial?.loc ?? '')
  const [type, setType] = useState(initial?.type ?? '')
  const [link, setLink] = useState(initial?.link ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  return (
    <Box sx={(th) => ({ bgcolor: alpha(th.palette.accent.green, 0.06), border: '1px solid', borderColor: th.palette.divider, borderRadius: '10px', p: 1.5 })}>
      {/* 제목줄 — 배경/▲ 클릭 시 접힘. 입력 요소는 stopPropagation */}
      <Box onClick={onCancel} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, cursor: 'pointer' }}>
        <Tooltip title={urgent ? '긴급 해제' : '긴급'}>
          <Box
            role="checkbox" aria-checked={urgent} aria-label="긴급" tabIndex={0}
            onClick={(e) => { stop(e); setUrgent((v) => !v) }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUrgent((v) => !v) } }}
            sx={(th) => ({
              width: 18, height: 18, borderRadius: '4px', flexShrink: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, lineHeight: 1,
              border: '1px solid',
              ...(urgent
                ? { bgcolor: th.palette.accent.red, borderColor: th.palette.accent.red, color: '#fff' }
                : { borderColor: th.palette.divider, color: 'text.disabled', bgcolor: 'transparent' }),
            })}
          >!</Box>
        </Tooltip>
        <InputBase value={title} onClick={stop} onChange={(e) => setTitle(e.target.value)} placeholder="제목" inputProps={{ 'aria-label': '제목' }} sx={(th) => ({ ...inputSx(th), flex: 1 })} />
        <Tooltip title="접기">
          <IconButton size="small" aria-label="접기" onClick={(e) => { stop(e); onCancel() }} sx={{ color: 'text.secondary', flexShrink: 0 }}>
            <ExpandLessIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}><DropField value={loc} onChange={setLoc} options={locOptions} placeholder="개선위치" width={140} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}><DropField value={type} onChange={setType} options={typeOptions} placeholder="유형" width={140} /></Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.25 }}>
        <InputBase value={content} onChange={(e) => setContent(e.target.value)} placeholder="개선내용" inputProps={{ 'aria-label': '개선내용' }} multiline minRows={2} maxRows={6} sx={(th) => ({ ...inputSx(th), flex: 1 })} />
        <LinkField value={link} onChange={setLink} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
        <Button size="small" color="error" onClick={onCancel} disabled={saving}>취소</Button>
        <Button size="small" variant="contained" color="success" onClick={() => onSave({ urgent, title, loc, type, link, content })} disabled={saving}>{saving ? '저장 중…' : (editing ? '수정' : '저장')}</Button>
      </Box>
    </Box>
  )
}

export default function Improve() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt, locOptions: sheetLoc, typeOptions: sheetType } = useAppSelector((s) => s.improve)
  const { isAdmin, user, authKey } = useRole()

  const [selected, setSelected] = useState<Set<ImpStatus>>(new Set()) // 비었으면 전체
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [reasonDlg, setReasonDlg] = useState<ReasonDlg | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  // 새 제안(상단 카드) / 수정(아코디언 in-place) / 삭제 확인
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDlg, setDeleteDlg] = useState<ImprovementItem | null>(null)

  const showSnack = (msg: string, severity: Snack['severity'] = 'success') => setSnack({ open: true, msg, severity })

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of items) { const s = normStatus(t.status); c[s] = (c[s] || 0) + 1 }
    return c
  }, [items])

  // 필터 탭: 건수 0건 상태는 숨김(단, 현재 선택돼 있으면 토글 가능하도록 유지)
  const visibleStatuses = useMemo(
    () => IMP_STATUSES.filter((s) => (counts[s] || 0) > 0 || selected.has(s)),
    [counts, selected],
  )

  const listed = useMemo(() => {
    const base = selected.size === 0 ? items : items.filter((t) => selected.has(normStatus(t.status) as ImpStatus))
    // 번호 내림차순(높은 번호 → 낮은 번호). 번호 동일/결측 시 제안일자 최신 순으로 보조 정렬.
    return [...base].sort((a, b) => (Number(b.num) || 0) - (Number(a.num) || 0) || dateSortValue(b.date) - dateSortValue(a.date))
  }, [items, selected])

  // 위치/유형 드롭다운 — 시트 데이터 확인 목록 우선, 없으면 기존 데이터에서 추출
  const typeOptions = useMemo(() => (sheetType.length ? sheetType : [...new Set([...IMP_TYPE_OPTIONS, ...items.map((t) => t.type).filter(Boolean)])]), [items, sheetType])
  const locOptions = useMemo(() => (sheetLoc.length ? sheetLoc : [...new Set(items.map((t) => t.loc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))), [items, sheetLoc])

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

  const openNew = () => { setEditingId(null); setComposing(true) }
  const openEdit = (t: ImprovementItem) => {
    setComposing(false)
    setEditingId(t.id)
    setExpanded((prev) => { const n = new Set(prev); n.add(t.id); return n }) // 펼쳐진 상태로 편집
  }

  const handleCreate = async (d: ComposeData) => {
    if (saving) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!d.title.trim()) return showSnack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      await createImprovement({ author: user, key: authKey, urgent: d.urgent, type: d.type.trim(), loc: d.loc.trim(), title: d.title.trim(), content: d.content.trim(), mgr: user, link: d.link.trim() })
      setSaving(false); setComposing(false)
      showSnack('개선제안을 등록했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  const handleEdit = async (t: ImprovementItem, d: ComposeData) => {
    if (saving) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!d.title.trim()) return showSnack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      // 상태는 건드리지 않고 내용 필드만 수정(완료일자·사유 보존)
      await updateImprovement({ author: user, key: authKey, num: t.num, urgent: d.urgent, type: d.type.trim(), loc: d.loc.trim(), title: d.title.trim(), content: d.content.trim(), link: d.link.trim() })
      setSaving(false); setEditingId(null)
      showSnack('수정했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '수정 실패', 'error')
    }
  }

  const handleDelete = async () => {
    if (!deleteDlg) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    setSaving(true)
    try {
      await deleteImprovement({ author: user, key: authKey, num: deleteDlg.num })
      setSaving(false); setDeleteDlg(null)
      showSnack('삭제했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
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
        {/* 상태 필터 탭 (0건 상태 숨김 · 재클릭=전체 · Shift=중복) + 우측 Shift 안내 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            {visibleStatuses.map((s) => {
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
          {visibleStatuses.length > 1 && (
            <Box component="span" sx={{ fontSize: 11.5, color: 'text.disabled', whiteSpace: 'nowrap', ml: 'auto' }}>
              Shift+클릭으로 여러 상태 선택
            </Box>
          )}
        </Box>

        {/* 새 제안: 헤더와 목록 사이 — 평소엔 dashed 박스, 클릭 시 작성 카드 펼침 (수정 중엔 숨김) */}
        {isAdmin && editingId === null && (
          <Box sx={{ mb: 2 }}>
            {composing ? (
              <ComposeCard key="new" locOptions={locOptions} typeOptions={typeOptions} saving={saving} onCancel={() => setComposing(false)} onSave={handleCreate} />
            ) : (
              <Box
                role="button"
                tabIndex={0}
                aria-label="새 제안 작성"
                onClick={openNew}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openNew() } }}
                sx={(th) => ({
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                  border: `1.5px dashed ${th.palette.divider}`, borderRadius: '10px',
                  py: 1.25, cursor: 'pointer', color: 'text.secondary', fontWeight: 500, fontSize: 13,
                  '&:hover': { borderColor: th.palette.accent.green, color: th.palette.accent.green, bgcolor: alpha(th.palette.accent.green, 0.04) },
                })}
              >
                <AddIcon sx={{ fontSize: 18 }} /> 새 제안
              </Box>
            )}
          </Box>
        )}

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
                <TableCell sx={{ width: '1%' }}>상태</TableCell>
                <TableCell sx={{ width: '1%' }}>비고</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>해당 개선제안이 없습니다</TableCell>
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
                    sx={(th) => ({ cursor: 'pointer', '& td': { textAlign: 'center', fontSize: 12.5, ...(open ? { bgcolor: alpha(th.palette.accent.blue, 0.1), borderBottomColor: 'transparent' } : {}) } })}
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
                    <TableRow key={`${t.id}-a`} sx={(th) => ({ '& td': { borderTop: 0, bgcolor: alpha(th.palette.accent.blue, 0.1) } })}>
                      <TableCell />
                      <TableCell colSpan={7} sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
                        {editingId === t.id ? (
                          <ComposeCard
                            key={`edit-${t.id}`}
                            editing
                            initial={{ urgent: t.urgent, title: t.title, loc: t.loc, type: t.type, link: t.link, content: t.content }}
                            locOptions={locOptions}
                            typeOptions={typeOptions}
                            saving={saving}
                            onCancel={() => setEditingId(null)}
                            onSave={(d) => handleEdit(t, d)}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                            <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.primary', lineHeight: 1.7, py: 0.5, flex: 1 }}>{t.content || '내용 없음'}</Box>
                            {manage && (
                              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, pt: 0.25 }} onClick={stop}>
                                <Button size="small" startIcon={<EditIcon sx={{ fontSize: 16 }} />} onClick={() => openEdit(t)} sx={{ color: 'text.secondary', minWidth: 0 }}>수정</Button>
                                <Button size="small" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />} onClick={() => setDeleteDlg(t)} sx={{ minWidth: 0 }}>삭제</Button>
                              </Box>
                            )}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })}
            </TableBody>
          </Table>
        </AppCard>
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

      {/* 삭제 확인 팝업 */}
      <Dialog open={!!deleteDlg} onClose={() => !saving && setDeleteDlg(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>개선제안 삭제</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.7 }}>「{deleteDlg?.title}」 제안을 삭제할까요?<br />삭제하면 되돌릴 수 없습니다.</Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDlg(null)} disabled={saving}>취소</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={saving}>{saving ? '삭제 중…' : '삭제'}</Button>
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
