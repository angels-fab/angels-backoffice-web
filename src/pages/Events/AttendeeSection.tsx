import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import GroupsIcon from '@mui/icons-material/Groups'
import { alpha } from '@mui/material/styles'
import type { AttendeeRow } from '@/api/events'

/**
 * 종료 행사 상세의 참석자 영역 — 하이브리드.
 * 로그인 팀원: '내가 참석/참석 취소' 토글(본인 이름만). 관리자: 이름 수기 추가 + 아무나 삭제.
 */
export default function AttendeeSection({ rows, user, isMember, isAdmin, busy, onToggleSelf, onAddName, onRemove }: {
  rows: AttendeeRow[]; user: string | null; isMember: boolean; isAdmin: boolean; busy: boolean
  onToggleSelf: () => void; onAddName: (name: string) => void; onRemove: (id: number) => void
}) {
  const [name, setName] = useState('')
  const mine = user ? rows.find((r) => r.memberUid && r.name === user) : undefined
  const canRemove = (r: AttendeeRow) => isAdmin || (!!r.memberUid && r.name === user)
  const add = () => { const n = name.trim(); if (n) { onAddName(n); setName('') } }
  return (
    <Box sx={{ mb: 1.5, borderTop: 1, borderColor: 'divider', pt: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, color: 'text.disabled', fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em' }}>
          <GroupsIcon sx={{ fontSize: 15 }} /> 참석자 {rows.length}명
        </Box>
        {isMember && user && (
          <Button size="small" variant={mine ? 'outlined' : 'contained'} color={mine ? 'inherit' : 'success'} disabled={busy} onClick={onToggleSelf} sx={{ fontSize: 11.5, py: '2px', minWidth: 0, whiteSpace: 'nowrap' }}>
            {mine ? '참석 취소' : '내가 참석'}
          </Button>
        )}
      </Box>
      {rows.length > 0 ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {rows.map((r) => (
            <Box key={r.id} component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: 12, color: 'text.primary', bgcolor: alpha(th.palette.text.primary, 0.06), border: `1px solid ${th.palette.divider}`, borderRadius: '999px', pl: 1, pr: canRemove(r) ? 0.25 : 1, py: '2px' })}>
              {r.name}
              {canRemove(r) && (
                <IconButton size="small" aria-label={`${r.name} 제거`} disabled={busy} onClick={() => onRemove(r.id)} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
              )}
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ fontSize: 12, color: 'text.disabled' }}>아직 참석자가 없습니다.</Box>
      )}
      {isAdmin && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
          <InputBase
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="이름 추가"
            sx={(th) => ({ flex: 1, fontSize: 12.5, bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: '6px', px: 1, py: '3px' })}
          />
          <IconButton size="small" aria-label="참석자 추가" disabled={busy || !name.trim()} onClick={add} sx={{ color: 'success.main' }}><AddIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
      )}
    </Box>
  )
}
