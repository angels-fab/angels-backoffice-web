import type { ReactElement } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from './role'

/**
 * 팀원(이상) 전용 라우트 가드.
 * 팀 콘텐츠(공지·업무일정·업무현황·개선요청·장비)는 팀원/관리자만 접근.
 * 게스트·유관자가 진입하면 홈으로 돌려보낸다. (유관자는 장비 제한열람을 별도 경로로 — 추후)
 */
export default function RequireMember({ children }: { children: ReactElement }) {
  const { isMember, ready } = useRole()
  if (!ready) return null // 세션 복원 중 — 새로고침 시 팀원이 홈으로 튕기지 않게 대기
  return isMember ? children : <Navigate to="/" replace />
}
