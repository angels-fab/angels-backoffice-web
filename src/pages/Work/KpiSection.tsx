import type { ReactNode, MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UndoIcon from '@mui/icons-material/Undo'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { alpha, useTheme } from '@mui/material/styles'
import { AppCard, ContentSection, StatusChip } from '@/components/ds'
import type { WorkItem } from '@/types'
import { taskTitle } from './workMeta'

/**
 * 업무현황 KPI 2열 — v11 확정 시안.
 * 진행중 카드: 숨쉬는 초록 링(건수) + Check 모아보기 필(아이콘만) + 보류 보관함(서랍+서류).
 * 완료 카드: 완료 N/전체 박스 + Remind 옆면 플래그(건수만큼) + Remind 필 + 열기.
 * Check 색 규칙: 보라 채움 = 진행중 소속 / 보라 채움 + 앰버 테두리 = 보류 소속.
 */

export interface KpiSectionProps {
  inProgressCount: number
  doneCount: number
  totalCount: number
  remindCount: number
  /** Check(검토 필요) 업무 — 진행중 소속 */
  checkInProg: WorkItem[]
  /** Check(검토 필요) 업무 — 보류 소속 */
  checkHold: WorkItem[]
  /** 보류 업무 전체 */
  holdList: WorkItem[]
  /** 진행중 뷰 하이라이트 */
  inProgressSelected: boolean
  checkOpen: boolean
  holdOpen: boolean
  remindActive: boolean
  doneActive: boolean
  isAdmin: boolean
  onSelectInProgress: () => void
  onToggleCheck: () => void
  onToggleHold: () => void
  onToggleRemind: () => void
  onToggleDone: () => void
  /** 목록 행 클릭 — 업무 상세 열기 */
  onPick: (t: WorkItem) => void
  /** 보류 → 진행중 복귀(확인 다이얼로그는 부모) */
  onResume: (t: WorkItem) => void
  /** 보류 → 완료(확인 다이얼로그는 부모) */
  onComplete: (t: WorkItem) => void
}

// Check 동그라미 아이콘 — 보라 채움, 보류 소속은 앰버 테두리 추가
function CheckDot({ hold, size = 22, overlap }: { hold?: boolean; size?: number; overlap?: boolean }) {
  const th = useTheme()
  return (
    <Box
      component="span"
      sx={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        bgcolor: th.palette.accent.purple, color: '#1a1030',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: hold ? `1.5px solid ${th.palette.accent.amber}` : `1.5px solid ${th.palette.background.default}`,
        ...(overlap ? { ml: '-8px' } : {}),
      }}
    >
      <CheckIcon sx={{ fontSize: size * 0.58 }} />
    </Box>
  )
}

// 우상단 ✓N 배지 — 보라 채움 + (보류면) 앰버 테두리
function CheckBadge({ count, hold }: { count: number; hold?: boolean }) {
  const th = useTheme()
  if (count <= 0) return null
  return (
    <Box
      component="span"
      sx={{
        position: 'absolute', top: -9, right: -9, zIndex: 1,
        display: 'inline-flex', alignItems: 'center', gap: '2px',
        px: 0.9, py: 0.25, borderRadius: '999px',
        bgcolor: th.palette.accent.purple, color: '#1a1030',
        fontSize: 12, fontWeight: 700, lineHeight: 1,
        border: hold ? `1.5px solid ${th.palette.accent.amber}` : `2px solid ${th.palette.background.default}`,
      }}
    >
      <CheckIcon sx={{ fontSize: 12 }} />
      {count}
    </Box>
  )
}

// 인라인 패널 행 (Check 모아보기 / 보류 보관함 공용 골격)
function PanelRow({ leading, title, trailing, onClick }: { leading: ReactNode; title: string; trailing: ReactNode; onClick: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={(th) => ({
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
        borderTop: 1, borderColor: 'divider', cursor: 'pointer',
        '&:hover': { bgcolor: alpha(th.palette.text.primary, 0.04) },
      })}
    >
      {leading}
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
      {trailing}
    </Box>
  )
}

const stop = (e: MouseEvent) => e.stopPropagation()

