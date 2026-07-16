/**
 * 오류 리포트 단일 창구 — 앱 전역의 오류를 여기 한 곳으로 모은다.
 *
 * 지금은 콘솔에만 남긴다. 다음 단계(우선순위2 모니터링)에서 이 함수 안에만
 * Sentry.captureException(...) 또는 Supabase `client_errors` insert를 연결하면,
 * ErrorBoundary·전역 핸들러·저장 실패 등 모든 리포트가 자동으로 그리 흘러간다.
 */
export interface ErrorContext {
  /** 어디서 났는지 — 'react-render' | 'window.onerror' | 'save:업무' 등 */
  source?: string
  [key: string]: unknown
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  // 콘솔엔 항상 남긴다(개발·디버그용).
  console.error('[reportError]', context.source ?? '', error, context)
  // TODO(모니터링): 여기에 Sentry.captureException(error, { extra: context })
  //                 또는 supabase.from('client_errors').insert({...}) 연결.
}
