import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import Popover from '@mui/material/Popover'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { addReply, patchReply, removeReply } from '@/store/slices/replySlice'
import { updateImprovement, createReply, updateReply, deleteReply } from '@/api/improve'
import type { ReplyRow } from '@/api/sheets'
import { RichBodyView } from '@/utils/richBody'
import { RichBodyEditor } from '@/components/richText'
import { useRole } from '@/auth/role'
import { memosForPath, visibleMemos, firstLine } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import ReplyThread from '@/pages/Improve/ReplyThread'
import { StatusChip, useSnack, ConfirmDialog } from '@/components/ds'
import { IMP_STATUSES, impKind, needsReason, normStatus, isSettled } from '@/pages/Improve/improveMeta'
import { radius, iconSize, typescale, weight } from '@/theme/tokens'

/** '개선 메모 N' 칩 — 제목 옆. 클릭 시 패널 토글(열 때 각 항목은 접힌 상태로 시작). */
function MemoChip({ count, open, onToggle, anchorRef }: { count: number; open: boolean; onToggle: () => void; anchorRef?: React.Ref<HTMLButtonElement> }) {
  return (
    <Box
      component="button"
      type="button"
      ref={anchorRef}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`개선 메모 ${count}건${open ? ' 접기' : ' 펼치기'}`}
      sx={(th) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        // 전구 아이콘만 — '개선 메모' 글자와 건수 배지는 뺐다(사용자 지시 2026-08-09).
        // 건수는 aria-label 로만 남긴다(화면낭독기 사용자에겐 여전히 필요).
        width: 28,
        height: 28,
        border: `1px solid ${alpha(th.palette.accent.amber, 0.46)}`,
        borderRadius: `${radius.pill}px`,
        p: 0,
        cursor: 'pointer',
        font: 'inherit',
        fontSize: typescale.small.size,
        fontWeight: weight.heavy,
        color: th.palette.accentText.amber,
        bgcolor: alpha(th.palette.accent.amber, open ? 0.2 : 0.12),
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: alpha(th.palette.accent.amber, 0.22) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      })}
    >
      <LightbulbIcon sx={{ fontSize: iconSize.action }} />
    </Box>
  )
}

/** 답글 +N 칩 — 포털개선요청 게시판과 동일 디자인(파란색, 점 없음). 삭제 안 된 답글 수. */
function ReplyCountChip({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`답글 ${count}건`}
      sx={(th) => ({
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        px: '7px',
        borderRadius: `${radius.button}px`,
        border: `1px solid ${alpha(th.palette.accent.blue, 0.4)}`,
        bgcolor: alpha(th.palette.accent.blue, 0.14),
        color: th.palette.accentText.blue,
        font: 'inherit',
        fontSize: typescale.caption.size,
        fontWeight: weight.bold,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        '&:hover': { bgcolor: alpha(th.palette.accent.blue, 0.22) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      })}
    >
      답글 +{count}
    </Box>
  )
}

