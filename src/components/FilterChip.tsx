import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { radius, typescale } from '@/theme/tokens'

/**
 * 필터 칩 공용 컴포넌트 — 업무현황(Work)·업무일정(Calendar)·공지(Notice) 세 곳이 각자 인라인으로
 * 복제하던 필터 칩의 **상호작용·접근성·틴트배경 로직을 하나로 통일**한다. 시각 스펙(아이콘 유무·패딩·
 * 글자색)은 페이지마다 정당하게 다르므로 각 호출부가 children/sx로 자기 모습을 그대로 넘긴다(시각 변화 0).
 *
 * 공통 상호작용: 일반 클릭=단일선택(재클릭 해제), Shift+클릭(PC)/복수모드(모바일)=추가선택,
 * mousedown에서 텍스트 선택 차단, Enter/Space 키보드 접근성, role=button + aria-pressed + aria-label.
 */

/** Shift+클릭 시 텍스트가 드래그 선택되지 않도록 mousedown 기본동작 차단 */
export const preventShiftSelect = (e: React.MouseEvent) => { if (e.shiftKey) e.preventDefault() }

interface TintChipProps {
  on: boolean
  /** 틴트 배경 계산에 쓰는 accent 색(hex 또는 CSS 색). 테마 의존 색은 (theme)=>string 함수로 전달. */
  color: string | ((theme: Theme) => string)
  ariaLabel: string
  /** additive = Shift(PC) 여부. 호출부가 모바일 복수모드 등을 OR로 덧붙일 수 있다. */
  onToggle: (additive: boolean) => void
  /** on 호버 시 밝게, off 호버 시 dim 완화 — Work 칩은 true, Calendar/Notice는 현행 유지(false) */
  hover?: boolean
  /** 페이지별 패딩 등 컨테이너 미세 오버라이드 */
  sx?: SxProps<Theme>
  /** 아이콘+라벨+건수 등 페이지 고유 콘텐츠 */
  children: ReactNode
}

/** 틴트 pill 칩(구분/종류/분류) — on=틴트 배경, off=더 옅게+전체 dim(opacity .45). 콘텐츠는 호출부 담당. */
export function TintChip({ on, color, ariaLabel, onToggle, hover = false, sx, children }: TintChipProps) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={on}
      onMouseDown={preventShiftSelect}
      onClick={(e) => onToggle(!!e.shiftKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(!!e.shiftKey) } }}
      sx={[
        (theme: Theme) => {
          const c = typeof color === 'function' ? color(theme) : color
          return {
            display: 'inline-flex', alignItems: 'center', height: 24, boxSizing: 'border-box', lineHeight: 1, gap: '5px', borderRadius: `${radius.pill}px`,
            bgcolor: alpha(c, on ? 0.16 : 0.06), cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
            opacity: on ? 1 : 0.45, transition: 'opacity .15s, background .15s',
            // lineHeight:1 통일 후, 글자 span만 0.5px 하향(아이콘 svg 제외) — 다른 칩과 동일 보정으로 정중앙
            '& > span': { transform: 'translateY(0.5px)' },
            ...(hover ? { '&:hover': on ? { bgcolor: alpha(c, 0.22) } : { opacity: 0.7 } } : {}),
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  )
}

interface PillChipProps {
  /** 알약 안에 보일 텍스트(이름/담당자) */
  label: string
  /** 알약 accent 색 — on=솔리드 배경, off=옅은 배경+테두리 */
  color: string
  on: boolean
  ariaLabel: string
  /** 모바일 복수선택 모드(Shift 대체) — 켜져 있으면 클릭이 곧 추가선택 */
  multi?: boolean
  onToggle: (additive: boolean) => void
}

/**
 * 팀원/담당자 알약 칩 — on=고유색 솔리드+흰 글자 / off=옅은 배경+테두리.
 * on 호버는 밝기만 상승(선택된 모습 유지, 미선택 모습으로 회귀 금지). Work·Calendar가 동일 스펙 공유.
 */
export function PillChip({ label, color, on, ariaLabel, multi = false, onToggle }: PillChipProps) {
  const toggle = (e: { shiftKey?: boolean }) => onToggle(!!e.shiftKey || multi)
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={on}
      title={label}
      onMouseDown={preventShiftSelect}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e) } }}
      sx={{
        height: 24,
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        px: '10px',
        borderRadius: `${radius.pill}px`,
        fontSize: typescale.small.size,
        fontWeight: typescale.emphasis.weight,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        border: '1px solid',
        transition: 'background .15s, color .15s, border-color .15s',
        ...(on
          ? { bgcolor: color, color: 'common.white', borderColor: color }
          : { bgcolor: alpha(color, 0.1), color: 'text.secondary', borderColor: alpha(color, 0.3) }),
        '&:hover': on ? { filter: 'brightness(1.08)' } : { bgcolor: alpha(color, 0.2), borderColor: alpha(color, 0.5) },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      {/* 한글 잉크 상단쏠림 보정(다른 칩과 동일하게 글자만 0.5px 하향) */}
      <Box component="span" sx={{ display: 'inline-block', transform: 'translateY(0.5px)' }}>{label}</Box>
    </Box>
  )
}
