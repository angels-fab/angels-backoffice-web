import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import { ContentSection } from '@/components/ds'
import type { DropZone, WorkView } from './dropZones'

/**
 * 업무현황 KPI — 확정 시안(docs/mockups/work-kpi-4col-nested.html)의 4열 연결형 스트립.
 * 진행중/보류/완료/Remind 가 하나의 긴 카드 안에 4열(외곽 테두리 1개 + 동일 세로 구분선),
 * 각 영역은 상태색 컬러 워시(경계 2%만 양쪽 색이 직접 섞임). 클릭=상태 목록, 선택=배경 농도.
 * 진행중·보류의 '건' 오른쪽에 보라 원형 Check 배지(absolute, 중앙축 불변), 그룹 경계 하단에
 * '부서장 확인' 통합 칩(클릭=Check 목록). 드롭존(data-dropzone)·강조·펄스 계약은 기존 그대로.
 */

export interface KpiSectionProps {
  inProgressCount: number
  holdCount: number
  checkInProgCount: number
  checkHoldCount: number
  doneCount: number
  totalCount: number
  remindCount: number
  /** 현재 열린 목록 — 선택 상태(배경 농도)로 표시 */
  view: WorkView
  onOpenView: (v: WorkView) => void
  /** 카드 드래그 진행 중(드롭존 표시) */
  dragging: boolean
  /** 포인터가 들어와 있는 드롭존 */
  activeZone: DropZone | null
  /** 드롭 반영 직후 KPI 숫자 펄스 */
  pulse: { zone: DropZone; tick: number } | null
}

// 시안 고정 색상(다크 전용 포털) — 상태명/워시/강조는 경계 2% 혼합 규칙을 그대로 사용
const LABEL: Record<DropZone, string> = { inProgress: '#72c78d', hold: '#79a9e2', done: '#c2cad5', remind: '#e0bc74' }
const WASH: Record<DropZone, string> = {
  inProgress: 'linear-gradient(to right, rgba(77,161,103,.1) 0 98%, rgba(81,153,161,.098) 100%)',
  hold: 'linear-gradient(to right, rgba(81,153,161,.098) 0%, rgba(84,145,218,.095) 2% 98%, rgba(113,149,194,.09) 100%)',
  done: 'linear-gradient(to right, rgba(113,149,194,.09) 0%, rgba(141,152,169,.085) 2% 98%, rgba(178,157,116,.078) 100%)',
  remind: 'linear-gradient(to right, rgba(178,157,116,.078) 0%, rgba(214,162,62,.07) 2% 100%)',
}
const STRONG: Record<DropZone, string> = {
  inProgress: 'linear-gradient(to right, rgba(77,161,103,.34) 0 98%, rgba(81,153,161,.34) 100%)',
  hold: 'linear-gradient(to right, rgba(81,153,161,.34) 0%, rgba(84,145,218,.34) 2% 98%, rgba(113,149,194,.34) 100%)',
  done: 'linear-gradient(to right, rgba(113,149,194,.28) 0%, rgba(141,152,169,.28) 2% 98%, rgba(178,157,116,.28) 100%)',
  remind: 'linear-gradient(to right, rgba(178,157,116,.25) 0%, rgba(214,162,62,.25) 2% 100%)',
}
const ZONE_RING: Record<DropZone, string> = {
  inProgress: 'rgba(77,161,103,.55)', hold: 'rgba(84,145,218,.55)', done: 'rgba(141,152,169,.55)', remind: 'rgba(214,162,62,.55)',
}
const LABEL_KO: Record<DropZone, string> = { inProgress: '진행중', hold: '보류', done: '완료', remind: 'Remind' }
const DIVIDER = 'rgba(170,180,195,.22)'

const keyActivate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); fn() }
}

