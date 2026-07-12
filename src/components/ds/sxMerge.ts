import type { SxProps, Theme } from '@mui/material/styles'

/**
 * mergeSx — 기본 sx와 호출자 sx의 안전한 병합 (P2 리뷰 확정 수정).
 *
 * `{ ...base, ...sx }` 객체 스프레드는 함수형 sx(테마 참조)를 `{}`로 소실시키고
 * 배열형 sx를 숫자 키 객체로 오염시킨다(TS는 통과 — 순수 런타임 함정).
 * MUI 공식 합성 패턴인 배열로 병합한다. ds 컴포넌트의 sx 병합은 반드시 이것 사용.
 */
export const mergeSx = (base: SxProps<Theme>, sx?: SxProps<Theme>): SxProps<Theme> =>
  [base, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>
