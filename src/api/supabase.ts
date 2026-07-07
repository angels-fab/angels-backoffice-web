import { createClient } from '@supabase/supabase-js'

/**
 * Supabase 클라이언트 — ANGELS PORTAL 백엔드(점진 이관 중).
 * anon key는 RLS 전제의 공개 키(브라우저 노출 정상) — SCRIPT_URL과 같은 하드코딩 관례.
 */
export const SUPABASE_URL = 'https://rmvutlhdcfkqubzrckqf.supabase.co'
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtdnV0bGhkY2ZrcXVienJja3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNjY4MTIsImV4cCI6MjA5ODY0MjgxMn0.D5wXLA2fqc_u9byPLOc6e_mMUKlZD6IdaEnxbU7iCk8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 페이지 이탈 직전 keepalive 전송(beacon 대체)처럼 동기 접근이 필요한 곳을 위한 최신 액세스 토큰
export let currentAccessToken: string | null = null
void supabase.auth.getSession().then(({ data }) => {
  currentAccessToken = data.session?.access_token ?? null
})
supabase.auth.onAuthStateChange((_event, session) => {
  currentAccessToken = session?.access_token ?? null
})

/**
 * 로그인 이메일 — 사번을 내부 도메인 계정으로 매핑(사번 UX 유지).
 * 신규 도메인 = angels-fab.com. (기존 @angels.local은 예약 TLD라 GoTrue 신규 가입에서 거부됨 →
 * 유효 도메인으로 전환. 기존 4계정은 @angels.local 그대로 두고 login에서 폴백으로 처리.)
 */
export const AUTH_EMAIL_DOMAIN = 'angels-fab.com'
const LEGACY_EMAIL_DOMAIN = 'angels.local'
export const empEmail = (empNo: string) => `${empNo.trim()}@${AUTH_EMAIL_DOMAIN}`
/** 레거시 계정(@angels.local) 로그인 폴백용 — 도메인 이관 전 만들어진 기존 계정 */
export const empEmailLegacy = (empNo: string) => `${empNo.trim()}@${LEGACY_EMAIL_DOMAIN}`

/**
 * Supabase 비밀번호 패딩 — Auth 최소 6자 정책 충족용 고정 접미사.
 * 사용자는 기존 짧은 비밀번호를 그대로 입력하고, 저장·로그인 시에만 이 변환을 거친다.
 * (비밀번호 변경 기능을 만들 때도 반드시 동일 변환을 적용할 것)
 */
export const padPassword = (pw: string) => pw + '.angels'
