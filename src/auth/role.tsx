import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, empEmail, padPassword } from '@/api/supabase'

/**
 * 권한 컨텍스트 — Supabase Auth 세션 기반.
 * 역할 3단계: guest(비로그인) / member(일반) / admin(관리자) — 역할은 profiles.role에서 읽음.
 * 로그인 UX는 기존과 동일(사번+비밀번호). 내부적으로 사번→내부 이메일, 비밀번호→패딩 변환.
 *
 * 인증은 전적으로 Supabase 세션(JWT)+RLS로 처리한다. authKey는 과거 Apps Script 대조용 원문
 * 비밀번호였으나, 전 도메인이 Supabase로 이관되어 그 값은 더 이상 쓰이지 않는다. 평문 비밀번호를
 * localStorage에 보관하던 방식을 폐지하고, authKey는 '로그인됨'을 뜻하는 비밀 아닌 표식으로만 남긴다
 * (쓰기 게이트의 truthy 판정용). 기존 브라우저에 남은 평문 비밀번호는 마운트 시 제거한다.
 */
const SESSION_MARK = 'session' // authKey 표식 — 비밀 아님(값 미사용, 존재 여부만 로그인 판정에 씀)
export type Role = 'guest' | 'member' | 'admin'

interface RoleContextValue {
  role: Role
  isAdmin: boolean
  /** 세션 복원 완료 여부 — 라우트 가드는 이 값이 true일 때만 판정(새로고침 리다이렉트 방지) */
  ready: boolean
  /** 로그인한 담당자 이름(게시자명) — profiles.name */
  user: string | null
  /** '로그인됨' 표식(비밀 아님) — 쓰기 게이트 truthy 판정용. 값은 서버로 안 감(인증=세션+RLS). */
  authKey: string | null
  /** 사번+비밀번호 로그인(Supabase Auth). 성공 시 true. */
  login: (empNo: string, password: string) => Promise<boolean>
  logout: () => void
}

const RoleContext = createContext<RoleContextValue>({
  role: 'guest',
  isAdmin: false,
  ready: false,
  user: null,
  authKey: null,
  login: async () => false,
  logout: () => {},
})

/** auth 사용자 → 이름·역할. profiles 우선, 없으면 메타데이터 이름 + member */
async function fetchProfile(authUserId: string, metaName: string | undefined) {
  const { data } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return {
    name: data?.name || metaName || '',
    role: (data?.role === 'admin' ? 'admin' : 'member') as Role,
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('guest')
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<string | null>(null)
  const [authKey, setAuthKey] = useState<string | null>(null)

  // 세션 복원 — supabase-js가 저장한 세션에서 이름·역할 재구성(authKey는 기존 localStorage 유지분)
  useEffect(() => {
    let alive = true
    ;(async () => {
      // 기존 브라우저에 남은 평문 비밀번호(레거시 adminKey/adminUser) 제거 — 로그인 여부와 무관하게 정리
      localStorage.removeItem('adminKey')
      localStorage.removeItem('adminUser')
      try {
        const { data } = await supabase.auth.getSession()
        const session = data.session
        if (session && alive) {
          const p = await fetchProfile(session.user.id, session.user.user_metadata?.name)
          if (!alive) return
          setUser(p.name)
          setRole(p.role)
          setAuthKey(SESSION_MARK)
        }
      } finally {
        if (alive) setReady(true)
      }
    })()
    // 다른 탭 로그아웃 등 외부 세션 종료 반영
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setRole('guest')
        setUser(null)
        setAuthKey(null)
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (empNo: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: empEmail(empNo),
      password: padPassword(password),
    })
    if (error || !data.user) return false
    const p = await fetchProfile(data.user.id, data.user.user_metadata?.name)
    // 평문 비밀번호는 저장하지 않는다(인증=세션 JWT). 구버전 게이트 키·잔재 정리만.
    localStorage.removeItem('role')
    localStorage.removeItem('adminUser')
    localStorage.removeItem('adminKey')
    setUser(p.name)
    setRole(p.role)
    setAuthKey(SESSION_MARK)
    return true
  }, [])

  const logout = useCallback(() => {
    void supabase.auth.signOut()
    localStorage.removeItem('role')
    localStorage.removeItem('adminUser')
    localStorage.removeItem('adminKey')
    setRole('guest')
    setUser(null)
    setAuthKey(null)
  }, [])

  return (
    <RoleContext.Provider value={{ role, isAdmin: role === 'admin', ready, user, authKey, login, logout }}>
      {children}
    </RoleContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRole = () => useContext(RoleContext)
