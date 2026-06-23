import { Fragment, useEffect, useMemo, useState } from 'react'
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
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
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
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { deleteNotice } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import { noticeCatStatus } from './noticeMeta'
import NoticeDetail from './NoticeDetail'
import NoticeWrite from './NoticeWrite'

const CAT_BASE_ORDER = ['긴급', '공지', '일반', '회의', '교육', '행사', '점검']

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' }

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error, updatedAt } = useAppSelector((s) => s.notice)
  const { isAdmin, user, authKey } = useRole()
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [writeOpen, setWriteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NoticeItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })

  const today = todaySeoul()
  const thisMonth = today.slice(0, 7)

  // 딥링크(/notice/:num) → 펼친 행(아코디언) 대상
  const selected = useMemo(() => (num ? items.find((n) => String(n.num) === String(num)) ?? null : null), [items, num])

  // 행이 펼쳐질 때 1회: 조회수 증가
  useEffect(() => {
    if (ready && selected) dispatch(bumpNoticeViews(selected.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected?.id])

  const kpi = useMemo(
    () => ({
      total: items.length,
      month: items.filter((n) => (n.date || '').startsWith(thisMonth)).length,
      recent: items.filter((n) => n.isNew).length,
    }),
    [items, thisMonth],
  )

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

  const refresh = () => {
    setCat('전체')
    setQuery('')
    if (num) navigate('/notice', { replace: true })
    dispatch(loadNoticeData())
  }

  const showSnack = (msg: string, severity: 'success' | 'error' = 'success') => setSnack({ open: true, msg, severity })

  // 작성/수정 성공
  const handleSaved = (savedNum: number, isEdit: boolean) => {
    setWriteOpen(false)
    setEditTarget(null)
    dispatch(loadNoticeData())
    showSnack(isEdit ? '공지를 수정했습니다.' : '공지를 등록했습니다.', 'success')
    if (savedNum > 0) navigate(`/notice/${savedNum}`, { replace: true })
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
      // 삭제한 공지를 보고 있었다면 드로어 닫기
      if (String(num) === String(deletedNum)) navigate('/notice', { replace: true })
    } catch (err) {
      setDeleting(false)
      showSnack(err instanceof Error ? err.message : '삭제 실패', 'error')
    }
  }

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
              <Button variant="contained" size="small" startIcon={<EditNoteIcon />} onClick={() => { setEditTarget(null); setWriteOpen(true) }}>
                새 공지
              </Button>
            )}
            <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>
        }
      />

      {/* ① KPI */}
      <ContentSection>
        <CardGrid columns={3}>
          <StatTile value={kpi.total} unit="건" label="전체 공지" status="info" />
          <StatTile value={kpi.month} unit="건" label="이번달 공지" status="success" />
          <StatTile value={kpi.recent} unit="건" label="최근 7일" status="error" />
        </CardGrid>
      </ContentSection>

      {/* ② 공지 목록 — 테이블 (분류·제목·작성자·작성일). 행 클릭 시 아코디언 펼침 */}
      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        <FilterBar trailing={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·분류 검색" />}>
          {cats.map((c) => (
            <StatusChip key={c} status={c === '전체' ? 'neutral' : noticeCatStatus(c)} label={c} selected={cat === c} onClick={() => setCat(c)} />
          ))}
        </FilterBar>

        {!ready ? (
          <AppCard padding={18}><Typography variant="body2">불러오는 중…</Typography></AppCard>
        ) : filtered.length === 0 ? (
          <AppCard padding={0}><EmptyState size="sm" title="공지사항이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 560, '& td, & th': { borderColor: 'divider' } }}>
                <TableHead>
                  <TableRow sx={{ '& th': { color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' } }}>
                    <TableCell sx={{ width: 96 }}>분류</TableCell>
                    <TableCell>제목</TableCell>
                    <TableCell sx={{ width: 100 }}>작성자</TableCell>
                    <TableCell sx={{ width: 116 }}>작성일</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map((n) => {
                    const open = String(n.num) === String(num)
                    const toggle = () => (open ? navigate('/notice', { replace: true }) : navigate(`/notice/${n.num}`))
                    return (
                      <Fragment key={n.id}>
                        <TableRow
                          hover
                          tabIndex={0}
                          aria-label={`공지: ${n.title}`}
                          aria-expanded={open}
                          onClick={toggle}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
                          sx={{
                            cursor: 'pointer',
                            opacity: isExpired(n) ? 0.55 : 1,
                            bgcolor: open ? 'action.hover' : undefined,
                            '& > td': open ? { borderBottom: 0 } : undefined,
                            '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
                          }}
                        >
                          <TableCell><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
                          <TableCell sx={{ color: 'text.primary' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                              {n.pinned && <StatusChip status="warning" label="중요" />}
                              {n.isNew && <StatusChip status="error" label="NEW" />}
                              <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {n.dept ? `[${n.dept}] ` : ''}{n.title}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{n.author || '-'}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                              <Box component="span" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{n.date}</Box>
                              <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={4} sx={{ p: 0, border: 0 }}>
                            <Collapse in={open} timeout="auto" unmountOnExit>
                              <NoticeDetail notice={n} isAdmin={isAdmin} onEdit={setEditTarget} onDelete={setDeleteTarget} />
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

      {isAdmin && (
        <NoticeWrite
          open={writeOpen || !!editTarget}
          editing={editTarget}
          onClose={() => { setWriteOpen(false); setEditTarget(null) }}
          onSaved={handleSaved}
          onError={(msg) => showSnack(msg, 'error')}
        />
      )}

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
