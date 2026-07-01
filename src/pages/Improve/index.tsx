import { useMemo, useRef, useState } from 'react'
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
import CircularProgress from '@mui/material/CircularProgress'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { addReply, patchReply, removeReply } from '@/store/slices/replySlice'
import { updateImprovement, deleteImprovement, createImprovements, fetchDrafts, saveDrafts, deleteDrafts, createReply, updateReply, deleteReply, type ReplyRow } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { fmtDate, todaySeoul } from '@/utils/date'
import { isImproveNew } from '@/utils/newPost'
import { locationToPath } from '@/utils/improveMemo'
import type { ImprovementItem } from '@/types'
import ReplyThread from './ReplyThread'
import { IMP_STATUSES, impKind, needsReason, remarkOf, normStatus, statusRank, isSettled } from './improveMeta'
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

// 위치/유형 드롭다운 — 화살표 버튼, 클릭 시 시트 목록 표시 (선택만).
// 기존 값이 목록에 없으면(예: 모바일) 그 값을 메뉴에 포함해 표시·보존(강제 변경 방지).
function DropField({ value, onChange, options, placeholder, width }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; width: number }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options
  return (
    <Select
      value={opts.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      variant="standard"
      disableUnderline
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      renderValue={(v) => (v ? <span>{v}</span> : <Box component="span" sx={{ color: 'text.disabled' }}>{placeholder}</Box>)}
      sx={(th) => ({
        ...inputSx(th), width, maxWidth: '100%', height: 32,
        '& .MuiSelect-select': { p: 0, pl: '20px !important', pr: '20px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translateX(-4px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {opts.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
    </Select>
  )
}

// 제목 행 셀 즉시 변경용 Select — 상태 Select와 동일한 미니멀 디자인(표준·밑줄 없음·작은 화살표).
// 기존 값이 목록에 없으면(예: 모바일) 그 값을 표시·보존.
function CellSelect({ value, options, onChange, disabled, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; disabled: boolean; placeholder: string }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options
  return (
    <Select
      value={opts.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      displayEmpty
      variant="standard"
      disableUnderline
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      renderValue={(v) => (v ? <Box component="span">{v}</Box> : <Box component="span" sx={{ color: 'text.disabled' }}>{placeholder}</Box>)}
      sx={{
        fontSize: 12.5, color: 'text.primary', maxWidth: '100%',
        '& .MuiSelect-select': { p: 0, pr: '18px !important', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
        '& .MuiSelect-icon': { right: -2, fontSize: 18, color: 'text.secondary' },
      }}
    >
      {opts.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>)}
    </Select>
  )
}

// 긴급 토글 박스 — 켜짐=빨강 채움 '!' / 꺼짐=외곽선. 인라인 수정·작성 모달 카드 공용.
function UrgentBox({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Tooltip title={on ? '긴급 해제' : '긴급'}>
      <Box
        role="checkbox" aria-checked={on} aria-label="긴급" tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        sx={(th) => ({
          width: 24, height: 24, borderRadius: '5px', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, lineHeight: 1,
          border: '1px solid',
          ...(on
            ? { bgcolor: th.palette.accent.red, borderColor: th.palette.accent.red, color: '#fff' }
            : { borderColor: th.palette.divider, color: 'text.disabled', bgcolor: 'transparent' }),
        })}
      >!</Box>
    </Tooltip>
  )
}

// 작성 모달 카드 — 아직 게시되지 않은 개선요청 초안. key=React 키(로컬), id=시트 임시저장ID(신규는 빈값).
type DraftCard = { key: number; id: string; urgent: boolean; title: string; loc: string; link: string; content: string }

export default function Improve() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt, locOptions: sheetLoc } = useAppSelector((s) => s.improve)
  const replies = useAppSelector((s) => s.reply.items)
  const { isAdmin, user, authKey } = useRole()

  const [selected, setSelected] = useState<Set<ImpStatus>>(new Set()) // 비었으면 전체
  const [openId, setOpenId] = useState<number | null>(null) // 아코디언 — 한 번에 하나만 펼침
  const [reasonDlg, setReasonDlg] = useState<ReasonDlg | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [snack, setSnack] = useState<Snack>({ open: false, msg: '', severity: 'success' })
  // 답글 — 요청번호별 그룹화(작성일시 오름차순) + 등록/삭제 진행중 플래그 + 삭제 확인 대상
  const [replyBusy, setReplyBusy] = useState(false)
  const [delReply, setDelReply] = useState<ReplyRow | null>(null)
  const repliesByReq = useMemo(() => {
    const m: Record<string, ReplyRow[]> = {}
    for (const r of replies) (m[r.reqNum] ||= []).push(r)
    for (const k in m) m[k].sort((a, b) => a.created.localeCompare(b.created))
    return m
  }, [replies])
  // 아코디언 열기/토글 — 다른 글 열면 기존 닫힘. 전환 시 답글 입력/편집 상태는 ReplyThread 리마운트로 초기화(key=t.id).
  const toggleRow = (id: number) => setOpenId((prev) => (prev === id ? null : id))

  // 수정(목록 내 in-place) / 삭제 확인 — 수정 입력은 c* 상태 공용
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteDlg, setDeleteDlg] = useState<ImprovementItem | null>(null)
  const [cUrgent, setCUrgent] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cLoc, setCLoc] = useState('')
  const [cLink, setCLink] = useState('')
  const [cContent, setCContent] = useState('')

  // 새 개선요청 작성 모달(#12 멀티카드 + #8 배경클릭 닫힘 비활성 + #9 수동 임시저장)
  const [composeOpen, setComposeOpen] = useState(false)
  const [cards, setCards] = useState<DraftCard[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const cardSeq = useRef(0)

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

  // 개선위치 드롭다운 — 시트 데이터 확인 목록 우선, 없으면 기존 데이터에서 추출. (유형 항목은 제거됨)
  const locOptions = useMemo(() => (sheetLoc.length ? sheetLoc : [...new Set(items.map((t) => t.loc).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))), [items, sheetLoc])

  const onTab = (s: ImpStatus, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift) { next.has(s) ? next.delete(s) : next.add(s); return next }
      if (next.size === 1 && next.has(s)) return new Set()
      return new Set([s])
    })
  }

  // 수정(상태·위치·유형·내용·사유·메모) = 로그인 관리자 전체 / 삭제 = 해당 글 담당자(작성자)만
  const canEdit = isAdmin && !!user && !!authKey
  const canDelete = (t: ImprovementItem) => isAdmin && !!user && user === (t.mgr || '').trim()
  // 작업 메모 열은 로그인 관리자에게만 노출(게스트 미노출). 열 개수 = 메모열 유무에 따라 8/9.
  const memoCol = canEdit
  // 유형 열 제거로 열 수 1 감소
  const detailSpan = memoCol ? 7 : 6
  const fullSpan = memoCol ? 8 : 7

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

  // 제목 행에서 개선위치만 즉시 변경(다른 필드 미변경). 행 단위 savingId로 동시 변경 방지.
  const saveField = async (row: ImprovementItem, patch: { loc: string }) => {
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    setSavingId(row.id)
    try {
      await updateImprovement({ author: user, key: authKey, num: row.num, ...patch })
      setSavingId(null)
      showSnack('개선위치를 변경했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSavingId(null)
      showSnack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }

  // 작업 메모 띄우기/해제 — 메모표시 토글(다른 필드 미변경). 행 단위 savingId로 동시 변경 방지.
  const toggleMemo = async (row: ImprovementItem, next: boolean) => {
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    setSavingId(row.id)
    try {
      await updateImprovement({ author: user, key: authKey, num: row.num, memo: next })
      setSavingId(null)
      showSnack(next ? '해당 페이지에 메모를 띄웠습니다.' : '메모를 해제했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setSavingId(null)
      showSnack(err instanceof Error ? err.message : '메모 변경 실패', 'error')
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
    setCLink(t?.link ?? ''); setCContent(t?.content ?? '')
  }
  const openEdit = (t: ImprovementItem) => {
    resetCompose(t)
    setEditingId(t.id)
    setOpenId(t.id) // 펼쳐진 상태로 편집
  }

  // ── 새 개선요청 작성 모달(멀티카드) ──
  const blankCard = (): DraftCard => ({ key: (cardSeq.current += 1), id: '', urgent: false, title: '', loc: '', link: '', content: '' })
  const toCards = (rows: { id: string; urgent: boolean; title: string; loc: string; link: string; content: string }[]): DraftCard[] =>
    rows.map((r) => ({ key: (cardSeq.current += 1), id: r.id, urgent: r.urgent, title: r.title, loc: r.loc, link: r.link, content: r.content }))

  // 열기 = 저장된 임시저장 불러오기(없으면 빈 카드 1개). 실패해도(미배포) 빈 카드로 시작.
  const openCompose = async () => {
    setComposeOpen(true)
    setCards([])
    if (!user || !authKey) { setCards([blankCard()]); return }
    setDraftsLoading(true)
    try {
      const rows = await fetchDrafts({ author: user, key: authKey })
      setCards(rows.length ? toCards(rows) : [blankCard()])
    } catch (err) {
      setCards([blankCard()])
      showSnack(err instanceof Error ? err.message : '임시저장 불러오기 실패', 'error')
    } finally {
      setDraftsLoading(false)
    }
  }

  const patchCard = (key: number, patch: Partial<DraftCard>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  const addCard = () => setCards((cs) => [...cs, blankCard()]) // 새 카드 개선위치 미승계(빈 카드)
  const removeCard = (key: number) => setCards((cs) => { const next = cs.filter((c) => c.key !== key); return next.length ? next : [blankCard()] })

  const cardDirty = (c: DraftCard) => !!(c.title.trim() || c.content.trim() || c.link.trim() || c.loc.trim() || c.urgent)
  const isDirty = cards.some(cardDirty)
  const publishable = cards.filter((c) => c.title.trim())

  const doClose = () => { setComposeOpen(false); setCloseConfirm(false); setCards([]) }
  // 배경클릭·Esc로는 닫히지 않음(#8). X/취소만 호출 — 내용 있으면 확인 팝업.
  const requestClose = () => { if (savingDraft || publishing) return; if (isDirty) setCloseConfirm(true); else doClose() }

  const draftPayload = () => cards.filter(cardDirty).map((c) => ({ id: c.id || undefined, urgent: c.urgent, title: c.title.trim(), loc: c.loc.trim(), link: c.link.trim(), content: c.content.trim() }))

  const handleSaveDrafts = async (thenClose: boolean) => {
    if (savingDraft || publishing) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    const payload = draftPayload()
    // 저장할 내용이 없으면 서버를 건드리지 않는다(기존 저장분 파괴적 삭제 방지)
    if (!payload.length) {
      if (thenClose) doClose()
      else { setCloseConfirm(false); showSnack('저장할 내용이 없습니다.', 'info') }
      return
    }
    setSavingDraft(true)
    try {
      const rows = await saveDrafts({ author: user, key: authKey, drafts: payload })
      setSavingDraft(false)
      if (thenClose) { doClose(); showSnack('임시저장 후 닫았습니다.', 'success') }
      else { setCards(rows.length ? toCards(rows) : [blankCard()]); setCloseConfirm(false); showSnack('임시저장했습니다.', 'success') }
    } catch (err) {
      setSavingDraft(false)
      showSnack(err instanceof Error ? err.message : '임시저장 실패', 'error')
    }
  }

  const handlePublish = async () => {
    if (publishing || savingDraft) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!publishable.length) return showSnack('등록할 요청의 제목을 입력해주세요.', 'error')
    // 제목 없이 내용/링크/위치만 채운 카드가 있으면 실수 방지 경고(빈 카드는 무시)
    if (cards.some((c) => !c.title.trim() && (c.content.trim() || c.link.trim() || c.loc.trim())))
      return showSnack('제목이 없는 요청이 있습니다. 제목을 입력하거나 그 카드를 비워주세요.', 'error')
    setPublishing(true)
    try {
      await createImprovements({ author: user, key: authKey, items: publishable.map((c) => ({ urgent: c.urgent, loc: c.loc.trim(), title: c.title.trim(), content: c.content.trim(), link: c.link.trim() })) })
      // 방금 게시한(임시저장에서 온) 항목만 정리 — 게시하지 않은 저장분은 보존
      const usedIds = publishable.map((c) => c.id).filter(Boolean)
      if (usedIds.length) { try { await deleteDrafts({ author: user, key: authKey, ids: usedIds }) } catch { /* 임시저장 정리 실패는 치명적 아님 */ } }
      setPublishing(false)
      doClose()
      showSnack(`${publishable.length}건을 등록했습니다.`, 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setPublishing(false)
      showSnack(err instanceof Error ? err.message : '일괄등록 실패', 'error')
    }
  }

  const handleEdit = async (t: ImprovementItem) => {
    if (saving) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    if (!cTitle.trim()) return showSnack('제목을 입력해주세요.', 'error')
    setSaving(true)
    try {
      // 상태는 건드리지 않고 내용 필드만 수정(완료일자·사유 보존)
      await updateImprovement({ author: user, key: authKey, num: t.num, urgent: cUrgent, loc: cLoc.trim(), title: cTitle.trim(), content: cContent.trim(), link: cLink.trim() })
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

  // ── 답글 (낙관적 업데이트 — 성공 시 store 즉시 반영 → 칩 개수·목록 즉시 갱신) ──
  const createReplyH = async (reqNum: string, content: string) => {
    if (!user || !authKey) { showSnack('로그인이 필요합니다.', 'error'); throw new Error('no-auth') }
    setReplyBusy(true)
    try {
      const { id, created } = await createReply({ author: user, key: authKey, reqNum, content })
      // 서버가 작성일시를 누락(구버전 배포)해도 정렬·표시가 깨지지 않게 클라 폴백(정렬 가능한 yyyy-MM-dd HH:mm:ss)
      const createdAt = created || `${todaySeoul()} 00:00:00`
      dispatch(addReply({ id, reqNum, created: createdAt, author: user, content, edited: '' }))
      setReplyBusy(false)
      showSnack('답글을 등록했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      showSnack(err instanceof Error ? err.message : '답글 등록 실패', 'error')
      throw err // 실패 시 입력 유지
    }
  }
  const editReplyH = async (id: string, content: string) => {
    if (!user || !authKey) { showSnack('로그인이 필요합니다.', 'error'); throw new Error('no-auth') }
    setReplyBusy(true)
    try {
      const { edited } = await updateReply({ author: user, key: authKey, id, content })
      dispatch(patchReply({ id, content, edited: edited || `${todaySeoul()} 00:00` }))
      setReplyBusy(false)
      showSnack('답글을 수정했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      showSnack(err instanceof Error ? err.message : '답글 수정 실패', 'error')
      throw err
    }
  }
  const confirmDelReply = async () => {
    if (!delReply || !user || !authKey) return
    setReplyBusy(true)
    try {
      await deleteReply({ author: user, key: authKey, id: delReply.id })
      dispatch(removeReply(delReply.id))
      setReplyBusy(false)
      setDelReply(null)
      showSnack('답글을 삭제했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      showSnack(err instanceof Error ? err.message : '답글 삭제 실패', 'error')
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // 수정 인라인 행(목록과 동일한 열 정렬 구조). 제목줄 배경 클릭 시 접힘(입력 셀은 stopPropagation).
  // 신규 작성은 별도 멀티카드 모달(아래 composeOpen)로 분리됨.
  const renderEditRow = (t: ImprovementItem) => {
    const onCancel = () => setEditingId(null)
    const onSave = () => void handleEdit(t)
    const author = t.author || '-'
    const dateStr = fmtDate(t.date || '')
    const stLabel = normStatus(t.status || '')
    const stKind: StatusKind = impKind(stLabel)
    const kb = `edit-${t.id}`
    const greenBg = (th: Theme) => alpha(th.palette.accent.green, 0.06)
    return [
      <TableRow key={`${kb}-1`} onClick={onCancel} sx={{ cursor: 'pointer', '& td': { verticalAlign: 'middle', bgcolor: greenBg, py: 1 } }}>
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}><Box sx={{ display: 'flex', justifyContent: 'center' }}><UrgentBox on={cUrgent} onToggle={() => setCUrgent((v) => !v)} /></Box></TableCell>
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
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5 }}>{author}</TableCell>
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</TableCell>
        <TableCell sx={{ textAlign: 'center' }}><StatusChip status={stKind} label={stLabel} /></TableCell>
        <TableCell />
        {memoCol && <TableCell />}
      </TableRow>,
      <TableRow key={`${kb}-2`} sx={{ '& td': { borderTop: 0, bgcolor: greenBg, py: 0.75, verticalAlign: 'middle' } }}>
        <TableCell />
        <TableCell colSpan={memoCol ? 6 : 5} onClick={stop} sx={{ textAlign: 'left' }}>
          <InputBase
            value={cContent}
            onChange={(e) => setCContent(e.target.value)}
            placeholder="요청내용"
            multiline
            minRows={1}
            inputProps={{ 'aria-label': '요청내용' }}
            sx={(th) => ({ ...inputSx(th), width: '100%', minHeight: 32, py: '6px' })}
          />
        </TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title="수정 저장">
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
                      // &&로 우선순위를 높여 MUI Chip 기본 hover(배경 옅어짐)를 덮어씀 → 선택/호버 모두 채운 상태 유지
                      '&&:hover': { bgcolor: c, color: t.palette.common.white, borderColor: c },
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
              onClick={() => void openCompose()}
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              sx={(th) => {
                const c = th.palette.accent.green
                const on = composeOpen // 작성 모달이 열리면 초록 채움+흰 글자로 전환
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
                <TableCell sx={{ width: '1%' }}>작성자</TableCell>
                <TableCell sx={{ width: '1%' }}>제안일자</TableCell>
                <TableCell sx={{ width: '1%' }}>상태</TableCell>
                <TableCell sx={{ width: '1%' }}>비고</TableCell>
                {memoCol && <TableCell sx={{ width: '1%' }}>작업 메모</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* 신규 작성은 멀티카드 모달(우상단 '새 요청' 버튼)로 분리 — 표에는 수정 인라인만 */}
              {listed.length === 0 && (
                <TableRow>
                  <TableCell colSpan={fullSpan} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>해당하는 요청이 없습니다</TableCell>
                </TableRow>
              )}
              {listed.map((t) => {
                if (editingId === t.id) return renderEditRow(t) // 수정: 그 자리에서 인라인 편집(열 정렬 동일)
                const open = openId === t.id
                const rm = remarkOf(t)
                const st = normStatus(t.status)
                const kind = impKind(st) // 행 배경 상태색 틴트용
                const editable = canEdit // 상태·위치·유형·내용·사유 수정 = 로그인 관리자 전체
                const removable = canDelete(t) // 삭제 = 해당 글 담당자(작성자)만
                const isNew = isImproveNew(t) // 접수·검토중·보류 + 제안일자 최근 7일(사이드바와 동일 판정)
                const rowReplies = repliesByReq[t.num] || [] // 이 요청의 답글(삭제 제외)
                const toggle = () => toggleRow(t.id)
                // 작업 메모 핀 — 켜짐=앰버 PushPin / 꺼짐=PushPinOutlined. 종결상태·연결페이지 없으면 활성 불가.
                const memoOn = t.memo === true
                const memoTarget = locationToPath(t.loc) // null = 기타/연결 페이지 없음
                const memoBlocked = !memoOn && (!memoTarget || isSettled(t.status))
                const memoTip = memoOn
                  ? '메모 해제'
                  : !memoTarget
                    ? '연결할 페이지가 없습니다 (기타 위치)'
                    : isSettled(t.status)
                      ? '종결 상태(보류·완료·불가)는 메모를 띄울 수 없습니다'
                      : '해당 페이지에 띄우기'
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
                        {/* 제목 → 최근글 N칩 → 답글 +N칩 → 링크 순. 모두 줄어들지 않게 flexShrink:0 */}
                        {isNew && (
                          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: '4px', bgcolor: 'error.main', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
                        )}
                        {/* 답글 +N — 삭제 안 된 답글이 있을 때만. 파란 칩(왼쪽 점 없음), 상태와 무관. 클릭 시 행 토글로 아코디언 펼침 */}
                        {rowReplies.length > 0 && (
                          <Box component="span" sx={(th) => ({ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 18, px: '7px', borderRadius: '9px', fontSize: 10.5, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap', color: th.palette.accent.blue, bgcolor: alpha(th.palette.accent.blue, 0.14), border: `1px solid ${alpha(th.palette.accent.blue, 0.4)}` })}>답글 +{rowReplies.length}</Box>
                        )}
                        {t.link && (
                          <IconButton component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련자료" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                            <OpenInNewIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    {/* 개선위치 — 로그인 관리자는 셀에서 즉시 변경(아코디언 토글 방지: 셀 onClick stop) */}
                    <TableCell onClick={editable ? stop : undefined} sx={{ maxWidth: 140 }}>
                      {editable
                        ? <CellSelect value={t.loc} options={locOptions} disabled={savingId === t.id} placeholder="-" onChange={(v) => { if (v !== (t.loc || '')) void saveField(t, { loc: v }) }} />
                        : (t.loc || '-')}
                    </TableCell>
                    <TableCell>{t.author || '-'}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{fmtDate(t.date)}</TableCell>
                    <TableCell onClick={stop} sx={{ cursor: editable ? 'default' : 'not-allowed' }}>
                      {editable ? (
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
                          onClick={editable ? (e) => { stop(e); setReasonDlg({ row: t, status: st, value: t.reason || '' }) } : undefined}
                          sx={{ color: 'text.secondary', whiteSpace: 'normal', cursor: editable ? 'pointer' : 'default' }}
                        >
                          {rm.text || (editable ? '사유 입력' : '-')}
                        </Box>
                      ) : (
                        <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
                      )}
                    </TableCell>
                    {/* 작업 메모 핀 — 클릭이 아코디언 토글로 전파되지 않게 셀 onClick stop */}
                    {memoCol && (
                      <TableCell onClick={stop} sx={{ textAlign: 'center' }}>
                        <Tooltip title={memoTip}>
                          <span>
                            <IconButton
                              size="small"
                              aria-label={memoTip}
                              disabled={memoBlocked || savingId === t.id}
                              onClick={() => void toggleMemo(t, !memoOn)}
                              sx={(th) => ({ color: memoOn ? th.palette.accent.amber : 'text.disabled', p: 0.5 })}
                            >
                              {memoOn ? <PushPinIcon sx={{ fontSize: 18 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>,
                  open ? (
                    <TableRow key={`${t.id}-a`} sx={(th) => ({ '& td': { borderTop: 0, bgcolor: alpha(th.palette.accent.blue, 0.09) } })}>
                      <TableCell />
                      <TableCell colSpan={detailSpan} sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
                        {/* 원문 내용 + (관리자) 개선요청 수정/삭제 */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                          <Box sx={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'text.primary', lineHeight: 1.7, py: 0.5, flex: 1 }}>{t.content || '내용 없음'}</Box>
                          {(editable || removable) && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, pt: 0.25 }} onClick={stop}>
                              {/* 수정 = 로그인 관리자 전체 / 삭제 = 담당자(작성자)만 */}
                              {editable && <Tooltip title="수정"><IconButton size="small" aria-label="수정" onClick={() => openEdit(t)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
                              {removable && <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="삭제" onClick={() => setDeleteDlg(t)}><DeleteOutlineIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
                            </Box>
                          )}
                        </Box>
                        {/* 답글 — 목록(시간순) + (관리자) 입력창. key=t.id로 행 전환 시 입력/편집 상태 초기화 */}
                        <ReplyThread
                          key={t.id}
                          replies={rowReplies}
                          isAdmin={isAdmin}
                          user={user}
                          busy={replyBusy}
                          onCreate={(content) => createReplyH(t.num, content)}
                          onEdit={editReplyH}
                          onRequestDelete={(r) => setDelReply(r)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ]
              })}
            </TableBody>
          </Table>
        </AppCard>
      </ContentSection>

      {/* 새 개선요청 작성 모달 — 멀티카드 + 임시저장 + 일괄등록. 배경클릭·Esc로 닫히지 않음(X/취소만) */}
      <Dialog
        open={composeOpen}
        onClose={() => { /* 배경클릭·Esc로 닫히지 않음(#8) — X/취소 버튼만 requestClose 호출 */ }}
        fullWidth
        maxWidth="sm"
        scroll="paper"
        slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          <Box component="span">새 개선요청{cards.length > 1 ? ` · ${cards.length}건` : ''}</Box>
          <IconButton aria-label="닫기" onClick={requestClose} disabled={savingDraft || publishing} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {draftsLoading ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} /></Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {cards.map((c, idx) => (
                <Box key={c.key} sx={(th) => ({ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: 1.5, bgcolor: alpha(th.palette.accent.green, 0.04) })}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Box component="span" sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>요청 {idx + 1}</Box>
                    <UrgentBox on={c.urgent} onToggle={() => patchCard(c.key, { urgent: !c.urgent })} />
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="이 카드 삭제">
                      <IconButton size="small" color="error" aria-label="카드 삭제" onClick={() => removeCard(c.key)} disabled={savingDraft || publishing}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
                    </Tooltip>
                  </Box>
                  <InputBase
                    value={c.title}
                    onChange={(e) => patchCard(c.key, { title: e.target.value })}
                    placeholder="제목"
                    inputProps={{ 'aria-label': '제목' }}
                    endAdornment={<LinkField value={c.link} onChange={(v) => patchCard(c.key, { link: v })} />}
                    sx={(th) => ({ ...inputSx(th), width: '100%', height: 36, mb: 1 })}
                  />
                  <Box sx={{ mb: 1 }}><DropField value={c.loc} onChange={(v) => patchCard(c.key, { loc: v })} options={locOptions} placeholder="개선위치" width={160} /></Box>
                  <InputBase
                    value={c.content}
                    onChange={(e) => patchCard(c.key, { content: e.target.value })}
                    placeholder="요청내용"
                    multiline
                    minRows={2}
                    inputProps={{ 'aria-label': '요청내용' }}
                    sx={(th) => ({ ...inputSx(th), width: '100%', py: '8px' })}
                  />
                </Box>
              ))}
              <Button onClick={addCard} startIcon={<AddIcon />} variant="outlined" size="small" disabled={savingDraft || publishing} sx={{ alignSelf: 'flex-start', color: 'text.secondary', borderColor: 'divider' }}>요청 추가</Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => void handleSaveDrafts(false)} disabled={savingDraft || publishing || draftsLoading} sx={{ color: 'text.secondary' }}>{savingDraft ? '임시저장 중…' : '임시저장'}</Button>
          <Box sx={{ flex: 1 }} />
          <Button color="error" onClick={requestClose} disabled={savingDraft || publishing}>취소</Button>
          <Button variant="contained" color="success" onClick={() => void handlePublish()} disabled={publishing || savingDraft || draftsLoading || publishable.length === 0}>{publishing ? '등록 중…' : `${publishable.length}건 등록`}</Button>
        </DialogActions>
      </Dialog>

      {/* 작성 중 닫기 확인 — 임시저장 후 닫기 / 저장 안 함 / 계속 작성 */}
      <Dialog open={closeConfirm} onClose={() => !savingDraft && setCloseConfirm(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>작성 중인 내용이 있습니다</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.7 }}>작성 중인 요청을 임시저장할까요?<br />저장하지 않으면 이번에 작성한 내용은 사라집니다.</Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setCloseConfirm(false)} disabled={savingDraft}>계속 작성</Button>
          <Box sx={{ flex: 1 }} />
          <Button color="error" onClick={doClose} disabled={savingDraft}>저장 안 함</Button>
          <Button variant="contained" color="success" onClick={() => void handleSaveDrafts(true)} disabled={savingDraft}>{savingDraft ? '저장 중…' : '임시저장 후 닫기'}</Button>
        </DialogActions>
      </Dialog>

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

      {/* 답글 삭제 확인 팝업 (소프트 삭제) */}
      <Dialog open={!!delReply} onClose={() => !replyBusy && setDelReply(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>답글 삭제</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 14, color: 'text.primary', lineHeight: 1.7 }}>이 답글을 삭제할까요?<br />삭제하면 목록과 답글 수에서 제외됩니다.</Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDelReply(null)} disabled={replyBusy}>취소</Button>
          <Button variant="contained" color="error" onClick={confirmDelReply} disabled={replyBusy}>{replyBusy ? '삭제 중…' : '삭제'}</Button>
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
