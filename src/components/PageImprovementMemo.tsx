import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import CloseIcon from '@mui/icons-material/Close'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import PushPinIcon from '@mui/icons-material/PushPin'
import SendIcon from '@mui/icons-material/Send'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadImproveData } from '@/store/slices/improveSlice'
import { addReply } from '@/store/slices/replySlice'
import { updateImprovement, createReply } from '@/api/improve'
import type { ReplyRow } from '@/api/sheets'
import { RichBodyView } from '@/utils/richBody'
import { RichBodyEditor } from '@/components/richText'
import { useRole } from '@/auth/role'
import { memosForPath, visibleMemos, firstLine } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import { StatusChip, useSnack } from '@/components/ds'
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

/**
 * 메모 한 장 — **PC 붙임쪽지와 같은 모습**(2026-08-14 사용자 지시: "캡처화면처럼").
 * 앰버 그라데이션 머리(전구·요청번호·상태칩·연필·핀) + 내용 + 작성자·위치·게시판 + 답글.
 * 내용은 항상 펼쳐져 있다 — 쪽지에 접기가 없듯 여기도 펼치기 버튼이 없다.
 *
 * 여러 장이면 **직각으로 맞붙는다**: 첫 장만 위 모서리, 끝 장만 아래 모서리가 둥글고
 * 맞붙는 변은 직각(사용자 지시). 겹치는 테두리는 mt -1px 로 한 줄로 합친다.
 */
