import SvgIcon from '@mui/material/SvgIcon'
import type { SvgIconProps } from '@mui/material/SvgIcon'

/**
 * 윈도우 캡처 도구의 도구 그림을 본뜬 아이콘 4종 (2026-08-06 사용자 지시 — 보내준 캡처의 모양대로).
 *
 * MUI 세트에는 이 그림들이 없다 — 아래 펜촉·치즐 마커·기울인 지우개·원+사각 모음 전부.
 * 비슷한 MUI 아이콘으로 때웠더니 캡처와 전혀 다르게 보였다(사용자 지적 2회). 그래서
 * '아이콘은 MUI 만' 규칙(CLAUDE.md)의 **명시적 예외**로 여기서만 직접 그린다 —
 * 사용자가 캡처 이미지를 보내며 "색은 신경 쓰지 말고 모양만 이대로"를 지정했다.
 *
 * MUI SvgIcon 으로 감싸므로 크기(fontSize)·색(color/currentColor) 처리와 정렬은 다른 MUI
 * 아이콘과 완전히 같다. 전부 선(stroke) 기반 아웃라인이라 테마·상태 색이 그대로 입혀진다.
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 볼펜 — 아래를 향한 펜촉(가운데 슬릿) + 긋는 줄 */
export function SnipPenIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <path d="M8.7 3.9h6.6l-2.4 8.4a1 1 0 0 1-1.8 0Z" />
        <path d="M12 7.4v2.8" />
        <path d="M5.5 18.8h13" />
      </g>
    </SvgIcon>
  )
}

/** 형광펜 — 치즐(비스듬 사각) 촉 마커 + 두꺼운 칠 줄 */
export function SnipHighlightIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <path d="M9 3.8h6v5.1l-1.3 4.7H10L9 8.9Z" />
        <path d="M9 8.9h6" />
        <path d="M6 18.6h12" strokeWidth={2.7} />
      </g>
    </SvgIcon>
  )
}

/** 지우개 — 45° 기울인 지우개(소매 경계선) + 지우는 줄 */
export function SnipEraserIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <g transform="rotate(-45 11.5 9.3)">
          <rect x="5.8" y="6.1" width="11.4" height="6.4" rx="1.9" />
          <path d="M10.1 6.1v6.4" />
        </g>
        <path d="M5.5 18.8h13" />
      </g>
    </SvgIcon>
  )
}

/** 도형 모음 — 원과 둥근 사각형이 겹친 그림 */
export function SnipShapesIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <circle cx="9.4" cy="8.9" r="5.2" />
        <rect x="11" y="10.5" width="8.2" height="8.2" rx="2" />
      </g>
    </SvgIcon>
  )
}
