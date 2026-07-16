import * as Sentry from '@sentry/react'

/**
 * 오류 리포트 단일 창구 — 앱 전역의 오류를 여기 한 곳으로 모아 Sentry로 보낸다.
 *
 * 여기로 들어오는 것: ErrorBoundary가 잡은 렌더 오류, 그 밖에 직접 신고하는 오류(저장 실패 등).
 * 처리 안 된 오류·promise 거부는 Sentry가 전역 핸들러로 알아서 잡으므로 따로 안 불러도 된다.
 *
 * 운영(PROD)에서만 실제 전송된다(utils/sentry의 enabled 설정) — 개발 중엔 콘솔만.
 * context에는 개인정보를 넣지 말 것(이름·연락처 등) — 진단에 필요한 것만.
 */
export interface ErrorContext {
  /** 어디서 났는지 — 'react-render' | 'save:업무' 등 */
  source?: string
  [key: string]: unknown
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  // 콘솔엔 항상 남긴다(개발·디버그용).
  console.error('[reportError]', context.source ?? '', error, context)
  Sentry.captureException(error, { extra: context })
}
