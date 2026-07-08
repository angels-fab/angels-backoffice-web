import { supabase, makeSignupClient, padPassword } from './supabase'

/**
 * 공용 세션/타임아웃 가드 — 사무실망에서 supabase 요청이 토큰 갱신 스톨로 멈추는 것 방지.
 * (공지 저장 멈춤 원인·수정과 동일 개념. 다른 write API로도 전파 가능하도록 공용화)
 */

/** 요청에 타임아웃을 씌운다(supabase 쿼리빌더는 thenable → Promise.resolve로 실행 트리거). */
export async function withTimeout<T>(work: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 응답이 지연됩니다 — 네트워크를 확인하고 다시 시도해주세요.`)), ms)
  })
  try {
    return await Promise.race([Promise.resolve(work), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * 쓰기 전에 세션(액세스 토큰)을 먼저 확보한다. 토큰 만료 임박 시 supabase 내부의 '타임아웃 없는'
 * 갱신이 요청을 붙잡아 멈추는 것을 방지 — 갱신을 타임아웃 가능한 단계로 분리해 먼저 처리.
 */
export async function ensureSession(ms = 20_000): Promise<void> {
  const { error } = await withTimeout(supabase.auth.getSession(), ms, '세션 확인')
  if (error) throw new Error(error.message || '세션 확인에 실패했습니다 — 다시 시도해주세요.')
}

/**
 * 로그인한 사용자의 비밀번호 재확인(민감 작업 보호). 격리 클라이언트로 검증해 현재 세션은 건드리지 않는다.
 * 맞으면 true. (사번→내부 이메일은 이미 세션 email에 있으므로 그걸로 재인증)
 */
export async function verifyPassword(entered: string): Promise<boolean> {
  const pw = entered.trim()
  if (!pw) return false
  const { data } = await supabase.auth.getSession()
  const email = data.session?.user.email
  if (!email) return false
  const tmp = makeSignupClient()
  const { error } = await withTimeout(tmp.auth.signInWithPassword({ email, password: padPassword(pw) }), 15_000, '비밀번호 확인')
  return !error
}
