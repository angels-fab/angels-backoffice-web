import type { KeyboardEvent, ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { alpha, useTheme } from '@mui/material/styles'
import { AppCard, ContentSection } from '@/components/ds'
import type { DropZone, WorkView } from './dropZones'

/**
 * 업무현황 KPI 2열 — 명시적 버튼만 목록을 연다(카드 배경은 클릭 불가).
 * 진행중 카드: 숨쉬는 초록 링(버튼·드롭존) + Check 필(버튼) + 보류 보관함(버튼·드롭존).
 * 완료 카드: 완료 박스(버튼·드롭존) + Remind 필(버튼·드롭존) + 옆면 플래그.
 * 드래그 중에는 드롭존이 상태색으로 강조되고, 포인터가 든 존은 살짝 확대된다.
 */

export interface KpiSectionProps {
  inProgressCount: number
  holdCount: number
  checkInProgCount: number
  checkHoldCount: number
  doneCount: number
  totalCount: number
  remindCount: number
  /** 현재 열린 목록 — 각 버튼의 선택 상태 표시 */
  view: WorkView
  onOpenView: (v: WorkView) => void
  /** 카드 드래그 진행 중(존 활성 표시) */
  dragging: boolean
  /** 포인터가 들어와 있는 드롭존 */
  activeZone: DropZone | null
  /** 드롭 반영 직후 KPI 숫자 펄스 */
  pulse: { zone: DropZone; tick: number } | null
}

// 우상단 ✓N 배지 — 보라 채움 + (보류 소속) 앰버 테두리
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

const keyActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn() }
}

