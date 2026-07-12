import { useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import PushPinIcon from '@mui/icons-material/PushPin'
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
import { useRole } from '@/auth/role'
import { memosForPath } from '@/utils/improveMemo'
import { todaySeoul } from '@/utils/date'
import type { ImprovementItem } from '@/types'
import ReplyThread from '@/pages/Improve/ReplyThread'
import { StatusChip, useSnack } from '@/components/ds'
import { IMP_STATUSES, impKind, needsReason, normStatus, isSettled } from '@/pages/Improve/improveMeta'
import { radius, iconSize } from '@/theme/tokens'

/** '개선 메모 N' 칩 — 제목 옆. 클릭 시 패널 토글(열 때 각 항목은 접힌 상태로 시작). */
function MemoChip({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`개선 메모 ${count}건${open ? ' 접기' : ' 펼치기'}`}
      sx={(th) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
        border: `1px solid ${alpha(th.palette.accent.amber, 0.46)}`,
        borderRadius: radius.pill,
        px: '10px',
        py: '5px',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 12,
        fontWeight: 800,
        color: th.palette.accent.amber,
        bgcolor: alpha(th.palette.accent.amber, open ? 0.2 : 0.12),
        transition: 'background-color .15s ease',
        '&:hover': { bgcolor: alpha(th.palette.accent.amber, 0.22) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      })}
    >
      <PushPinIcon sx={{ fontSize: iconSize.body }} />
      개선 메모
      <Box
        component="span"
        sx={(th) => ({
          display: 'inline-grid',
          placeItems: 'center',
          minWidth: 18,
          height: 18,
          px: '4px',
          borderRadius: radius.pill,
          fontSize: 11,
          fontWeight: 800,
          bgcolor: th.palette.accent.amber,
          color: th.palette.getContrastText(th.palette.accent.amber),
        })}
      >
        {count}
      </Box>
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
        borderRadius: radius.button,
        border: `1px solid ${alpha(th.palette.accent.blue, 0.4)}`,
        bgcolor: alpha(th.palette.accent.blue, 0.14),
        color: th.palette.accent.blue,
        font: 'inherit',
        fontSize: 11,
        fontWeight: 700,
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
  onStatusChange, savingStatus,
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
}) {
  const st = normStatus(t.status)
  return (
    <Box sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box component="span" sx={(th) => ({ fontSize: 11, fontWeight: 800, color: th.palette.accent.amber, fontVariantNumeric: 'tabular-nums' })}>
          요청 #{t.num}
        </Box>
        <Box component="span" sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', minWidth: 0 }}>{t.title}</Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: 11, color: 'text.secondary' }}>
          <PersonOutlineIcon sx={{ fontSize: iconSize.caption }} />{t.author || '-'}
        </Box>
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: 11, color: th.palette.accent.blue, bgcolor: alpha(th.palette.accent.blue, 0.13), px: '7px', py: '2px', borderRadius: radius.pill })}>
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
            {IMP_STATUSES.map((s) => <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>)}
          </Select>
        ) : (
          <StatusChip status={impKind(st)} label={st || '-'} />
        )}
        {replies.length > 0 && <ReplyCountChip count={replies.length} onClick={onToggle} />}
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          <Button
            size="small"
            onClick={onToggle}
            aria-expanded={open}
            startIcon={open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            sx={{ minWidth: 0, fontSize: 12, color: 'text.secondary', px: 1 }}
          >
            {open ? '접기' : '펼치기'}
          </Button>
          <Button size="small" color="warning" onClick={onRemove} disabled={removing} sx={{ minWidth: 0, fontSize: 12, px: 1 }}>
            메모 해제
          </Button>
        </Box>
      </Box>
      {open && (
        <Box sx={{ mt: 1 }}>
          {/* 1·2: 개선요청 내용 */}
          <Box sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
            {t.content ? <RichBodyView html={t.content} /> : '내용 없음'}
          </Box>
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
  const { isAdmin, user, authKey } = useRole()
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const items = useAppSelector((s) => s.improve.items)
  const replyItems = useAppSelector((s) => s.reply.items)

  const [open, setOpen] = useState(false)
  const [openNum, setOpenNum] = useState<string | null>(null) // 내용+답글 통합 펼침 — 한 번에 하나만
  const [removingNum, setRemovingNum] = useState<string | null>(null)
  const [replyBusy, setReplyBusy] = useState(false)
  const [delReply, setDelReply] = useState<ReplyRow | null>(null)
  const [savingStatusNum, setSavingStatusNum] = useState<string | null>(null)
  const [statusDlg, setStatusDlg] = useState<{ row: ImprovementItem; status: string; value: string } | null>(null)

  const memos = useMemo(() => memosForPath(items, pathname), [items, pathname])
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

  const admin = isAdmin && !!user && !!authKey
  // 답글 삭제 + 상태변경 확인 Dialog — 관리자에게 항상 렌더(패널 상태와 무관). 스낵바는 전역 useSnack.
  const snackbar = admin ? (
    <>
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
      {/* 상태 변경 확인(보류·완료·불가) — 보류·불가는 사유 입력 */}
      <Dialog open={!!statusDlg} onClose={() => savingStatusNum === null && setStatusDlg(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
        <DialogTitle>상태를 '{statusDlg?.status}'(으)로 변경할까요?</DialogTitle>
        <DialogContent>
          <Box sx={{ fontSize: 13, color: 'text.secondary', mb: statusDlg && needsReason(statusDlg.status) ? 1.5 : 0 }}>「{statusDlg?.row.title}」</Box>
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

  const chip = <MemoChip count={memos.length} open={open} onToggle={toggleOpen} />

  const panel = open ? (
    <Box
      sx={(th) => ({
        mt: 1.25,
        border: `1px solid ${alpha(th.palette.accent.amber, 0.35)}`,
        borderRadius: radius.card,
        overflow: 'hidden',
        background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.1)}, ${th.palette.background.paper} 52%)`,
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 1, borderBottom: '1px solid', borderColor: (th) => alpha(th.palette.accent.amber, 0.18) }}>
        <Box sx={(th) => ({ fontSize: 12, fontWeight: 800, color: th.palette.accent.amber })}>이 화면에서 확인할 개선요청</Box>
        <Button size="small" onClick={() => setOpen(false)} sx={{ minWidth: 0, fontSize: 12, color: 'text.secondary', px: 1 }}>접기</Button>
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
            savingStatus={savingStatusNum === t.num}
          />
        ))}
      </Box>
    </Box>
  ) : null

  return { chip, panel, snackbar }
}
