import Chip from '@mui/material/Chip'
import { darken } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { iconSize, typescale } from '@/theme/tokens'
import { flatten } from '@/utils/color'

/** 의미 상태 — 색 매핑의 단일 기준 */
export type StatusKind = 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'purple' | 'teal'

export interface StatusChipProps {
  /** 상태 종류. 색을 결정한다. */
  status: StatusKind
  /** 표시 내용 — 문자열이 기본. 필터 칩의 '라벨 + 흐린 건수'처럼 조각을 나눠 꾸밀 땐 ReactNode(MUI Chip label 에 그대로 전달) */
  label: ReactNode
  /** 선택형(클릭 토글) 칩일 때 선택 여부 — 채워진 스타일 */
  selected?: boolean
  icon?: ReactNode
  /** 클릭 — 이벤트를 전달(shiftKey 등 수정키 판별용) */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  /** 마우스다운 — Shift+클릭 시 텍스트 선택 방지 등 */
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  size?: 'small' | 'medium'
  /** status 매핑 대신 쓸 고정 색(담당자 고유색 등) — 알파 공식(약한 채움→호버→선택 솔리드)은 동일 적용 */
  customColor?: string
}

const COLOR: Record<StatusKind, (t: import('@mui/material/styles').Theme) => string> = {
  success: (t) => t.palette.accent.green,
  info: (t) => t.palette.accent.blue,
  warning: (t) => t.palette.accent.amber,
  error: (t) => t.palette.accent.red,
  purple: (t) => t.palette.accent.purple,
  teal: (t) => t.palette.accent.teal,
  neutral: (t) => t.palette.text.secondary,
}

// 글자용 색 — 같은 의미의 accentText(테마가 자동 선택). 채움(COLOR)과 분리된 2계층.
/**
 * 상태색 계열의 **글자색** 정본. 표시칩(이 파일)과 필터칩(Work/Notice/Improve)이 같은 값을 써야
 * "같은 분류"가 목록과 필터에서 같은 색으로 읽힌다 — 예전엔 필터만 회색이라 같은 '행정'인데
 * 카드는 파랑·필터는 회색으로 보였다(사용자 지적 2026-07-26).
 * accent(채움용 원색)가 아니라 accentText라 틴트 면 위에서도 4.5:1을 넘긴다.
 */
export const statusTextColor = (t: import('@mui/material/styles').Theme, kind: StatusKind): string =>
  TEXT_COLOR[kind](t)

const TEXT_COLOR: Record<StatusKind, (t: import('@mui/material/styles').Theme) => string> = {
  success: (t) => t.palette.accentText.green,
  info: (t) => t.palette.accentText.blue,
  warning: (t) => t.palette.accentText.amber,
  error: (t) => t.palette.accentText.red,
  purple: (t) => t.palette.accentText.purple,
  teal: (t) => t.palette.accentText.teal,
  neutral: (t) => t.palette.text.secondary,
}

/**
 * StatusChip — 상태/분류를 일관된 색 규칙으로 표시하는 칩.
 *
 * 색은 status로만 결정(하드코딩 금지). 옅은 배경 + 같은 색 테두리/글자.
 * selected=true면 채워진 스타일(필터 토글 등).
 *
 * @example
 * <StatusChip status="success" label="국내" />
 * <StatusChip status="info" label="해외" selected onClick={toggle} />
 */