function MemoRow({
  t, replies, first, last, isAdmin, user, replyBusy, onCreateReply, onRemove, removing,
  onStatusChange, savingStatus, onSaveContent, onGoBoard,
}: {
  t: ImprovementItem
  replies: ReplyRow[]
  first: boolean
  last: boolean
  isAdmin: boolean
  user: string | null
  replyBusy: boolean
  onCreateReply: (reqNum: string, content: string) => Promise<void>
  onRemove: () => void
  removing: boolean
  onStatusChange: (status: string) => void
  savingStatus: boolean
  /** 본문 수정 저장 — 실패 시 throw(편집 상태를 유지해야 다시 시도할 수 있다) */
  onSaveContent: (body: string) => Promise<void>
  onGoBoard: () => void
}) {
  const st = normStatus(t.status)
  const [editing, setEditing] = useState(false)
  const [eContent, setEContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [reply, setReply] = useState('')
  const startEdit = () => {
    setEContent(t.content || t.title || '')
    setEditing(true)
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
  const sendReply = async () => {
    const v = reply.trim()
    if (!v || replyBusy) return
    try {
      await onCreateReply(t.num, v)
      setReply('')
    } catch {
      /* 실패 스낵바는 부모가 — 입력은 남겨 다시 보낼 수 있게 */
    }
  }
  const corner = `${radius.card}px`
  return (
    <Box
      sx={(th) => ({
        border: `1px solid ${alpha(th.palette.accent.amber, 0.5)}`,
        bgcolor: 'background.paper',
        borderRadius: `${first ? corner : 0} ${first ? corner : 0} ${last ? corner : 0} ${last ? corner : 0}`,
        mt: first ? 0 : '-1px',
        overflow: 'hidden',
      })}
    >
      <Box
        sx={(th) => ({
          display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 1,
          borderBottom: '1px solid', borderColor: 'divider',
          background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.13)}, transparent 70%)`,
        })}
      >
        <LightbulbIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
        <Box component="span" sx={(th) => ({ fontSize: typescale.caption.size, fontWeight: weight.heavy, color: th.palette.accentText.amber, fontVariantNumeric: 'tabular-nums' })}>
          요청 #{t.num}
        </Box>
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
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25 }}>
          {!editing && (
            <Tooltip title="제목·내용 수정">
              <IconButton size="small" aria-label="메모 수정" onClick={startEdit} sx={{ color: 'text.secondary', p: 0.5 }}>
                <EditIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="메모 해제">
            <span>
              <IconButton size="small" aria-label="메모 해제" onClick={onRemove} disabled={removing} sx={(th) => ({ color: th.palette.accent.amber, p: 0.5 })}>
                <PushPinIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ px: 1.5, pt: 1.25, pb: 1.5 }}>
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
              toolbar={false}
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
          <RichBodyView
            html={t.content || t.title}
            sx={{ fontSize: typescale.body.size, lineHeight: 1.65, color: 'text.primary', maxHeight: 200, overflowY: 'auto' }}
          />
        )}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: 'text.secondary' }}>
            <PersonOutlineIcon sx={{ fontSize: iconSize.caption }} />{t.author || '-'}
          </Box>
          <Box
            component="span"
            sx={(th) => ({
              fontSize: typescale.caption.size, color: 'accentText.blue',
              bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: `${radius.pill}px`,
            })}
          >
            {t.loc || '-'}
          </Box>
          <Button
            size="small"
            endIcon={<OpenInNewIcon sx={{ fontSize: iconSize.caption }} />}
            onClick={onGoBoard}
            sx={{ ml: 'auto', minWidth: 0, px: 0.75, fontSize: typescale.caption.size, color: 'text.secondary' }}
          >
            게시판
          </Button>
        </Box>

        {replies.length > 0 && (
          <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 132, overflowY: 'auto' }}>
            {replies.map((r) => (
              <Box key={r.id} sx={{ bgcolor: 'background.elevated', borderRadius: `${radius.chip}px`, px: 1, py: 0.75 }}>
                <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: 'text.primary', mr: 0.75 }}>
                  {r.author || '-'}
                </Box>
                <RichBodyView html={r.content} sx={{ display: 'inline', fontSize: typescale.caption.size, color: 'text.secondary' }} />
              </Box>
            ))}
          </Box>
        )}

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.25 }}>
            <TextField
              size="small"
              fullWidth
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              // isComposing 검사가 없으면 한글 조합을 Enter 로 확정하는 순간 답글이 전송된다
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void sendReply() } }}
              placeholder="답글 달기"
              disabled={replyBusy}
              slotProps={{ htmlInput: { 'aria-label': '답글 입력' } }}
              sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size, py: 0.75 } }}
            />
            <IconButton
              size="small"
              aria-label="답글 등록"
              onClick={() => void sendReply()}
              disabled={replyBusy || !reply.trim()}
              sx={{ flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
            >
              <SendIcon sx={{ fontSize: iconSize.body }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * 현재 경로의 개선 메모를 PageHeader에 결합하는 훅.
 * 반환: 제목 옆 칩 / 전구에 닻을 둔 팝오버(쪽지 모습 카드 묶음) / (상태변경 Dialog는 관리자에게 항상 렌더).
 * 게스트·메모 없음 → chip/panel은 null.
 *
 * 카드 모습은 PC 붙임쪽지(StickyMemo)와 같다(2026-08-14 사용자 지시) — 답글도 쪽지처럼
 * 단순 목록 + 한 줄 입력. 답글 수정·삭제는 게시판이 담당한다.
 */
export function usePageImprovementMemo(): { chip: ReactNode; panel: ReactNode; snackbar: ReactNode } {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isAdmin, isMember, user, authKey } = useRole()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const items = useAppSelector((s) => s.improve.items)
  const replyItems = useAppSelector((s) => s.reply.items)

  const [open, setOpen] = useState(false)
  // 팝오버 닻 — 제목 옆 전구 칩
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const [removingNum, setRemovingNum] = useState<string | null>(null)
  const [replyBusy, setReplyBusy] = useState(false)
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

  // 답글 등록 — 게시판과 동일 API·낙관적 업데이트(두 화면 즉시 동기화)
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
  const admin = isMember && !!authKey
  // 상태변경 확인 Dialog — 관리자에게 항상 렌더(패널 상태와 무관). 스낵바는 전역 useSnack.
  const snackbar = admin ? (
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
  ) : null

  // 게스트 또는 이 페이지에 메모 없음 → 칩·패널 미표시(Dialog만 유지)
  if (!admin || memos.length === 0) return { chip: null, panel: null, snackbar }

  const toggleOpen = () => setOpen((o) => !o)

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
   * 전체화면 시트(요청메모 99·100, 2026-08-22) — 종전 팝오버는 화면에는 고정돼 보여도
   * 폰에서 **키보드가 열리는 순간**(본문 수정·답글) 상단바와 함께 레이아웃 뷰포트째 밀려났다.
   * 이 칩·패널은 모바일 전용(개선요청 74)이라 시트로 바꿔도 PC는 영향이 없고, 시트는 화면
   * 전부가 제 것이라 "항상 그 자리"가 구조로 보장된다 — 공지 모바일 작성과 같은 A안 문법.
   */
  const panel = (
    <Dialog
      open={open}
      fullScreen
      onClose={() => setOpen(false)}
      slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton aria-label="닫기" onClick={() => setOpen(false)} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: iconSize.header }} />
        </IconButton>
        <LightbulbIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
        <Box component="span" sx={{ flex: 1, fontSize: typescale.cardTitle.size, fontWeight: weight.bold }}>
          개선 메모 {memos.length}건
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
      {memos.map((t, i) => (
        <MemoRow
          key={t.num}
          t={t}
          replies={repliesByReq[t.num] || []}
          first={i === 0}
          last={i === memos.length - 1}
          isAdmin={isAdmin}
          user={user}
          replyBusy={replyBusy}
          onCreateReply={createReplyH}
          onRemove={() => void removeMemo(t)}
          removing={removingNum === t.num}
          onStatusChange={(status) => onStatusChange(t, status)}
          onSaveContent={(body) => saveContent(t, body)}
          savingStatus={savingStatusNum === t.num}
          onGoBoard={() => { setOpen(false); navigate('/improve') }}
        />
      ))}
      </Box>
    </Dialog>
  )

  return { chip, panel, snackbar }
}
