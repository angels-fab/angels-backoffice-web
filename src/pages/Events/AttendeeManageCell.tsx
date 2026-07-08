import { useState } from 'react'
import Button from '@mui/material/Button'
import Popover from '@mui/material/Popover'
import GroupsIcon from '@mui/icons-material/Groups'
import AttendeeSection from './AttendeeSection'
import type { AttendeeRow } from '@/api/events'

/**
 * 관리자 전용 목록 셀 — 참석자 추가/제거 팝오버.
 * 버튼(관리 N) 클릭 시 팝오버로 AttendeeSection(자기토글 숨김)을 띄워 이름 추가·삭제.
 */
export default function AttendeeManageCell({ rows, user, isMember, isAdmin, busy, onAddName, onRemove }: {
  rows: AttendeeRow[]; user: string | null; isMember: boolean; isAdmin: boolean; busy: boolean
  onAddName: (name: string) => void; onRemove: (id: number) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Button
        size="small" variant="text" startIcon={<GroupsIcon sx={{ fontSize: 16 }} />}
        onClick={(e) => { e.stopPropagation(); setAnchor(e.currentTarget) }}
        sx={{ minWidth: 0, px: 0.75, py: '2px', fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}
      >
        관리 {rows.length}
      </Button>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 260, p: 1.25, bgcolor: 'background.paper' } } }}
      >
        <AttendeeSection
          rows={rows}
          user={user}
          isMember={isMember}
          isAdmin={isAdmin}
          busy={busy}
          hideSelfToggle
          onAddName={onAddName}
          onRemove={onRemove}
        />
      </Popover>
    </>
  )
}
