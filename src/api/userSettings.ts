import { supabase } from './supabase'

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
 * 개인 설정 저장(전체 덮어쓰기 upsert). user_name = 본인 이름(profiles.name) — RLS check와 일치해야 저장됨.
 * 부분 갱신은 호출 측에서 병합한 전체 객체를 넘긴다(슬라이스가 담당).
 */
export async function saveMySettings(userName: string, settings: UserSettings): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_name: userName, settings, updated_at: new Date().toISOString() }, { onConflict: 'user_name' })
  if (error) throw error
}
