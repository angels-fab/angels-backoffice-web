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
import ReplayIcon from '@mui/icons-material/Replay'
import { alpha, useTheme } from '@mui/material/styles'
import { keyframes } from '@mui/system'
import type { Theme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { radius, iconSize, typescale } from '@/theme/tokens'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { taskTitle, taskLink, mgrColor, catKind, deptKind } from './workMeta'
import { workBodyLines } from './richContent'
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
  /** 진행중으로 되돌리기(상태→진행중) */
  onRevert?: (t: WorkItem) => void
  /** in-place 편집 대상 id — selTask와 같으면 상세 패널에 편집 폼 렌더 */
  editingId?: number | null
  /** 편집 폼 렌더(상세 패널 in-place 편집용) */
  renderEdit?: (t: WorkItem) => ReactNode
  /** 좌측 1열 리스트 + 우측 내용(마스터-디테일)을 처음부터 표시 */
  masterDetail?: boolean
}

/**
 * TaskGridAccordion — 3열(반응형 3/2/1) 카드 그리드.
 * - 기본: 카드 클릭 시 같은 행 아래 풀폭으로 내용 펼침(인라인 아코디언).
 * - masterDetail: 카드 선택 시 그리드 → 좌측 1열 리스트 + 우측 내용 패널로 모드 전환(CSS 페이드).
 */
