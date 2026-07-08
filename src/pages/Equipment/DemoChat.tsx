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
/** 작성자 색 — 업무현황/일정 담당자 필터 색상(MEMBERS.color). 미등록 이름은 회색 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)

/**
 * 코멘트 — 비교표 아래에 반응형 카드 그리드(PC=여러 장, 모바일=1열). 차분한 카드 스타일.
 * 작성자는 아바타(담당자 색)+이름으로 구분. 본인 카드만 삭제. "코멘트 추가"로 계속 추가.
 */
export default function DemoChat({ memos, canPost, user, busy, onPost, onDelete }: {
  memos: DemoChatMsg[]; canPost: boolean; user: string | null; busy: boolean
  onPost: (body: string) => Promise<void>; onDelete: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const save = async () => { if (!draft.trim() || busy) return; try { await onPost(draft); setDraft(''); setAdding(false) } catch { /* 유지 */ } }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 1, alignItems: 'start' }}>
      {memos.map((m) => {
        const own = !!user && m.author === user
        const color = memberOf(m.author)?.color || undefined
        return (
          <Box key={m.id} sx={(th) => ({ display: 'flex', flexDirection: 'column', gap: 0.5, border: `1px solid ${th.palette.divider}`, borderRadius: '10px', bgcolor: alpha(th.palette.text.primary, 0.02), p: '8px 10px' })}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 700, color: '#fff', bgcolor: color || 'text.disabled' }}>{given(m.author || '팀원').slice(0, 2)}</Box>
              <Box sx={{ fontSize: 10.5, fontWeight: 700, color: color || 'text.secondary', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.author || '팀원'}</Box>
              <Box sx={{ fontSize: 9.5, color: 'text.disabled', flex: 'none' }}>· {fmtTime(m.createdAt)}</Box>
              <Box sx={{ flex: 1 }} />
              {own && <IconButton size="small" aria-label="코멘트 삭제" onClick={() => onDelete(m.id)} sx={{ p: '1px', flex: 'none', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: 12 }} /></IconButton>}
            </Box>
            <Box sx={{ fontSize: 12, lineHeight: 1.5, color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</Box>
          </Box>
        )
      })}

      {/* 작성 카드 — 입력 중이면 전체폭, 아니면 한 칸 '+ 코멘트 추가' */}
      {canPost && (adding ? (
        <Box sx={(th) => ({ gridColumn: '1 / -1', border: `1px solid ${th.palette.primary.main}`, borderRadius: '10px', bgcolor: 'background.paper', p: '8px 10px' })}>
          <InputBase multiline minRows={2} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="코멘트 입력…"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void save() } }}
            sx={{ width: '100%', fontSize: 12 }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
            <Button size="small" onClick={() => { setAdding(false); setDraft('') }} disabled={busy} sx={{ color: 'text.secondary', fontSize: 11.5, minWidth: 0 }}>취소</Button>
            <Button size="small" variant="contained" onClick={() => void save()} disabled={busy || !draft.trim()} startIcon={busy ? <CircularProgress size={12} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 11.5, minWidth: 0 }}>저장</Button>
          </Box>
        </Box>
      ) : (
        <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
          sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 52, border: `1px dashed ${th.palette.divider}`, borderRadius: '10px', color: 'text.disabled', cursor: 'pointer', fontSize: 12, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
          <AddIcon sx={{ fontSize: 15 }} /> 코멘트 추가
        </Box>
      ))}
      {memos.length === 0 && !adding && !canPost && <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>코멘트가 없습니다.</Box>}
    </Box>
  )
}
