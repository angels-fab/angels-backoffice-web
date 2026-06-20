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
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { updateImprovement, createImprovement, deleteImprovement } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { fmtDate, todaySeoul } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import { IMP_STATUSES, IMP_TYPE_OPTIONS, impKind, needsReason, remarkOf, normStatus, statusRank } from './improveMeta'
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
        ...inputSx(th), width, maxWidth: '100%', height: 32,
        '& .MuiSelect-select': { p: 0, pl: '20px !important', pr: '20px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
    </Select>
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

  // 새 제안(표 상단) / 수정(목록 내 in-place) / 삭제 확인 — 작성 입력은 c* 상태 공용
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDlg, setDeleteDlg] = useState<ImprovementItem | null>(null)
  const [cUrgent, setCUrgent] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cLoc, setCLoc] = useState('')
  const [cType, setCType] = useState('')
  const [cLink, setCLink] = useState('')
  const [cContent, setCContent] = useState('')

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
    // 1순위 번호 내림차순(높은 번호=최신 위), 2순위 상태(접수→검토중→보류→완료→불가).
    return [...base].sort((a, b) =>
      (Number(b.num) || 0) - (Number(a.num) || 0) ||
      statusRank(a.status) - statusRank(b.status))
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

  const resetCompose = (t?: ImprovementItem) => {
    setCUrgent(t?.urgent ?? false); setCTitle(t?.title ?? ''); setCLoc(t?.loc ?? '')
    setCType(t?.type ?? ''); setCLink(t?.link ?? ''); setCContent(t?.content ?? '')
  }
  const openNew = () => { resetCompose(); setEditingId(null); setComposing(true) }
  const openEdit = (t: ImprovementItem) => {
    resetCompose(t)
    setComposing(false)
    setEditingId(t.id)
    setExpanded((prev) => { const n = new Set(prev); n.add(t.id); return n }) // 펼쳐진 상태로 편집
  }

  const handleCreate = async () => {
    if (saving) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!cTitle.trim()) return showSnack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      await createImprovement({ author: user, key: authKey, urgent: cUrgent, type: cType.trim(), loc: cLoc.trim(), title: cTitle.trim(), content: cContent.trim(), mgr: user, link: cLink.trim() })
      setSaving(false); setComposing(false)
      showSnack('요청을 등록했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  const handleEdit = async (t: ImprovementItem) => {
    if (saving) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!cTitle.trim()) return showSnack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      // 상태는 건드리지 않고 내용 필드만 수정(완료일자·사유 보존)
      await updateImprovement({ author: user, key: authKey, num: t.num, urgent: cUrgent, type: cType.trim(), loc: cLoc.trim(), title: cTitle.trim(), content: cContent.trim(), link: cLink.trim() })
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

  // 작성/수정 공용 인라인 행(이전 버전과 동일한 열 정렬 구조). 제목줄 배경 클릭 시 접힘(입력 셀은 stopPropagation).
  const renderCompose = (mode: 'new' | 'edit', t?: ImprovementItem) => {
    const onCancel = mode === 'new' ? () => setComposing(false) : () => setEditingId(null)
    const onSave = mode === 'new' ? handleCreate : () => { if (t) void handleEdit(t) }
    const author = mode === 'new' ? (user || '-') : (t?.author || '-')
    const dateStr = mode === 'new' ? fmtDate(todaySeoul()) : fmtDate(t?.date || '')
    const stLabel = mode === 'new' ? '접수' : normStatus(t?.status || '')
    const stKind: StatusKind = mode === 'new' ? 'neutral' : impKind(stLabel)
    const kb = mode === 'new' ? 'new' : `edit-${t!.id}`
    const greenBg = (th: Theme) => alpha(th.palette.accent.green, 0.06)
    const urgentBox = (
      <Tooltip title={cUrgent ? '긴급 해제' : '긴급'}>
        <Box
          role="checkbox" aria-checked={cUrgent} aria-label="긴급" tabIndex={0}
          onClick={() => setCUrgent((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCUrgent((v) => !v) } }}
          sx={(th) => ({
            width: 24, height: 24, mx: 'auto', borderRadius: '5px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1,
            border: '1px solid',
            ...(cUrgent
              ? { bgcolor: th.palette.accent.red, borderColor: th.palette.accent.red, color: '#fff' }
              : { borderColor: th.palette.divider, color: 'text.disabled', bgcolor: 'transparent' }),
          })}
        >!</Box>
      </Tooltip>
    )
    return [
      <TableRow key={`${kb}-1`} onClick={onCancel} sx={{ cursor: 'pointer', '& td': { verticalAlign: 'middle', bgcolor: greenBg, py: 1 } }}>
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}>{urgentBox}</TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
          <InputBase
            value={cTitle}
            onChange={(e) => setCTitle(e.target.value)}
            placeholder="제목"
            inputProps={{ 'aria-label': '제목' }}
            endAdornment={<LinkField value={cLink} onChange={setCLink} />}
            sx={(th) => ({ ...inputSx(th), width: '100%', height: 32 })}
          />
        </TableCell>
        <TableCell onClick={stop}><DropField value={cLoc} onChange={setCLoc} options={locOptions} placeholder="위치" width={96} /></TableCell>
        <TableCell onClick={stop}><DropField value={cType} onChange={setCType} options={typeOptions} placeholder="유형" width={84} /></TableCell>
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5 }}>{author}</TableCell>
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</TableCell>
        <TableCell sx={{ textAlign: 'center' }}><StatusChip status={stKind} label={stLabel} /></TableCell>
        <TableCell />
      </TableRow>,
      <TableRow key={`${kb}-2`} sx={{ '& td': { borderTop: 0, bgcolor: greenBg, pt: 0, pb: 1.25, verticalAlign: 'middle' } }}>
        <TableCell />
        <TableCell colSpan={6} onClick={stop} sx={{ textAlign: 'left' }}>
          <InputBase
            value={cContent}
            onChange={(e) => setCContent(e.target.value)}
            placeholder="개선내용"
            multiline
            minRows={1}
            inputProps={{ 'aria-label': '개선내용' }}
            sx={(th) => ({ ...inputSx(th), width: '100%', py: '7px' })}
          />
        </TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={mode === 'edit' ? '수정 저장' : '저장'}>
              <span><IconButton size="small" color="success" aria-label="저장" onClick={onSave} disabled={saving}><CheckIcon sx={{ fontSize: 19 }} /></IconButton></span>
            </Tooltip>
            <Tooltip title="취소">
              <span><IconButton size="small" color="error" aria-label="취소" onClick={onCancel} disabled={saving}><CloseIcon sx={{ fontSize: 19 }} /></IconButton></span>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>,
    ]
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<LightbulbOutlinedIcon />}
        title="포털개선요청"
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
                      transition: 'background-color .2s ease, color .2s ease, border-color .2s ease',
                      color: on ? t.palette.common.white : c,
                      bgcolor: on ? c : alpha(c, 0.12),
                      borderColor: on ? c : alpha(c, 0.32),
                      cursor: 'pointer',
                      '&:hover': { bgcolor: c, color: t.palette.common.white, borderColor: c },
                    }
                  }}
                />
              )
            })}
            {visibleStatuses.length > 1 && (
              <Box component="span" sx={{ fontSize: 11.5, color: 'text.disabled', whiteSpace: 'nowrap', ml: 0.5 }}>
                Shift로 다중선택
              </Box>
            )}
          </Box>
          {isAdmin && (
            <Button
              onClick={() => { if (composing) setComposing(false); else openNew() }}
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              sx={(th) => {
                const c = th.palette.accent.green
                const on = composing // 클릭해 작성칸이 열리면 초록 채움+흰 글자로 스르륵 전환
                return {
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  transition: 'background-color .2s ease, color .2s ease, border-color .2s ease',
                  color: on ? th.palette.common.white : c,
                  bgcolor: on ? c : alpha(c, 0.12),
                  borderColor: on ? c : alpha(c, 0.32),
                  '&:hover': { bgcolor: on ? c : alpha(c, 0.2), borderColor: on ? c : alpha(c, 0.32) },
                }
              }}
            >
              새 요청
            </Button>
          )}
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
                <TableCell sx={{ width: '1%' }}>상태</TableCell>
                <TableCell sx={{ width: '1%' }}>비고</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* 새 요청 작성 행: 헤더 우상단 '새 요청' 버튼 클릭 시 표 최상단(헤더 바로 아래, 최신글 위)에 열림 */}
              {isAdmin && editingId === null && composing && renderCompose('new')}
              {listed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>해당하는 요청이 없습니다</TableCell>
                </TableRow>
              )}
              {listed.map((t) => {
                if (editingId === t.id) return renderCompose('edit', t) // 수정: 그 자리에서 인라인 편집(열 정렬 동일)
                const open = expanded.has(t.id)
                const rm = remarkOf(t)
                const st = normStatus(t.status)
                const kind = impKind(st) // 행 배경 상태색 틴트용
                const manage = canManage(t)
                const toggle = () => setExpanded((prev) => { const n = new Set(prev); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })
                return [
                  <TableRow
                    key={`${t.id}-r`}
                    hover
                    onClick={toggle}
                    sx={(th) => ({
                      cursor: 'pointer',
                      '& td': {
                        textAlign: 'center', fontSize: 12.5,
                        ...(open
                          ? { bgcolor: alpha(th.palette.accent.blue, 0.22), borderBottomColor: 'transparent' }
                          : { bgcolor: alpha(kindColor(th, kind), 0.07) }),
                      },
                    })}
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
                    <TableRow key={`${t.id}-a`} onClick={toggle} sx={(th) => ({ cursor: 'pointer', '& td': { borderTop: 0, bgcolor: alpha(th.palette.accent.blue, 0.09) } })}>
                      <TableCell />
                      <TableCell colSpan={7} sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                          <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.primary', lineHeight: 1.7, py: 0.5, flex: 1 }}>{t.content || '내용 없음'}</Box>
                          {manage && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, pt: 0.25 }} onClick={stop}>
                              <Tooltip title="수정"><IconButton size="small" aria-label="수정" onClick={() => openEdit(t)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                              <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="삭제" onClick={() => setDeleteDlg(t)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                            </Box>
                          )}
                        </Box>
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
        <DialogTitle>요청 삭제</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.7 }}>「{deleteDlg?.title}」 요청을 삭제할까요?<br />삭제하면 되돌릴 수 없습니다.</Box>
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
