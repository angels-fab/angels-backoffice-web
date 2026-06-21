import { useState } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { taskSubs, taskTitle, taskLink, mgrColor } from './workMeta'
import SubLine from './SubLine'

export interface RemindDrawerProps {
  open: boolean
  onClose: () => void
  items: WorkItem[]
  isAdmin?: boolean
  onEdit?: (t: WorkItem) => void
  onComplete?: (t: WorkItem) => void
  onDelete?: (t: WorkItem) => void
}

/**
 * RemindDrawer — Remind 업무를 우측 드로어로 표시.
 * 상단: 1열 목록(스크롤) / 하단: 선택 업무 내용(스크롤).
 */
export default function RemindDrawer({ open, onClose, items, isAdmin, onEdit, onComplete, onDelete }: RemindDrawerProps) {
  const theme = useTheme()
  const amber = theme.palette.accent.amber
  const [sel, setSel] = useState<number | null>(null)
  const selTask = items.find((t) => t.id === sel) ?? null

  const close = () => { setSel(null); onClose() }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={close}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ width: { xs: '100vw', sm: 440 }, maxWidth: '100vw', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 2, bgcolor: 'background.elevated', borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography variant="h3">Remind 업무</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>{items.length}건</Typography>
          </Box>
          <IconButton onClick={close} size="small" aria-label="닫기" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* 목록(상단, 스크롤) */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', py: 3, textAlign: 'center' }}>Remind 업무가 없습니다</Typography>
          ) : (
            items.map((t) => {
              const on = sel === t.id
              return (
                <Box
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={on}
                  aria-label={`업무: ${taskTitle(t)}`}
                  onClick={() => setSel((s) => (s === t.id ? null : t.id))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel((s) => (s === t.id ? null : t.id)) } }}
                  sx={{
                    bgcolor: alpha(amber, on ? 0.2 : 0.08),
                    border: 1,
                    borderColor: on ? amber : 'divider',
                    borderRadius: 1,
                    px: 1.25, py: 0.9,
                    cursor: 'pointer',
                    transition: 'border-color .15s, background-color .15s',
                    '&:hover': { borderColor: amber },
                    '&:focus-visible': { outline: 'none', borderColor: amber },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    {t.cat && <StatusChip status="neutral" label={t.cat} />}
                    {t.dept && <StatusChip status="info" label={t.dept} />}
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {taskTitle(t)}
                    </Typography>
                  </Box>
                </Box>
              )
            })
          )}
        </Box>

        {/* 내용(하단, 스크롤) */}
        {selTask && (
          <Box sx={{ flexShrink: 0, maxHeight: '50%', overflowY: 'auto', borderTop: 2, borderColor: alpha(amber, 0.4), bgcolor: alpha(amber, 0.06), p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{taskTitle(selTask)}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Box component="span" sx={{ fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1, py: 0.3, bgcolor: mgrColor(selTask.mgr), color: '#fff', whiteSpace: 'nowrap' }}>{selTask.mgr || '미지정'}</Box>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(selTask.start)}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
              {selTask.cat && <StatusChip status="neutral" label={selTask.cat} />}
              {selTask.dept && <StatusChip status="info" label={selTask.dept} />}
            </Box>
            {(() => {
              const subs = taskSubs(selTask)
              const link = taskLink(selTask)
              return (
                <>
                  {subs.length > 0 ? (
                    <Box>{subs.map((l, k) => <SubLine key={k} line={l} />)}</Box>
                  ) : (
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
                  )}
                  {(selTask.plan || selTask.end || link) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
                      {selTask.plan && <Typography variant="caption" sx={{ color: 'text.secondary' }}>예정 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(selTask.plan)}</Box></Typography>}
                      {selTask.end && <Typography variant="caption" sx={{ color: 'text.secondary' }}>완료 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(selTask.end)}</Box></Typography>}
                      {link && (
                        <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" sx={{ color: 'text.secondary' }}>
                          <OpenInNewIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      )}
                    </Box>
                  )}
                </>
              )
            })()}
            {isAdmin && (
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
                {(selTask.status || '').trim() !== '완료' && (
                  <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => onComplete?.(selTask)}>완료</Button>
                )}
                <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon sx={{ fontSize: 18 }} />} onClick={() => { onEdit?.(selTask); close() }}>수정</Button>
                <Button size="small" variant="text" color="error" startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />} onClick={() => onDelete?.(selTask)}>삭제</Button>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
