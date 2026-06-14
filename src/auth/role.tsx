import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { verifyAdmin } from '@/api/sheets'

/**
 * 권한 모드(내부용 UI 게이트 — 보안 인증 아님).
 * Guest: 조회 전용 / Admin: 작성·관리 기능.
 * 인증: '담당자' 시트의 사번(=ID)+비밀번호를 백엔드에서 대조(열 위치 헤더 자동 인식, 비번 미노출).
 * 로그인 성공 시 담당자 이름·비번을 보관 → 공지 작성 시 재입력 없이 게시.
 * 유지: localStorage(role / adminUser / adminKey).
 */
export type Role = 'guest' | 'admin'

interface RoleContextValue {
  role: Role
  isAdmin: boolean
  /** 로그인한 담당자 이름(공지 게시자명) */
  user: string | null
  /** 공지 작성용 게시자 비밀번호(로그인 시 검증된 값) — 재입력 생략용 */
  authKey: string | null
  /** 사번+비밀번호를 '담당자' 시트와 대조. 일치 시 admin 저장하고 true 반환. */
  login: (empNo: string, password: string) => Promise<boolean>
  logout: () => void
}

const RoleContext = createContext<RoleContextValue>({
  role: 'guest',
  isAdmin: false,
  user: null,
  authKey: null,
  login: async () => false,
  logout: () => {},
})

const isAdminStored = () => localStorage.getItem('role') === 'admin'

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => (isAdminStored() ? 'admin' : 'guest'))
  const [user, setUser] = useState<string | null>(() => (isAdminStored() ? localStorage.getItem('adminUser') : null))
  const [authKey, setAuthKey] = useState<string | null>(() => (isAdminStored() ? localStorage.getItem('adminKey') : null))

  const login = useCallback(async (empNo: string, password: string) => {
    const { valid, name } = await verifyAdmin(empNo.trim(), password)
    if (valid) {
      localStorage.setItem('role', 'admin')
      localStorage.setItem('adminUser', name)
      localStorage.setItem('adminKey', password)
      setRole('admin')
      setUser(name)
      setAuthKey(password)
      return true
    }
    return false
    // verifyAdmin은 모듈 스코프 import(불변)이라 deps 불필요
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('role')
    localStorage.removeItem('adminUser')
    localStorage.removeItem('adminKey')
    setRole('guest')
    setUser(null)
    setAuthKey(null)
  }, [])

  return <RoleContext.Provider value={{ role, isAdmin: role === 'admin', user, authKey, login, logout }}>{children}</RoleContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRole = () => useContext(RoleContext)
