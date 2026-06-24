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
import SearchIcon from '@mui/icons-material/Search'
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
import NoticeCompose, { type NoticeFormValues } from './NoticeCompose'

const CAT_BASE_ORDER = ['긴급', '안전', '보안', '시설', '공지', '일반', '회의', '교육', '행사', '점검']

const refUrl = (ref: string) => String(ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

// 분류 → 색 (업무일정 필터처럼 부드러운 톤). noticeCatStatus의 StatusKind를 테마 색으로 매핑.
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

// 전체선택(빈 배열)에서 하나 클릭=그것만 / 선택된 것 재클릭=해제(마지막이면 전체) — 업무일정과 동일 알고리즘
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

  const today = todaySeoul()

  // 딥링크(/notice/:num) → 펼친 행(아코디언) 대상
  const selected = useMemo(() => (num ? items.find((n) => String(n.num) === String(num)) ?? null : null), [items, num])

  useEffect(() => {
    if (ready && selected) dispatch(bumpNoticeViews(selected.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, selected?.id])

  // 존재하는 분류 목록(고정 순서 우선) + 건수
  const catList = useMemo(() => {
    const present = [...new Set(items.map((n) => n.cat).filter(Boolean))]
    return [...CAT_BASE_ORDER.filter((c) => present.includes(c)), ...present.filter((c) => !CAT_BASE_ORDER.includes(c))]
  }, [items])
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of items) m[n.cat] = (m[n.cat] || 0) + 1
    return m
  }, [items])

  const catSelected = (c: string) => selCats.length === 0 || selCats.includes(c)
  const toggleCat = (c: string) => setSelCats((prev) => isolateToggle(prev, c, catList.length))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((n) => selCats.length === 0 || selCats.includes(n.cat))
      .filter((n) => !q || `${n.title} ${n.author} ${n.cat} ${n.dept} ${n.num}`.toLowerCase().includes(q))
  }, [items, selCats, query])

  const isExpired = (n: NoticeItem) => !!n.end && n.end < today
  const stop = (e: MouseEvent) => e.stopPropagation()

  const refresh = () => {
    setSelCats([])
    setQuery('')
    setComposing(false)
    setEditingId(null)
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
          <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        }
      />

      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        {/* 상단 필터 바 — 업무일정 방식(부드러운 색 칩 + 전체↔개별 토글). 우측: 검색 + 새 공지 */}
        <Box
          sx={(t) => ({
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25, mb: 2,
            p: '10px 14px', bgcolor: 'background.paper', border: `1px solid ${t.palette.divider}`, borderRadius: '12px',
          })}
        >
          <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled', flex: 'none' }}>분류</Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            {catList.map((c) => {
              const on = catSelected(c)
              const color = catColor(theme, c)
              // 동적 색/투명도는 inline style로 적용(상태 변경 시 확실히 반영)
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
                    display: 'inline-flex', alignItems: 'center', gap: '6px', p: '5px 11px', borderRadius: '999px',
                    cursor: 'pointer', transition: 'opacity .15s, background-color .15s',
                  }}
                >
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
                    <TableCell sx={{ width: 72, textAlign: 'center' }}>번호</TableCell>
                    <TableCell sx={{ width: 92 }}>분류</TableCell>
                    <TableCell>제목</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center' }}>작성자</TableCell>
                    <TableCell sx={{ width: 120 }}>작성일</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
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
                          {/* 번호 칸: 상단고정(중요)이면 번호 대신 '중요' 배지 (GIST 공지 스타일) */}
                          <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {n.pinned
                              ? <StatusChip status="warning" label="중요" />
                              : <Box component="span" sx={{ color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{n.num}</Box>}
                          </TableCell>
                          <TableCell><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
                          <TableCell sx={{ color: 'text.primary' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
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
