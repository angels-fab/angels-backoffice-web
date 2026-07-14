import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'

// 사무실망 토큰갱신 스톨 대비 — write는 ensureSession + withTimeout (공지와 동일 안전장치)
const DB_TIMEOUT = 20_000

/** 개인화 설정 — 로그인 사용자별 JSON(user_settings.settings). 키는 점표기('cal.view' 등). */
export type UserSettings = Record<string, unknown>

/**
 * 현재 로그인 사용자의 개인 설정을 읽는다. RLS(user_name = my_name())로 본인 행만 보이므로
 * 필터 없이 조회해도 자기 것만 온다. 행이 없으면(첫 사용) 빈 객체.
 */
export async function fetchMySettings(): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('settings').maybeSingle()
  if (error) throw error
  return ((data?.settings as UserSettings) ?? {}) || {}
}

/**
 * 개인 설정 키 단위 병합 저장 — 이 세션이 바꾼 키만 서버에 반영(RPC user_settings_merge, jsonb ||).
 * ⚠ 전체 덮어쓰기 upsert 금지: 멀티탭/멀티기기에서 stale 스냅샷이 다른 세션의 seen.*·필터·뷰를
 * 통째로 롤백하는 last-writer-wins 사고가 나므로(적대적 리뷰 확정) 반드시 변경분 패치만 보낸다.
 * user_name은 서버가 my_name()으로 결정(RLS 동일 기준) — 파라미터로 받지 않는다.
 */
export async function mergeMySettings(patch: UserSettings): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(supabase.rpc('user_settings_merge', { p_patch: patch }), DB_TIMEOUT, '개인 설정 저장')
  if (error) throw error
}
