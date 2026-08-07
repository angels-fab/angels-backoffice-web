import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import ChatIcon from '@mui/icons-material/Chat'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined'
import SendIcon from '@mui/icons-material/SendRounded'
import { alpha } from '@mui/material/styles'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadPageNotes } from '@/store/slices/pageNotesSlice'
import { createPageNote, deletePageNote, createPageNoteReply, deletePageNoteReply, workTarget } from '@/api/pageNotes'
import { SharePicker, notifyPageNotesChanged } from '@/components/memoKind'
import { useSnack, ConfirmDialog } from '@/components/ds'
import { useRole } from '@/auth/role'
import { RichBodyView } from '@/utils/richBody'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'

/**
 * 업무카드 안에 박아 넣는 일반메모 (2026-08-07 사용자 지시).
 *
 * 화면에 떠 있는 쪽지는 좌표를 갖는다 — 그래서 카드 순서가 사람마다 다르면 엉뚱한 카드 옆을
 * 가리키고, 그걸 맞추려면 카드를 계속 따라다니는 감시 장치가 필요했다.
 * **메모를 카드의 자식으로 그리면 그 문제가 통째로 사라진다** — 순서가 바뀌든 걸러지든 접히든
 * 메모는 카드와 함께 움직인다. 좌표도, 추적도 없다.
 *
 * 그래서 이 메모에는 x·y 가 없다(page_notes.target = 'work:{num}').
 * 열람·공유 규칙은 떠 있는 일반메모와 완전히 같다 — 작성자 + 지목해 공유받은 사람(RLS).
 *
 * 카드가 부풀지 않게 **평소엔 건수 배지만** 두고 눌러야 펴진다.
 */
