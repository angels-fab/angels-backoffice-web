import { Fragment, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
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
import { TintChip } from '@/components/FilterChip'
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import PushPinIcon from '@mui/icons-material/PushPin'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  StatusChip,
  EmptyState,
  SearchBar,
  LoadingState,
  FilterToolbar,
  dataTableHeadSx,
  dataTableSx,
  useSnack,
} from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { iconSize, radius } from '@/theme/tokens'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { useMarkSeen } from '@/layouts/useNavBadges'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { addNotice, updateNotice, deleteNotice, removeNoticeFiles } from '@/api/notices'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import { noticeCatStatus } from './noticeMeta'
import NoticeDetail from './NoticeDetail'
import NoticeCompose, { NOTICE_CATS, type NoticeFormValues } from './NoticeCompose'

const refUrl = (ref: string) => String(ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null

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

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error } = useAppSelector((s) => s.notice)
  // 공지 작성/수정/삭제 = 팀원(member)+관리자. (게스트·유관자는 열람만)
  const { isMember, user, authKey } = useRole()
  // 내 기준 새 글 배지(개인화) — 페이지 진입 시 현재 새 글을 읽음 처리.
  // error 게이트 필수: 로드 실패도 ready=true라, 없으면 실패(빈 목록)를 '새 글 0'으로 오인해 seen을 지움
  useMarkSeen('notice', useMemo(() => items.filter((n) => n.isNew).map((n) => String(n.num)), [items]), ready && !error)
  const theme = useTheme()
  const [selCats, setSelCats] = useState<string[]>([]) // 빈 배열 = 전체
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<NoticeItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const snack = useSnack()
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

  const handleSaveNew = async (v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return snack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return snack('제목을 입력해주세요.', 'error')
    if (!v.body) return snack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      const newNum = await addNotice({ key: authKey, author: user, cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, deptMgr: v.deptMgr, target: v.target, ref: v.ref, attachments: v.attachments, date: todaySeoul() })
      setComposing(false)
      dispatch(loadNoticeData())
      snack('공지를 등록했습니다.', 'success')
      if (newNum > 0) navigate(`/notice/${newNum}`, { replace: true })
    } catch (err) {
      snack(err instanceof Error ? err.message : '저장 실패', 'error')
    } finally {
      setSaving(false) // 성공·실패·타임아웃 무엇이든 스피너는 반드시 해제(멈춤 방지)
    }
  }

  const handleSaveEdit = async (n: NoticeItem, v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return snack('관리자 로그인이 필요합니다.', 'error')
    if (!v.title) return snack('제목을 입력해주세요.', 'error')
    if (!v.body) return snack('내용을 입력해주세요.', 'error')
    setSaving(true)
    try {
      await updateNotice({
        num: n.num, key: authKey, author: user,
        cat: v.cat, title: v.title, body: v.body, pinned: v.pinned, dept: v.dept, deptMgr: v.deptMgr, target: v.target, ref: v.ref,
        attachments: v.attachments, end: n.end, date: n.date,
      })
      // 수정 성공 후: 기존 첨부 중 제거된 파일을 스토리지에서 정리(best-effort)
      const keptPaths = new Set(v.attachments.map((a) => a.path))
      const removedPaths = (n.attachments || []).filter((a) => !keptPaths.has(a.path)).map((a) => a.path)
      if (removedPaths.length) void removeNoticeFiles(removedPaths).catch(() => {})
      setEditingId(null)
      dispatch(loadNoticeData())
      snack('공지를 수정했습니다.', 'success')
    } catch (err) {
      snack(err instanceof Error ? err.message : '수정 실패', 'error')
    } finally {
      setSaving(false) // 성공·실패·타임아웃 무엇이든 스피너는 반드시 해제(멈춤 방지)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    if (!user || !authKey) { snack('관리자 로그인이 필요합니다.', 'error'); return }
    setDeleting(true)
    try {
      await deleteNotice({ num: deleteTarget.num, author: user, key: authKey })
      // 삭제 성공 후: 해당 공지의 첨부파일도 스토리지에서 정리(best-effort)
      const attachPaths = (deleteTarget.attachments || []).map((a) => a.path)
      if (attachPaths.length) void removeNoticeFiles(attachPaths).catch(() => {})
      const deletedNum = deleteTarget.num
      setDeleteTarget(null)
      dispatch(loadNoticeData())
      snack('공지를 삭제했습니다.', 'success')
      if (String(num) === String(deletedNum)) navigate('/notice', { replace: true })
    } catch (err) {
      snack(err instanceof Error ? err.message : '삭제 실패', 'error')
    } finally {
      setDeleting(false) // 성공·실패·타임아웃 무엇이든 진행 표시는 반드시 해제
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
    // 아코디언은 openKey state로만 토글 — 예전엔 클릭 시 navigate로 URL을 바꿔 컴포넌트가 리셋되며
    // 스크롤이 최상단으로 튀는 버그가 있었음(rowKey가 pin-X/X를 구분하므로 URL 없이도 정확히 펼침).
    // 주소로 직접 /notice/:num 진입하는 딥링크는 상단 useEffect(num)가 계속 처리.
    const toggle = () => setOpenKey(open ? null : rowKey)
    return (
      <Fragment key={rowKey}>
        <TableRow
          hover
          sx={(th) => ({
            // 종료글은 더 흐리게(0.3) · 진행중은 그대로(상대 대비로 더 또렷)
            opacity: isExpired(n) ? 0.3 : 1,
            '& > td': {
              // 표준(DataTable): 기본행=투명(카드면 비침)+행 hover / 펼침=블루 틴트 / 상단고정만 예외로 살짝 떠오른 표면
              bgcolor: open ? alpha(th.palette.accent.blue, 0.12) : isCopy ? th.palette.background.elevated : 'transparent',
              borderBottom: open ? 0 : undefined,
            },
          })}
        >
          <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
            {isCopy
              ? <PushPinIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
              : (
                // 같은 번호의 상단고정 복사본이 펼쳐져 있으면 원본 번호에 동그라미 강조
                <Box
                  component="span"
                  sx={(th) => ({
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 22, height: 22, px: '4px', borderRadius: radius.circle, fontVariantNumeric: 'tabular-nums',
                    transition: 'border-color .15s, color .15s',
                    ...(openKey === `pin-${n.num}`
                      ? { border: `1.5px solid ${th.palette.accent.amber}`, color: th.palette.accent.amber, fontWeight: 700 }
                      : { color: th.palette.text.disabled }),
                  })}
                >
                  {n.num}
                </Box>
              )}
          </TableCell>
          <TableCell sx={{ textAlign: 'center' }}><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
          {/* 아코디언 활성 영역 = 제목 셀만(행 전체 아님) */}
          <TableCell
            role="button"
            tabIndex={0}
            aria-label={`공지: ${n.title}`}
            aria-expanded={open}
            onClick={toggle}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
            sx={{ color: 'text.primary', cursor: 'pointer', '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, width: 'fit-content', maxWidth: '100%' }}>
              {isExpired(n) && <Box component="span" sx={{ flexShrink: 0 }}><StatusChip status="neutral" label="종료" /></Box>}
              <Typography className="notice-title" variant="body2" sx={{ fontWeight: isCopy ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', md: 'nowrap' }, minWidth: 0 }}>
                {n.dept ? `[${n.dept}] ` : ''}{n.title}
              </Typography>
              {n.isNew && (
                <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: 'error.main', color: 'common.white', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
              )}
              {link && (
                <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="첨부/관련자료 열기" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                  <OpenInNewIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              )}
            </Box>
          </TableCell>
          <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', textAlign: 'center', display: { xs: 'none', sm: 'table-cell' } }}>{n.author || '-'}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-end', md: 'space-between' }, gap: 1 }}>
              <Box component="span" sx={{ color: 'text.disabled', fontFamily: 'monospace', display: { xs: 'none', md: 'inline' } }}>{n.date}</Box>
              <ExpandMoreIcon sx={{ fontSize: iconSize.action, color: 'text.disabled', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </Box>
          </TableCell>
          {/* 첨부 유무 — DS 표준 첨부 표식 = AttachFile 클립(손그림 플로피 SVG 폐지, 사용자 확정 2026-07-13) */}
          <TableCell sx={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
            {!!n.attachments?.length && (
              <Tooltip title={`첨부파일 ${n.attachments.length}개`}>
                <AttachFileIcon
                  aria-label={`첨부파일 ${n.attachments.length}개`}
                  sx={{ fontSize: iconSize.body, color: 'text.secondary', verticalAlign: 'middle' }}
                />
              </Tooltip>
            )}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <NoticeDetail notice={n} canEdit={isMember} onEdit={startEdit} onDelete={setDeleteTarget} />
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
        updatedAt={error ? '불러오기 실패' : undefined}
        actions={
          <IconButton aria-label="새로고침" onClick={refresh} disabled={loading} size="small" sx={{ color: 'text.secondary' }}>
            <RefreshIcon sx={{ fontSize: iconSize.header }} />
          </IconButton>
        }
      />

      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        {/* 상단 필터 바 — 공용 FilterToolbar(박스+칩+검색+새글). 분류 칩은 아이콘 없이(사용자 확정). */}
        <FilterToolbar
          label="분류"
          search={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·분류 검색" width={200} />}
          actions={isMember ? (
            <Button variant={composing ? 'contained' : 'outlined'} size="small" startIcon={<EditNoteIcon sx={{ fontSize: iconSize.action }} />} onClick={startCompose} sx={{ whiteSpace: 'nowrap' }}>
              새 공지
            </Button>
          ) : undefined}
        >
          {NOTICE_CATS.map((c) => {
            const on = catSelected(c)
            const color = catColor(theme, c)
            return (
              <TintChip
                key={c}
                on={on}
                color={color}
                ariaLabel={`${c} ${catCounts[c] || 0}건${on ? '' : ' (해제됨)'}`}
                onToggle={() => toggleCat(c)}
                sx={{ p: '4px 10px', color }}
              >
                <Box component="span" sx={{ fontSize: 12, fontWeight: 600 }}>{c}</Box>
                <Box component="span" sx={{ fontSize: 11, opacity: 0.7 }}>{catCounts[c] || 0}</Box>
              </TintChip>
            )
          })}
        </FilterToolbar>

        {!ready ? (
          <AppCard padding={18}><LoadingState /></AppCard>
        ) : showEmpty ? (
          <AppCard padding={0}><EmptyState size="sm" title="공지사항이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0} sx={{ overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: { xs: 0, md: 640 }, ...dataTableSx }}>
                <TableHead>
                  <TableRow sx={dataTableHeadSx}>
                    <TableCell sx={{ width: 48 }}>번호</TableCell>
                    <TableCell sx={{ width: 68 }}>분류</TableCell>
                    <TableCell sx={{ textAlign: 'left !important' }}>제목</TableCell>
                    <TableCell sx={{ width: 100, textAlign: 'center', display: { xs: 'none', sm: 'table-cell' } }}>작성자</TableCell>
                    <TableCell sx={{ width: { xs: 44, md: 120 }, textAlign: { xs: 'right', md: 'left' } }}>작성일</TableCell>
                    <TableCell sx={{ width: 52, textAlign: 'center' }}>첨부</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isMember && composing && (
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
                      <TableCell colSpan={6} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>공지사항이 없습니다</TableCell>
                    </TableRow>
                  )}
                  {/* 전체 최신순(원본) */}
                  {filtered.map((n) =>
                    isMember && editingId === n.id
                      // key는 renderRow 원본 행과 동일한 String(n.num) 사용 — n.id(위치기반 idx+1)를 쓰면
                      // 다른 행의 n.num과 충돌(id=13-num)해 React 재조정이 깨지고 저장 후 폼/스피너가 안 사라짐.
                      ? <NoticeCompose key={String(n.num)} mode="edit" notice={n} author={user || '-'} saving={saving} deptOptions={deptOptions} deptMgrOptions={deptMgrOptions} onSave={(v) => handleSaveEdit(n, v)} onCancel={() => setEditingId(null)} />
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
    </PageContainer>
  )
}