export default function TaskGridAccordion({ items, tone, isAdmin, onEdit, onComplete, onDelete, onRevert, editingId, renderEdit, masterDetail }: TaskGridAccordionProps) {
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
  const cardBody = (t: WorkItem, on: boolean, showChevron: boolean, hideMenu?: boolean) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      {t.cat && <StatusChip status={catKind(t.cat)} label={t.cat} />}
      {t.dept && <StatusChip status={deptKind(t.dept)} label={t.dept} />}
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: typescale.emphasis.weight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {taskTitle(t)}
      </Typography>
      {isAdmin && !hideMenu && (
        <IconButton
          size="small"
          aria-label="더보기"
          onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, t }) }}
          sx={{ color: 'text.secondary', p: 0.25, flexShrink: 0 }}
        >
          <MoreVertIcon sx={{ fontSize: iconSize.action }} />
        </IconButton>
      )}
      {showChevron && (
        <ExpandMoreIcon sx={(th) => ({ flexShrink: 0, fontSize: iconSize.header, color: on ? toneColor(th, tone) : 'text.disabled', transition: 'transform .2s', transform: on ? 'rotate(180deg)' : 'none' })} />
      )}
    </Box>
  )

  const cardSx = (on: boolean) => (th: Theme) => ({
    bgcolor: alpha(toneColor(th, tone), on ? 0.2 : 0.08),
    border: 1,
    borderColor: on ? toneColor(th, tone) : 'divider',
    borderRadius: `${radius.card}px`,
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
  const detailBody = (st: WorkItem, showActions?: boolean) => {
    const subs = workBodyLines(st)
    const link = taskLink(st)
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: typescale.cardTitle.weight, wordBreak: 'break-word' }}>{taskTitle(st)}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box component="span" sx={{ fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, borderRadius: `${radius.chip}px`, px: 1, py: 0.3, bgcolor: mgrColor(st.mgr), color: 'common.white', whiteSpace: 'nowrap' }}>{st.mgr || '미지정'}</Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(st.start)}</Typography>
          </Box>
        </Box>
        {subs.length > 0 ? (
          <Box>{subs.map((l, k) => <SubLine key={k} bodyLine={l} />)}</Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
        )}
        {(st.plan || st.end || link) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            {st.plan && <Typography variant="caption" sx={{ color: 'text.secondary' }}>예정 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(st.plan)}</Box></Typography>}
            {st.end && <Typography variant="caption" sx={{ color: 'text.secondary' }}>완료 <Box component="span" sx={{ color: 'text.primary' }}>{fmtDate(st.end)}</Box></Typography>}
            {link && (
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: iconSize.action }} />
              </IconButton>
            )}
          </Box>
        )}
        {showActions && isAdmin && (onRevert || onEdit || onDelete) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
            {onEdit && (
              <IconButton size="small" aria-label="수정" onClick={(e) => { e.stopPropagation(); onEdit(st) }} sx={{ color: 'text.secondary' }}>
                <EditOutlinedIcon sx={{ fontSize: iconSize.header }} />
              </IconButton>
            )}
            {onDelete && (
              <IconButton size="small" aria-label="삭제" onClick={(e) => { e.stopPropagation(); onDelete(st) }} sx={{ color: 'error.main' }}>
                <DeleteOutlineIcon sx={{ fontSize: iconSize.header }} />
              </IconButton>
            )}
            {onRevert && (
              <Button size="small" variant="outlined" color="success" startIcon={<ReplayIcon sx={{ fontSize: iconSize.action }} />} onClick={(e) => { e.stopPropagation(); onRevert(st) }} sx={{ ml: 0.5 }}>진행중</Button>
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

  // ============ 마스터-디테일 — 처음부터 좌측 1열 리스트 + 우측 상세 ============
  if (masterDetail) {
    const mobileDetail = !!selTask && !isSm // xs(작은 화면) + 선택 → 디테일 전체폭(목록 숨김)

    // 우측 상세 — 선택 시 내용+액션(수정/삭제/진행중 되돌리기), 미선택 시 안내
    const detailEl = selTask ? (
      <Box
        key={`detail-${selTask.id}`}
        sx={(th) => ({
          animation: reduce ? 'none' : `${slideIn} .2s ease both`,
          bgcolor: alpha(toneColor(th, tone), 0.06),
          border: 1, borderColor: alpha(toneColor(th, tone), 0.3), borderRadius: `${radius.card}px`, p: 1.75,
        })}
      >
        {editingId === selTask.id && renderEdit ? (
          renderEdit(selTask)
        ) : (
          <>
            {!isSm && (
              <Box sx={{ mb: 1 }}>
                <Button size="small" startIcon={<ArrowBackIcon sx={{ fontSize: iconSize.action }} />} onClick={() => setSel(null)} sx={{ color: 'text.secondary', minWidth: 0, px: 0.75 }}>목록으로</Button>
              </Box>
            )}
            {detailBody(selTask, true)}
          </>
        )}
      </Box>
    ) : (
      <Box sx={(th) => ({ border: 1, borderColor: alpha(toneColor(th, tone), 0.3), borderRadius: `${radius.card}px`, p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 })}>
        <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>목록에서 업무를 선택하면 내용이 표시됩니다</Typography>
      </Box>
    )

    // 좌측 1열 라인 리스트(간격 축소·메뉴 없음 — 액션은 상세에서)
    const listEl = (
      <Box sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, overflow: 'hidden' }}>
        {items.map((t, i) => {
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
              sx={(th) => ({
                px: 1, py: 0.35, cursor: 'pointer',
                borderTop: i === 0 ? 0 : 1, borderColor: 'divider',
                bgcolor: on ? alpha(toneColor(th, tone), 0.16) : 'transparent',
                transition: 'background-color .15s',
                '&:hover': { bgcolor: alpha(toneColor(th, tone), on ? 0.16 : 0.06) },
                '&:focus-visible': { outline: 'none', bgcolor: alpha(toneColor(th, tone), 0.16) },
              })}
            >
              {cardBody(t, on, false, true)}
            </Box>
          )
        })}
      </Box>
    )

    const motionSx = reduce ? {} : { animation: `${fadeUp} .18s ease both` }

    let inner: ReactNode
    if (mobileDetail) {
      inner = <Box sx={motionSx}>{detailEl}</Box> // 모바일 선택 → 디테일 전체폭
    } else if (!isSm) {
      inner = <Box sx={motionSx}>{listEl}</Box> // 모바일 미선택 → 리스트만
    } else {
      // sm+ — 좌측 1열 리스트(진행중 KPI 너비 = 1/3) + 우측 상세(항상 표시)
      inner = (
        <Box sx={{ ...motionSx, display: 'grid', gridTemplateColumns: { sm: '1fr 2fr' }, gap: '8px', alignItems: 'start' }}>
          {listEl}
          <Box sx={{ minWidth: 0, position: 'sticky', top: 8 }}>{detailEl}</Box>
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
            borderRadius: `${radius.card}px`, p: 1.75,
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
