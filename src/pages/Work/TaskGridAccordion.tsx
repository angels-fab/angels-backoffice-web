import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import useMediaQuery from '@mui/material/useMediaQuery'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { taskSubs, taskTitle, taskLink, mgrColor } from './workMeta'
import SubLine from './SubLine'

export type GridTone = 'amber' | 'gray'
const toneColor = (th: Theme, tone: GridTone) =>
  tone === 'amber' ? th.palette.accent.amber : th.palette.text.secondary

export interface TaskGridAccordionProps {
  items: WorkItem[]
  /** 카드 톤 — amber(Remind) / gray(완료) */
  tone: GridTone
  isAdmin?: boolean
  onEdit?: (t: WorkItem) => void
  onComplete?: (t: WorkItem) => void
  onDelete?: (t: WorkItem) => void
}

/**
 * TaskGridAccordion — 3열(반응형 3/2/1) 카드 그리드.
 * 카드는 접힘(구분칩·부서칩·제목). 클릭하면 그 카드 선택(톤색, 얇은 테두리) + 같은 행 아래 풀폭으로 내용 펼침.
 */
export default function TaskGridAccordion({ items, tone, isAdmin, onEdit, onComplete, onDelete }: TaskGridAccordionProps) {
  const theme = useTheme()
  const isLg = useMediaQuery(theme.breakpoints.up('lg'))
  const isSm = useMediaQuery(theme.breakpoints.up('sm'))
  const cols = isLg ? 3 : isSm ? 2 : 1
  const [sel, setSel] = useState<number | null>(null)
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; t: WorkItem } | null>(null)

  const selIdx = items.findIndex((t) => t.id === sel)
  const rowEnd = selIdx >= 0 ? Math.min(Math.floor(selIdx / cols) * cols + cols - 1, items.length - 1) : -1
  const selTask = selIdx >= 0 ? items[selIdx] : null

  const closeMenu = () => setMenuFor(null)
  const act = (fn?: (t: WorkItem) => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuFor) fn?.(menuFor.t)
    closeMenu()
  }

  const children: ReactNode[] = []
  items.forEach((t, i) => {
    const on = sel === t.id
    children.push(
      <Box
        key={t.id}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={`업무: ${taskTitle(t)}`}
        onClick={() => setSel((s) => (s === t.id ? null : t.id))}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel((s) => (s === t.id ? null : t.id)) } }}
        sx={(th) => ({
          bgcolor: alpha(toneColor(th, tone), on ? 0.2 : 0.08),
          border: 1,
          borderColor: on ? toneColor(th, tone) : 'divider',
          borderRadius: 1,
          px: 1.25, py: 0.9,
          cursor: 'pointer',
          transition: 'border-color .15s, background-color .15s',
          '&:hover': { borderColor: toneColor(th, tone) },
          '&:focus-visible': { outline: 'none', borderColor: toneColor(th, tone) },
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          {t.cat && <StatusChip status="neutral" label={t.cat} />}
          {t.dept && <StatusChip status="info" label={t.dept} />}
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {taskTitle(t)}
          </Typography>
          {isAdmin && (
            <IconButton
              size="small"
              aria-label="더보기"
              onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, t }) }}
              sx={{ color: 'text.secondary', p: 0.25, flexShrink: 0 }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <ExpandMoreIcon sx={(th) => ({ flexShrink: 0, fontSize: 20, color: on ? toneColor(th, tone) : 'text.disabled', transition: 'transform .2s', transform: on ? 'rotate(180deg)' : 'none' })} />
        </Box>
      </Box>,
    )
    if (selTask && i === rowEnd) {
      const subs = taskSubs(selTask)
      const link = taskLink(selTask)
      children.push(
        <Box
          key={`exp-${selTask.id}`}
          sx={(th) => ({
            gridColumn: '1 / -1',
            bgcolor: alpha(toneColor(th, tone), 0.06),
            border: 1, borderColor: alpha(toneColor(th, tone), 0.3),
            borderRadius: 1, p: 1.75,
          })}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{taskTitle(selTask)}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Box component="span" sx={{ fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1, py: 0.3, bgcolor: mgrColor(selTask.mgr), color: '#fff', whiteSpace: 'nowrap' }}>{selTask.mgr || '미지정'}</Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(selTask.start)}</Typography>
            </Box>
          </Box>
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
                <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                  <OpenInNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Box>
          )}
        </Box>,
      )
    }
  })

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: '8px', '& > *': { minWidth: 0 } }}>
        {children}
      </Box>
      {isAdmin && (
        <Menu
          anchorEl={menuFor?.el ?? null}
          open={!!menuFor}
          onClose={closeMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } } }}
        >
          {menuFor && (menuFor.t.status || '').trim() !== '완료' && (
            <MenuItem onClick={act(onComplete)}>
              <ListItemIcon><CheckCircleOutlineIcon fontSize="small" /></ListItemIcon>
              <ListItemText>완료</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={act(onEdit)}>
            <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>수정</ListItemText>
          </MenuItem>
          <MenuItem onClick={act(onDelete)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
            <ListItemText>삭제</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </>
  )
}
