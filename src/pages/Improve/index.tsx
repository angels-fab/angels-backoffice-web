import { useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import useMediaQuery from '@mui/material/useMediaQuery'
import Checkbox from '@mui/material/Checkbox'
import { TintChip } from '@/components/FilterChip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Collapse from '@mui/material/Collapse'
import Select from '@mui/material/Select'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import InputBase from '@mui/material/InputBase'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { typescale, iconSize, radius, control, table, weight } from '@/theme/tokens'
import { nextFilterSelection } from '@/utils/filterSelect'
import { PageContainer, PageHeader, ContentSection, AppCard, StatusChip, statusTextColor, ErrorBanner, LoadingState, FilterToolbar, SearchBar, dataTableSx, useSnack, ConfirmDialog } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { inlineFieldSx } from '@/components/ds/fields'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { addReply, patchReply, removeReply } from '@/store/slices/replySlice'
import { updateImprovement, deleteImprovement, createImprovements, fetchDrafts, saveDrafts, deleteDrafts, createReply, updateReply, deleteReply } from '@/api/improve'
import type { ReplyRow } from '@/api/sheets'
import { useRole } from '@/auth/role'
import { fmtDate, todaySeoul } from '@/utils/date'
import { isImproveNew } from '@/utils/newPost'
import { useMarkSeen } from '@/layouts/useNavBadges'
import { locationToPath } from '@/utils/improveMemo'
import { NAV_LABELS } from '@/constants/nav'
import type { ImprovementItem } from '@/types'
import ReplyThread from './ReplyThread'
import { RichBodyEditor } from '@/components/richText'
import { RichBodyView } from '@/utils/richBody'
import { IMP_STATUSES, impKind, needsReason, remarkOf, normStatus, statusRank, isSettled } from './improveMeta'
import type { ImpStatus } from './improveMeta'

const kindColor = (t: Theme, kind: StatusKind) =>
  kind === 'success' ? t.palette.accent.green
    : kind === 'info' ? t.palette.accent.blue
      : kind === 'warning' ? t.palette.accent.amber
        : kind === 'error' ? t.palette.accent.red
          : t.palette.text.secondary

const inputSx = (th: Theme) => ({ ...inlineFieldSx(th), py: 0.4 })

type Snack = { open: boolean; msg: string; severity: 'success' | 'error' | 'info' }
type ReasonDlg = { row: ImprovementItem; status: string; value: string }

// 개선위치 칩 — 일반 중립 상태칩(회색). 흰색은 너무 무거워 상태칩 텍스트 톤으로 맞춤(사용자 요청).
function LocChip({ label }: { label: string }) {
  return <StatusChip status="neutral" label={label} />
}

// 관련자료 — 박스 없는 아이콘 + 입력 팝업 (값 있으면 파랑)
function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = !!value.trim()
  return (
    <>
      <Tooltip title={active ? '관련자료 편집' : '관련자료 추가'}>
        <IconButton size="small" aria-label="관련자료" onClick={(e) => setAnchor(e.currentTarget)} sx={(th) => ({ color: active ? th.palette.accent.blue : 'text.disabled', p: 0.5 })}>
          <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: `${radius.button}px`, mt: 0.5 } } }}>
        <Box sx={{ p: 1.5, width: 280 }}>
          <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary', mb: 0.5 }}>관련자료 링크</Box>
          <InputBase autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" inputProps={{ 'aria-label': '관련자료 링크' }} sx={(th) => ({ ...inputSx(th), width: '100%', py: 0.5 })} />
        </Box>
      </Popover>
    </>
  )
}