export default function KpiSection({
  inProgressCount, holdCount, checkInProgCount, checkHoldCount,
  doneCount, remindCount,
  view, onOpenView, dragging, activeZone, pulse,
}: KpiSectionProps) {
  const checkTotal = checkInProgCount + checkHoldCount

  // 스크롤해도 KPI가 상단(topbar 아래)에 고정 — 드래그 목적지를 항상 노출(PC). 모바일은 화면을 너무 가려 일반 흐름 유지.
  const [stickyTop, setStickyTop] = useState(62)
  useEffect(() => {
    const measure = () => {
      const bar = document.querySelector<HTMLElement>('.topbar')
      setStickyTop(bar ? bar.offsetHeight : 0)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const pulseSx = (zone: DropZone) =>
    pulse && pulse.zone === zone ? { animation: 'kpiPulse .34s ease-out' } : {}
  const pulseKey = (zone: DropZone) => (pulse && pulse.zone === zone ? pulse.tick : 0)

  // 상태 영역(타일) — 클릭=목록, 드롭존, 선택/호버=배경 농도(테두리 없음), 하단 30px 인디케이터
  const tile = (zone: DropZone, count: number, checkCount: number, radius: { xs: string; md: string }) => {
    const selected = view === zone
    const highlighted = selected || activeZone === zone
    return (
      <Box
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${LABEL_KO[zone]} 업무 목록 열기 (${count}건${checkCount > 0 ? `, 부서장 확인 ${checkCount}건` : ''})`}
        data-dropzone={zone}
        onClick={() => onOpenView(zone)}
        onKeyDown={keyActivate(() => onOpenView(zone))}
        sx={{
          position: 'relative', minWidth: 0, minHeight: { xs: 104, md: 132 },
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '7px', textAlign: 'center', cursor: 'pointer', color: LABEL[zone],
          borderRadius: { xs: radius.xs, md: radius.md },
          background: highlighted ? STRONG[zone] : WASH[zone],
          transition: 'background .14s ease, box-shadow .14s ease, transform .14s ease',
          '&:hover': { background: STRONG[zone] },
          '&:focus-visible': { outline: '2px solid #7db3ef', outlineOffset: '-3px' },
          // 하단 인디케이터(호버·선택 시) — 장식이므로 pointer-events 없음(pseudo)
          '&::after': {
            content: '""', position: 'absolute', left: '50%', bottom: 9, width: 30, height: 2,
            borderRadius: '999px', bgcolor: 'currentColor', transform: 'translateX(-50%)',
            opacity: selected ? 0.72 : 0, transition: 'opacity .14s', pointerEvents: 'none',
          },
          '&:hover::after': { opacity: 0.72 },
          // 드래그 중: 드롭 가능 영역 상태색 안쪽 링, 활성 존은 강조 배경 + 1.02 확대
          ...(dragging ? { boxShadow: `inset 0 0 0 1.5px ${ZONE_RING[zone]}` } : {}),
          ...(activeZone === zone ? { transform: 'scale(1.02)', zIndex: 1 } : {}),
        }}
      >
        {/* 건수(위) — Check 배지는 레이아웃 폭에 미포함(absolute)이라 중앙축 불변 */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <Typography
            key={pulseKey(zone)}
            component="span"
            sx={{ fontSize: { xs: 31, md: 43 }, fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.04em', color: '#fff', ...pulseSx(zone) }}
          >
            {count}
          </Typography>
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: '#aab4c3', lineHeight: 1 }}>건</Typography>
          {checkCount > 0 && (
            <Box
              component="span"
              aria-hidden
              sx={{
                position: 'absolute', left: 'calc(100% + 7px)', top: '50%', transform: 'translateY(-50%)',
                width: { xs: 22, md: 23 }, height: { xs: 22, md: 23 },
                border: '1px solid rgba(169,138,224,.52)', borderRadius: '999px',
                bgcolor: '#29233a', color: '#d7c6f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: { xs: 12.5, md: 13 }, fontWeight: 800, lineHeight: 1,
                boxShadow: '0 3px 9px rgba(0,0,0,.2)', pointerEvents: 'none',
              }}
            >
              {checkCount}
            </Box>
          )}
        </Box>
        {/* 상태명(아래) — 상태 대표색 */}
        <Typography component="span" sx={{ fontSize: { xs: 14, md: 16 }, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', color: LABEL[zone] }}>
          {LABEL_KO[zone]}
        </Typography>
      </Box>
    )
  }

  // 그룹(2타일) 공통 — 내부 중앙 세로 구분선(장식, pointer-events 없음)
  const familySx = {
    position: 'relative' as const,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    minWidth: 0,
    // 모바일(<md): 그룹이 독립 카드
    border: { xs: '1px solid', md: 0 },
    borderColor: { xs: 'divider', md: 'transparent' },
    borderRadius: { xs: '15px', md: 0 },
    bgcolor: { xs: 'background.paper', md: 'transparent' },
    overflow: 'visible',
    '&::after': {
      content: '""', position: 'absolute', zIndex: 2, left: '50%', top: 17, bottom: 17, width: '1px',
      bgcolor: DIVIDER, pointerEvents: 'none',
    },
  }

  return (
    <ContentSection
      sx={{
        mb: '10px',
        // PC(md+): topbar 아래 sticky. 칩 돌출(-15px)을 배경으로 받치는 하단 패딩 포함.
        position: { xs: 'static', md: 'sticky' },
        top: { md: `${stickyTop}px` },
        zIndex: 30,
        bgcolor: { md: 'background.default' },
        pt: { md: '6px' },
        pb: { md: '18px' },
      }}
    >
      {/* 스트립 — PC(md+)에서는 외곽 테두리 1개의 긴 카드, 좁은 폭에서는 두 그룹 카드 상하 배치 */}
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: '26px', md: 0 },
          border: { xs: 0, md: '1px solid' },
          borderColor: { md: 'divider' },
          borderRadius: { md: '18px' },
          bgcolor: { xs: 'transparent', md: 'background.paper' },
          overflow: 'visible',
          '& > *': { minWidth: 0 },
          // 보류/완료 사이 중앙 구분선(PC 연결형에서만)
          '&::after': {
            content: '""', position: 'absolute', zIndex: 2, left: '50%', top: 17, bottom: 17, width: '1px',
            bgcolor: DIVIDER, pointerEvents: 'none', display: { xs: 'none', md: 'block' },
          },
        }}
      >
        {/* 진행중 + 보류 그룹 */}
        <Box aria-label="진행 업무 그룹" sx={familySx}>
          {tile('inProgress', inProgressCount, checkInProgCount, { xs: '14px 0 0 14px', md: '17px 0 0 17px' })}
          {tile('hold', holdCount, checkHoldCount, { xs: '0 14px 14px 0', md: '0' })}
          {/* 부서장 확인 통합 칩 — 진행중·보류 경계 하단에 걸침. 클릭=Check 목록(진행중+보류) */}
          {checkTotal > 0 && (
            <Tooltip title={`진행중 ${checkInProgCount}건 · 보류 ${checkHoldCount}건`}>
              <Box
                role="button"
                tabIndex={0}
                aria-pressed={view === 'check'}
                aria-label={`부서장 확인 업무 ${checkTotal}건 목록 열기`}
                onClick={(e) => { e.stopPropagation(); onOpenView('check') }}
                onKeyDown={keyActivate(() => onOpenView('check'))}
                sx={{
                  position: 'absolute', zIndex: 4, left: '50%', bottom: { xs: -14, md: -15 },
                  transform: 'translateX(-50%)',
                  height: { xs: 28, md: 30 }, px: '11px',
                  border: '1px solid rgba(169,138,224,.42)', borderRadius: '999px',
                  bgcolor: view === 'check' ? 'rgba(169,138,224,.22)' : '#1b202b',
                  color: '#c5adf0',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontSize: { xs: 10.5, md: 11 }, fontWeight: 800, whiteSpace: 'nowrap', cursor: 'pointer',
                  boxShadow: '0 5px 14px rgba(0,0,0,.28)',
                  transition: 'background-color .14s ease, border-color .14s ease, transform .14s ease',
                  '&:hover': { bgcolor: 'rgba(169,138,224,.18)', borderColor: 'rgba(169,138,224,.65)', transform: 'translateX(-50%) translateY(-1px)' },
                  '&:focus-visible': { outline: '2px solid #bfa7ef', outlineOffset: '2px' },
                }}
              >
                <CheckIcon sx={{ fontSize: 14 }} />
                <Box component="span">부서장 확인</Box>
                <Box component="span" sx={{ fontSize: { xs: 12.5, md: 13 }, fontWeight: 800, color: '#d7c6f6' }}>{checkTotal}</Box>
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* 완료 + Remind 그룹 */}
        <Box aria-label="완료 업무 그룹" sx={familySx}>
          {tile('done', doneCount, 0, { xs: '14px 0 0 14px', md: '0' })}
          {tile('remind', remindCount, 0, { xs: '0 14px 14px 0', md: '0 17px 17px 0' })}
        </Box>
      </Box>
    </ContentSection>
  )
}
