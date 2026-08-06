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
 *
 * ⚠ 도형은 24칸 뷰박스를 **거의 꽉 채우게**(대략 x 4~20 · y 2~21) 그린다. 처음에 가운데
 * 절반만 쓰게 그렸더니 같은 fontSize 의 MUI 아이콘 옆에서 혼자 작아 보였다(사용자 신고).
 */
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 볼펜 — 아래를 향한 펜촉(가운데 슬릿) + 긋는 줄 */
export function SnipPenIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <path d="M7.5 2.6h9l-3.2 11.3a1.35 1.35 0 0 1-2.6 0Z" />
        <path d="M12 7.2v3.6" />
        <path d="M4.2 20.4h15.6" />
      </g>
    </SvgIcon>
  )
}

/** 형광펜 — 치즐(비스듬 사각) 촉 마커 + 두꺼운 칠 줄 */
export function SnipHighlightIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <path d="M8 2.6h8v6.6l-1.7 6H9.7L8 9.2Z" />
        <path d="M8 9.2h8" />
        <path d="M5 20.2h14" strokeWidth={3.1} />
      </g>
    </SvgIcon>
  )
}

/** 지우개 — 45° 기울인 지우개(소매 경계선) + 지우는 줄 */
export function SnipEraserIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <g transform="rotate(-45 12 10)">
          <rect x="4.8" y="6.2" width="14.4" height="7.6" rx="2.2" />
          <path d="M10 6.2v7.6" />
        </g>
        <path d="M4.2 20.4h15.6" />
      </g>
    </SvgIcon>
  )
}

/** 도형 모음 — 원과 둥근 사각형이 겹친 그림 */
export function SnipShapesIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...stroke}>
        <circle cx="8.8" cy="8.1" r="6.1" />
        <rect x="10.6" y="9.9" width="9.9" height="9.9" rx="2.3" />
      </g>
    </SvgIcon>
  )
}
