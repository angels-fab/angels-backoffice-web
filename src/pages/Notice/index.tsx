import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Collapse from '@mui/material/Collapse'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PushPinIcon from '@mui/icons-material/PushPin'
import SearchIcon from '@mui/icons-material/Search'
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety'
import SecurityIcon from '@mui/icons-material/Security'
import ApartmentIcon from '@mui/icons-material/Apartment'
import SchoolIcon from '@mui/icons-material/School'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  StatusChip,
  EmptyState,
} from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { addNotice, updateNotice, deleteNotice } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import { noticeCatStatus } from './noticeMeta'
import NoticeDetail from './NoticeDetail'
import NoticeCompose, { NOTICE_CATS, type NoticeFormValues } from './NoticeCompose'

const refUrl = (ref: string) => String(ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

// 분류 필터 아이콘(업무일정 탭처럼) — 안전/보안/시설/교육/일반
const CAT_ICON: Record<string, SvgIconComponent> = {
  안전: HealthAndSafetyIcon,
  보안: SecurityIcon,
  시설: ApartmentIcon,
  교육: SchoolIcon,
  일반: InfoOutlinedIcon,
}

function kindColor(th: Theme, kind: StatusKind): string {
  switch (kind) {
    case 'error': return th.palette.accent.red
    case 'info': return th.palette.accent.blue
    case 'success': return th.palette.accent.green
    case 'warning': return th.palette.accent.amber
    case 'purple': return th.palette.accent.purple
    case 'teal': return th.palette.accent.teal
    default: return th.palette.text.secondary
  }
}
const catColor = (th: Theme, cat: string) => kindColor(th, noticeCatStatus(cat))

function isolateToggle(prev: string[], id: string, total: number): string[] {
  if (prev.length === 0 || prev.length >= total) return [id]
  if (prev.includes(id)) return prev.filter((x) => x !== id)
  const next = [...prev, id]
  return next.length >= total ? [] : next
}

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error, updatedAt } = useAppSelector((s) => s.notice)
  const { isAdmin, user, authKey } = useRole()
  const theme = useTheme()
  const [selCats, setSelCats] = useState<string[]>([]) // 빈 배열 = 전체
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })
  const [openKey, setOpenKey] = useState<string | null>(null) // 펼친 행 키('번호' 또는 'pin-번호')

  const today = todaySeoul()

  // 딥링크(/notice/:num) → 원본 행 펼침
  const selected = useMemo(() => (num ? items.find((n) => String(n.num) === String(num)) ?? null : null), [items, num])
  useEffect(() => { setOpenKey(num ? String(num) : null) }, [num])
  useEffect(() => {
    if (ready && selected) dispatch(bumpNoticeViews(selected.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected?.id])

  // 분류 필터: 갯수와 무관하게 항상 5개 모두 노출(안전/보안/시설/교육/일반)
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of items) m[n.cat] = (m[n.cat] || 0) + 1
    return m
  }, [items])

  const catSelected = (c: string) => selCats.length === 0 || selCats.includes(c)
  const toggleCat = (c: string) => setSelCats((prev) => isolateToggle(prev, c, NOTICE_CATS.length))

  // 자동완성용 옵션 (부서/부서담당자 히스토리)
  const deptOptions = useMemo(() => [...new Set(items.map((n) => n.dept).filter(Boolean))], [items])
  const deptMgrOptions = useMemo(() => [...new Set(items.map((n) => n.deptMgr).filter(Boolean))], [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((n) => selCats.length === 0 || selCats.includes(n.cat))
      .filter((n) => !q || `${n.title} ${n.author} ${n.cat} ${n.dept} ${n.num}`.toLowerCase().includes(q))
  }, [items, selCats, query])

  const isExpired = (n: NoticeItem) => !!n.end && n.end < today
  // 상단고정 복사본 — 종료된 공지는 상단고정 자동 해제(아래 일반 목록엔 그대로 남음)
  const pinnedCopies = useMemo(() => filtered.filter((n) => n.pinned && !(n.end && n.end < today)), [filtered, today])

  const stop = (e: MouseEvent) => e.stopPropagation()

  const refresh = () => {
    setSelCats([]); setQuery(''); setComposing(false); setEditingId(null)
    if (num) navigate('/notice', { replace: true })
    dispatch(loadNoticeData())
  }

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  const handleSaveNew = async (v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return showSnack('제목을 입력해주세요.', 'error')
    if (!v.body) return showSnack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      const newNum = await addNotice({ key: authKey, author: user, cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, deptMgr: v.deptMgr, target: v.target, ref: v.ref, date: todaySeoul() })
      setSaving(false); setComposing(false)
      dispatch(loadNoticeData())
      showSnack('공지를 등록했습니다.', 'success')
      if (newNum > 0) navigate(`/notice/${newNum}`, { replace: true })
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  const handleSaveEdit = async (n: NoticeItem, v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return showSnack('제목을 입력해주세요.', 'error')
    if (!v.body) return showSnack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      await updateNotice({
        num: n.num, key: authKey, author: user,
        cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, deptMgr: v.deptMgr, target: v.target, ref: v.ref,
        end: n.end, date: n.date,
      })
      setSaving(false); setEditingId(null)
      dispatch(loadNoticeData())
      showSnack('공지를 수정했습니다.', 'success')
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '수정 실패', 'error')
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) { showSnack('관리자 로그인이 필요합니다.', 'error'); return }
    setDeleting(true)
    try {
      await deleteNotice({ num: deleteTarget.num, author: user, key: authKey })
      const deletedNum = deleteTarget.num
      setDeleteTarget(null); setDeleting(false)
      dispatch(loadNoticeData())
      showSnack('공지를 삭제했습니다.', 'success')
      if (String(num) === String(deletedNum)) navigate('/notice', { replace: true })
    } catch (err) {
      setDeleting(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
    }
  }

  const startCompose = () => { setEditingId(null); setComposing((c) => !c) }
  const startEdit = (n: NoticeItem) => { setComposing(false); setEditingId(n.id) }

  const showEmpty = ready && filtered.length === 0 && !composing

  // 상단고정 ↔ 일반 목록 구분선 — 게시판 테두리색 계열 그라데이션
  const renderGroupSep = () => (
    <TableRow>
      <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
        <Box sx={(th) => ({ height: 2, background: `linear-gradient(90deg, transparent, ${alpha(th.palette.text.disabled, 0.5)}, transparent)` })} />
      </TableCell>
    </TableRow>
  )

  // 공지 한 행(원본/복사본 공용). isCopy=상단 중요 복사본(압정·볼드·떠오른 표면), 아니면 일반(번호).
  const renderRow = (n: NoticeItem, isCopy: boolean) => {
    const rowKey = isCopy ? `pin-${n.num}` : String(n.num)
    const open = openKey === rowKey
    const link = refUrl(n.ref)
    const toggle = () => {
      if (isCopy) { setOpenKey(open ? null : rowKey); return }
      if (open) { setOpenKey(null); navigate('/notice', { replace: true }) }
      else { navigate(`/notice/${n.num}`) }
    }
    return (
      <Fragment key={rowKey}>
        <TableRow
          hover
          tabIndex={0}
          aria-label={`공지: ${n.title}`}
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
          sx={(th) => ({
            cursor: 'pointer',
            // 종료글은 더 흐리게(0.3) · 진행중은 그대로(상대 대비로 더 또렷)
            opacity: isExpired(n) ? 0.3 : 1,
            '& > td': {
              // 상단고정 그룹은 떠오른 표면(elevated), 일반 목록은 더 어두운 배경(default)으로 대비
              bgcolor: open ? 'action.hover' : isCopy ? th.palette.background.elevated : th.palette.background.default,
              borderBottom: open ? 0 : undefined,
            },
            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
          })}
        >
          <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
            {isCopy
              ? <PushPinIcon sx={(th) => ({ fontSize: 16, color: th.palette.accent.amber })} />
              : <Box component="span" sx={{ color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{n.num}</Box>}
          </TableCell>
          <TableCell><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
          <TableCell sx={{ color: 'text.primary' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
              {isExpired(n) && <Box component="span" sx={{ flexShrink: 0 }}><StatusChip status="neutral" label="종료" /></Box>}
              <Typography variant="body2" sx={{ fontWeight: isCopy ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {n.dept ? `[${n.dept}] ` : ''}{n.title}
              </Typography>
              {n.isNew && (
                <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: '4px', bgcolor: 'error.main', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
              )}
              {link && (
                <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="첨부/관련자료 열기" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                  <OpenInNewIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </Box>
          </TableCell>
          <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', textAlign: 'center' }}>{n.author || '-'}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Box component="span" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{n.date}</Box>
              <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </Box>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <NoticeDetail notice={n} isAdmin={isAdmin} onEdit={startEdit} onDelete={setDeleteTarget} />
            </Collapse>
          </TableCell>
        </TableRow>
      </Fragment>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<CampaignIcon />}
        title="공지사항"
        subtitle="팀 공지 허브"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        {/* 상단 필터 바 — 업무일정 방식(부드러운 색 칩, 전체↔개별 토글). 분류 5개 항상 노출. 우측: 검색 + 새 공지 */}
        <Box
          sx={(t) => ({
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2,
            p: '10px 14px', bgcolor: 'background.paper', border: `1px solid ${t.palette.divider}`, borderRadius: '12px',
          })}
        >
          <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none' }}>분류</Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {NOTICE_CATS.map((c) => {
              const on = catSelected(c)
              const color = catColor(theme, c)
              const Icon = CAT_ICON[c]
              return (
                <Box
                  key={c}
                  role="button"
                  tabIndex={0}
                  aria-label={`${c} ${catCounts[c] || 0}건${on ? '' : ' (해제됨)'}`}
                  onClick={() => toggleCat(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCat(c) } }}
                  style={{ backgroundColor: alpha(color, on ? 0.18 : 0.06), color, opacity: on ? 1 : 0.45 }}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px', p: '5px 11px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'opacity .15s, background-color .15s',
                  }}
                >
                  {Icon && <Icon sx={{ fontSize: 15, flex: 'none' }} />}
                  <Box component="span" sx={{ fontSize: 12.5, fontWeight: 600 }}>{c}</Box>
                  <Box component="span" sx={{ fontSize: 11, opacity: 0.7 }}>{catCounts[c] || 0}</Box>
                </Box>
              )
            })}
          </Box>

          <Box sx={{ ml: { sm: 'auto' }, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ position: 'relative' }}>
              <SearchIcon sx={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'text.disabled' }} />
              <Box
                component="input"
                value={query}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                placeholder="제목·작성자·분류 검색"
                sx={(t) => ({
                  width: 180, height: 32, border: `1px solid ${t.palette.divider}`, borderRadius: '8px',
                  p: '0 10px 0 28px', fontSize: 12, fontFamily: 'inherit', color: 'text.primary', bgcolor: 'background.default',
                  outline: 'none', '&::placeholder': { color: t.palette.text.disabled }, '&:focus': { borderColor: t.palette.primary.main },
                })}
              />
            </Box>
            {isAdmin && (
              <Button variant={composing ? 'contained' : 'outlined'} size="small" startIcon={<EditNoteIcon sx={{ fontSize: 18 }} />} onClick={startCompose} sx={{ whiteSpace: 'nowrap' }}>
                새 공지
              </Button>
            )}
          </Box>
        </Box>

        {!ready ? (
          <AppCard padding={18}><Typography variant="body2">불러오는 중…</Typography></AppCard>
        ) : showEmpty ? (
          <AppCard padding={0}><EmptyState size="sm" title="공지사항이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 640, '& td, & th': { borderColor: 'divider' } }}>
                <TableHead>
                  <TableRow sx={{ '& th': { color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ width: 48, textAlign: 'center' }}>번호</TableCell>
                    <TableCell sx={{ width: 68 }}>분류</TableCell>
                    <TableCell>제목</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center' }}>작성자</TableCell>
                    <TableCell sx={{ width: 120 }}>작성일</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isAdmin && composing && (
                    <NoticeCompose mode="new" author={user || '-'} saving={saving} deptOptions={deptOptions} deptMgrOptions={deptMgrOptions} onSave={handleSaveNew} onCancel={() => setComposing(false)} />
                  )}
                  {/* 상단고정 그룹(종료 공지는 자동 해제) + 구분선. 원본은 아래 최신순 목록에 그대로 남음 */}
                  {pinnedCopies.length > 0 && (
                    <>
                      {pinnedCopies.map((n) => renderRow(n, true))}
                      {renderGroupSep()}
                    </>
                  )}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>공지사항이 없습니다</TableCell>
                    </TableRow>
                  )}
                  {/* 전체 최신순(원본) */}
                  {filtered.map((n) =>
                    isAdmin && editingId === n.id
                      ? <NoticeCompose key={n.id} mode="edit" notice={n} author={user || '-'} saving={saving} deptOptions={deptOptions} deptMgrOptions={deptMgrOptions} onSave={(v) => handleSaveEdit(n, v)} onCancel={() => setEditingId(null)} />
                      : renderRow(n, false),
                  )}
                </TableBody>
              </Table>
            </Box>
          </AppCard>
        )}
      </ContentSection>

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 360 } } } }}>
        <DialogTitle>공지를 삭제할까요?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            「{deleteTarget?.title}」 공지를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? '삭제 중…' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
