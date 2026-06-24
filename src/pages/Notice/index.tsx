import { Fragment, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
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
import { alpha } from '@mui/material/styles'
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  FilterBar,
  SearchBar,
  StatusChip,
  EmptyState,
} from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { addNotice, updateNotice, deleteNotice } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import { noticeCatStatus } from './noticeMeta'
import NoticeDetail from './NoticeDetail'
import NoticeCompose, { type NoticeFormValues } from './NoticeCompose'

const CAT_BASE_ORDER = ['긴급', '공지', '일반', '회의', '교육', '행사', '점검']

const refUrl = (ref: string) => String(ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error, updatedAt } = useAppSelector((s) => s.notice)
  const { isAdmin, user, authKey } = useRole()
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false) // 새 공지 인라인 작성 (표 상단)
  const [editingId, setEditingId] = useState<number | null>(null) // 인라인 수정 대상 id
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const today = todaySeoul()

  // 딥링크(/notice/:num) → 펼친 행(아코디언) 대상
  const selected = useMemo(() => (num ? items.find((n) => String(n.num) === String(num)) ?? null : null), [items, num])

  // 행이 펼쳐질 때 1회: 조회수 증가
  useEffect(() => {
    if (ready && selected) dispatch(bumpNoticeViews(selected.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected?.id])

  // 상단체크(중요) 공지 — 위로 이동시키지 않고 강조해 '한 번 더' 노출
  const pinnedNotices = useMemo(() => items.filter((n) => n.pinned), [items])

  const cats = useMemo(() => {
    const present = [...new Set(items.map((n) => n.cat).filter(Boolean))]
    return ['전체', ...CAT_BASE_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CAT_BASE_ORDER.includes(c))]
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((n) => cat === '전체' || n.cat === cat)
      .filter((n) => !q || `${n.title} ${n.author} ${n.cat} ${n.dept} ${n.num}`.toLowerCase().includes(q))
  }, [items, cat, query])

  const isExpired = (n: NoticeItem) => !!n.end && n.end < today
  const stop = (e: MouseEvent) => e.stopPropagation()

  const refresh = () => {
    setCat('전체')
    setQuery('')
    setComposing(false)
    setEditingId(null)
    if (num) navigate('/notice', { replace: true })
    dispatch(loadNoticeData())
  }

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  // 새 공지 등록 (인라인)
  const handleSaveNew = async (v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return showSnack('제목을 입력해주세요.', 'error')
    if (!v.body) return showSnack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      const newNum = await addNotice({ key: authKey, author: user, cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, ref: v.ref, date: todaySeoul() })
      setSaving(false)
      setComposing(false)
      dispatch(loadNoticeData())
      showSnack('공지를 등록했습니다.', 'success')
      if (newNum > 0) navigate(`/notice/${newNum}`, { replace: true })
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  // 공지 수정 (인라인) — 폼 밖 필드(부서담당자·해당자·종료일·게시일)는 원본 보존
  const handleSaveEdit = async (n: NoticeItem, v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return showSnack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return showSnack('제목을 입력해주세요.', 'error')
    if (!v.body) return showSnack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      await updateNotice({
        num: n.num, key: authKey, author: user,
        cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, ref: v.ref,
        deptMgr: n.deptMgr, target: n.target, end: n.end, date: n.date,
      })
      setSaving(false)
      setEditingId(null)
      dispatch(loadNoticeData())
      showSnack('공지를 수정했습니다.', 'success')
    } catch (err) {
      setSaving(false)
      showSnack(err instanceof Error ? err.message : '수정 실패', 'error')
    }
  }

  // 삭제 확정
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) {
      showSnack('관리자 로그인이 필요합니다.', 'error')
      return
    }
    setDeleting(true)
    try {
      await deleteNotice({ num: deleteTarget.num, author: user, key: authKey })
      const deletedNum = deleteTarget.num
      setDeleteTarget(null)
      setDeleting(false)
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

  return (
    <PageContainer>
      <PageHeader
        icon={<CampaignIcon />}
        title="공지사항"
        subtitle="팀 공지 허브"
        updatedAt={error ? '불러오기 실패' : updatedAt || undefined}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button
                variant={composing ? 'contained' : 'outlined'}
                size="small"
                startIcon={<EditNoteIcon />}
                onClick={startCompose}
              >
                새 공지
              </Button>
            )}
            <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      {/* 중요 공지 — 상단체크된 공지를 위로 옮기지 않고 강조해 한 번 더 노출(목록에도 그대로 있음) */}
      {pinnedNotices.length > 0 && (
        <ContentSection title="중요 공지" description="상단 강조 · 목록에도 그대로 표시됩니다" count={`${pinnedNotices.length}건`}>
          <AppCard padding={0}>
            {pinnedNotices.map((n, i) => (
              <Box
                key={n.id}
                role="button"
                tabIndex={0}
                aria-label={`중요 공지: ${n.title}`}
                onClick={() => navigate(`/notice/${n.num}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/notice/${n.num}`) } }}
                sx={(th) => ({
                  display: 'flex', alignItems: 'center', gap: 1, p: '10px 14px', cursor: 'pointer',
                  borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider',
                  bgcolor: alpha(th.palette.accent.amber, 0.06),
                  '&:hover': { bgcolor: alpha(th.palette.accent.amber, 0.13) },
                  opacity: isExpired(n) ? 0.55 : 1,
                })}
              >
                <StatusChip status="warning" label="중요" />
                <StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} />
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.dept ? `[${n.dept}] ` : ''}{n.title}
                </Typography>
                {refUrl(n.ref) && <OpenInNewIcon sx={{ fontSize: 15, color: 'info.main', flexShrink: 0 }} />}
                <Box component="span" sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>{n.date}</Box>
              </Box>
            ))}
          </AppCard>
        </ContentSection>
      )}

      {/* 공지 목록 — 번호·분류·제목(+첨부)·작성자·작성일. 최신순. 행 클릭=아코디언 / 관리자=인라인 작성·수정 */}
      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·분류 검색" />}>
          {cats.map((c) => (
            <StatusChip key={c} status={c === '전체' ? 'neutral' : noticeCatStatus(c)} label={c} selected={cat === c} onClick={() => setCat(c)} />
          ))}
        </FilterBar>

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
                    <TableCell sx={{ width: 56, textAlign: 'center' }}>번호</TableCell>
                    <TableCell sx={{ width: 92 }}>분류</TableCell>
                    <TableCell>제목</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center' }}>작성자</TableCell>
                    <TableCell sx={{ width: 120 }}>작성일</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* 새 공지 작성 행 (헤더 바로 아래, 최신글 위) */}
                  {isAdmin && composing && (
                    <NoticeCompose mode="new" author={user || '-'} saving={saving} onSave={handleSaveNew} onCancel={() => setComposing(false)} />
                  )}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>공지사항이 없습니다</TableCell>
                    </TableRow>
                  )}
                  {filtered.map((n) => {
                    if (isAdmin && editingId === n.id) {
                      return <NoticeCompose key={n.id} mode="edit" notice={n} author={user || '-'} saving={saving} onSave={(v) => handleSaveEdit(n, v)} onCancel={() => setEditingId(null)} />
                    }
                    const open = String(n.num) === String(num)
                    const toggle = () => (open ? navigate('/notice', { replace: true }) : navigate(`/notice/${n.num}`))
                    const link = refUrl(n.ref)
                    return (
                      <Fragment key={n.id}>
                        <TableRow
                          hover
                          tabIndex={0}
                          aria-label={`공지: ${n.title}`}
                          aria-expanded={open}
                          onClick={toggle}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
                          sx={(th) => ({
                            cursor: 'pointer',
                            opacity: isExpired(n) ? 0.55 : 1,
                            '& > td': {
                              bgcolor: open ? 'action.hover' : n.pinned ? alpha(th.palette.accent.amber, 0.09) : undefined,
                              borderBottom: open ? 0 : undefined,
                            },
                            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                          })}
                        >
                          <TableCell sx={{ textAlign: 'center', color: 'text.disabled', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{n.num}</TableCell>
                          <TableCell><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
                          <TableCell sx={{ color: 'text.primary' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                              {n.pinned && <StatusChip status="warning" label="중요" />}
                              {n.isNew && <StatusChip status="error" label="NEW" />}
                              <Typography variant="body2" sx={{ fontWeight: n.pinned ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {n.dept ? `[${n.dept}] ` : ''}{n.title}
                              </Typography>
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
                  })}
                </TableBody>
              </Table>
            </Box>
          </AppCard>
        )}
      </ContentSection>

      {/* 삭제 확인 Dialog */}
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

      {/* 결과 Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </PageContainer>
  )
}
