import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/SendRounded'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ReplyIcon from '@mui/icons-material/Reply'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { addWorkComment, removeWorkComment, markWorkCommentDeleted } from '@/store/slices/workCommentsSlice'
import { createWorkComment, deleteWorkComment, softDeleteWorkComment } from '@/api/workComments'
import type { WorkComment } from '@/api/workComments'
import { useSnack, ConfirmDialog } from '@/components/ds'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import { useRole } from '@/auth/role'

/**
 * 업무카드 코멘트 스레드 (개선요청 68).
 *
 * 처음엔 카드 안에서 아래로 펼쳤는데(A안, 2026-08-12) **카드 밖 팝업으로 바꿨다**(사용자 지시 2026-08-13):
 * 스레드는 카드를 아래로 확장하는 것이 아니라 **임시로 열어 보는** 것이라, 펼칠 때 옆 카드가 밀리면
 * 안 된다. 이 컴포넌트는 팝업의 **내용물**만 그린다 — 띄우는 것(Popper·닫기 규칙·표면 스타일)은
 * TaskAccordion 이 첨부 팝업과 같은 방식으로 한다.
 *
 * 스레드 규칙(2026-08-13 지시):
 *  · 답글의 답글 가능 — parentId 사슬로 깊이 제한 없음. 들여쓰기는 3단에서 멈춘다(팝업 폭 380이라
 *    그 아래는 글줄이 못 산다 — 4단부터는 3단과 같은 자리에 시간순으로 이어진다).
 *  · 답글이 달린 코멘트를 지우면 **자리는 남는다** — "삭제된 코멘트입니다"(내용은 DB에서도 비움).
 *    답글까지 함께 사라지면 남의 글을 지우는 셈이 되기 때문. 답글 없는 코멘트는 행째 지운다.
 *  · 지우기 전에 확인을 받는다(ConfirmDialog).
 *
 * 목록은 전역(workCommentsSlice)에서 온다 — 카드마다 불러오면 화면 한 번에 요청이 150건을 넘는다.
 * 열람·작성·삭제 권한의 최종 판정은 전부 서버(RLS)다. 여기서는 버튼을 감추기만 한다.
 */