export default function KpiSection({
  inProgressCount, doneCount, totalCount, remindCount,
  checkInProg, checkHold, holdList,
  inProgressSelected, checkOpen, holdOpen, remindActive, doneActive,
  isAdmin,
  onSelectInProgress, onToggleCheck, onToggleHold, onToggleRemind, onToggleDone,
  onPick, onResume, onComplete,
}: KpiSectionProps) {
  const th = useTheme()
  const green = th.palette.accent.green
  const amber = th.palette.accent.amber
  const purple = th.palette.accent.purple
  const holdCount = holdList.length
  const checkTotal = checkInProg.length + checkHold.length

  // Check 필 아이콘 — 최대 5개 표시(진행중 먼저), 초과분 +N
  const pillDots: { hold: boolean }[] = [
    ...checkInProg.map(() => ({ hold: false })),
    ...checkHold.map(() => ({ hold: true })),
  ]
  const shownDots = pillDots.slice(0, 5)
  const moreDots = pillDots.length - shownDots.length

  // Remind 옆면 플래그 — 건수만큼(최대 16), 두 톤 교차
  const flagCount = Math.min(remindCount, 16)

  return (
    <>
      <ContentSection sx={{ mb: '14px' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, '& > *': { minWidth: 0 } }}>

          {/* ── 진행중 카드: 링 + Check 필 + 보류 보관함 ── */}
          <AppCard
            interactive
            onClick={onSelectInProgress}
            ariaLabel="진행중 업무 보기"
            padding={18}
            sx={{
              overflow: 'visible',
              ...(inProgressSelected ? { borderColor: green, bgcolor: alpha(green, 0.1) } : {}),
              '&:hover': { borderColor: green, bgcolor: alpha(green, inProgressSelected ? 0.14 : 0.06) },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 96, sm: 108 } }}>
              {/* 링 — 투명도 숨쉬기(로드맵 진행중 단계와 같은 '살아있음' 신호, 회전·파동 없음) */}
              <Box sx={{ position: 'relative', width: { xs: 92, sm: 104 }, height: { xs: 92, sm: 104 }, flexShrink: 0 }}>
                <Box component="span" sx={{ position: 'absolute', inset: '4px', borderRadius: '50%', border: `3px solid ${green}`, animation: 'kpiBreath 2.4s ease-in-out infinite' }} />
                <Box sx={{ position: 'absolute', inset: '4px', borderRadius: '50%', bgcolor: alpha(green, 0.09), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                  <Typography component="span" sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: 800, lineHeight: 1 }}>{inProgressCount}</Typography>
                  <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: green, lineHeight: 1 }}>진행중</Typography>
                </Box>
                <CheckBadge count={checkInProg.length} />
              </Box>

              {/* Check 모아보기 필 — 아이콘만(개수=건수), 클릭 시 통합 패널 */}
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignSelf: 'center', minWidth: 0 }}>
                {checkTotal > 0 && (
                  <Tooltip title={`Check 업무 ${checkTotal}건 모아보기 (진행중 ${checkInProg.length} · 보류 ${checkHold.length})`}>
                    <Box
                      role="button"
                      tabIndex={0}
                      aria-label={`Check 업무 ${checkTotal}건 모아보기`}
                      aria-expanded={checkOpen}
                      onClick={(e) => { stop(e); onToggleCheck() }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleCheck() } }}
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        pl: 0.75, pr: 1, py: 0.6, borderRadius: '999px', cursor: 'pointer',
                        border: `1px solid ${alpha(purple, checkOpen ? 0.8 : 0.45)}`,
                        bgcolor: alpha(purple, checkOpen ? 0.16 : 0.08),
                        transition: 'background-color .15s, border-color .15s',
                        '&:hover': { bgcolor: alpha(purple, 0.18) },
                      }}
                    >
                      {shownDots.map((d, i) => <CheckDot key={i} hold={d.hold} overlap={i > 0} />)}
                      {moreDots > 0 && (
                        <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: purple, ml: 0.25 }}>+{moreDots}</Typography>
                      )}
                      <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', transition: 'transform .2s', transform: checkOpen ? 'rotate(180deg)' : 'none' }} />
                    </Box>
                  </Tooltip>
                )}
              </Box>

              {/* 보류 보관함 — 서랍 + 서류 1장(글줄 배경 위 정중앙 건수). 클릭 시 보류 목록 */}
              <Tooltip title={holdCount > 0 ? `보류 업무 ${holdCount}건 열기` : '보류 업무 없음'}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={`보류 업무 ${holdCount}건 열기`}
                  aria-expanded={holdOpen}
                  onClick={(e) => { stop(e); if (holdCount > 0) onToggleHold() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (holdCount > 0) onToggleHold() } }}
                  sx={{ position: 'relative', width: { xs: 92, sm: 104 }, height: { xs: 92, sm: 104 }, flexShrink: 0, cursor: holdCount > 0 ? 'pointer' : 'default', opacity: holdCount > 0 ? 1 : 0.45 }}
                >
                  {/* 서류(정자세) — 불릿·글줄 배경 + 정중앙 건수 */}
                  <Box sx={{
                    position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    width: 72, height: { xs: 64, sm: 72 },
                    bgcolor: 'background.elevated', border: `1px solid ${alpha(amber, 0.6)}`, borderRadius: '8px', overflow: 'hidden',
                  }}>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', px: 1.25 }}>
                      {[100, 100, 62, 78].map((w, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha(th.palette.text.secondary, 0.32), flexShrink: 0 }} />
                          <Box sx={{ width: `${w}%`, height: 2, borderRadius: '1px', bgcolor: alpha(th.palette.text.secondary, 0.2) }} />
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography component="span" sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: 800, lineHeight: 1, bgcolor: 'background.elevated', px: 0.75, py: 0.25, borderRadius: '6px' }}>
                        {holdCount}
                      </Typography>
                    </Box>
                  </Box>
                  {/* 서류 우상단 ✓N — 보류 소속 Check(앰버 테두리) */}
                  <Box sx={{ position: 'absolute', top: { xs: -4, sm: -2 }, right: 2 }}>
                    <Box sx={{ position: 'relative' }}><CheckBadge count={checkHold.length} hold /></Box>
                  </Box>
                  {/* 서랍 — '보류' 라벨 가운데 */}
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 34,
                    borderRadius: '9px', bgcolor: alpha(amber, 0.14), border: `1px solid ${alpha(amber, 0.6)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                  }}>
                    <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: amber, lineHeight: 1 }}>보류</Typography>
                    <ExpandMoreIcon sx={{ fontSize: 14, color: alpha(amber, 0.8), transition: 'transform .2s', transform: holdOpen ? 'rotate(180deg)' : 'none' }} />
                  </Box>
                </Box>
              </Tooltip>
            </Box>
          </AppCard>

          {/* ── 완료 카드: 완료 N/전체 박스 + Remind 필 + 옆면 플래그 + 열기 ── */}
          <AppCard
            interactive
            onClick={onToggleDone}
            ariaLabel="완료 업무 목록 열기/닫기"
            padding={18}
            sx={{
              overflow: 'hidden', position: 'relative',
              ...(doneActive ? { borderColor: th.palette.text.secondary, bgcolor: alpha(th.palette.text.secondary, 0.1) } : {}),
              '&:hover': { borderColor: th.palette.text.secondary, bgcolor: alpha(th.palette.text.secondary, doneActive ? 0.16 : 0.07) },
            }}
          >
            {/* Remind 옆면 플래그 — 태그 붙은 서류 뭉치의 인덱스 견출지(건수만큼) */}
            {flagCount > 0 && (
              <Box aria-hidden sx={{ position: 'absolute', top: 12, bottom: 12, right: -1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 1 }}>
                {Array.from({ length: flagCount }, (_, i) => (
                  <Box key={i} sx={{
                    width: i % 2 === 0 ? 16 : 13, height: 5, borderRadius: '3px 0 0 3px',
                    bgcolor: i % 2 === 0 ? amber : alpha(amber, 0.55), alignSelf: 'flex-end',
                  }} />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 96, sm: 108 }, pr: '18px' }}>
              {/* 완료 N/전체 박스 */}
              <Box sx={{
                flexShrink: 0, px: 2.25, py: 1.75, borderRadius: '12px', bgcolor: alpha(th.palette.text.secondary, 0.14),
                display: 'flex', alignItems: 'baseline', gap: 0.75,
              }}>
                <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', lineHeight: 1 }}>완료</Typography>
                <Typography component="span" sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: 800, lineHeight: 1 }}>{doneCount}</Typography>
                <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}>/{totalCount}</Typography>
              </Box>

              {/* Remind 필 — 태그 붙은 업무 목록 토글 */}
              {remindCount > 0 && (
                <Tooltip title={`Remind 업무 ${remindCount}건 ${remindActive ? '접기' : '펼치기'}`}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`Remind 업무 ${remindCount}건 펼치기`}
                    aria-expanded={remindActive}
                    onClick={(e) => { stop(e); onToggleRemind() }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleRemind() } }}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.6,
                      borderRadius: '999px', cursor: 'pointer',
                      border: `1px solid ${alpha(amber, remindActive ? 0.8 : 0.45)}`,
                      bgcolor: alpha(amber, remindActive ? 0.2 : 0.12), color: amber,
                      transition: 'background-color .15s, border-color .15s',
                      '&:hover': { bgcolor: alpha(amber, 0.22) },
                    }}
                  >
                    <NotificationsActiveIcon sx={{ fontSize: 15 }} />
                    <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>Remind {remindCount}</Typography>
                    <ExpandMoreIcon sx={{ fontSize: 15, transition: 'transform .2s', transform: remindActive ? 'rotate(180deg)' : 'none' }} />
                  </Box>
                </Tooltip>
              )}

              <Box sx={{ flex: 1, minWidth: 4 }} />
              {/* 열기 컨트롤 — 우측 드로어 */}
              <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, color: doneActive ? 'text.primary' : 'text.secondary' }}>
                {doneActive ? <ChevronRightIcon sx={{ fontSize: 24 }} /> : <ChevronLeftIcon sx={{ fontSize: 24 }} />}
                <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1 }}>{doneActive ? '닫기' : '열기'}</Typography>
              </Box>
            </Box>
          </AppCard>
        </Box>
      </ContentSection>

      {/* ── Check 모아보기 패널 — 진행중·보류 통합 ── */}
      <Collapse in={checkOpen} unmountOnExit>
        <ContentSection sx={{ mb: '14px' }}>
          <Box sx={{ border: `1px solid ${alpha(purple, 0.5)}`, borderRadius: '12px', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: alpha(purple, 0.12), display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CheckIcon sx={{ fontSize: 16, color: purple }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: purple }}>Check 업무 · {checkTotal}건</Typography>
              <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>진행중 {checkInProg.length} · 보류 {checkHold.length}</Typography>
            </Box>
            {checkTotal === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.disabled', py: 2.5, textAlign: 'center' }}>Check 업무가 없습니다</Typography>
            ) : (
              <>
                {checkInProg.map((t) => (
                  <PanelRow
                    key={t.id}
                    leading={<CheckDot size={18} />}
                    title={taskTitle(t)}
                    trailing={<><StatusChip status="success" label="진행중" /><ArrowForwardIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></>}
                    onClick={() => onPick(t)}
                  />
                ))}
                {checkHold.map((t) => (
                  <PanelRow
                    key={t.id}
                    leading={<CheckDot size={18} hold />}
                    title={taskTitle(t)}
                    trailing={<><StatusChip status="warning" label="보류" /><ArrowForwardIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></>}
                    onClick={() => onPick(t)}
                  />
                ))}
              </>
            )}
          </Box>
        </ContentSection>
      </Collapse>

      {/* ── 보류 보관함 패널 — 복귀 / 완료 액션 ── */}
      <Collapse in={holdOpen} unmountOnExit>
        <ContentSection sx={{ mb: '14px' }}>
          <Box sx={{ border: `1px solid ${alpha(amber, 0.5)}`, borderRadius: '12px', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: alpha(amber, 0.12), display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: amber }}>보류 보관함 · {holdList.length}건</Typography>
              <Typography variant="caption" sx={{ ml: 'auto', color: 'text.secondary' }}>꺼내서 진행하거나 완료로 넘길 수 있습니다</Typography>
            </Box>
            {holdList.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.disabled', py: 2.5, textAlign: 'center' }}>보류된 업무가 없습니다</Typography>
            ) : (
              holdList.map((t) => (
                <PanelRow
                  key={t.id}
                  leading={t.chief ? <CheckDot size={18} hold /> : <Box sx={{ width: 18, flexShrink: 0 }} />}
                  title={taskTitle(t)}
                  trailing={
                    isAdmin ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }} onClick={stop}>
                        <Tooltip title="진행중으로 복귀">
                          <IconButton size="small" aria-label="진행중으로 복귀" onClick={() => onResume(t)} sx={{ bgcolor: alpha(green, 0.14), color: green, borderRadius: '8px', p: 0.5, '&:hover': { bgcolor: alpha(green, 0.24) } }}>
                            <UndoIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="완료로 넘기기">
                          <IconButton size="small" aria-label="완료로 넘기기" onClick={() => onComplete(t)} sx={{ bgcolor: alpha(th.palette.text.secondary, 0.14), color: 'text.secondary', borderRadius: '8px', p: 0.5, '&:hover': { bgcolor: alpha(th.palette.text.secondary, 0.24) } }}>
                            <CheckIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ) : (
                      <ArrowForwardIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                    )
                  }
                  onClick={() => onPick(t)}
                />
              ))
            )}
          </Box>
        </ContentSection>
      </Collapse>
    </>
  )
}
