import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { ReplyRow } from '@/api/sheets'

/** 'yyyy-MM-dd HH:mm:ss' → 'yyyy-MM-dd HH:mm' (화면은 분까지만) */
function fmtReplyTime(s: string): string {
  return (s || '').slice(0, 16)
}

const taSx = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid',
  borderColor: th.palette.divider,
  borderRadius: '8px',
  px: 1,
  py: '6px',
  fontSize: 12.5,
  color: 'text.primary',
  lineHeight: 1.6,
  '&.Mui-focused': { borderColor: th.palette.accent.green },
  '& textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})

interface Props {
  replies: ReplyRow[]
  isAdmin: boolean
  /** 현재 로그인 관리자 이름 — 본인 답글에만 수정/삭제 버튼 */
  user: string | null
  busy: boolean
  /** 성공 시 resolve, 실패 시 reject(입력 유지) */
  onCreate: (content: string) => Promise<void>
  onEdit: (id: string, content: string) => Promise<void>
  onRequestDelete: (reply: ReplyRow) => void
}

/**
 * 포털개선요청 답글 — 시간순 단일 대화(중첩 없음). 작성일시 오름차순.
 * 본인 답글만 인라인 수정/삭제. 등록은 관리자만.
 */
export default function ReplyThread({ replies, isAdmin, user, busy, onCreate, onEdit, onRequestDelete }: Props) {
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const submit = async () => {
    const v = text.trim()
    if (!v || busy) return
    await onCreate(v) // 실패 시 throw → 아래 setText 미실행(입력 유지)
    setText('')
  }
  const startEdit = (r: ReplyRow) => {
    setEditingId(r.id)
    setEditText(r.content)
  }
  const saveEdit = async (r: ReplyRow) => {
    const v = editText.trim()
    if (!v || busy) return
    await onEdit(r.id, v)
    setEditingId(null)
  }

  return (
    <Box sx={{ mt: 2 }} onClick={(e) => e.stopPropagation()}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, color: 'text.secondary', fontSize: 11.5, fontWeight: 700 }}>
        답글 {replies.length}개
        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      </Box>

      {replies.length === 0 ? (
        <Box sx={{ color: 'text.disabled', fontSize: 12.5, py: 1.25, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: '8px' }}>
          아직 답글이 없습니다
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {replies.map((r) => {
            const mine = isAdmin && !!user && user === (r.author || '').trim()
            const editing = editingId === r.id
            return (
              <Box key={r.id} sx={(th) => ({ border: '1px solid', borderColor: 'divider', borderRadius: '10px', p: '10px 12px', bgcolor: alpha(th.palette.text.primary, 0.02) })}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box component="span" sx={{ fontSize: 12, fontWeight: 800, color: 'text.primary' }}>{r.author || '-'}</Box>
                  <Box component="span" sx={{ fontSize: 10.5, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtReplyTime(r.created)}{r.edited ? ' · 수정됨' : ''}
                  </Box>
                  {mine && !editing && (
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 0.25, flexShrink: 0 }}>
                      <Tooltip title="수정"><IconButton size="small" aria-label="답글 수정" onClick={() => startEdit(r)} sx={{ color: 'text.secondary', p: 0.25 }}><EditIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                      <Tooltip title="삭제"><IconButton size="small" color="error" aria-label="답글 삭제" onClick={() => onRequestDelete(r)} sx={{ p: 0.25 }}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                    </Box>
                  )}
                </Box>
                {editing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <InputBase multiline minRows={2} value={editText} onChange={(e) => setEditText(e.target.value)} inputProps={{ 'aria-label': '답글 수정' }} sx={(th) => ({ ...taSx(th), width: '100%' })} />
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Button size="small" color="inherit" onClick={() => setEditingId(null)} disabled={busy}>취소</Button>
                      <Button size="small" variant="contained" color="success" onClick={() => saveEdit(r)} disabled={busy || !editText.trim()}>저장</Button>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12.5, lineHeight: 1.65, color: 'text.primary' }}>{r.content}</Box>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      {isAdmin && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mt: 1.25, flexWrap: 'wrap' }}>
          <InputBase
            multiline
            minRows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="이 요청에 대한 답글을 입력하세요"
            inputProps={{ 'aria-label': '답글 입력' }}
            sx={(th) => ({ ...taSx(th), flex: 1, minWidth: 180 })}
          />
          <Button variant="contained" onClick={submit} disabled={busy || !text.trim()} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {busy ? '등록 중…' : '답글 등록'}
          </Button>
        </Box>
      )}
    </Box>
  )
}