export default function KpiSection({
  inProgressCount, holdCount, checkInProgCount, checkHoldCount,
  doneCount, totalCount, remindCount,
  view, onOpenView, dragging, activeZone, pulse,
}: KpiSectionProps) {
  const th = useTheme()
  const green = th.palette.accent.green
  const amber = th.palette.accent.amber
  const purple = th.palette.accent.purple
  const gray = th.palette.text.secondary
  const checkTotal = checkInProgCount + checkHoldCount

  // 드롭존 공통 강조 — 드래그 중 상태색 테두리, 포인터 진입 시 1.02 확대(transform 전용)
  const zoneSx = (zone: DropZone, color: string) => ({
    transition: 'transform .12s ease, box-shadow .12s ease, background-color .12s ease',
    ...(dragging ? { boxShadow: `0 0 0 1.5px ${alpha(color, activeZone === zone ? 0.95 : 0.5)}` } : {}),
    ...(activeZone === zone ? { transform: 'scale(1.02)' } : {}),
  })

  // 펄스 — key 교체로 애니메이션 재시작
  const pulseSx = (zone: DropZone) =>
    pulse && pulse.zone === zone ? { animation: 'kpiPulse .34s ease-out' } : {}
  const pulseKey = (zone: DropZone) => (pulse && pulse.zone === zone ? pulse.tick : 0)

  // Check 필 아이콘 — 최대 5개(진행중 먼저), 초과 +N
  const pillDots: boolean[] = [
    ...Array.from({ length: checkInProgCount }, () => false),
    ...Array.from({ length: checkHoldCount }, () => true),
  ]
  const shownDots = pillDots.slice(0, 5)
  const moreDots = pillDots.length - shownDots.length

  const flagCount = Math.min(remindCount, 16)

  const dotEl = (hold: boolean, i: number): ReactNode => (
    <Box
      key={i}
      component="span"
      sx={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        bgcolor: purple, color: '#1a1030',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: hold ? `1.5px solid ${amber}` : `1.5px solid #101826`,
        ...(i > 0 ? { ml: '-8px' } : {}),
      }}
    >
      <CheckIcon sx={{ fontSize: 13 }} />
    </Box>
  )

  return (
    <ContentSection sx={{ mb: '14px' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, '& > *': { minWidth: 0 } }}>

        {/* ── 진행중 카드 — 배경 클릭 불가. 링·필·보관함이 각자 버튼 ── */}
        <AppCard padding={18} sx={{ overflow: 'visible' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 96, sm: 108 } }}>

            {/* 링(버튼·드롭존) — 클릭=진행중 목록, 드롭=상태 '진행중' */}
            <Box
              role="button"
              tabIndex={0}
              aria-label="진행중 업무 목록 열기"
              aria-pressed={view === 'inProgress'}
              data-dropzone="inProgress"
              onClick={() => onOpenView('inProgress')}
              onKeyDown={keyActivate(() => onOpenView('inProgress'))}
              sx={{
                position: 'relative', width: { xs: 92, sm: 104 }, height: { xs: 92, sm: 104 }, flexShrink: 0,
                cursor: 'pointer', borderRadius: '50%',
                ...zoneSx('inProgress', green),
                '&:hover .kpi-ring-core': { bgcolor: alpha(green, 0.16) },
              }}
            >
              <Box component="span" sx={{ position: 'absolute', inset: '4px', borderRadius: '50%', border: `3px solid ${green}`, animation: 'kpiBreath 2.4s ease-in-out infinite' }} />
              <Box className="kpi-ring-core" sx={{ position: 'absolute', inset: '4px', borderRadius: '50%', bgcolor: alpha(green, view === 'inProgress' ? 0.18 : 0.09), transition: 'background-color .15s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                <Typography key={pulseKey('inProgress')} component="span" sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: 800, lineHeight: 1, ...pulseSx('inProgress') }}>{inProgressCount}</Typography>
                <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: green, lineHeight: 1 }}>진행중</Typography>
              </Box>
              <CheckBadge count={checkInProgCount} />
            </Box>

            {/* Check 모아보기 필(버튼) — 클릭=Check 목록(진행중·보류 통합) */}
            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignSelf: 'center', minWidth: 0 }}>
              {checkTotal > 0 && (
                <Tooltip title={`Check 업무 ${checkTotal}건 목록 (진행중 ${checkInProgCount} · 보류 ${checkHoldCount})`}>
                  <Box
                    role="button"
                    tabIndex={0}
                    aria-label={`Check 업무 ${checkTotal}건 목록 열기`}
                    aria-pressed={view === 'check'}
                    onClick={() => onOpenView('check')}
                    onKeyDown={keyActivate(() => onOpenView('check'))}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      pl: 0.75, pr: 1, py: 0.6, borderRadius: '999px', cursor: 'pointer',
                      border: `1px solid ${alpha(purple, view === 'check' ? 0.9 : 0.45)}`,
                      bgcolor: alpha(purple, view === 'check' ? 0.2 : 0.08),
                      transition: 'background-color .15s, border-color .15s',
                      '&:hover': { bgcolor: alpha(purple, 0.22) },
                    }}
                  >
                    {shownDots.map((hold, i) => dotEl(hold, i))}
                    {moreDots > 0 && (
                      <Typography component="span" sx={{ fontSize: 12, fontWeight: 700, color: purple, ml: 0.25 }}>+{moreDots}</Typography>
                    )}
                    <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary', transition: 'transform .2s', transform: view === 'check' ? 'rotate(180deg)' : 'none' }} />
                  </Box>
                </Tooltip>
              )}
            </Box>

            {/* 보류 보관함(버튼·드롭존) — 클릭=보류 목록, 드롭=상태 '보류' */}
            <Box
              role="button"
              tabIndex={0}
              aria-label={`보류 업무 목록 열기 (${holdCount}건)`}
              aria-pressed={view === 'hold'}
              data-dropzone="hold"
              onClick={() => onOpenView('hold')}
              onKeyDown={keyActivate(() => onOpenView('hold'))}
              sx={{
                position: 'relative', width: { xs: 92, sm: 104 }, height: { xs: 92, sm: 104 }, flexShrink: 0,
                cursor: 'pointer', borderRadius: '10px',
                opacity: holdCount > 0 || dragging || view === 'hold' ? 1 : 0.5,
                ...zoneSx('hold', amber),
              }}
            >
              {/* 서류 — 하단이 서랍 뒤로 꽂힘 */}
              <Box sx={{ position: 'absolute', bottom: { xs: 14, sm: 16 }, left: '50%', transform: 'translateX(-50%)', width: 68, height: { xs: 62, sm: 70 } }}>
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'background.elevated', border: `1px solid ${alpha(amber, 0.6)}`, borderRadius: '8px', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', px: 1.25, pb: '16px' }}>
                    {[100, 100, 62, 78].map((w, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha(gray, 0.32), flexShrink: 0 }} />
                        <Box sx={{ width: `${w}%`, height: 2, borderRadius: '1px', bgcolor: alpha(gray, 0.2) }} />
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pb: '16px' }}>
                    <Typography key={pulseKey('hold')} component="span" sx={{ fontSize: { xs: 24, sm: 27 }, fontWeight: 800, lineHeight: 1, bgcolor: 'background.elevated', px: 0.75, py: 0.25, borderRadius: '6px', ...pulseSx('hold') }}>
                      {holdCount}
                    </Typography>
                  </Box>
                </Box>
                <CheckBadge count={checkHoldCount} hold />
              </Box>
              {/* 서랍 */}
              <Box sx={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: { xs: 30, sm: 34 },
                borderRadius: '9px', bgcolor: '#2a2416',
                border: `1px solid ${alpha(amber, view === 'hold' ? 0.95 : 0.6)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              }}>
                <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, color: amber, lineHeight: 1 }}>보류</Typography>
                <ExpandMoreIcon sx={{ fontSize: 14, color: alpha(amber, 0.8), transition: 'transform .2s', transform: view === 'hold' ? 'rotate(180deg)' : 'none' }} />
              </Box>
            </Box>
          </Box>
        </AppCard>

        {/* ── 완료 카드 — 배경 클릭 불가. 완료 박스·Remind 필이 각자 버튼 ── */}
        <AppCard padding={18} sx={{ overflow: 'hidden', position: 'relative' }}>
          {flagCount > 0 && (
            <Box aria-hidden sx={{ position: 'absolute', top: 12, bottom: 12, right: -1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 1, pointerEvents: 'none' }}>
              {Array.from({ length: flagCount }, (_, i) => (
                <Box key={i} sx={{
                  width: i % 2 === 0 ? 16 : 13, height: 5, borderRadius: '3px 0 0 3px',
                  bgcolor: i % 2 === 0 ? amber : alpha(amber, 0.55), alignSelf: 'flex-end',
                }} />
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, minHeight: { xs: 96, sm: 108 }, pr: '18px' }}>
            {/* 완료 박스(버튼·드롭존) — 클릭=완료 목록, 드롭=완료(Remind 해제) */}
            <Box
              role="button"
              tabIndex={0}
              aria-label={`완료 업무 목록 열기 (${doneCount}건)`}
              aria-pressed={view === 'done'}
              data-dropzone="done"
              onClick={() => onOpenView('done')}
              onKeyDown={keyActivate(() => onOpenView('done'))}
              sx={{
                flexShrink: 0, px: 2.25, py: 1.75, borderRadius: '12px', cursor: 'pointer',
                bgcolor: alpha(gray, view === 'done' ? 0.24 : 0.14),
                display: 'flex', alignItems: 'baseline', gap: 0.75,
                '&:hover': { bgcolor: alpha(gray, 0.26) },
                ...zoneSx('done', gray),
              }}
            >
              <Typography component="span" sx={{ fontSize: 14, fontWeight: 600, color: 'text.secondary', lineHeight: 1 }}>완료</Typography>
              <Typography key={pulseKey('done')} component="span" sx={{ fontSize: { xs: 26, sm: 30 }, fontWeight: 800, lineHeight: 1, ...pulseSx('done') }}>{doneCount}</Typography>
              <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: 'text.disabled', lineHeight: 1 }}>/{totalCount}</Typography>
            </Box>

            {/* Remind 필(버튼·드롭존) — 클릭=Remind 목록, 드롭=완료+Remind */}
            <Box
              role="button"
              tabIndex={0}
              aria-label={`Remind 업무 목록 열기 (${remindCount}건)`}
              aria-pressed={view === 'remind'}
              data-dropzone="remind"
              onClick={() => onOpenView('remind')}
              onKeyDown={keyActivate(() => onOpenView('remind'))}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.6,
                borderRadius: '999px', cursor: 'pointer', flexShrink: 0,
                border: `1px solid ${alpha(amber, view === 'remind' ? 0.9 : 0.45)}`,
                bgcolor: alpha(amber, view === 'remind' ? 0.22 : 0.12), color: amber,
                '&:hover': { bgcolor: alpha(amber, 0.24) },
                ...zoneSx('remind', amber),
              }}
            >
              <NotificationsActiveIcon sx={{ fontSize: 15 }} />
              <Typography key={pulseKey('remind')} component="span" sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1, ...pulseSx('remind') }}>Remind {remindCount}</Typography>
              <ExpandMoreIcon sx={{ fontSize: 15, transition: 'transform .2s', transform: view === 'remind' ? 'rotate(180deg)' : 'none' }} />
            </Box>

            <Box sx={{ flex: 1, minWidth: 4 }} />
          </Box>
        </AppCard>
      </Box>
    </ContentSection>
  )
}
