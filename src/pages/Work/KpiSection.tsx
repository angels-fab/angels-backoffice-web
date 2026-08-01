import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import { ContentSection, focusRingSx } from '@/components/ds'
import { iconSize, radius, shadow, typescale, z } from '@/theme/tokens'
import { chiefPurple } from './chiefCheck'
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
// D3 전역 배정(사용자 확정): 진행중=그린 · 보류=앰버 · 완료=파랑 · Remind(플래그)=퍼플
// 경계색 = 인접 두 상태색(accent RGB)의 중간값: 그린77,161,103 · 앰버214,162,62 · 파랑84,145,218 · 퍼플169,138,224
// 상태명은 "글자"이므로 채움색이 아니라 글자용 강조색(테마별로 자동 전환되는 --*-tx)을 쓴다.
// 구 하드코딩 파스텔(#72c78d 등)은 다크 전용 값이라 라이트에서 1.7~2.2:1로 읽히지 않았음.
const LABEL: Record<DropZone, string> = { inProgress: 'var(--green-tx)', hold: 'var(--amber-tx)', done: 'var(--blue-tx)', remind: 'var(--purple-tx)' }
// 선택·드롭 후보 타일의 채움 — 타일이 분리 카드가 되면서 연결형 시절의 경계 블렌딩 그라데이션은 불필요해졌다.
// 평면 단색이라 라이트/다크 모두에서 농도가 그대로 나온다("색에 힘이 없다" 대응).
const STRONG: Record<DropZone, string> = {
  inProgress: 'rgba(77,161,103,.34)',
  hold: 'rgba(214,162,62,.34)',
  done: 'rgba(84,145,218,.34)',
  remind: 'rgba(169,138,224,.32)',
}
const LABEL_KO: Record<DropZone, string> = { inProgress: '진행중', hold: '보류', done: '완료', remind: 'Remind' }

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
  const tile = (zone: DropZone, count: number, checkCount: number) => {
    const selected = view === zone
    // 드래그 중에는 **실제로 겹친 존 하나만** 켠다. 선택 타일까지 같이 켜두면 두 타일이 동시에
    // 활성으로 보여 어디에 놓이는지 헷갈린다(사용자 지적). 드래그가 끝나면 선택 강조가 돌아온다.
    const highlighted = dragging ? activeZone === zone : selected
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
          // 컴팩트 시안(work-kpi-compact-preview) — 가로폭·드롭영역 폭은 유지, 세로만 축소
          position: 'relative', minWidth: 0, minHeight: { xs: 82, md: 90 },
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '4px', textAlign: 'center', cursor: 'pointer', color: LABEL[zone],
          // 분리형 카드(약한 분리) — 대면적 파스텔 대신 중립 표면. 색은 라벨·하단 인디케이터·드래그 강조로만.
          borderRadius: `${radius.card}px`,
          border: '1px solid',
          borderColor: highlighted ? 'transparent' : 'divider',
          boxShadow: highlighted ? 'none' : shadow.sm,
          overflow: 'hidden',
          // 평소=중립 카드, 드래그 후보·선택 시에만 상태색이 켜진다(드롭존 역할 유지)
          background: highlighted ? STRONG[zone] : 'var(--ink2)',
          transition: 'background .14s ease, box-shadow .14s ease, transform .14s ease',
          // 드래그 중에는 :hover를 끈다. 들린 카드는 pointerEvents:'none'이고 포인터 캡처도 안 쓰므로
          // 커서가 지나가는 타일이 계속 hover를 받는데, 드롭 판정(activeZone)은 커서가 아니라
          // '카드 실영역의 최대 교차면적 + 1.15배 히스테리시스'라 둘이 어긋난다 → 타일 2개가 동시에 켜짐.
          ...(dragging ? {} : { '&:hover': { background: STRONG[zone], transform: 'translateY(-2px)', boxShadow: shadow.md } }),
          ...(focusRingSx as object),
          // 하단 3px 인디케이터는 제거(사용자 요청). 분리형 카드가 되면서 강조 배경만으로 상태가 충분히 읽히고,
          // 선(線)까지 있으면 타일마다 색 요소가 둘이라 시끄러웠다.
          // 드래그 표시 규칙 — 드래그 시작만으로는 아무 변화 없음(링·확대·테두리 금지).
          // 카드가 실제로 겹친 존(activeZone)만 강조 배경으로 켜진다.
        }}
      >
        {/* 건수(위) — Check 배지는 레이아웃 폭에 미포함(absolute)이라 중앙축 불변 */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <Typography
            key={pulseKey(zone)}
            component="span"
            sx={{ fontSize: typescale.display.size, fontWeight: typescale.display.weight, lineHeight: 1, letterSpacing: '-0.04em', color: 'text.primary', ...pulseSx(zone) }}
          >
            {count}
          </Typography>
          <Typography component="span" sx={{ fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, color: 'var(--text2)', lineHeight: 1 }}>건</Typography>
          {checkCount > 0 && (
            <Box
              component="span"
              aria-hidden
              // 색은 카드의 부서장 확인 배지와 **같은 토큰**(chiefPurple). 예전엔 손으로 박은 hex라
              // 같은 '부서장 확인'인데 카드와 KPI의 보라가 달랐다(사용자 지적).
              // 숫자는 12px이라 원 안에서 안 읽혀 14px로 키우고 원도 함께 키움.
              sx={(t) => ({
                position: 'absolute', zIndex: 2, left: 'calc(100% + 7px)', top: '50%', transform: 'translateY(-50%)',
                width: { xs: 23, md: 24 }, height: { xs: 23, md: 24 },
                border: '1px solid', borderColor: chiefPurple.border(t), borderRadius: `${radius.pill}px`,
                // 타일 위에 **얹혀 있는** 배지라 타일 호버색이 비쳐서는 안 된다(사용자 지적).
                // 반투명이면 아래 STRONG[zone]이 그대로 올라오므로, 타일 표면색 위에 같은 알파를
                // 덧칠해 불투명하게 만든다 — 호버해도 배지 색은 그대로.
                bgcolor: 'var(--ink2)',
                backgroundImage: `linear-gradient(${chiefPurple.fill(t)}, ${chiefPurple.fill(t)})`,
                color: chiefPurple.text(t),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: typescale.emphasis.size, fontWeight: typescale.display.weight, lineHeight: 1,
                boxShadow: shadow.sm, pointerEvents: 'none',
              })}
            >
              {checkCount}
            </Box>
          )}
        </Box>
        {/* 상태명(아래) — 상태 대표색 */}
        <Typography component="span" sx={{ fontSize: { xs: typescale.emphasis.size, md: typescale.cardTitle.size }, fontWeight: typescale.display.weight, lineHeight: 1, letterSpacing: '-0.02em', color: LABEL[zone] }}>
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
    // 타일이 각자 카드가 됐으므로 그룹은 배치만 담당(테두리·구분선 제거). 간격은 아래 카드들과 같은 리듬
    gap: '10px',
    overflow: 'visible',
  }

  return (
    <ContentSection
      sx={{
        mb: '10px',
        // PC(md+): topbar 아래 sticky. 칩 돌출(-15px)을 배경으로 받치는 하단 패딩 포함.
        position: { xs: 'static', md: 'sticky' },
        top: { md: `${stickyTop}px` },
        zIndex: z.sticky,
        bgcolor: { md: 'background.default' },
        pt: { md: '6px' },
        pb: { md: '15px' },
      }}
    >
      {/* 스트립 — PC(md+)에서는 외곽 테두리 1개의 긴 카드, 좁은 폭에서는 두 그룹 카드 상하 배치 */}
      <Box
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: { xs: '26px', md: '10px' },
          overflow: 'visible',
          '& > *': { minWidth: 0 },
        }}
      >
        {/* 진행중 + 보류 그룹 */}
        <Box aria-label="진행 업무 그룹" sx={familySx}>
          {tile('inProgress', inProgressCount, checkInProgCount)}
          {tile('hold', holdCount, checkHoldCount)}
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
                sx={(t) => ({
                  position: 'absolute', zIndex: 4, left: '50%', bottom: { xs: -14, md: -15 },
                  transform: 'translateX(-50%)',
                  height: { xs: 28, md: 30 }, px: '12px',
                  border: '1px solid', borderColor: chiefPurple.border(t), borderRadius: `${radius.pill}px`,
                  // 색은 카드 배지·KPI 숫자 배지와 같은 토큰(chiefPurple). 다만 이 칩은 타일 사이 틈에
                  // 걸쳐 있어 **불투명이어야** 뒤 테두리가 비치지 않는다 → 페이지색 위에 같은 알파를
                  // 덧칠해 합성 결과는 같으면서 불투명하게(배경색 + 같은 색 그라데이션 1겹).
                  bgcolor: 'var(--ink)',
                  backgroundImage: `linear-gradient(${view === 'check' ? chiefPurple.fillStrong(t) : chiefPurple.fill(t)}, ${view === 'check' ? chiefPurple.fillStrong(t) : chiefPurple.fill(t)})`,
                  color: chiefPurple.text(t),
                  display: 'flex', alignItems: 'center', gap: '7px',
                  // 11px은 작아서 안 읽힘(사용자 지적) — 라벨 12px, 건수는 아래에서 14px
                  // KPI 상태명(진행중·보류)과 같은 크기 — 그 사이에 걸친 칩이라 둘보다 작으면 눌려 보인다
                  // 상태명(16px)보다 **한 단 아래**. 같게 하면 KPI의 주인공과 경쟁하고, 11px은 안 읽혔다.
                  fontSize: typescale.body.size, fontWeight: typescale.display.weight, whiteSpace: 'nowrap', cursor: 'pointer',
                  boxShadow: shadow.sm,
                  transition: 'background-color .14s ease, border-color .14s ease, transform .14s ease',
                  '&:hover': { backgroundImage: `linear-gradient(${chiefPurple.fillStrong(t)}, ${chiefPurple.fillStrong(t)})`, transform: 'translateX(-50%) translateY(-1px)' },
                  ...(focusRingSx as object),
                })}
              >
                <CheckIcon sx={{ fontSize: iconSize.body }} />
                <Box component="span">부서장 확인</Box>
                <Box component="span" sx={(t) => ({ fontSize: typescale.emphasis.size, fontWeight: typescale.display.weight, color: chiefPurple.text(t) })}>{checkTotal}</Box>
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* 완료 + Remind 그룹 */}
        <Box aria-label="완료 업무 그룹" sx={familySx}>
          {tile('done', doneCount, 0)}
          {tile('remind', remindCount, 0)}
        </Box>
      </Box>
    </ContentSection>
  )
}