/** 메모 한 건 — 번호·제목·작성자·개선위치 + 답글 +N + 펼치면 내용·답글 통합 표시. */
function MemoRow({
  t, replies, open, onToggle, onRemove, removing, isAdmin, user, replyBusy, onCreateReply, onEditReply, onRequestDeleteReply,
  onStatusChange, savingStatus, onSaveContent,
}: {
  t: ImprovementItem
  replies: ReplyRow[]
  open: boolean
  onToggle: () => void
  onRemove: () => void
  removing: boolean
  isAdmin: boolean
  user: string | null
  replyBusy: boolean
  onCreateReply: (reqNum: string, content: string) => Promise<void>
  onEditReply: (id: string, content: string) => Promise<void>
  onRequestDeleteReply: (r: ReplyRow) => void
  onStatusChange: (status: string) => void
  savingStatus: boolean
  /** 본문 수정 저장 — 실패 시 throw(편집 상태를 유지해야 다시 시도할 수 있다) */
  onSaveContent: (body: string) => Promise<void>
}) {
  const st = normStatus(t.status)
  /**
   * 본문 수정(요청메모 91) — PC 는 붙임쪽지의 연필로 고치는데 그 레이어가 PC 전용이라
   * 모바일(이 패널)에는 수정 길이 없었다. 쪽지와 같은 리치 에디터·같은 저장 경로를 그대로 쓴다.
   */
  const [editing, setEditing] = useState(false)
  const [eContent, setEContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const startEdit = () => {
    setEContent(t.content || t.title || '')
    setEditing(true)
    if (!open) onToggle() // 접힌 채로는 에디터가 안 보인다 — 먼저 펼친다
  }
  const submitEdit = async () => {
    const body = eContent.trim()
    if (!body) return
    setSavingEdit(true)
    try {
      await onSaveContent(body)
      setEditing(false)
    } catch {
      /* 실패 스낵바는 부모가 띄운다 — 편집 상태 유지 */
    } finally {
      setSavingEdit(false)
    }
  }
  /**
   * 카드 어디를 눌러도 펼치기/접기(요청메모 91) — 종전엔 '펼치기' 버튼만 토글이라 44px 미만
   * 과녁을 정확히 맞혀야 했다. 안의 버튼·선택칸 클릭은 토글로 번지면 안 되므로 걸러낸다
   * (StickyMemo 의 isInteractive 와 같은 잣대). 펼친 본문(답글 입력 등)은 이 판 밖이다.
   */
  const onHeaderTap = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('button, input, textarea, a, [contenteditable], [role="combobox"]')) return
    onToggle()
  }
  return (
    <Box sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      {/* 두 줄 구성(2026-08-14 사용자 지시) — 제목줄엔 번호·제목만, 메타(작성자·위치·상태·버튼)는 아랫줄.
          종전엔 한 줄 flexWrap 이라 제목이 짧으면 작성자가 제목 옆으로 올라와 붙었다(#85 에서 확인). */}
      <Box onClick={onHeaderTap} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, cursor: 'pointer' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Box component="span" sx={(th) => ({ flexShrink: 0, fontSize: typescale.caption.size, fontWeight: weight.heavy, color: th.palette.accentText.amber, fontVariantNumeric: 'tabular-nums' })}>
          요청 #{t.num}
        </Box>
        <Box component="span" sx={{ fontSize: typescale.body.size, fontWeight: weight.bold, color: 'text.primary', minWidth: 0, wordBreak: 'break-word' }}>{t.title}</Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: 'text.secondary' }}>
          <PersonOutlineIcon sx={{ fontSize: iconSize.caption }} />{t.author || '-'}
        </Box>
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: th.palette.accentText.blue, bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: `${radius.pill}px` })}>
          <PlaceOutlinedIcon sx={{ fontSize: iconSize.caption }} />{t.loc || '-'}
        </Box>
        {/* 상태 — 메인 보드와 동일 값·색. 관리자는 여기서 바로 변경(보류·완료·불가는 확인 팝업). */}
        {isAdmin ? (
          <Select
            value={st}
            onChange={(e) => onStatusChange(e.target.value)}
            disabled={savingStatus}
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
        {replies.length > 0 && <ReplyCountChip count={replies.length} onClick={onToggle} />}
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          <Button size="small" onClick={startEdit} disabled={editing} sx={{ minWidth: 0, fontSize: typescale.small.size, color: 'text.secondary', px: 1 }}>
            수정
          </Button>
          <Button
            size="small"
            onClick={onToggle}
            aria-expanded={open}
            startIcon={open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            sx={{ minWidth: 0, fontSize: typescale.small.size, color: 'text.secondary', px: 1 }}
          >
            {open ? '접기' : '펼치기'}
          </Button>
          <Button size="small" color="warning" onClick={onRemove} disabled={removing} sx={{ minWidth: 0, fontSize: typescale.small.size, px: 1 }}>
            메모 해제
          </Button>
        </Box>
      </Box>
      </Box>
      {open && (
        <Box sx={{ mt: 1 }}>
          {/* 1·2: 개선요청 내용 — 수정 중엔 쪽지(StickyMemo)와 같은 리치 에디터.
              평문 textarea 로 받으면 서식 있는 글의 태그가 그대로 드러난다 */}
          {editing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <RichBodyEditor
                value={eContent}
                onChange={setEContent}
                placeholder="내용"
                ariaLabel="메모 내용"
                fontSize={typescale.small.size}
                minHeight={64}
                framed
                onCtrlEnter={() => void submitEdit()}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                <Button size="small" onClick={() => setEditing(false)} disabled={savingEdit} sx={{ color: 'text.secondary' }}>취소</Button>
                <Button size="small" variant="contained" onClick={() => void submitEdit()} disabled={savingEdit || !eContent.trim()}>
                  {savingEdit ? '저장 중…' : '저장'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ fontSize: typescale.body.size, color: 'text.secondary', lineHeight: 1.7 }}>
              {t.content ? <RichBodyView html={t.content} /> : '내용 없음'}
            </Box>
          )}
          {/* 3·4·5·6: 답글 +N · 목록 · 입력창 · 등록 (게시판과 동일 데이터/컴포넌트) */}
          <ReplyThread
            replies={replies}
            isAdmin={isAdmin}
            user={user}
            busy={replyBusy}
            onCreate={(content) => onCreateReply(t.num, content)}
            onEdit={onEditReply}
            onRequestDelete={onRequestDeleteReply}
          />
        </Box>
      )}
    </Box>
  )
}

