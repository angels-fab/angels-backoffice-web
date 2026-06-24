import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from './role'

/**
 * 로그인(관리자) 전용 라우트 가드.
 * 게스트가 보호된 경로로 진입하면 홈으로 돌려보낸다.
 * 로그인은 상단바(TopBar)의 '관리자 모드' 버튼에서 하므로, 게이트로 막아도 로그인 경로가 끊기지 않는다.
 */
export default function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAdmin } = useRole()
  return isAdmin ? children : <Navigate to="/" replace />
}