export default function StatusChip({
  status,
  label,
  selected,
  icon,
  onClick,
  onMouseDown,
  size = 'small',
  customColor,
}: StatusChipProps) {
  return (
    <Chip
      label={label}
      icon={icon as never}
      onClick={onClick}
      onMouseDown={onMouseDown}
      size={size}
      variant="outlined"
      sx={(t) => {
        const c = customColor ?? COLOR[status](t)
        // 채움(fill)은 c, 글자는 테마별 글자용 값 — 흰/틴트 배경에서도 4.5:1 확보(fill/text 2계층).
        // customColor(담당자 고유색 등)는 매핑이 없으므로 라이트에서만 어둡게 눌러 대비를 만든다.
        const textC = customColor
          ? (t.palette.mode === 'light' ? darken(customColor, 0.34) : customColor)
          : TEXT_COLOR[status](t)
        return {
          // MUI Chip 기본 라벨은 13px(body) → 본문·ManagerChip과 같은 12px(칩=라벨 크기)로 통일.
          fontSize: typescale.small.size,
          // 채움(selected) 라벨은 흰색 고정이 아니라 채움색 대비로 자동 선택 —
          // 앰버·틸 같은 밝은 채움 위 흰 글자는 2.3:1까지 떨어진다(getContrastText가 검은 라벨을 고름).
          //
          // ★ 아이콘이 있으면 글자는 **중립색**으로 넘긴다(2026-08-04). 색을 나르는 일을 아이콘이
          //   맡으므로 글자가 색을 벗어도 분류 신호가 안 죽고, 틴트 면과 글자가 같은 계열이 아니게
          //   되어 대비가 저절로 벌어진다 — 업무 구분 칩 실측 5.05~6.15 → 14.1:1.
          //   아이콘이 없는 칩은 글자가 유일한 색 신호이므로 종전대로 accentText 를 쓴다.
          color: selected ? t.palette.getContrastText(c) : icon ? t.palette.text.primary : textC,
          // 미선택 칩의 면·보더 농도. 구 값(.12/.32)은 카드 대비 면 1.10~1.26·보더 1.29~1.86이라
          // 6색 칩이 멀리서 회색 알약으로 뭉쳐 보였다(분류 신호가 죽음).
          //
          // ★ 틴트를 **표면 위에 미리 합성**해 불투명하게 만든다(2026-08-04). 반투명으로 두면
          //   뒤에 무엇이 오느냐에 따라 결과가 달라진다 — 업무 카드는 상태 톤이 깔려 있어
          //   칩 틴트에 카드 색이 섞이고, 대비가 3.77:1 까지 떨어지며(실측) 칩 색까지 왜곡됐다
          //   (파란 '행정' 칩 배경이 청록 #b4d2d4, 앰버 '인사'가 올리브 #ccd5b8).
          //   합성 후 5.06~6.15:1, 어느 카드 위에서든 같은 색.
          //   "라벨은 .18 면 위에서도 4.5 통과"라던 옛 주석은 **색 없는 카드**에서만 참이었다.
          //   같은 카드의 담당자 칩(ManagerChip)은 원래부터 불투명 솔리드라, 이 변경으로 두 칩이
          //   같은 규칙이 된다.
          bgcolor: selected ? c : flatten(c, 0.18, t.palette.background.paper),
          borderColor: selected ? c : flatten(c, 0.6, t.palette.background.paper),
          // 아이콘이 분류 색을 나른다 — 글자가 중립이 된 만큼 색 신호가 여기로 옮겨왔다.
          //
          // ★ 채움용 accent(c)가 아니라 **글자용 accentText**(textC)를 쓴다. 아이콘이 정보를
          //   나르므로 WCAG 1.4.11 의 3:1 을 지켜야 하는데, accent 를 쓰면 라이트에서
          //   인사 2.01 · 교육세미나 2.41 · 행정 2.70 으로 전부 미달한다(실측 2026-08-04).
          //   accentText 는 애초에 "틴트 면 위 4.5:1"을 보장하려고 만든 계층이라 그대로 통과한다.
          //   다크는 accent 로도 3.66~5.16 이었지만, 테마마다 다른 계층을 쓰면 규칙이 둘로 갈린다.
          // 채움(selected) 칩은 배경이 원색이라 아이콘도 라벨과 같은 대비색을 따라간다.
          // 13(iconSize.caption) = 업무일정 종류 칩과 같은 값. 여백은 MUI 기본(ml 5 / mr -6)이
          //  12px 라벨 옆에서 뜨므로 좁힌다.
          '& .MuiChip-icon': {
            color: selected ? 'inherit' : textC,
            fontSize: iconSize.caption,
            marginLeft: '1px',
            marginRight: '-3px',
          },
          // lineHeight:1 통일 + 글자 0.5px 하향 — 다른 칩과 동일 규격으로 한글 정중앙(실측)
          '& .MuiChip-label': { lineHeight: 1, transform: 'translateY(0.5px)' },
          ...(onClick && {
            cursor: 'pointer',
            // 선택 > 호버 — 선택 칩은 호버에도 솔리드 유지, 미선택 칩만 같은 색으로 조금 더 선명하게
            '&:hover': { bgcolor: selected ? c : flatten(c, 0.2, t.palette.background.paper), borderColor: selected ? c : flatten(c, 0.5, t.palette.background.paper) },
          }),
        }
      }}
    />
  )
}
