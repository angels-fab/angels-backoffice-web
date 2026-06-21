import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import useMediaQuery from '@mui/material/useMediaQuery'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { alpha, useTheme } from '@mui/material/styles'
import { keyframes } from '@mui/system'
import type { Theme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { taskSubs, taskTitle, taskLink, mgrColor } from './workMeta'
import SubLine from './SubLine'

export type GridTone = 'amber' | 'gray'
const toneColor = (th: Theme, tone: GridTone) =>
  tone === 'amber' ? th.palette.accent.amber : th.palette.text.secondary

// 모드 전환 모션(순수 CSS) — opacity/transform만, 마운트 시 1회 재생
const fadeUp = keyframes({ from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'translateY(0)' } })
const slideIn = keyframes({ from: { opacity: 0, transform: 'translateX(10px)' }, to: { opacity: 1, transform: 'translateX(0)' } })

export interface TaskGridAccordionProps {
  items: WorkItem[]
  /** 카드 톤 — amber(Remind) / gray(완료) */
  tone: GridTone
  isAdmin?: boolean
  onEdit?: (t: WorkItem) => void
  onComplete?: (t: WorkItem) => void
  onDelete?: (t: WorkItem) => void
  /** 선택 시 3열 그리드 → 좌측 1열 리스트 + 우측 내용(마스터-디테일)로 전환 */
  masterDetail?: boolean
}

/**
 * TaskGridAccordion — 3열(반응형 3/2/1) 카드 그리드.
 * - 기본: 카드 클릭 시 같은 행 아래 풀폭으로 내용 펼침(인라인 아코디언).
 * - masterDetail: 카드 선택 시 그리드 → 좌측 1열 리스트 + 우측 내용 패널로 모드 전환(CSS 페이드).
 */
