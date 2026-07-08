import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { MEMBERS, given } from '@/pages/Calendar/members'
import type { DemoChatMsg } from '@/api/demo'

const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
/** 작성자 색 — 업무현황/일정의 담당자 필터 색상과 동일(MEMBERS.color). 미등록 이름은 회색 */
const memberColor = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)?.color

/**
 * 코멘트 — 비교표 아래에 코멘트창을 위→아래로 쌓는다. "코멘트 추가"로 계속 추가.
 * 작성자는 담당자 필터 색상(점+이름)으로 구분. 본인 글만 삭제 가능.
 */
export default function DemoChat({ memos, canPost, user, busy, onPost, onDelete }: {
  memos: DemoChatMsg[]; canPost: boolean; user: string | null; busy: boolean
  onPost: (body: string) => Promise<void>; onDelete: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const save = async () => { if (!draft.trim() || busy) return; try { await onPost(draft); setDraft(''); setAdding(false) } catch { /* 유지 */ } }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
      {memos.map((m) => {
        const own = !!user && m.author === user
        const color = memberColor(m.author)
        return (
          <Box key={m.id} sx={(th) => ({ border: `1px solid ${th.palette.divider}`, borderRadius: '9px', bgcolor: alpha(th.palette.text.primary, 0.02), px: 1, py: 0.75 })}>
            <Box sx={{ fontSize: 12.5, lineHeight: 1.5, color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
              <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', bgcolor: color || 'text.disabled' }} />
              <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, color: color || 'text.disabled' }}>{m.author || '팀원'}</Box>
              <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>· {fmtTime(m.createdAt)}</Box>
              <Box sx={{ flex: 1 }} />
              {own && <IconButton size="small" aria-label="코멘트 삭제" onClick={() => onDelete(m.id)} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>}
            </Box>
          </Box>
        )
      })}

      {/* 새 코멘트 작성 / 추가 */}
      {canPost && (adding ? (
        <Box sx={(th) => ({ border: `1px solid ${th.palette.primary.main}`, borderRadius: '9px', bgcolor: 'background.paper', px: 1, py: 0.75 })}>
          <InputBase multiline minRows={2} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="코멘트 입력…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() } }}
            sx={{ width: '100%', fontSize: 12.5 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
            <Button size="small" onClick={() => { setAdding(false); setDraft('') }} disabled={busy} sx={{ color: 'text.secondary', fontSize: 11.5, minWidth: 0 }}>취소</Button>
            <Button size="small" variant="contained" onClick={() => void save()} disabled={busy || !draft.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>저장</Button>
          </Box>
        </Box>
      ) : (
        <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
          sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, border: `1px dashed ${th.palette.divider}`, borderRadius: '9px', px: 1, py: 0.6, color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
          <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
        </Box>
      ))}
      {memos.length === 0 && !adding && !canPost && <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}
    </Box>
  )
}
