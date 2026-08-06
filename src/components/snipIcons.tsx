import SvgIcon from '@mui/material/SvgIcon'
import type { SvgIconProps } from '@mui/material/SvgIcon'

/**
 * 윈도우 캡처 도구의 도구 그림을 본뜬 아이콘 4종 (2026-08-06 사용자 지시 — 보내준 캡처의 모양대로).
 *
 * MUI 세트에는 이 그림들이 없다 — 아래 펜촉·치즐 마커·기울인 지우개·원+사각 모음 전부.
 * 비슷한 MUI 아이콘으로 때웠더니 캡처와 전혀 다르게 보였다(사용자 지적 2회). 그래서
 * '아이콘은 MUI 만' 규칙(CLAUDE.md)의 **명시적 예외**로 여기서만 직접 그린다.
 *
 * 색 구조가 핵심이다(사용자 지적 3회차): 캡처 도구처럼 **몸통 윤곽은 중립(currentColor),
 * 잉크가 닿는 촉 부분만 ink 색으로 채운다.** 처음에 윤곽 전체를 잉크색으로 칠했더니
 * 노랑처럼 옅은 색은 가는 선이 배경에 묻혀 보이지 않았다 — 면(채움)은 옅은 색도 읽히고,
 * 둘레의 중립 윤곽이 형태를 지켜 준다. 지우개·도형 모음은 캡처와 같이 중립 그대로.
 *
 * MUI SvgIcon 으로 감싸므로 크기(fontSize)·색 처리와 정렬은 다른 MUI 아이콘과 완전히 같다.
 */
export type SnipIconProps = SvgIconProps & {
  /** 잉크 색 — 펜촉·마커 촉만 이 색으로 채운다. 안 주면 currentColor(중립) */
  ink?: string
}

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 잉크 촉 공통 — 채움은 잉크색, 둘레는 중립 윤곽(옅은 색이어도 형태가 살게) */
const tip = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinejoin: 'round' } as const

/** 볼펜 — 펜촉 몸통(중립 윤곽 + 슬릿), 끝 원뿔만 잉크색 */
export function SnipPenIcon({ ink, ...props }: SnipIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...line}>
        <path d="M7 2.9h10l-2.4 8.7H9.4Z" />
        <path d="M12 6.2v3" />
      </g>
      <path d="M9.4 11.6h5.2L12 17.4Z" fill={ink ?? 'currentColor'} {...tip} />
    </SvgIcon>
  )
}

/** 형광펜 — 마커 몸통(중립 윤곽), 치즐 촉만 잉크색 */
export function SnipHighlightIcon({ ink, ...props }: SnipIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...line}>
        <path d="M7.6 2.9h8.8v6.3l-1.6 2.4H9.2L7.6 9.2Z" />
      </g>
      <path d="M9.2 11.6h5.6l-1 4.2H10.2Z" fill={ink ?? 'currentColor'} {...tip} />
    </SvgIcon>
  )
}

/** 지우개 — 45° 기울인 지우개(소매 경계선) + 지우는 줄. 캡처와 같이 중립색 */
export function SnipEraserIcon({ ink: _ink, ...props }: SnipIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...line}>
        <g transform="rotate(-45 12 10)">
          <rect x="4.8" y="6.2" width="14.4" height="7.6" rx="2.2" />
          <path d="M10 6.2v7.6" />
        </g>
        <path d="M4.2 20.4h15.6" />
      </g>
    </SvgIcon>
  )
}

/** 도형 모음 — 원과 둥근 사각형이 겹친 그림. 캡처와 같이 중립색 */
export function SnipShapesIcon({ ink: _ink, ...props }: SnipIconProps) {
  return (
    <SvgIcon {...props}>
      <g {...line}>
        <circle cx="8.8" cy="8.1" r="6.1" />
        <rect x="10.6" y="9.9" width="9.9" height="9.9" rx="2.3" />
      </g>
    </SvgIcon>
  )
}
