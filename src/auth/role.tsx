import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, makeSignupClient, empEmail, empEmailLegacy, padPassword } from '@/api/supabase'

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
// 권한 4단계: guest(비로그인) < associate(유관자·제한열람) < member(팀원·열람+작성) < admin(팀원+관리)
// admin은 member의 상위 집합 — 관리자도 팀원 기능 전부 + 사용자·포털 관리.
export type Role = 'guest' | 'associate' | 'member' | 'admin'

/**
 * 포털 유지보수자 이름 — 개선 메모(제목 옆 칩·패널·사이드바 배지)는 이 사람에게만 노출.
 * (유지보수는 조성범 1인. profiles.name 기준 — 이름 바뀌면 여기만 수정.)
 */
export const MAINTAINER = '조성범'

/** 역할 표시명 — UI 라벨 단일 출처(칩·설정·메뉴 공용) */
export const ROLE_LABEL: Record<Role, string> = {
  guest: '게스트',
  associate: '유관자',
  member: '팀원',
  admin: '관리자',
}
/** 로그인 결과 — ok=성공 / fail=사번·비번 불일치 / pending=가입 승인 대기(로그인 불가) */
export type LoginResult = 'ok' | 'fail' | 'pending'

interface RoleContextValue {
  role: Role
  /** 관리자 — 사용자 승인·관리·포털관리 등 관리 기능 전용 게이트 */
  isAdmin: boolean
  /** 포털 유지보수자(조성범) — 개선 메모 노출 게이트 */
  isMaintainer: boolean
  /** 팀원 이상(member 또는 admin) — 팀 콘텐츠 열람·작성 게이트 */
  isMember: boolean
  /** 유관자 — 제한 열람(장비 일부·행사·바로가기) */
  isAssociate: boolean
  /** 로그인 여부(유관자·팀원·관리자) — 로그인/로그아웃 표시 게이트 */
  loggedIn: boolean
  /** 세션 복원 완료 여부 — 라우트 가드는 이 값이 true일 때만 판정(새로고침 리다이렉트 방지) */
  ready: boolean
  /** 로그인한 담당자 이름(게시자명) — profiles.name */
  user: string | null
  /** '로그인됨' 표식(비밀 아님) — 쓰기 게이트 truthy 판정용. 값은 서버로 안 감(인증=세션+RLS). */
  authKey: string | null
  /** 사번+비밀번호 로그인(Supabase Auth). 'ok'/'fail'/'pending'(승인 대기) */
  login: (empNo: string, password: string) => Promise<LoginResult>
  /** 가입 신청 — pending 프로필 생성(DB 트리거). 관리자 승인 후에 로그인 가능. */
  signUp: (empNo: string, name: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const RoleContext = createContext<RoleContextValue>({
  role: 'guest',
  isAdmin: false,
  isMaintainer: false,
  isMember: false,
  isAssociate: false,
  loggedIn: false,
  ready: false,
  user: null,
  authKey: null,
  login: async () => 'fail',
  signUp: async () => ({ ok: false }),
  logout: () => {},
})

/** auth 사용자 → 이름·역할. profiles 우선, 없으면 메타데이터 이름 + member */
async function fetchProfile(authUserId: string, metaName: string | undefined) {
  const { data } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  const raw = String(data?.role || '')
  return {
    name: data?.name || metaName || '',
    // admin/member/associate만 권한 부여 — pending·프로필없음은 접근 없음(guest)
    role: (raw === 'admin' ? 'admin' : raw === 'member' ? 'member' : raw === 'associate' ? 'associate' : 'guest') as Role,
    pending: raw === 'pending',
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
          if (p.pending) {
            await supabase.auth.signOut() // 승인 대기 계정 — 세션 있어도 접근 없음(게스트 취급)
          } else {
            setUser(p.name)
            setRole(p.role)
            setAuthKey(SESSION_MARK)
          }
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

  const login = useCallback(async (empNo: string, password: string): Promise<LoginResult> => {
    const pw = padPassword(password)
    // 신규 도메인(angels-fab.com) 먼저, 실패 시 레거시 @angels.local 폴백(기존 4계정)
    let res = await supabase.auth.signInWithPassword({ email: empEmail(empNo), password: pw })
    if (res.error || !res.data.user) {
      res = await supabase.auth.signInWithPassword({ email: empEmailLegacy(empNo), password: pw })
    }
    if (res.error || !res.data.user) return 'fail'
    const p = await fetchProfile(res.data.user.id, res.data.user.user_metadata?.name)
    if (p.pending) { await supabase.auth.signOut(); return 'pending' } // 승인 대기 — 로그인 불가
    // 평문 비밀번호는 저장하지 않는다(인증=세션 JWT). 구버전 게이트 키·잔재 정리만.
    localStorage.removeItem('role')
    localStorage.removeItem('adminUser')
    localStorage.removeItem('adminKey')
    setUser(p.name)
    setRole(p.role)
    setAuthKey(SESSION_MARK)
    return 'ok'
  }, [])

  const signUp = useCallback(async (empNo: string, name: string, password: string): Promise<{ ok: boolean; error?: string }> => {
    // 격리 클라이언트로 가입 → 현재 로그인 세션(관리자 등)을 건드리지 않음. signOut 불필요(임시 세션은 저장 안 됨).
    const tmp = makeSignupClient()
    const { error } = await tmp.auth.signUp({
      email: empEmail(empNo),
      password: padPassword(password),
      options: { data: { name: name.trim() } },
    })
    if (error) {
      const dup = /registered|already/i.test(error.message || '')
      return { ok: false, error: dup ? '이미 등록된 사번입니다.' : error.message || '가입 신청에 실패했습니다.' }
    }
    return { ok: true }
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
    <RoleContext.Provider value={{ role, isAdmin: role === 'admin', isMaintainer: user === MAINTAINER, isMember: role === 'member' || role === 'admin', isAssociate: role === 'associate', loggedIn: role !== 'guest', ready, user, authKey, login, signUp, logout }}>
      {children}
    </RoleContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRole = () => useContext(RoleContext)
