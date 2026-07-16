import * as Sentry from '@sentry/react'

/**
 * Sentry(오류 추적) 초기화 — 앱에서 오류가 나면 Sentry 대시보드에 쌓이고,
 * 프로젝트 설정(Alerts)에 따라 유지보수자 이메일로 자동 알림이 간다.
 *
 * 설계 의도(중요):
 * - DSN은 '이벤트 보내기 전용' 공개 키다. 남의 데이터를 읽는 권한이 없어 코드에 있어도 안전
 *   (Sentry 공식 권장 방식). 그래서 빌드 시크릿 없이 배포된다.
 * - `enabled: PROD` — 개발 중 오류는 안 보낸다. 운영에서 실제 사용자에게 난 것만 모은다.
 * - `sendDefaultPii: false` — IP·쿠키 등 개인정보 자동 수집을 끈다.
 * - 성능추적(traces)·세션리플레이는 안 켠다 — '오류 알림'만이 목적이라 무료 할당량·번들 절약.
 *
 * 초기화하면 처리 안 된 오류(window.onerror)와 promise 거부도 자동 포착된다.
 * 직접 잡은 오류는 utils/reportError를 통해 들어온다.
 */
const DSN = 'https://d3ed3148782aaaa840afe3dc18c45e62@o4511743386976256.ingest.us.sentry.io/4511743421644800'

export function initSentry(): void {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  })
}
