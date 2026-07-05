import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from './role'

/**
 * 로그인 전용 라우트 가드(열람 허용 기준).
 * 비로그인(guest)이 보호된 경로로 진입하면 홈으로 돌려보낸다 — 사내 데이터는 로그인해야 열람.
 * admin/member 구분 없이 '로그인 여부'만 본다. 관리 전용 페이지(장비·설정)는 RequireAdmin을 쓴다.
 * 로그인은 홈 상단바(TopBar)에서 하므로 게이트로 막아도 로그인 경로가 끊기지 않는다.
 */
export default function RequireAuth({ children }: { children: ReactElement }) {
  const { role, ready } = useRole()
  if (!ready) return null // 세션 복원 중 — 새로고침 시 로그인 사용자가 홈으로 튕기지 않게 대기
  return role !== 'guest' ? children : <Navigate to="/" replace />
}