export default function WorkCardComments({ num }: { num: string }) {
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const { isMember } = useRole()
  const all = useAppSelector((s) => s.workComments.items)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  /** 답글을 다는 중인 부모 코멘트 id — null 이면 답글칸 없음 */
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  /** 삭제 확인 대상 — 답글 유무에 따라 안내문·삭제 방식이 갈린다 */
  const [delAsk, setDelAsk] = useState<WorkComment | null>(null)

  const list = all.filter((c) => c.num === String(num))
  const tops = list.filter((c) => c.parentId === null)
  const childrenOf = (id: number) => list.filter((c) => c.parentId === id)

  const send = async (content: string, parentId: number | null) => {
    const body = content.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const saved = await createWorkComment({ num, content: body, parentId })
      dispatch(addWorkComment(saved))
      if (parentId === null) setDraft('')
      else { setReplyDraft(''); setReplyTo(null) }
    } catch (err) {
      snack(err instanceof Error ? err.message : '코멘트 등록에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 확인 후 실제 삭제 — 답글이 달려 있으면 자리만 남기고(소프트), 없으면 행째 */
  const confirmRemove = async () => {
    if (!delAsk) return
    const hasReplies = childrenOf(delAsk.id).length > 0
    setBusy(true)
    try {
      if (hasReplies) {
        await softDeleteWorkComment(delAsk.id)
        dispatch(markWorkCommentDeleted(delAsk.id))
      } else {
        await deleteWorkComment(delAsk.id)
        dispatch(removeWorkComment(delAsk.id))
      }
      setDelAsk(null)
    } catch (err) {
      snack(err instanceof Error ? err.message : '코멘트 삭제에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** 코멘트 한 줄 — 답글 버튼은 날짜 바로 옆(사용자 지시 2026-08-13), 삭제는 오른쪽 끝 */
  const row = (c: WorkComment) => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: c.deleted ? 'text.disabled' : 'text.primary' }}>
            {c.author || '-'}
          </Box>
          {/* 날짜+시간을 항상 같이 — 시간만 있으면 '언제 적 얘기인지'를 매번 되물어야 한다(사용자 지시 2026-08-13) */}
          <Box component="span" sx={{ fontSize: typescale.micro.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
            {fmtWhen(c.created)}
          </Box>
          {/* 답글 — 날짜 옆(사용자 지시 2026-08-13). 지워진 자리에는 답을 달 수 없다 */}
          {!c.deleted && isMember && (
            <Tooltip title="답글">
              <IconButton
                size="small"
                aria-label={`${c.author}의 코멘트에 답글`}
                onClick={() => { setReplyTo((prev) => (prev === c.id ? null : c.id)); setReplyDraft('') }}
                sx={{ p: 0.25, color: replyTo === c.id ? 'primary.main' : 'text.disabled' }}
              >
                <ReplyIcon sx={{ fontSize: iconSize.body }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {c.deleted ? (
          // 내용 대신 문구만 — 답글이 딸려 있어 자리는 남긴다(원문은 DB에서도 비웠다)
          <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>삭제된 코멘트입니다</Typography>
        ) : (
          // 평문으로 그린다 — 서식 편집기를 붙이면 팝업 안에서 도구막대가 또 한 층을 먹는다
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {c.content}
          </Typography>
        )}
      </Box>
      {/* 지우기는 쓴 사람만 — 관리자 예외 없음(남의 말을 지우면 기록으로서 값을 잃는다).
          빨강 + body 크기 — 되돌릴 수 없는 동작이라 중립 회색과 무게를 구분한다 */}
      {!c.deleted && c.mine && (
        <Tooltip title="코멘트 삭제">
          <IconButton size="small" aria-label="코멘트 삭제" onClick={() => setDelAsk(c)} sx={(th) => ({ p: 0.25, color: th.palette.accentText.red, flexShrink: 0 })}>
            <DeleteOutlineIcon sx={{ fontSize: iconSize.body }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  )

  /**
   * 스레드 재귀 — 코멘트 + (답글칸) + 자식들. 들여쓰기는 3단까지만:
   * 팝업 폭 380에서 그 아래는 글줄이 못 살아, 4단부터는 3단과 같은 자리에 이어진다.
   */
  const thread = (c: WorkComment, depth: number) => {
    const kids = childrenOf(c.id)
    // 지워진 코멘트는 남은 답글이 있을 때만 자리를 지킨다 — 답글까지 지워지면 함께 사라진다
    if (c.deleted && kids.length === 0) return null
    const indent = depth < 3
    return (
      <Box key={c.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {row(c)}
        {replyTo === c.id && (
          <Box sx={{ pl: 2.5, ml: 0.5 }}>
            {composer(replyDraft, setReplyDraft, () => void send(replyDraft, c.id), '답글 남기기', () => { setReplyTo(null); setReplyDraft('') })}
          </Box>
        )}
        {kids.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ...(indent ? { pl: 2.5, ml: 0.5, borderLeft: '2px solid', borderColor: 'divider' } : {}) }}>
            {kids.map((r) => thread(r, depth + 1))}
          </Box>
        )}
      </Box>
    )
  }

  /** 입력 한 줄 — 본문·답글이 같은 모양. Enter=보내기 / Shift+Enter=줄바꿈 */
  const composer = (value: string, onChange: (v: string) => void, onSend: () => void, placeholder: string, onCancel?: () => void) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <InputBase
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
          // 답글칸의 Escape 는 답글만 접는다 — 팝업까지 닫히면 쓰던 본문 맥락을 잃는다
          if (e.key === 'Escape' && onCancel) { e.stopPropagation(); onCancel() }
        }}
        placeholder={placeholder}
        // 팝업을 연 목적의 절반은 글쓰기다 — 열리자마자 바로 쓸 수 있게
        autoFocus
        multiline
        maxRows={4}
        inputProps={{ 'aria-label': `${placeholder} 입력` }}
        sx={{
          flex: 1, minWidth: 0,
          px: 1.25, py: 0.5,
          border: '1px solid', borderColor: 'divider', borderRadius: `${radius.button}px`,
          bgcolor: 'background.paper', fontSize: typescale.body.size,
        }}
      />
      {/* 보내기 — 파란 배경 버튼이 아니라 **아이콘 색이 파랗게** 변한다(사용자 지시 2026-08-13).
          비었을 때는 disabled 회색이라, 글이 생기는 순간 색이 켜지는 것이 곧 "보낼 수 있다"는 신호다 */}
      <IconButton
        size="small"
        aria-label={`${placeholder.replace(/\s.*$/, '')} 등록`}
        onClick={onSend}
        disabled={busy || !value.trim()}
        sx={{ flexShrink: 0, color: 'primary.main' }}
      >
        {busy
          ? <CircularProgress size={iconSize.body} thickness={5} sx={{ color: 'primary.main' }} />
          : <SendIcon sx={{ fontSize: iconSize.action }} />}
      </IconButton>
    </Box>
  )

  return (
    <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* 글타래 — 길어지면 팝업이 화면을 삼키지 않게 안에서만 스크롤 */}
      <Box sx={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {tops.filter((c) => !(c.deleted && childrenOf(c.id).length === 0)).length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>아직 코멘트가 없습니다.</Typography>
        )}
        {tops.map((c) => thread(c, 0))}
      </Box>

      {isMember && composer(draft, setDraft, () => void send(draft, null), '코멘트 남기기')}

      {/* 삭제 확인(사용자 지시 2026-08-13) — 답글 유무로 결과가 다르니 안내문도 갈린다 */}
      <ConfirmDialog
        open={!!delAsk}
        destructive
        title="코멘트를 지울까요?"
        description={
          delAsk && childrenOf(delAsk.id).length > 0
            ? `답글 ${childrenOf(delAsk.id).length}건이 달려 있어 자리는 남고 "삭제된 코멘트입니다"로 표시됩니다. 내용은 지워지며 되돌릴 수 없습니다.`
            : '되돌릴 수 없습니다.'
        }
        confirmLabel="삭제"
        busy={busy}
        onConfirm={confirmRemove}
        onClose={() => setDelAsk(null)}
      />
    </Box>
  )
}

/** 날짜와 시간을 항상 같이 — "MM-DD HH:MM"(사용자 지시 2026-08-13. 시간만 보이면 날짜를 되물어야 한다) */
function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
