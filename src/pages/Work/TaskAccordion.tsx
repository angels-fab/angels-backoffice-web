import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import { isWorkNew } from '@/utils/newPost'
import type { WorkItem } from '@/types'
import { taskTitle, taskLink, mgrColor, catKind, deptKind } from './workMeta'
import { workBodyLines } from './richContent'
import SubLine from './SubLine'

export type CardTone = 'green' | 'amber' | 'gray'
const toneOf = (th: Theme, tone: CardTone) =>
  tone === 'amber' ? th.palette.accent.amber : tone === 'gray' ? th.palette.text.secondary : th.palette.accent.green

export interface TaskAccordionProps {
  t: WorkItem
  /** 카드 채움 색 (선택된 KPI 색) */
  tone: CardTone
  /** 선택 여부 — 선택된 카드만 초록 테두리 + 진한 채움 */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
  /** 관리자 — 더보기 메뉴(완료/수정/삭제) 노출 */
  isAdmin?: boolean
  onEdit?: (t: WorkItem) => void
  onComplete?: (t: WorkItem) => void
  onDelete?: (t: WorkItem) => void
}

/**
 * 업무 카드 — 아코디언 없이 항상 내용 표시(정적). 클릭하면 선택(초록 테두리).
 * 제목 줄: 구분칩 · 관련부서칩 · 제목 · 담당자칩 · 발의일자칩 · (관리자)더보기 메뉴.
 */
export default function TaskAccordion({ t, tone, selected = false, onSelect, isAdmin, onEdit, onComplete, onDelete }: TaskAccordionProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const subs = workBodyLines(t)
  const link = taskLink(t)
  const isDone = (t.status || '').trim() === '완료'
  // 부서는 제목줄 칩으로 이동 — 본문 메타는 예정/완료만
  const metas: { label: string; value: string }[] = [
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())

  const closeMenu = () => setMenuAnchor(null)
  const runAction = (fn?: (t: WorkItem) => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    closeMenu()
    fn?.(t)
  }

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`업무: ${taskTitle(t)}`}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      sx={(th) => ({
        bgcolor: alpha(toneOf(th, tone), selected ? 0.22 : 0.1),
        border: 1,
        borderColor: selected ? th.palette.accent.green : th.palette.divider,
        boxShadow: selected ? `inset 0 0 0 1px ${th.palette.accent.green}` : 'none',
        borderRadius: 1,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .15s',
        '&:hover': { borderColor: th.palette.accent.green },
        '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green, boxShadow: (t2: Theme) => `inset 0 0 0 1px ${t2.palette.accent.green}` },
      })}
    >
      {/* 제목 줄 (③ 띠 채움) */}
      <Box
        sx={(th) => ({
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          bgcolor: alpha(toneOf(th, tone), selected ? 0.36 : 0.18),
          borderBottom: 1, borderColor: alpha(toneOf(th, tone), 0.3),
        })}
      >
        {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
        {t.dept && <StatusChip status={deptKind(t.dept)} label={t.dept} />}
        {/* 새 업무 N 배지 — 진행중+발의 7일(공지 N칩과 동일 디자인). 제목 말줄임과 안 겹치게 flexShrink:0 */}
        {isWorkNew(t) && (
          <Box component="span" sx={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 15, height: 15, px: '2px', borderRadius: '4px', bgcolor: 'error.main', color: '#fff', fontSize: 9.5, fontWeight: 700, lineHeight: 1 }}>N</Box>
        )}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', height: 24, boxSizing: 'border-box', fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1.25, bgcolor: mgrColor(t.mgr), color: '#fff', whiteSpace: 'nowrap' }}>
          {t.mgr || '미지정'}
        </Box>
        <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', height: 24, boxSizing: 'border-box', fontSize: 12, borderRadius: '8px', px: 1, color: 'text.secondary', bgcolor: alpha(th.palette.text.secondary, 0.14), border: 1, borderColor: alpha(th.palette.text.secondary, 0.3), fontFamily: 'monospace', whiteSpace: 'nowrap' })}>
          {fmtDate(t.start)}
        </Box>
        {isAdmin && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <IconButton size="small" aria-label="더보기" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ color: 'text.secondary', p: 0.5 }}>
              <MoreVertIcon sx={{ fontSize: 19 }} />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={!!menuAnchor}
              onClose={closeMenu}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } } }}
            >
              {!isDone && (
                <MenuItem onClick={runAction(onComplete)}>
                  <ListItemIcon><CheckCircleOutlineIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>완료</ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={runAction(onEdit)}>
                <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
                <ListItemText>수정</ListItemText>
              </MenuItem>
              <MenuItem onClick={runAction(onDelete)} sx={{ color: 'error.main' }}>
                <ListItemIcon><DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                <ListItemText>삭제</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Box>

      {/* 본문 */}
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {metas.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {metas.map((m) => (
                <Typography key={m.label} variant="caption" sx={{ color: 'text.secondary' }}>
                  {m.label} <Box component="span" sx={{ color: 'text.primary' }}>{m.value}</Box>
                </Typography>
              ))}
            </Box>
          )}
          {subs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {subs.map((l, i) => (
                <SubLine key={i} bodyLine={l} />
              ))}
            </Box>
          ) : (
            metas.length === 0 && <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
          )}
          {link && (
            <Box sx={{ mt: 0.25 }}>
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </Box>
        {t.chief && (
          <Box
            sx={(th) => ({
              width: 84, height: 84, flexShrink: 0, alignSelf: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 1, borderColor: alpha(th.palette.accent.purple, 0.55), bgcolor: alpha(th.palette.accent.purple, 0.16),
              borderRadius: '14px',
              color: th.palette.accent.purple, fontWeight: 800, fontSize: 15,
            })}
          >
            Check
          </Box>
        )}
      </Box>
    </Box>
  )
}