export default function TaskGridAccordion({ items, tone, isAdmin, onEdit, onComplete, onDelete, masterDetail }: TaskGridAccordionProps) {
  const theme = useTheme()
  const isLg = useMediaQuery(theme.breakpoints.up('lg'))
  const isSm = useMediaQuery(theme.breakpoints.up('sm'))
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)')
  const cols = isLg ? 3 : isSm ? 2 : 1
  const [sel, setSel] = useState<number | null>(null)
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; t: WorkItem } | null>(null)

  const selIdx = items.findIndex((t) => t.id === sel)
  const selTask = selIdx >= 0 ? items[selIdx] : null

  const closeMenu = () => setMenuFor(null)
  const act = (fn?: (t: WorkItem) => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (menuFor) fn?.(menuFor.t)
    closeMenu()
  }
  const toggle = (id: number) => setSel((s) => (s === id ? null : id))

  // ── 공유: 카드 본문(칩·제목·메뉴·셰브론) ──
  const cardBody = (t: WorkItem, on: boolean, showChevron: boolean) => (
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
      {showChevron && (
        <ExpandMoreIcon sx={(th) => ({ flexShrink: 0, fontSize: 20, color: on ? toneColor(th, tone) : 'text.disabled', transition: 'transform .2s', transform: on ? 'rotate(180deg)' : 'none' })} />
      )}
    </Box>
  )

  const cardSx = (on: boolean) => (th: Theme) => ({
    bgcolor: alpha(toneColor(th, tone), on ? 0.2 : 0.08),
    border: 1,
    borderColor: on ? toneColor(th, tone) : 'divider',
    borderRadius: 1,
    px: 1.25, py: 0.9,
    cursor: 'pointer',
    transition: 'border-color .15s, background-color .15s',
    '&:hover': { borderColor: toneColor(th, tone) },
    '&:focus-visible': { outline: 'none', borderColor: toneColor(th, tone) },
  })

  const cardEl = (t: WorkItem, showChevron: boolean) => {
    const on = sel === t.id
    return (
      <Box
        key={t.id}
        role="button"
        tabIndex={0}
        aria-pressed={on}
        aria-label={`업무: ${taskTitle(t)}`}
        onClick={() => toggle(t.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(t.id) } }}
        sx={cardSx(on)}
      >
        {cardBody(t, on, showChevron)}
      </Box>
    )
  }

  // ── 공유: 디테일 본문(제목·담당자·내용·예정/완료/링크) ──
  const detailBody = (st: WorkItem) => {
    const subs = taskSubs(st)
    const link = taskLink(st)
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{taskTitle(st)}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box component="span" sx={{ fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1, py: 0.3, bgcolor: mgrColor(st.mgr), color: '#fff', whiteSpace: 'nowrap' }}>{st.mgr || '미지정'}</Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(st.start)}</Typography>
          </Box>
        </Box>
        {subs.length > 0 ? (
          <Box>{subs.map((l, k) => <SubLine key={k} line={l} />)}</Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
        )}
        {(st.plan || st.end || link) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            {st.plan && <Typography variant="caption" sx={{ color: 'text.secondary' }}>예정 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(st.plan)}</Box></Typography>}
            {st.end && <Typography variant="caption" sx={{ color: 'text.secondary' }}>완료 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(st.end)}</Box></Typography>}
            {link && (
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        )}
      </>
    )
  }

  // ── 공유: 관리자 메뉴 ──
  const adminMenu = isAdmin ? (
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
  ) : null

  // ============ 마스터-디테일(모드 스왑 + CSS 페이드) ============
  if (masterDetail) {
    const mobileDetail = !!selTask && !isSm // xs(작은 화면) + 선택 → 디테일 전체폭(목록 숨김)

    const detailEl = selTask ? (
      <Box
        key={`detail-${selTask.id}`}
        sx={(th) => ({
          animation: reduce ? 'none' : `${slideIn} .2s ease both`,
          bgcolor: alpha(toneColor(th, tone), 0.06),
          border: 1,
          borderColor: alpha(toneColor(th, tone), 0.3),
          borderRadius: 1,
          p: 1.75,
        })}
      >
        <Box sx={{ mb: 1 }}>
          <Button
            size="small"
            startIcon={<ArrowBackIcon sx={{ fontSize: 18 }} />}
            onClick={() => setSel(null)}
            sx={{ color: 'text.secondary', minWidth: 0, px: 0.75 }}
          >
            목록으로
          </Button>
        </Box>
        {detailBody(selTask)}
      </Box>
    ) : null

    const motionSx = reduce ? {} : { animation: `${fadeUp} .18s ease both` }

    let inner: ReactNode
    if (sel === null) {
      // 그리드 모드 — 3/2/1열
      inner = (
        <Box sx={{ ...motionSx, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: '8px', '& > *': { minWidth: 0 } }}>
          {items.map((t) => cardEl(t, true))}
        </Box>
      )
    } else if (mobileDetail) {
      // 모바일 — 디테일 전체폭(목록 숨김, 목록으로 버튼으로 복귀)
      inner = <Box sx={motionSx}>{detailEl}</Box>
    } else {
      // 마스터-디테일 — 좌측 1열 리스트 + 우측 내용(고정)
      inner = (
        <Box sx={{ ...motionSx, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: '0 0 280px', minWidth: 0 }}>
            {items.map((t) => cardEl(t, false))}
          </Box>
          <Box sx={{ flex: '1 1 0', minWidth: 0, position: 'sticky', top: 8 }}>{detailEl}</Box>
        </Box>
      )
    }

    return (
      <>
        {inner}
        {adminMenu}
      </>
    )
  }

  // ============ 인라인 아코디언(기본 — 완료 등) ============
  const rowEnd = selIdx >= 0 ? Math.min(Math.floor(selIdx / cols) * cols + cols - 1, items.length - 1) : -1
  const children: ReactNode[] = []
  items.forEach((t, i) => {
    children.push(cardEl(t, true))
    if (selTask && i === rowEnd) {
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
          {detailBody(selTask)}
        </Box>,
      )
    }
  })

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: '8px', '& > *': { minWidth: 0 } }}>
        {children}
      </Box>
      {adminMenu}
    </>
  )
}