export default function WorkCardNotes({ num, people }: { num: string; people: string[] }) {
  const dispatch = useAppDispatch()
  const snack = useSnack()
  const { isMember, user } = useRole()
  const target = workTarget(num)
  const notes = useAppSelector((s) => s.pageNotes.items)
  const allReplies = useAppSelector((s) => s.pageNotes.replies)

  const [open, setOpen] = useState(false)
  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')
  const [shared, setShared] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [delAsk, setDelAsk] = useState<number | null>(null)
  const [reply, setReply] = useState<Record<number, string>>({})

  // RLS 가 이미 '내 것 + 공유받은 것'만 주므로 대상만 고르면 된다
  const mine = notes.filter((n) => n.target === target)
  if (!isMember) return null

  const refresh = () => { void dispatch(loadPageNotes()); notifyPageNotesChanged() }

  const add = async () => {
    const body = text.trim()
    if (!body) return snack('내용을 입력해주세요.', 'error')
    setBusy(true)
    try {
      await createPageNote({ path: '/work', content: body, shared, target })
      setText(''); setShared([]); setComposing(false); setOpen(true)
      snack(shared.length ? `카드에 메모를 붙였습니다. ${shared.length}명과 공유합니다.` : '카드에 메모를 붙였습니다.', 'success')
      refresh()
    } catch (err) {
      snack(err instanceof Error ? err.message : '메모 저장에 실패했습니다', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: number) => {
    try {
      await deletePageNote(id)
      setDelAsk(null)
      snack('메모를 지웠습니다.', 'success')
      refresh()
    } catch (err) {
      snack(err instanceof Error ? err.message : '삭제에 실패했습니다', 'error')
    }
  }

  const sendReply = async (noteId: number) => {
    const v = (reply[noteId] || '').trim()
    if (!v) return
    try {
      await createPageNoteReply({ noteId, content: v })
      setReply((r) => ({ ...r, [noteId]: '' }))
      refresh()
    } catch (err) {
      snack(err instanceof Error ? err.message : '답글 등록에 실패했습니다', 'error')
    }
  }

  return (
    // 카드 클릭(상세 열기)과 섞이지 않게 이 영역의 클릭은 여기서 멈춘다
    <Box data-card-notes="" onClick={(e) => e.stopPropagation()} sx={{ mt: 1 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`이 업무의 메모 ${mine.length}건`}
        /* 메모가 없으면 조용한 아이콘 하나 — 카드 목록이 배지로 시끄러워지면 안 된다.
           있을 때만 앰버 면 + 건수로 눈에 띈다. */
        sx={(th) => ({
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          px: mine.length ? 0.75 : 0.25, py: 0.375, font: 'inherit', cursor: 'pointer', border: 'none',
          fontSize: typescale.caption.size, fontWeight: weight.bold,
          color: mine.length ? th.palette.accentText.amber : th.palette.text.disabled,
          bgcolor: mine.length ? alpha(th.palette.accent.amber, 0.14) : 'transparent',
          borderRadius: `${radius.pill}px`,
          '&:hover': {
            bgcolor: alpha(th.palette.accent.amber, mine.length ? 0.24 : 0.14),
            color: th.palette.accentText.amber,
          },
        })}
      >
        <ChatIcon sx={{ fontSize: iconSize.caption }} />
        {mine.length > 0 && `메모 ${mine.length}`}
      </Box>

      {open && (
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {mine.map((n) => {
            const rs = allReplies.filter((r) => r.noteId === n.id)
            const isMineNote = !!user && n.author === user
            return (
              <Box
                key={n.id}
                sx={(th) => ({
                  p: 1, borderRadius: `${radius.card}px`,
                  bgcolor: alpha(th.palette.accent.amber, 0.08),
                  border: '1px solid', borderColor: alpha(th.palette.accent.amber, 0.32),
                })}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                  <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, color: 'text.primary' }}>
                    {n.author || '-'}
                  </Box>
                  {n.shared.length > 0 && (
                    <Tooltip title={`공유 중: ${n.shared.join(', ')}`}>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: typescale.caption.size, color: 'text.secondary' }}>
                        <GroupOutlinedIcon sx={{ fontSize: iconSize.caption }} />{n.shared.length}
                      </Box>
                    </Tooltip>
                  )}
                  {isMineNote && (
                    <Tooltip title="메모 삭제">
                      <IconButton size="small" aria-label="메모 삭제" onClick={() => setDelAsk(n.id)} sx={(th) => ({ ml: 'auto', p: 0.25, color: th.palette.accentText.red })}>
                        <DeleteOutlineIcon sx={{ fontSize: iconSize.caption }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <RichBodyView html={n.content} sx={{ fontSize: typescale.small.size, lineHeight: 1.6, color: 'text.primary' }} />

                {rs.map((r) => (
                  <Box key={r.id} sx={{ mt: 0.5, pl: 1, borderLeft: '2px solid', borderColor: 'divider' }}>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: weight.bold, mr: 0.5 }}>{r.author}</Box>
                    <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.secondary', overflowWrap: 'anywhere' }}>{r.content}</Box>
                    {!!user && r.author === user && (
                      <IconButton
                        size="small" aria-label="답글 삭제"
                        onClick={() => { void deletePageNoteReply(r.id).then(refresh).catch(() => snack('답글 삭제에 실패했습니다', 'error')) }}
                        sx={{ p: 0.125, ml: 0.25, color: 'text.disabled' }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: iconSize.caption }} />
                      </IconButton>
                    )}
                  </Box>
                ))}

                {/* 공유받은 사람도 답글은 쓸 수 있다 — 떠 있는 일반메모와 같은 규칙 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                  <TextField
                    size="small" fullWidth
                    value={reply[n.id] || ''}
                    onChange={(e) => setReply((r) => ({ ...r, [n.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void sendReply(n.id) } }}
                    placeholder="답글 달기"
                    slotProps={{ htmlInput: { 'aria-label': '답글 입력' } }}
                    sx={{ '& .MuiInputBase-input': { fontSize: typescale.small.size, py: 0.5 } }}
                  />
                  <IconButton
                    size="small" aria-label="답글 등록"
                    onClick={() => void sendReply(n.id)}
                    disabled={!(reply[n.id] || '').trim()}
                    sx={{ flexShrink: 0, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                    <SendIcon sx={{ fontSize: iconSize.caption }} />
                  </IconButton>
                </Box>
              </Box>
            )
          })}

          {composing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <TextField
                autoFocus size="small" fullWidth multiline minRows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="메모 내용"
                disabled={busy}
                slotProps={{ htmlInput: { 'aria-label': '메모 내용' } }}
              />
              <SharePicker people={people.filter((p) => p !== user)} value={shared} onChange={setShared} disabled={busy} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                <Button size="small" disabled={busy} onClick={() => { setComposing(false); setText(''); setShared([]) }} sx={{ color: 'text.secondary' }}>취소</Button>
                <Button size="small" variant="contained" disabled={busy || !text.trim()} onClick={add}>{busy ? '붙이는 중…' : '붙이기'}</Button>
              </Box>
            </Box>
          ) : (
            <Button size="small" onClick={() => setComposing(true)} sx={{ alignSelf: 'flex-start', fontSize: typescale.caption.size }}>
              메모 추가
            </Button>
          )}
        </Box>
      )}

      <ConfirmDialog
        open={delAsk !== null}
        destructive
        title="이 메모를 지울까요?"
        description="되돌릴 수 없습니다."
        confirmLabel="삭제"
        onConfirm={() => { const id = delAsk; if (id !== null) void remove(id) }}
        onClose={() => setDelAsk(null)}
      />
    </Box>
  )
}