// 위치/유형 드롭다운 — 화살표 버튼, 클릭 시 시트 목록 표시 (선택만).
// 기존 값이 목록에 없으면(예: 모바일) 그 값을 메뉴에 포함해 표시·보존(강제 변경 방지).
function DropField({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options
  return (
    <Select
      value={opts.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      variant="standard"
      disableUnderline
      IconComponent={() => null}
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      renderValue={(v) => (v ? <LocChip label={v} /> : <Box component="span" sx={{ color: 'text.disabled', fontSize: typescale.body.size, border: '1px dashed', borderColor: 'divider', borderRadius: `${radius.modal}px`, px: 1, py: '3px' }}>{placeholder}</Box>)}
      sx={{ maxWidth: '100%', '& .MuiSelect-select': { p: 0, pr: '0 !important', minHeight: '0 !important', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
    >
      {opts.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: typescale.body.size }}>{o}</MenuItem>)}
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
      IconComponent={() => null}
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      renderValue={(v) => (v ? <LocChip label={v} /> : <Box component="span" sx={{ color: 'text.disabled', fontSize: typescale.body.size }}>{placeholder}</Box>)}
      sx={{
        maxWidth: '100%',
        '& .MuiSelect-select': { p: '0 !important', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      }}
    >
      {opts.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: typescale.body.size }}>{o}</MenuItem>)}
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
          width: 24, height: 24, borderRadius: `${radius.chip}px`, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1,
          border: '1px solid',
          ...(on
            ? { bgcolor: th.palette.accent.red, borderColor: th.palette.accent.red, color: th.palette.common.white }
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
  const { items, ready, error } = useAppSelector((s) => s.improve)
  const replies = useAppSelector((s) => s.reply.items)
  const { isMember, isAdmin, user, authKey } = useRole()
  // 내 기준 새 글 배지(개인화) — 페이지 진입 시 현재 새 글을 읽음 처리.
  // error 게이트 필수: rejected가 items=[]·ready=true라, 없으면 재로딩 실패 한 번에 seen이 []로 지워짐
  useMarkSeen('improve', useMemo(() => items.filter(isImproveNew).map((i) => String(i.num)), [items]), ready && !error)

  const [selected, setSelected] = useState<Set<ImpStatus>>(new Set()) // 비었으면 전체
  const [openId, setOpenId] = useState<number | null>(null) // 아코디언 — 한 번에 하나만 펼침
  const [reasonDlg, setReasonDlg] = useState<ReasonDlg | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const snack = useSnack()
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
  // 목록 더보기 메뉴 — 행을 펼치지 않고 바로 수정·삭제(기존 핸들러 재사용)
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; t: ImprovementItem } | null>(null)
  const [cUrgent, setCUrgent] = useState(false)
  const [cTitle, setCTitle] = useState('')
  const [cLoc, setCLoc] = useState('')
  const [cLink, setCLink] = useState('')
  const [cContent, setCContent] = useState('')

  // 새 개선요청 — 페이지 내부 인라인 작성(모달 아님). 요청 추가·임시저장 지원, 배경클릭 닫힘 없음.
  // 닫기 경고는 '텍스트 유무'가 아니라 마지막 저장본(baseline) 대비 실제 변경분으로 판단.
  const [composing, setComposing] = useState(false)
  const [cards, setCards] = useState<DraftCard[]>([])
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [closeConfirm, setCloseConfirm] = useState(false)
  const cardSeq = useRef(0)
  const baselineRef = useRef('') // 마지막 저장본(또는 로드 직후) 스냅샷 — 미저장 변경 판단 기준

  const showSnack = (msg: string, severity: Snack['severity'] = 'success') => snack(msg, severity)

  const [query, setQuery] = useState('')

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
    let base = selected.size === 0 ? items : items.filter((t) => selected.has(normStatus(t.status) as ImpStatus))
    const q = query.trim().toLowerCase()
    if (q) base = base.filter((t) => `${t.title || ''} ${t.mgr || ''} ${t.loc || ''}`.toLowerCase().includes(q))
    // 1순위 번호 내림차순(높은 번호=최신 위), 2순위 상태(접수→검토중→보류→완료→불가).
    return [...base].sort((a, b) =>
      (Number(b.num) || 0) - (Number(a.num) || 0) ||
      statusRank(a.status) - statusRank(b.status))
  }, [items, selected, query])

  // 개선위치 드롭다운 — 현재 내비게이션 메뉴(@/constants/nav)에서 파생 + '포털'(포털 전체) 항목.
  // (선택 대상·전체선택 판정은 canDelete 정의 뒤에 있다 — 아래 pickable 참조)
  // 메뉴를 추가/삭제하면 이 목록에 즉시 반영된다(미리 정해둔 목록·시트 불필요).
  const locOptions = useMemo(() => ['포털', ...NAV_LABELS], [])

  // 필터 선택 규칙은 정본(utils/filterSelect)에 위임 — 업무현황·공지와 동일
  const onTab = (s: ImpStatus, shift: boolean) => setSelected((prev) => nextFilterSelection(prev, s, shift))

  // 수정(상태·위치·유형·내용·사유·메모) = 로그인 관리자 전체 / 삭제 = 해당 글 담당자(작성자)만.
  // 담당자 미지정(mgr='')은 구성원 누구나 삭제 — RLS improvements_delete(mgr='' or mgr=my_name())와 같은 기준.
  // 이 조건이 빠져 있어 담당자 없는 글이 화면에서 영영 못 지워졌다(DB는 허용하는데 버튼만 안 나옴).
  const canEdit = isMember && !!user && !!authKey // 구성원 쓰기 개방(2026-08-05)
  const canDelete = (t: ImprovementItem) => {
    const mgr = (t.mgr || '').trim()
    // 구성원 쓰기 개방(2026-08-05) — 담당자 본인이면 구성원도 삭제, 관리자는 무조건 가능
    return (isMember && !!user && (mgr === '' || user === mgr)) || isAdmin
  }
  // 여러 건 선택(요청번호 집합) — 한 건씩 지우던 걸 모아서 지우기 위한 것.
  // 이름이 picked 인 이유: 이 파일의 selected 는 상태 필터 선택이라 이미 쓰이고 있다.
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const togglePick = (num: string) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(num)) next.delete(num); else next.add(num)
    return next
  })
  // 선택 대상 = 지금 보이는 목록 중 지울 수 있는 것(담당자 본인 또는 담당자 미지정).
  // 필터·검색으로 안 보이는 행까지 '전체 선택'에 끌려오면 모르는 걸 지우게 된다.
  const pickable = listed.filter(canDelete)
  const allPicked = pickable.length > 0 && pickable.every((t) => picked.has(t.num))
  // 필터·검색을 바꿔 목록에서 사라진 행은 선택에서도 뺀다.
  // 안 그러면 화면에 없는 요청이 선택된 채로 남아 '삭제'가 안 보이는 걸 지운다.
  useEffect(() => {
    setPicked((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(listed.map((t) => t.num))
      const next = new Set([...prev].filter((n) => visible.has(n)))
      return next.size === prev.size ? prev : next
    })
  }, [listed])
  // 선택·작업 메모·더보기 열은 로그인 관리자에게만 노출(게스트 미노출). 세 열 노출 조건이 같아 memoCol 하나로 판단한다.
  // 열 개수 = 게스트 7(번호·개선위치·제목·작성자·제안일자·상태·비고) / 관리자 10(선택 + … + 작업 메모·더보기).
  const memoCol = canEdit
  // detailSpan = 펼침행에서 앞 빈 셀 1개를 뺀 나머지, fullSpan = 전체 열 수
  const detailSpan = memoCol ? 9 : 6
  const fullSpan = memoCol ? 10 : 7

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

  // ── 새 개선요청 인라인 작성(멀티) ──
  const blankCard = (): DraftCard => ({ key: (cardSeq.current += 1), id: '', urgent: false, title: '', loc: '', link: '', content: '' })
  const toCards = (rows: { id: string; urgent: boolean; title: string; loc: string; link: string; content: string }[]): DraftCard[] =>
    rows.map((r) => ({ key: (cardSeq.current += 1), id: r.id, urgent: r.urgent, title: r.title, loc: r.loc, link: r.link, content: r.content }))

  const cardDirty = (c: DraftCard) => !!(c.title.trim() || c.content.trim() || c.link.trim() || c.loc.trim() || c.urgent)
  // 미저장 변경 판단용 정규화 스냅샷 — 내용 있는 카드만(빈 카드 추가는 변경으로 치지 않음), 순서 유지
  const serializeCards = (cs: DraftCard[]) =>
    JSON.stringify(cs.filter(cardDirty).map((c) => [c.urgent, c.title.trim(), c.loc.trim(), c.link.trim(), c.content.trim()]))

  // 열기 = 저장된 임시저장 불러오기(없으면 빈 카드 1개). 실패해도(미배포) 빈 카드로 시작. baseline=로드 직후 내용.
  const openCompose = async () => {
    setComposing(true)
    if (!user || !authKey) { const c = [blankCard()]; setCards(c); baselineRef.current = serializeCards(c); return }
    setCards([])
    setDraftsLoading(true)
    try {
      const rows = await fetchDrafts({ author: user, key: authKey })
      const c = rows.length ? toCards(rows) : [blankCard()]
      setCards(c); baselineRef.current = serializeCards(c)
    } catch (err) {
      const c = [blankCard()]; setCards(c); baselineRef.current = serializeCards(c)
      showSnack(err instanceof Error ? err.message : '임시저장 불러오기 실패', 'error')
    } finally {
      setDraftsLoading(false)
    }
  }

  const patchCard = (key: number, patch: Partial<DraftCard>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))
  const addCard = () => setCards((cs) => [...cs, blankCard()]) // 새 요청은 빈 카드(개선위치 미승계)
  const removeCard = (key: number) => setCards((cs) => { const next = cs.filter((c) => c.key !== key); return next.length ? next : [blankCard()] })

  // 미저장 변경 = 현재 내용이 마지막 저장본(baseline)과 다름. (텍스트 유무가 아니라 실제 변경 여부)
  const isDirty = serializeCards(cards) !== baselineRef.current
  const publishable = cards.filter((c) => c.title.trim())

  const doClose = () => { setComposing(false); setCloseConfirm(false); setCards([]); baselineRef.current = '' }
  // 취소 버튼만 닫기 시도(배경클릭 없음). 미저장 변경이 있을 때만 확인.
  const requestClose = () => { if (savingDraft || publishing) return; if (isDirty) setCloseConfirm(true); else doClose() }

  const draftPayload = () => cards.filter(cardDirty).map((c) => ({ id: c.id || undefined, urgent: c.urgent, title: c.title.trim(), loc: c.loc.trim(), link: c.link.trim(), content: c.content.trim() }))

  const handleSaveDrafts = async (thenClose: boolean) => {
    if (savingDraft || publishing) return
    if (!user || !authKey) return showSnack('로그인이 필요합니다.', 'error')
    const payload = draftPayload()
    // 저장할 내용이 없으면 서버를 건드리지 않는다(기존 저장분 파괴적 삭제 방지). baseline=현재로 맞춰 미저장 상태 해제.
    if (!payload.length) {
      baselineRef.current = serializeCards(cards)
      if (thenClose) doClose()
      else { setCloseConfirm(false); showSnack('저장할 내용이 없습니다.', 'info') }
      return
    }
    setSavingDraft(true)
    try {
      const rows = await saveDrafts({ author: user, key: authKey, drafts: payload })
      setSavingDraft(false)
      if (thenClose) { doClose(); showSnack('임시저장 후 닫았습니다.', 'success') }
      else {
        // 저장 성공 → 현재 상태를 새 비교 기준으로 갱신(이후 추가 수정 시 다시 미저장으로 판단)
        const c = rows.length ? toCards(rows) : [blankCard()]
        setCards(c); baselineRef.current = serializeCards(c); setCloseConfirm(false); showSnack('임시저장했습니다.', 'success')
      }
    } catch (err) {
      // 실패는 저장된 것으로 처리하지 않음(baseline 유지) → 미저장 상태 그대로, 오류만 안내
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

  /**
   * 선택한 요청 일괄 삭제 — 한 건씩 지우던 걸 모아서. 실패한 건은 남기고 결과를 알린다
   * (중간에 멈추면 어디까지 지워졌는지 알 수 없어 전부 시도한다).
   */
  const handleBulkDelete = async () => {
    if (!user || !authKey || picked.size === 0) return
    setBulkBusy(true)
    const nums = [...picked]
    const failed: string[] = []
    for (const num of nums) {
      try {
        await deleteImprovement({ author: user, key: authKey, num })
      } catch {
        failed.push(num)
      }
    }
    setBulkBusy(false)
    setBulkOpen(false)
    setPicked(new Set())
    const done = nums.length - failed.length
    if (failed.length === 0) showSnack(`${done}건을 삭제했습니다.`, 'success')
    else if (done === 0) showSnack(`삭제하지 못했습니다. (담당자만 지울 수 있습니다)`, 'error')
    else showSnack(`${done}건 삭제 · ${failed.length}건 실패(#${failed.join(', #')})`, 'error')
    dispatch(loadImproveData())
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

  // 모바일 = 셸 분기(768) 아래 — 표 대신 카드(개선요청 87). 공지와 같은 기준.
  const isMobile = useMediaQuery((th: Theme) => th.breakpoints.down('shell'))

  // 더보기 메뉴 실행 — 전파를 막고 기존 핸들러를 그대로 호출한 뒤 메뉴를 닫는다
  const closeMenu = () => setMenuFor(null)
  const menuAct = (fn: (t: ImprovementItem) => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuFor) fn(menuFor.t)
    closeMenu()
  }

  // 새 요청 인라인 카드(표 상단·목록과 동일 열 구조). 배경 클릭으로 닫히지 않음(입력만 반응).
  const composeGreen = (th: Theme) => alpha(th.palette.accent.green, 0.06)
  const renderComposeCard = (c: DraftCard, idx: number) => {
    const kb = `compose-${c.key}`
    return [
      <TableRow key={`${kb}-1`} sx={{ '& td': { verticalAlign: 'middle', bgcolor: composeGreen, py: 1 } }}>
        {/* 선택 열 자리(작성 중에는 비움) */}
        {memoCol && <TableCell padding="checkbox" />}
        <TableCell sx={{ textAlign: 'center' }}><Box sx={{ display: 'flex', justifyContent: 'center' }}><UrgentBox on={c.urgent} onToggle={() => patchCard(c.key, { urgent: !c.urgent })} /></Box></TableCell>
        <TableCell><DropField value={c.loc} onChange={(v) => patchCard(c.key, { loc: v })} options={locOptions} placeholder="위치" /></TableCell>
        <TableCell sx={{ textAlign: 'left', whiteSpace: 'normal' }}>
          <InputBase
            value={c.title}
            onChange={(e) => patchCard(c.key, { title: e.target.value })}
            placeholder={`제목 (요청 ${idx + 1})`}
            inputProps={{ 'aria-label': `제목 ${idx + 1}` }}
            endAdornment={<LinkField value={c.link} onChange={(v) => patchCard(c.key, { link: v })} />}
            sx={(th) => ({ ...inputSx(th), width: '100%', height: 32 })}
          />
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size }}>{user || '-'}</TableCell>
        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(todaySeoul())}</TableCell>
        <TableCell sx={{ textAlign: 'center' }}><StatusChip status="neutral" label="접수" /></TableCell>
        <TableCell sx={{ textAlign: 'center' }}>
          <Tooltip title="이 요청 삭제"><span><IconButton size="small" color="error" aria-label={`요청 ${idx + 1} 삭제`} onClick={() => removeCard(c.key)} disabled={savingDraft || publishing}><DeleteOutlineIcon sx={{ fontSize: iconSize.action }} /></IconButton></span></Tooltip>
        </TableCell>
        {/* 작업 메모·더보기 열 자리(작성 중에는 비움) */}
        {memoCol && <TableCell />}
        {memoCol && <TableCell />}
      </TableRow>,
      <TableRow key={`${kb}-2`} sx={{ '& td': { borderTop: 0, bgcolor: composeGreen, py: 0.75, verticalAlign: 'middle' } }}>
        {memoCol && <TableCell padding="checkbox" />}
        <TableCell />
        <TableCell />
        <TableCell colSpan={memoCol ? 6 : 4} sx={{ textAlign: 'left' }}>
          <RichBodyEditor
            value={c.content}
            onChange={(v) => patchCard(c.key, { content: v })}
            placeholder="요청내용"
            ariaLabel={`요청내용 ${idx + 1}`}
            fontSize={13}
            minHeight={32}
            framed
          />
        </TableCell>
        <TableCell />
      </TableRow>,
    ]
  }

  // 수정 인라인 행(목록과 동일한 열 정렬 구조). 제목줄 배경 클릭 시 접힘(입력 셀은 stopPropagation).
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
        {/* 선택 열 자리(수정 중에는 비움) */}
        {memoCol && <TableCell padding="checkbox" />}
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}><Box sx={{ display: 'flex', justifyContent: 'center' }}><UrgentBox on={cUrgent} onToggle={() => setCUrgent((v) => !v)} /></Box></TableCell>
        <TableCell onClick={stop}><DropField value={cLoc} onChange={setCLoc} options={locOptions} placeholder="위치" /></TableCell>
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
        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size }}>{author}</TableCell>
        <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  textAlign: 'center', color: 'text.secondary', fontSize: typescale.body.size, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</TableCell>
        <TableCell sx={{ textAlign: 'center' }}><StatusChip status={stKind} label={stLabel} /></TableCell>
        <TableCell />
        {/* 작업 메모·더보기 열 자리(수정 중에는 비움) */}
        {memoCol && <TableCell />}
        {memoCol && <TableCell />}
      </TableRow>,
      <TableRow key={`${kb}-2`} sx={{ '& td': { borderTop: 0, bgcolor: greenBg, py: 0.75, verticalAlign: 'middle' } }}>
        {memoCol && <TableCell padding="checkbox" />}
        <TableCell />
        <TableCell />
        <TableCell colSpan={memoCol ? 6 : 4} onClick={stop} sx={{ textAlign: 'left' }}>
          <RichBodyEditor
            value={cContent}
            onChange={setCContent}
            placeholder="요청내용"
            ariaLabel="요청내용"
            fontSize={13}
            minHeight={32}
            framed
          />
        </TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title="수정 저장">
              <span><IconButton size="small" color="success" aria-label="저장" onClick={onSave} disabled={saving}><CheckIcon sx={{ fontSize: iconSize.action }} /></IconButton></span>
            </Tooltip>
            <Tooltip title="취소">
              <span><IconButton size="small" color="error" aria-label="취소" onClick={onCancel} disabled={saving}><CloseIcon sx={{ fontSize: iconSize.action }} /></IconButton></span>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>,
    ]
  }

  /**
   * 모바일 카드 한 장(개선요청 87) — 375px 에서 표(구성원 10열 최소폭 약 922px)는 63%가 화면 밖이었다.
   * 공지 모바일 카드와 같은 3줄 구성: ①칩·핀·더보기 ②제목 ③번호·작성자·날짜·비고.
   * 탭하면 그 자리에서 내용·답글이 펼쳐진다(표의 아코디언과 같은 데이터·컴포넌트).
   * 모바일에서 버리는 것: 선택 체크박스(일괄삭제) — ⋮ 의 개별 삭제로 대신한다.
   */
  const renderMobileCard = (t: ImprovementItem) => {
    const open = openId === t.id
    const rm = remarkOf(t)
    const st = normStatus(t.status)
    const editable = canEdit
    const removable = canDelete(t)
    const isNew = isImproveNew(t)
    const rowReplies = repliesByReq[t.num] || []
    const toggle = () => toggleRow(t.id)
    const memoOn = t.memo === true
    const memoTarget = locationToPath(t.loc)
    const memoBlocked = !memoOn && (!memoTarget || isSettled(t.status))
    const onHeaderTap = (e: React.MouseEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('button, input, textarea, a, [contenteditable], [role="combobox"]')) return
      toggle()
    }
    return (
      <Box
        key={t.id}
        sx={(th) => ({
          border: '1px solid', borderColor: open ? alpha(th.palette.accent.blue, 0.5) : 'divider',
          borderRadius: `${radius.card}px`, mb: 1.25, overflow: 'hidden',
          bgcolor: open ? alpha(th.palette.accent.blue, 0.08) : 'background.paper',
        })}
      >
        <Box onClick={onHeaderTap} sx={{ p: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
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
                {IMP_STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: typescale.body.size }}>{s}</MenuItem>)}
              </Select>
            ) : (
              <StatusChip status={impKind(st)} label={st || '-'} />
            )}
            {t.loc && <LocChip label={t.loc} />}
            {isNew && (
              <Box component="span" sx={{ fontSize: typescale.micro.size, fontWeight: weight.semibold, letterSpacing: '0.06em', color: 'accentText.red' }}>NEW</Box>
            )}
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {canEdit && (
                <IconButton
                  size="small"
                  aria-label={memoOn ? '메모 해제' : '해당 페이지에 띄우기'}
                  disabled={memoBlocked || savingId === t.id}
                  onClick={(e) => { e.stopPropagation(); void toggleMemo(t, !memoOn) }}
                  sx={(th) => ({ color: memoOn ? th.palette.accent.amber : 'text.disabled', p: 0.5 })}
                >
                  {memoOn ? <PushPinIcon sx={{ fontSize: iconSize.action }} /> : <PushPinOutlinedIcon sx={{ fontSize: iconSize.action }} />}
                </IconButton>
              )}
              {canEdit && (
                <IconButton size="small" aria-label="더보기" onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, t }) }} sx={{ color: 'text.secondary', p: 0.5 }}>
                  <MoreVertIcon sx={{ fontSize: iconSize.action }} />
                </IconButton>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            {t.urgent && <PriorityHighIcon sx={{ fontSize: iconSize.action, color: 'error.main', flexShrink: 0 }} />}
            <Box component="span" sx={{ fontSize: typescale.emphasis.size, fontWeight: weight.medium, color: 'text.primary', minWidth: 0, wordBreak: 'break-word' }}>{t.title}</Box>
            {rowReplies.length > 0 && (
              <Box component="span" sx={(th) => ({ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 18, px: '7px', borderRadius: `${radius.button}px`, fontSize: typescale.caption.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1, whiteSpace: 'nowrap', color: th.palette.accentText.blue, bgcolor: alpha(th.palette.accent.blue, 0.14), border: `1px solid ${alpha(th.palette.accent.blue, 0.4)}` })}>답글 +{rowReplies.length}</Box>
            )}
            {t.link && (
              <IconButton component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련자료" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                <OpenInNewIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: typescale.small.size, color: 'text.disabled', flexWrap: 'wrap' }}>
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>#{t.num}</Box>
            <Box component="span">{t.author || '-'}</Box>
            <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDate(t.date)}</Box>
            {rm.kind === 'date' && <Box component="span" sx={{ color: 'info.main', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(rm.text)}</Box>}
            {rm.kind === 'reason' && !!rm.text && (
              <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>{rm.text}</Box>
            )}
          </Box>
        </Box>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={(th) => ({ bgcolor: alpha(th.palette.accent.blue, 0.06), px: 1.5, py: 1.25 })}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ fontSize: typescale.body.size, color: 'text.primary', lineHeight: 1.7, py: 0.5, flex: 1, minWidth: 0 }}>
                {t.content ? <RichBodyView html={t.content} /> : '내용 없음'}
              </Box>
              {(editable || removable) && (
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, pt: 0.25 }} onClick={stop}>
                  {editable && <IconButton size="small" aria-label="수정" onClick={() => openEdit(t)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: iconSize.action }} /></IconButton>}
                  {removable && <IconButton size="small" color="error" aria-label="삭제" onClick={() => setDeleteDlg(t)}><DeleteOutlineIcon sx={{ fontSize: iconSize.action }} /></IconButton>}
                </Box>
              )}
            </Box>
            <ReplyThread
              key={t.id}
              replies={rowReplies}
              isAdmin={isMember}
              user={user}
              busy={replyBusy}
              onCreate={(content) => createReplyH(t.num, content)}
              onEdit={editReplyH}
              onRequestDelete={(r) => setDelReply(r)}
            />
          </Box>
        </Collapse>
      </Box>
    )
  }

  /** 모바일 수정 카드 — 표의 인라인 수정(renderEditRow)과 같은 상태·저장 핸들러를 세로로 배치 */
  const renderMobileEdit = (t: ImprovementItem) => (
    <Box key={`edit-${t.id}`} sx={(th) => ({ border: '1px solid', borderColor: alpha(th.palette.accent.green, 0.5), borderRadius: `${radius.card}px`, mb: 1.25, p: '11px 13px', bgcolor: alpha(th.palette.accent.green, 0.06), display: 'flex', flexDirection: 'column', gap: 1 })}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <UrgentBox on={cUrgent} onToggle={() => setCUrgent((v) => !v)} />
        <DropField value={cLoc} onChange={setCLoc} options={locOptions} placeholder="위치" />
        <LinkField value={cLink} onChange={setCLink} />
      </Box>
      <InputBase
        value={cTitle}
        onChange={(e) => setCTitle(e.target.value)}
        placeholder="제목"
        inputProps={{ 'aria-label': '제목' }}
        sx={(th) => ({ ...inputSx(th), width: '100%', height: 32 })}
      />
      <RichBodyEditor value={cContent} onChange={setCContent} placeholder="요청내용" ariaLabel="요청내용" fontSize={13} minHeight={64} framed />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button size="small" onClick={() => setEditingId(null)} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button size="small" variant="contained" color="success" onClick={() => void handleEdit(t)} disabled={saving}>{saving ? '저장 중…' : '저장'}</Button>
      </Box>
    </Box>
  )

  return (
    <PageContainer>
      <PageHeader
        icon={<LightbulbOutlinedIcon />}
        title="포털개선요청"
        updatedAt={error ? '불러오기 실패' : undefined}
        /* 새로고침 버튼 삭제(요청메모 88) — 브라우저 새로고침과 겹치고,
           불러오기에 실패하면 아래 배너가 '다시 시도'를 이미 준다 */
      />

      {/* 불러오기 실패 — '요청 없음'으로 오해하지 않게 정직하게 알리고 재시도 제공(백로그 C2).
          기존 목록이 남아 있으면 경고(갱신만 실패), 아예 없으면 오류. */}
      {error && (
        <ErrorBanner
          severity={items.length > 0 ? 'warning' : 'error'}
          message={
            items.length > 0
              ? '개선요청 새로고침에 실패했습니다. 마지막으로 불러온 목록을 표시 중입니다.'
              : '개선요청을 불러오지 못했습니다.'
          }
          onRetry={() => dispatch(loadImproveData())}
        />
      )}

      {/* '개선요청 목록 N건' 라벨 삭제(2026-08-14 사용자 지시 — 공지와 같은 정리).
          페이지 제목이 이미 '포털개선요청'이고 건수는 상태 칩이 상태별로 보여준다. */}
      <ContentSection last>
        {/* 상태 필터 — 공용 FilterToolbar(공지와 동일 박스+검색+새글). 0건 상태 숨김·재클릭=전체·Shift=중복. */}
        <FilterToolbar
          label="상태"
          search={<SearchBar value={query} onChange={setQuery} placeholder="제목·작성자·위치 검색" width={200} />}
          actions={isMember && !isMobile ? ( // 구성원 쓰기 개방(2026-08-05)
            // 모바일은 숨긴다(개선요청 87) — 작성 폼이 표 행 구조라 카드 목록에 못 끼우고,
            // 모바일의 새 요청 창구는 상단바 전구(요청메모)가 이미 담당한다.
            <Button
              onClick={() => (composing ? requestClose() : void openCompose())}
              startIcon={<AddIcon />}
              variant={composing ? 'contained' : 'outlined'}
              size="small"
              sx={{ whiteSpace: 'nowrap', minHeight: control.height }}
            >
              새 요청
            </Button>
          ) : undefined}
        >
          {visibleStatuses.map((s) => {
            // 빈 선택 = 전체. 그 상태를 공지·업무현황과 같이 **전부 켜진 모습**으로 그린다
            // (구현은 셋 다 '빈=전체'로 같은데 개선요청만 전부 꺼진 모습이라 기본값이 달라 보였다).
            const on = selected.size === 0 || selected.has(s)
            return (
              <TintChip
                key={s}
                on={on}
                color={(t) => kindColor(t, impKind(s))}
                ariaLabel={`${s} ${counts[s] || 0}건${on ? '' : ' (해제됨)'}`}
                onToggle={(additive) => onTab(s, additive)}
                hover
                sx={{ p: '4px 10px' }}
              >
                <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight, color: (t) => (on ? statusTextColor(t, impKind(s)) : t.palette.text.secondary) }}>{s}</Box>
                <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.secondary' }}>{counts[s] || 0}</Box>
              </TintChip>
            )
          })}
          {visibleStatuses.length > 1 && (
            <Box component="span" sx={{ fontSize: typescale.small.size, color: 'text.disabled', whiteSpace: 'nowrap', ml: 0.5 }}>
              Shift로 다중선택
            </Box>
          )}
        </FilterToolbar>

        {/* 선택 액션 줄 — 표 바로 위. 처음엔 화면 하단 고정 바로 뒀는데 표에서 체크하는
            동안 시선이 아래로 안 가서 '복수선택은 되는데 삭제는 개별로 해야 한다'는 신고가
            나왔다. 체크박스 바로 옆에 두면 놓칠 수 없다(메일함들이 쓰는 방식). */}
        {memoCol && picked.size > 0 && (
          <Box
            sx={(th) => ({
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
              mb: 1.5, px: 1.75, py: 1.25,
              borderRadius: `${radius.card}px`,
              border: '1px solid', borderColor: alpha(th.palette.accent.blue, 0.4),
              bgcolor: alpha(th.palette.accent.blue, 0.1),
            })}
          >
            <Box sx={{ fontSize: typescale.emphasis.size, fontWeight: weight.heavy, color: 'text.primary' }}>
              {picked.size}건 선택됨
            </Box>
            <Button size="small" onClick={() => setPicked(new Set())} sx={{ color: 'text.secondary' }}>선택 해제</Button>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon sx={{ fontSize: iconSize.body }} />}
              onClick={() => setBulkOpen(true)}
            >
              선택한 {picked.size}건 삭제
            </Button>
          </Box>
        )}

        {isMobile ? (
          /* 모바일은 표를 아예 안 쓴다(개선요청 87) — 375px 에서 표의 63%가 화면 밖이었다.
             공지와 같은 카드 목록. 새 요청 작성은 상단바 전구(요청메모)가 이미 모바일 창구다. */
          <Box>
            {!ready && listed.length === 0 && <Box sx={{ py: 3, textAlign: 'center' }}><LoadingState /></Box>}
            {ready && listed.length === 0 && (
              <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: typescale.body.size }}>해당하는 요청이 없습니다</Box>
            )}
            {listed.map((t) => (editingId === t.id ? renderMobileEdit(t) : renderMobileCard(t)))}
          </Box>
        ) : (
        <AppCard padding={0} sx={{ overflowX: 'auto' }}>
          {/* '& th, & td'(특이도 0,1,1)는 셀 sx를 이겨 헤더 밑줄(--th-line)까지 죽인다 — 쓰지 말 것.
              구분선 색·여백은 theme MuiTableCell 담당, 여기서는 본문 줄바꿈만 막는다. */}
          <Table size="small" sx={{ ...dataTableSx, '& td': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              {/* 정렬은 셀 align prop 으로만 — 구 dataTableHeadSx 의 '& th'(특이도 0-1-1)가
                  셀 sx(0-1-0)를 이겨서, 제목·비고는 !important 로 버텨야 했다. 이제 불필요. */}
              <TableRow>
                {/* 선택 열 — 지울 수 있는 행만 대상. 머리 체크박스는 '보이는 목록 중 지울 수 있는 것' 전체 토글 */}
                {memoCol && (
                  <TableCell padding="checkbox" align="center" sx={{ width: '1%' }}>
                    <Checkbox
                      size="small"
                      slotProps={{ input: { 'aria-label': '보이는 요청 전체 선택' } }}
                      disabled={pickable.length === 0}
                      checked={pickable.length > 0 && allPicked}
                      indeterminate={picked.size > 0 && !allPicked}
                      onChange={() => setPicked(allPicked ? new Set() : new Set(pickable.map((t) => t.num)))}
                    />
                  </TableCell>
                )}
                <TableCell align="center" sx={{ width: '1%' }}>번호</TableCell>
                <TableCell align="center" sx={{ width: '1%' }}>개선위치</TableCell>
                <TableCell align="left" sx={{ width: '100%' }}>제목</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', lg: 'table-cell' },  width: '1%' }}>작성자</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', lg: 'table-cell' },  width: '1%' }}>제안일자</TableCell>
                <TableCell align="center" sx={{ width: '1%' }}>상태</TableCell>
                <TableCell align="center" sx={{ width: '1%' }}>비고</TableCell>
                {memoCol && <TableCell align="center" sx={{ width: '1%' }}>작업 메모</TableCell>}
                {/* 더보기 열 — 머리글 없음(액션 열). 스크린리더용 이름만 부여 */}
                {memoCol && <TableCell align="center" aria-label="관리" sx={{ width: '1%' }} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* 새 요청 인라인 작성 — 표 최상단. 요청 추가/임시저장/등록/취소는 하단 컨트롤 행. */}
              {/* 구성원 쓰기 개방(2026-08-05) */}
              {isMember && composing && draftsLoading && (
                <TableRow>
                  <TableCell colSpan={fullSpan} sx={{ textAlign: 'center', py: 2 }}><LoadingState /></TableCell>
                </TableRow>
              )}
              {isMember && composing && !draftsLoading && cards.map((c, idx) => renderComposeCard(c, idx))}
              {isMember && composing && !draftsLoading && (
                <TableRow key="compose-controls" sx={{ '& td': { bgcolor: composeGreen, py: 1, borderBottom: '2px solid', borderColor: 'divider' } }}>
                  <TableCell colSpan={fullSpan}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Button onClick={addCard} startIcon={<AddIcon />} size="small" variant="outlined" disabled={savingDraft || publishing} sx={{ color: 'text.secondary', borderColor: 'divider' }}>요청 추가</Button>
                      <Box sx={{ flex: 1 }} />
                      <Button onClick={() => void handleSaveDrafts(false)} size="small" disabled={savingDraft || publishing} sx={{ color: 'text.secondary' }}>{savingDraft ? '임시저장 중…' : '임시저장'}</Button>
                      <Button onClick={requestClose} size="small" disabled={savingDraft || publishing} sx={{ color: 'text.secondary' }}>취소</Button>
                      <Button onClick={() => void handlePublish()} size="small" variant="contained" color="success" disabled={publishing || savingDraft || publishable.length === 0}>{publishing ? '등록 중…' : `${publishable.length}건 등록`}</Button>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {/* 첫 로딩 — '없습니다'가 먼저 뜨지 않게 LoadingState 우선(공지·업무현황과 동일).
                  실패 시에도 ready=true라 여기 갇히지 않고 위 ErrorBanner가 설명한다. */}
              {!ready && listed.length === 0 && !composing && (
                <TableRow>
                  <TableCell colSpan={fullSpan} sx={{ textAlign: 'center', py: 3 }}><LoadingState /></TableCell>
                </TableRow>
              )}
              {ready && listed.length === 0 && !composing && (
                <TableRow>
                  <TableCell colSpan={fullSpan} sx={{ textAlign: 'center', color: 'text.disabled', py: 3 }}>해당하는 요청이 없습니다</TableCell>
                </TableRow>
              )}
              {listed.map((t) => {
                if (editingId === t.id) return renderEditRow(t) // 수정: 그 자리에서 인라인 편집(열 정렬 동일)
                const open = openId === t.id
                const rm = remarkOf(t)
                const st = normStatus(t.status)
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
                    sx={(th) => ({
                      // 표준(DataTable): 기본행=투명+행 hover / 펼침=블루 틴트. (상태색 줄무늬 폐지 — 상태는 상태칩으로만)
                      '& td': {
                        textAlign: 'center',
                        ...(open
                          ? { bgcolor: alpha(th.palette.accent.blue, 0.12), borderBottomColor: 'transparent' }
                          : {}),
                      },
                    })}
                  >
                    {/* 선택 — 셀 onClick stop 으로 아코디언 토글 방지. 담당자가 아니면 비활성 + 이유 안내.
                        align="center" 는 머리 체크박스와 세로로 안 맞아 열이 삐뚤어 보이던 것(개선요청 #39) */}
                    {memoCol && (
                      <TableCell padding="checkbox" align="center" onClick={stop}>
                        <Tooltip title={removable ? '' : '담당자만 삭제할 수 있습니다'} disableHoverListener={removable}>
                          <span>
                            <Checkbox
                              size="small"
                              slotProps={{ input: { 'aria-label': `요청 ${t.num} 선택` } }}
                              disabled={!removable}
                              checked={picked.has(t.num)}
                              onChange={() => togglePick(t.num)}
                            />
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                    <TableCell sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{t.num}</TableCell>
                    {/* 개선위치 — 흰색 칩(번호와 제목 사이). 관리자는 셀에서 즉시 변경(드롭다운), 셀 onClick stop으로 아코디언 토글 방지 */}
                    <TableCell onClick={editable ? stop : undefined} sx={{ maxWidth: 140, ...(editable && { cursor: 'pointer' }) }}>
                      {editable
                        ? <CellSelect value={t.loc} options={locOptions} disabled={savingId === t.id} placeholder="-" onChange={(v) => { if (v !== (t.loc || '')) void saveField(t, { loc: v }) }} />
                        : (t.loc ? <LocChip label={t.loc} /> : '-')}
                    </TableCell>
                    {/* 제목 — 활성 영역(클릭 시 아코디언 토글). 행 전체가 아니라 이 셀만 포인터 */}
                    <TableCell onClick={toggle} sx={{ textAlign: 'left !important', whiteSpace: 'normal', cursor: 'pointer' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {t.urgent && <Tooltip title="긴급"><PriorityHighIcon sx={{ fontSize: iconSize.action, color: 'error.main', flexShrink: 0 }} /></Tooltip>}
                        {/* 제목은 14px + 주 톤으로 이미 식별자 — 굵기는 강조 상태에만 쓴다(전부 굵으면 신호가 사라짐) */}
                        <Box component="span" sx={{ fontSize: typescale.emphasis.size, fontWeight: weight.medium, color: 'text.primary', overflowWrap: 'anywhere' }}>{t.title}</Box>
                        {/* 제목 → 최근글 N칩 → 답글 +N칩 → 링크 순. 모두 줄어들지 않게 flexShrink:0 */}
                        {isNew && (
                          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: `${radius.chip}px`, bgcolor: (t) => t.palette.accent.red, color: (t) => t.palette.getContrastText(t.palette.accent.red), fontSize: typescale.micro.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1 }}>N</Box>
                        )}
                        {/* 답글 +N — 삭제 안 된 답글이 있을 때만. 파란 칩(왼쪽 점 없음), 상태와 무관. 클릭 시 행 토글로 아코디언 펼침 */}
                        {rowReplies.length > 0 && (
                          <Box component="span" sx={(th) => ({ flexShrink: 0, display: 'inline-flex', alignItems: 'center', height: 18, px: '7px', borderRadius: `${radius.button}px`, fontSize: typescale.caption.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1, whiteSpace: 'nowrap', color: th.palette.accentText.blue, bgcolor: alpha(th.palette.accent.blue, 0.14), border: `1px solid ${alpha(th.palette.accent.blue, 0.4)}` })}>답글 +{rowReplies.length}</Box>
                        )}
                        {t.link && (
                          <IconButton component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련자료" onClick={stop} sx={{ color: 'info.main', p: 0.25, flexShrink: 0 }}>
                            <OpenInNewIcon sx={{ fontSize: iconSize.body }} />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  color: 'text.secondary' }}>{t.author || '-'}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' },  fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>{fmtDate(t.date)}</TableCell>
                    <TableCell onClick={stop} sx={{ cursor: editable ? 'pointer' : 'not-allowed' }}>
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
                          {IMP_STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: typescale.body.size }}>{s}</MenuItem>)}
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
                              {memoOn ? <PushPinIcon sx={{ fontSize: iconSize.action }} /> : <PushPinOutlinedIcon sx={{ fontSize: iconSize.action }} />}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                    {/* 더보기 — 행을 펼치지 않고 수정·삭제. 셀 onClick stop 으로 아코디언 토글 방지 */}
                    {memoCol && (
                      <TableCell onClick={stop} sx={{ textAlign: 'center' }}>
                        <IconButton
                          size="small"
                          aria-label="더보기"
                          onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, t }) }}
                          sx={{ color: 'text.secondary', p: 0.25, flexShrink: 0 }}
                        >
                          <MoreVertIcon sx={{ fontSize: iconSize.action }} />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>,
                  /* 펼침 행은 항상 렌더하고 Collapse 가 높이를 애니메이션한다(공지사항 표와 같은 방식).
                     구 `open ? <TableRow/> : null` 은 조건부 렌더라 내용이 툭 튀어나왔다.
                     셀은 p:0·border:0 이어야 접혔을 때 빈 띠가 남지 않는다 — 여백·배경은 안쪽 Box 가 갖는다. */
                  (
                    <TableRow key={`${t.id}-a`}>
                      <TableCell sx={{ p: 0, border: 0 }} />
                      <TableCell colSpan={detailSpan} sx={{ p: 0, border: 0 }}>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                          <Box sx={(th) => ({ bgcolor: alpha(th.palette.accent.blue, 0.06), px: `${table.cellPadX}px`, py: `${table.cellPadY}px`, textAlign: 'left', whiteSpace: 'normal' })}>
                        {/* 원문 내용 + (관리자) 개선요청 수정/삭제 */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                          <Box sx={{ fontSize: typescale.body.size, color: 'text.primary', lineHeight: 1.7, py: 0.5, flex: 1 }}>
                            {t.content ? <RichBodyView html={t.content} /> : '내용 없음'}
                          </Box>
                          {(editable || removable) && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, pt: 0.25 }} onClick={stop}>
                              {/* 수정 = 로그인 관리자 전체 / 삭제 = 담당자(작성자)만 */}
                              {editable && <Tooltip title="수정"><IconButton size="small" aria-label="수정" onClick={() => openEdit(t)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: iconSize.action }} /></IconButton></Tooltip>}
                              {removable && <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="삭제" onClick={() => setDeleteDlg(t)}><DeleteOutlineIcon sx={{ fontSize: iconSize.action }} /></IconButton></Tooltip>}
                            </Box>
                          )}
                        </Box>
                        {/* 답글 — 목록(시간순) + (관리자) 입력창. key=t.id로 행 전환 시 입력/편집 상태 초기화 */}
                        <ReplyThread
                          key={t.id}
                          replies={rowReplies}
                          // 구성원 쓰기 개방(2026-08-05) — 답글 등록·본인 답글 수정/삭제
                          isAdmin={isMember}
                          user={user}
                          busy={replyBusy}
                          onCreate={(content) => createReplyH(t.num, content)}
                          onEdit={editReplyH}
                          onRequestDelete={(r) => setDelReply(r)}
                        />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  ),
                ]
              })}
            </TableBody>
          </Table>
        </AppCard>
        )}
      </ContentSection>

      {/* 목록 더보기 메뉴 — 펼치지 않고 바로 처리. 수정 = 로그인 관리자 전체 / 삭제 = 담당자(작성자)만 */}
      {canEdit && (
        <Menu
          anchorEl={menuFor?.el ?? null}
          open={!!menuFor}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } } }}
        >
          <MenuItem onClick={menuAct(openEdit)}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>수정</ListItemText>
          </MenuItem>
          {menuFor && canDelete(menuFor.t) && (
            <MenuItem onClick={menuAct(setDeleteDlg)} sx={{ color: 'error.main' }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
              <ListItemText>삭제</ListItemText>
            </MenuItem>
          )}
        </Menu>
      )}

      {/* 작성 중 닫기 확인 — 미저장 변경이 있을 때만. 임시저장 후 닫기 / 저장 안 함 / 계속 작성 */}
      <Dialog open={closeConfirm} onClose={() => !savingDraft && setCloseConfirm(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>작성 중인 내용이 있습니다</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: typescale.emphasis.size, color: 'text.primary', lineHeight: 1.7 }}>작성 중인 요청을 임시저장할까요?<br />저장하지 않으면 이번에 작성한 내용은 사라집니다.</Box>
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
          <Button onClick={() => setReasonDlg(null)} disabled={savingId !== null} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" color="success" onClick={commitReason} disabled={savingId !== null}>{savingId !== null ? '저장 중…' : '저장'}</Button>
        </DialogActions>
      </Dialog>

      {/* 삭제 확인 팝업 */}
      <ConfirmDialog
        open={!!deleteDlg}
        destructive
        title="요청을 삭제할까요?"
        description={`「${deleteDlg?.title || ''}」 요청을 삭제합니다. 삭제 후 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        busy={saving}
        onConfirm={handleDelete}
        onClose={() => setDeleteDlg(null)}
      />

      <ConfirmDialog
        open={bulkOpen}
        destructive
        title={`선택한 요청 ${picked.size}건을 삭제할까요?`}
        description="삭제 후 되돌릴 수 없습니다. 답글도 함께 사라집니다."
        confirmLabel="삭제"
        busy={bulkBusy}
        onConfirm={handleBulkDelete}
        onClose={() => !bulkBusy && setBulkOpen(false)}
      />

      {/* 답글 삭제 확인 (소프트 삭제 — 되돌릴 수 없다는 문구는 쓰지 않는다) */}
      <ConfirmDialog
        open={!!delReply}
        destructive
        title="답글을 삭제할까요?"
        description="삭제하면 목록과 답글 수에서 제외됩니다."
        confirmLabel="삭제"
        busy={replyBusy}
        onConfirm={confirmDelReply}
        onClose={() => setDelReply(null)}
      />
    </PageContainer>
  )
}