/**
 * 현재 경로의 개선 메모를 PageHeader에 결합하는 훅.
 * 반환: 제목 옆 칩 / 제목 아래 패널 / (스낵바·답글삭제 Dialog는 관리자에게 항상 렌더).
 * 게스트·메모 없음 → chip/panel은 null. 답글은 포털개선요청과 동일 시트·API·replySlice·ReplyThread 재사용.
 */
export function usePageImprovementMemo(): { chip: ReactNode; panel: ReactNode; snackbar: ReactNode } {
  const { pathname } = useLocation()
  const { isAdmin, isMember, user, authKey } = useRole()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const items = useAppSelector((s) => s.improve.items)
  const replyItems = useAppSelector((s) => s.reply.items)

  const [open, setOpen] = useState(false)
  // 팝오버 닻 — 제목 옆 전구 칩(2026-08-14 팝오버 전환)
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const [openNum, setOpenNum] = useState<string | null>(null) // 내용+답글 통합 펼침 — 한 번에 하나만
  const [removingNum, setRemovingNum] = useState<string | null>(null)
  const [replyBusy, setReplyBusy] = useState(false)
  const [delReply, setDelReply] = useState<ReplyRow | null>(null)
  const [savingStatusNum, setSavingStatusNum] = useState<string | null>(null)
  const [statusDlg, setStatusDlg] = useState<{ row: ImprovementItem; status: string; value: string } | null>(null)

  // 작성자 본인 + 포털 관리자에게만(2026-08-05) — 남의 메모로 내 화면이 덮이지 않게
  const memos = useMemo(() => memosForPath(visibleMemos(items, user, isAdmin), pathname), [items, pathname, user, isAdmin])
  // 삭제 안 된 답글을 요청번호별로 그룹화(작성일시 오름차순) — 게시판과 동일 데이터
  const repliesByReq = useMemo(() => {
    const m: Record<string, ReplyRow[]> = {}
    for (const r of replyItems) (m[r.reqNum] ||= []).push(r)
    for (const k in m) m[k].sort((a, b) => a.created.localeCompare(b.created))
    return m
  }, [replyItems])

  // ── 답글 (게시판과 동일 API·낙관적 업데이트 → 두 화면 즉시 동기화) ──
  const createReplyH = async (reqNum: string, content: string) => {
    if (!user || !authKey) { snack('로그인이 필요합니다.', 'error'); throw new Error('no-auth') }
    setReplyBusy(true)
    try {
      const { id, created } = await createReply({ author: user, key: authKey, reqNum, content })
      dispatch(addReply({ id, reqNum, created: created || `${todaySeoul()} 00:00:00`, author: user, content, edited: '' }))
      setReplyBusy(false)
      snack('답글을 등록했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      snack(err instanceof Error ? err.message : '답글 등록 실패', 'error')
      throw err
    }
  }
  const editReplyH = async (id: string, content: string) => {
    if (!user || !authKey) { snack('로그인이 필요합니다.', 'error'); throw new Error('no-auth') }
    setReplyBusy(true)
    try {
      const { edited } = await updateReply({ author: user, key: authKey, id, content })
      dispatch(patchReply({ id, content, edited: edited || `${todaySeoul()} 00:00` }))
      setReplyBusy(false)
      snack('답글을 수정했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      snack(err instanceof Error ? err.message : '답글 수정 실패', 'error')
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
      snack('답글을 삭제했습니다.', 'success')
    } catch (err) {
      setReplyBusy(false)
      snack(err instanceof Error ? err.message : '답글 삭제 실패', 'error')
    }
  }

  // ── 상태 변경 (메인 보드와 동일 값·색·확인규칙). 저장 후 재로드로 메인 목록·메모 즉시 동기화. ──
  const saveStatus = async (t: ImprovementItem, status: string, reason: string) => {
    if (!user || !authKey) { snack('로그인이 필요합니다.', 'error'); return }
    setSavingStatusNum(t.num)
    try {
      await updateImprovement({ author: user, key: authKey, num: t.num, status, reason })
      setSavingStatusNum(null)
      setStatusDlg(null)
      snack('상태를 변경했습니다.', 'success')
      dispatch(loadImproveData()) // 종결 전환 시 자동 memo=FALSE → 이 패널에서도 자연스럽게 제외됨
    } catch (err) {
      setSavingStatusNum(null)
      snack(err instanceof Error ? err.message : '변경 실패', 'error')
    }
  }
  // 보류·완료·불가(종결)는 확인 팝업(보류·불가는 사유 입력), 그 외는 즉시 반영
  const onStatusChange = (t: ImprovementItem, status: string) => {
    if (status === normStatus(t.status)) return
    if (isSettled(status)) setStatusDlg({ row: t, status, value: t.reason || '' })
    else void saveStatus(t, status, '')
  }
  const applyStatusDlg = () => {
    if (!statusDlg) return
    if (needsReason(statusDlg.status) && !statusDlg.value.trim()) return snack('사유를 입력해주세요.', 'error')
    void saveStatus(statusDlg.row, statusDlg.status, needsReason(statusDlg.status) ? statusDlg.value.trim() : '')
  }

  // 개선 메모를 볼 수 있는 사람 = 로그인한 구성원. 무엇이 보이는지는 memos(작성자 본인 + 관리자)가 가른다.
  // 종전에는 유지보수자(조성범) 1인 전용이었는데, 자기 메모는 본인이 봐야 한다는 지시로 기준을 옮겼다(2026-08-05).
  const admin = isMember && !!authKey
  // 답글 삭제 + 상태변경 확인 Dialog — 유지보수자에게 항상 렌더(패널 상태와 무관). 스낵바는 전역 useSnack.
  const snackbar = admin ? (
    <>
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
      {/* 상태 변경 확인(보류·완료·불가) — 보류·불가는 사유 입력 */}
      <Dialog open={!!statusDlg} onClose={() => savingStatusNum === null && setStatusDlg(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>상태를 '{statusDlg?.status}'(으)로 변경할까요?</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: typescale.body.size, color: 'text.secondary', mb: statusDlg && needsReason(statusDlg.status) ? 1.5 : 0 }}>「{statusDlg?.row.title}」</Box>
          {statusDlg && needsReason(statusDlg.status) && (
            <TextField
              autoFocus fullWidth multiline minRows={3}
              value={statusDlg.value}
              onChange={(e) => setStatusDlg((p) => (p ? { ...p, value: e.target.value } : p))}
              placeholder={`${statusDlg.status} 사유를 입력해주세요.`}
              disabled={savingStatusNum !== null}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStatusDlg(null)} disabled={savingStatusNum !== null} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" onClick={applyStatusDlg} disabled={savingStatusNum !== null}>{savingStatusNum !== null ? '변경 중…' : '변경'}</Button>
        </DialogActions>
      </Dialog>
    </>
  ) : null

  // 게스트 또는 이 페이지에 메모 없음 → 칩·패널 미표시(스낵바·Dialog만 유지)
  if (!admin || memos.length === 0) return { chip: null, panel: null, snackbar }

  const toggleOpen = () => setOpen((o) => { const next = !o; if (next) setOpenNum(null); return next })
  const toggleRow = (num: string) => setOpenNum((prev) => (prev === num ? null : num))

  // 본문 수정 저장 — 쪽지(StickyMemo saveEdit)와 같은 규칙: 게시판 제목은 내용 첫 줄에서 다시 만든다
  const saveContent = async (t: ImprovementItem, body: string) => {
    if (!user || !authKey) { snack('로그인이 필요합니다.', 'error'); throw new Error('no-auth') }
    try {
      await updateImprovement({ author: user, key: authKey, num: t.num, title: firstLine(body), content: body })
      snack('수정했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      snack(err instanceof Error ? err.message : '수정에 실패했습니다', 'error')
      throw err
    }
  }

  const removeMemo = async (t: ImprovementItem) => {
    if (!user || !authKey) return snack('로그인이 필요합니다.', 'error')
    setRemovingNum(t.num)
    try {
      await updateImprovement({ author: user, key: authKey, num: t.num, memo: false })
      setRemovingNum(null)
      snack('메모를 해제했습니다.', 'success')
      dispatch(loadImproveData())
    } catch (err) {
      setRemovingNum(null)
      snack(err instanceof Error ? err.message : '메모 해제 실패', 'error')
    }
  }

  const chip = <MemoChip count={memos.length} open={open} onToggle={toggleOpen} anchorRef={chipRef} />

  /**
   * 팝오버로 띄운다(2026-08-14 사용자 지시) — 종전엔 제목 아래 인라인이라 패널을 열면
   * 공지 목록 전체가 그만큼 아래로 밀렸다. 팝오버는 떠 있어서 목록이 한 픽셀도 안 움직인다.
   * 세로는 화면의 70%까지, 넘치면 팝오버 안에서 스크롤.
   */
  const panel = (
    <Popover
      open={open}
      anchorEl={chipRef.current}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableScrollLock
      slotProps={{
        paper: {
          sx: (th) => ({
            mt: 1,
            width: 'min(calc(100vw - 24px), 520px)',
            maxHeight: '70vh',
            overflowY: 'auto',
            border: `1px solid ${alpha(th.palette.accent.amber, 0.35)}`,
            borderRadius: `${radius.card}px`,
            background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.1)}, ${th.palette.background.paper} 52%)`,
          }),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 1, borderBottom: '1px solid', borderColor: (th) => alpha(th.palette.accent.amber, 0.18) }}>
        <Box sx={(th) => ({ fontSize: typescale.small.size, fontWeight: weight.heavy, color: th.palette.accentText.amber })}>이 화면에서 확인할 개선요청</Box>
        <Button size="small" onClick={() => setOpen(false)} sx={{ minWidth: 0, fontSize: typescale.small.size, color: 'text.secondary', px: 1 }}>접기</Button>
      </Box>
      <Box sx={{ px: 1.75 }}>
        {memos.map((t) => (
          <MemoRow
            key={t.num}
            t={t}
            replies={repliesByReq[t.num] || []}
            open={openNum === t.num}
            onToggle={() => toggleRow(t.num)}
            onRemove={() => void removeMemo(t)}
            removing={removingNum === t.num}
            isAdmin={isAdmin}
            user={user}
            replyBusy={replyBusy}
            onCreateReply={createReplyH}
            onEditReply={editReplyH}
            onRequestDeleteReply={(r) => setDelReply(r)}
            onStatusChange={(status) => onStatusChange(t, status)}
            onSaveContent={(body) => saveContent(t, body)}
            savingStatus={savingStatusNum === t.num}
          />
        ))}
      </Box>
    </Popover>
  )

  return { chip, panel, snackbar }
}
