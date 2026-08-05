import { Fragment, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Collapse from '@mui/material/Collapse'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { TintChip } from '@/components/FilterChip'
import CampaignIcon from '@mui/icons-material/Campaign'
import RefreshIcon from '@mui/icons-material/Refresh'
import EditNoteIcon from '@mui/icons-material/EditNote'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import PushPinIcon from '@mui/icons-material/PushPin'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import {
  PageContainer,
  PageHeader,
  ContentSection,
  AppCard,
  StatusChip,
  EmptyState,
  ErrorBanner,
  SearchBar,
  LoadingState,
  FilterToolbar,
  dataTableSx,
  statusTextColor,
  useSnack,
  ConfirmDialog,
} from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { iconSize, radius, control, typescale, weight } from '@/theme/tokens'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { useMarkSeen } from '@/layouts/useNavBadges'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { addNotice, updateNotice, deleteNotice, removeNoticeFiles } from '@/api/notices'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import { nextFilterList } from '@/utils/filterSelect'
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

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error } = useAppSelector((s) => s.notice)
  // 공지 작성/수정 = 팀원(member)+관리자. (게스트·유관자는 열람만)
  // 삭제만 예외 — 작성자 본인 또는 포털 관리자(2026-08-05)
  const { isMember, isAdmin, user, authKey } = useRole()
  const canDelete = (n: NoticeItem) => isMember && (n.author === user || isAdmin)
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
  // 행 끝 '더보기' 메뉴 — 펼치지 않고 목록에서 바로 수정·삭제(팀원 이상)
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; n: NoticeItem } | null>(null)

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
  const toggleCat = (c: string, additive: boolean) => setSelCats((prev) => nextFilterList(prev, c, additive))

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

  const closeMenu = () => setMenuFor(null)
  // 메뉴 항목 실행 — 기존 핸들러(startEdit·setDeleteTarget)를 그대로 재사용
  const act = (fn: (n: NoticeItem) => void) => (e: MouseEvent) => {
    e.stopPropagation()
    if (menuFor) fn(menuFor.n)
    closeMenu()
  }

  const refresh = () => {
    setSelCats([]); setQuery(''); setComposing(false); setEditingId(null)
    if (num) navigate('/notice', { replace: true })
    dispatch(loadNoticeData())
  }

  const handleSaveNew = async (v: NoticeFormValues) => {
    if (saving) return
    if (!user || !authKey) return snack('로그인이 필요합니다.', 'error')
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
    if (!user || !authKey) return snack('로그인이 필요합니다.', 'error')
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
    if (!user || !authKey) { snack('로그인이 필요합니다.', 'error'); return }
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
            // 종료 표시는 행 전체 opacity가 아니라 제목 톤으로만 한다. opacity는 모든 자식에 곱해져
            // 분류칩·첨부아이콘·작성일까지 라이트 2.2~2.4:1로 깎았다('종료' 칩이 이미 상태를 말해준다).
            '& > td': {
              // 표준(DataTable): 기본행=투명(카드면 비침)+행 hover / 펼침=블루 틴트 / 상단고정만 예외로 살짝 떠오른 표면
              bgcolor: open ? alpha(th.palette.accent.blue, 0.12) : isCopy ? 'var(--surface-selected)' : 'transparent',
              borderBottom: open ? 0 : undefined,
            },
          })}
        >
          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
            {isCopy
              ? <PushPinIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accentText.amber })} />
              : (
                // 같은 번호의 상단고정 복사본이 펼쳐져 있으면 원본 번호에 동그라미 강조
                <Box
                  component="span"
                  sx={(th) => ({
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 22, height: 22, px: '4px', borderRadius: radius.circle, fontVariantNumeric: 'tabular-nums',
                    transition: 'border-color .15s, color .15s',
                    ...(openKey === `pin-${n.num}`
                      ? { border: `1.5px solid ${th.palette.accent.amber}`, color: th.palette.accentText.amber, fontWeight: weight.bold }
                      : { color: th.palette.text.secondary }),
                  })}
                >
                  {n.num}
                </Box>
              )}
          </TableCell>
          <TableCell align="center"><StatusChip status={noticeCatStatus(n.cat)} label={n.cat || '공지'} /></TableCell>
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
              {/* 행의 식별자 — variant body2는 테마에서 색이 보조톤이라 주 톤을 명시해야 제목이 눌리지 않는다 */}
              {/* 제목은 14px + 주 톤만으로 이미 식별자 — 굵기는 "상단고정"을 알리는 신호로 아껴 쓴다
                  (전부 700으로 두면 굵기가 아무 정보도 전달하지 못함) */}
              <Typography variant="body2" sx={{ flex: 1, color: isExpired(n) ? 'text.secondary' : 'text.primary', fontSize: typescale.emphasis.size, fontWeight: isCopy ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: { xs: 'normal', md: 'nowrap' }, minWidth: 0 }}>
                {n.dept ? `[${n.dept}] ` : ''}{n.title}
              </Typography>
              {n.isNew && (
                <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: (t) => t.palette.accent.red, color: (t) => t.palette.getContrastText(t.palette.accent.red), fontSize: typescale.micro.size, fontWeight: weight.bold, lineHeight: 1 }}>N</Box>
              )}
              {link && (
                <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="첨부/관련자료 열기" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                  <OpenInNewIcon sx={{ fontSize: iconSize.body }} />
                </IconButton>
              )}
            </Box>
          </TableCell>
          <TableCell align="center" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{n.author || '-'}</TableCell>
          {/* 날짜만 — 구 펼침 화살표는 삭제했다(2026-08-01). 클릭 대상은 제목 셀인데 화살표는 이 셀에
              있어서 눌러도 아무 일이 없는 가짜 버튼이었고, 펼칠 수 있다는 신호는 제목 셀 호버가 이미 준다. */}
          <TableCell align="center" sx={{ color: 'text.secondary', fontFamily: 'monospace', whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>
            {n.date}
          </TableCell>
          {/* 첨부 유무 — DS 표준 첨부 표식 = AttachFile 클립(손그림 플로피 SVG 폐지, 사용자 확정 2026-07-13) */}
          <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
            {!!n.attachments?.length && (
              <Tooltip title={`첨부파일 ${n.attachments.length}개`}>
                <AttachFileIcon
                  aria-label={`첨부파일 ${n.attachments.length}개`}
                  sx={{ fontSize: iconSize.body, color: 'text.secondary', verticalAlign: 'middle' }}
                />
              </Tooltip>
            )}
          </TableCell>
          {/* 더보기 — 펼치지 않고 목록에서 바로 수정·삭제(팀원 이상, 게스트는 열 자체가 없음) */}
          {isMember && (
            <TableCell align="center" onClick={stop} sx={{ whiteSpace: 'nowrap' }}>
              <IconButton
                size="small"
                aria-label="더보기"
                onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, n }) }}
                sx={{ color: 'text.secondary', p: 0.25, flexShrink: 0 }}
              >
                <MoreVertIcon sx={{ fontSize: iconSize.action }} />
              </IconButton>
            </TableCell>
          )}
        </TableRow>
        <TableRow>
          <TableCell colSpan={isMember ? 7 : 6} sx={{ p: 0, border: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <NoticeDetail notice={n} canEdit={isMember} canDelete={canDelete(n)} onEdit={startEdit} onDelete={setDeleteTarget} />
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

      {/* 불러오기 실패 — '공지 없음'으로 오해하지 않게 정직하게 알리고 재시도 제공(백로그 C2).
          기존 목록이 남아 있으면 경고(갱신만 실패), 아예 없으면 오류. */}
      {error && (
        <ErrorBanner
          severity={items.length > 0 ? 'warning' : 'error'}
          message={
            items.length > 0
              ? '공지 새로고침에 실패했습니다. 마지막으로 불러온 목록을 표시 중입니다.'
              : '공지사항을 불러오지 못했습니다.'
          }
          onRetry={refresh}
        />
      )}

      <ContentSection title="공지 목록" count={`${filtered.length}건`} last>
        {/* 상단 필터 바 — 공용 FilterToolbar(박스+칩+검색+새글). 분류 칩은 아이콘 없이(사용자 확정). */}
        <FilterToolbar
          label="분류"
          search={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·분류 검색" width={200} />}
          actions={isMember ? (
            <Button variant={composing ? 'contained' : 'outlined'} size="small" startIcon={<EditNoteIcon sx={{ fontSize: iconSize.action }} />} onClick={startCompose} sx={{ whiteSpace: 'nowrap', minHeight: control.height }}>
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
                onToggle={(additive) => toggleCat(c, additive)}
                sx={{ p: '4px 10px' }}
              >
                {/* 라벨은 중립톤 — 분류색은 배경 틴트가 이미 전달한다. 글자에 accent를 쓰면
                    같은 색 틴트 위라 대비가 2.1~3.6:1로 무너짐(개선요청·업무·일정 칩과 동일 규칙) */}
                <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, color: (t) => (on ? statusTextColor(t, noticeCatStatus(c)) : t.palette.text.secondary) }}>{c}</Box>
                <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.secondary' }}>{catCounts[c] || 0}</Box>
              </TintChip>
            )
          })}
        </FilterToolbar>

        {!ready ? (
          <AppCard padding={16}><LoadingState /></AppCard>
        ) : showEmpty ? (
          // 불러오기 실패로 비었으면 위 배너가 이미 설명 — '없습니다'를 겹쳐 띄우면 데이터가 원래 없는 걸로 오해됨
          error && items.length === 0 ? null : <AppCard padding={0}><EmptyState size="sm" title="공지사항이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0} sx={{ overflow: 'hidden' }}>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: { xs: 0, md: 640 }, ...dataTableSx }}>
                <TableHead>
                  {/* 정렬은 셀 align prop 으로만 — 구 dataTableHeadSx 의 '& th'(특이도 0-1-1)가
                      셀 sx(0-1-0)를 이겨서 여기 적힌 정렬이 조용히 죽고 있었다(작성일이 실제로 그랬다).
                      그래서 제목만 !important 로 버티고 있었는데, 그것도 이제 필요 없다. */}
                  <TableRow>
                    <TableCell align="center" sx={{ width: 48 }}>번호</TableCell>
                    <TableCell align="center" sx={{ width: 68 }}>분류</TableCell>
                    <TableCell align="left">제목</TableCell>
                    <TableCell align="center" sx={{ width: 100, display: { xs: 'none', sm: 'table-cell' } }}>작성자</TableCell>
                    <TableCell align="center" sx={{ width: 120, display: { xs: 'none', md: 'table-cell' } }}>작성일</TableCell>
                    <TableCell align="center" sx={{ width: 52 }}>첨부</TableCell>
                    {/* 더보기 열 — 라벨 없음(팀원 이상만) */}
                    {isMember && <TableCell align="center" sx={{ width: 52 }} />}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isMember && composing && (
                    <NoticeCompose mode="new" author={user || '-'} saving={saving} deptOptions={deptOptions} deptMgrOptions={deptMgrOptions} onSave={handleSaveNew} onCancel={() => setComposing(false)} />
                  )}
                  {/* 상단고정 그룹(종료 공지는 자동 해제). 원본은 아래 최신순 목록에 그대로 남음.
                      그라데이션 구분선은 제거 — 고정글은 압정 아이콘·굵은 제목·떠오른 배경으로 이미 구분되고,
                      그라데이션은 앱 어디에도 없는 장식이라 이질적이었음(사용자 확정) */}
                  {pinnedCopies.length > 0 && pinnedCopies.map((n) => renderRow(n, true))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isMember ? 7 : 6} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>공지사항이 없습니다</TableCell>
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

      {/* 행 끝 더보기 메뉴 — 삭제는 기존 확인 다이얼로그(아래)로 이어진다 */}
      {isMember && (
        <Menu
          anchorEl={menuFor?.el ?? null}
          open={!!menuFor}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } } }}
        >
          <MenuItem onClick={act(startEdit)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>수정</ListItemText>
          </MenuItem>
          {/* 삭제는 작성자 본인 또는 포털 관리자만(2026-08-05) */}
          {menuFor && canDelete(menuFor.n) && (
            <MenuItem onClick={act(setDeleteTarget)} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText>삭제</ListItemText>
            </MenuItem>
          )}
        </Menu>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        destructive
        title="공지를 삭제할까요?"
        description={`「${deleteTarget?.title || ''}」 공지를 삭제합니다. 삭제 후 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        busy={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </PageContainer>
  )
}
