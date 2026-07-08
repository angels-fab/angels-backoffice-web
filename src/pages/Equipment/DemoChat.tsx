import { useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import SendIcon from '@mui/icons-material/Send'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { DemoChatMsg, DemoMakerGroup } from '@/api/demo'

const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

/**
 * 비교 메모 = 메신저형 채팅(비교표 오른쪽에 표와 같은 높이로). 팀원 글=왼쪽, 내 글=오른쪽.
 * 메시지마다 대상 제조사(makers) 태그 필수 — 대상 선택 없이는 전송 불가. 쌓이면 스크롤.
 */
export default function DemoChat({ makers, messages, canPost, user, busy, onPost, onDelete }: {
  makers: DemoMakerGroup[]; messages: DemoChatMsg[]; canPost: boolean; user: string | null; busy: boolean
  onPost: (makers: string[], body: string) => Promise<void>; onDelete: (id: number) => void
}) {
  const makerNames = makers.map((m) => m.maker)
  const [sel, setSel] = useState<string[]>([])
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight }, [messages.length])

  const toggle = (n: string) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]))
  const canSend = sel.length > 0 && text.trim().length > 0 && !busy
  const send = async () => { if (!canSend) return; try { await onPost(sel, text); setText(''); setSel([]) } catch { /* 유지 */ } }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: (th) => alpha(th.palette.text.primary, 0.02), overflow: 'hidden' }}>
      <Box sx={{ px: 1.25, py: 0.75, borderBottom: 1, borderColor: 'divider', fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: 'text.disabled', flex: 'none' }}>비교 메모</Box>

      {/* 메시지 목록(스크롤) */}
      <Box ref={listRef} sx={{ flex: 1, minHeight: 120, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {messages.length === 0 ? (
          <Box sx={{ m: 'auto', color: 'text.disabled', fontSize: 11.5 }}>아직 메모가 없습니다.</Box>
        ) : (
          messages.map((msg) => {
            const mine = !!user && msg.author === user
            return (
              <Box key={msg.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                {!mine && <Box sx={{ fontSize: 9.5, color: 'text.disabled', mx: 0.75, mb: '1px' }}>{msg.author || '팀원'}</Box>}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, maxWidth: '86%' }}>
                  {mine && <IconButton size="small" aria-label="메모 삭제" onClick={() => onDelete(msg.id)} sx={{ p: '1px', color: 'text.disabled', opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' } }}><CloseIcon sx={{ fontSize: 12 }} /></IconButton>}
                  <Box sx={(th) => ({ px: 1, py: 0.6, borderRadius: '12px', fontSize: 12, lineHeight: 1.45, minWidth: 0,
                    bgcolor: mine ? th.palette.primary.main : th.palette.background.paper, color: mine ? '#fff' : 'text.primary', border: mine ? 'none' : `1px solid ${th.palette.divider}` })}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '3px', mb: 0.4 }}>
                      {msg.makers.map((mk) => (
                        <Box key={mk} component="span" sx={(th) => ({ fontSize: 9, fontWeight: 700, px: '5px', py: '1px', borderRadius: '999px', lineHeight: 1.5, bgcolor: mine ? 'rgba(255,255,255,.22)' : alpha(th.palette.primary.main, 0.12), color: mine ? '#fff' : th.palette.primary.main })}>{mk}</Box>
                      ))}
                    </Box>
                    <Box sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.body}</Box>
                  </Box>
                </Box>
                <Box sx={{ fontSize: 9, color: 'text.disabled', mt: '1px', mx: 0.75 }}>{fmtTime(msg.createdAt)}</Box>
              </Box>
            )
          })
        )}
      </Box>

      {/* 작성 — 대상 제조사 선택 필수 */}
      {canPost && (
        <Box sx={{ flex: 'none', borderTop: 1, borderColor: 'divider', p: 0.75 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px', mb: 0.5, alignItems: 'center' }}>
            <Box component="span" sx={{ fontSize: 9.5, color: 'text.disabled', mr: 0.25 }}>대상</Box>
            {makerNames.map((n) => {
              const on = sel.includes(n)
              return (
                <Box key={n} component="button" type="button" aria-pressed={on} onClick={() => toggle(n)} sx={(th) => ({ fontSize: 10.5, fontWeight: 600, px: '8px', py: '2px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'transparent' : th.palette.divider}`, bgcolor: on ? th.palette.primary.main : 'transparent', color: on ? '#fff' : 'text.secondary' })}>{n}</Box>
              )
            })}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5 }}>
            <InputBase multiline maxRows={3} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={sel.length ? '메모 입력…' : '대상을 먼저 선택하세요'}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
              sx={(th) => ({ flex: 1, fontSize: 12, bgcolor: 'background.paper', border: `1px solid ${th.palette.divider}`, borderRadius: '8px', px: 1, py: 0.5 })} />
            <IconButton size="small" color="primary" disabled={!canSend} onClick={() => void send()}>{busy ? <CircularProgress size={15} thickness={5} /> : <SendIcon sx={{ fontSize: 18 }} />}</IconButton>
          </Box>
        </Box>
      )}
    </Box>
  )
}
