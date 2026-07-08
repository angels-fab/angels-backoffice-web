import { useLocation, useNavigate } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { memoCountByPath } from '@/utils/improveMemo'
import { NAV_GROUPS, type NavItem } from '@/constants/nav'
import { useNavBadges } from './useNavBadges'

// PC 전용 좌측 사이드바 (모바일은 하단 탭바). 메뉴 정의는 @/constants/nav(단일 출처).
export default function SideNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const badges = useNavBadges()
  const { isMember, isAdmin } = useRole()
  // 경로별 활성 개선 메모 건수(장비도입/장비운영은 /equipment로 합산) — 관리자 전용 앰버 배지
  const improveItems = useAppSelector((s) => s.improve.items)
  const memoCounts = memoCountByPath(improveItems)

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  // 팀 콘텐츠(team)는 팀원 이상, 관리자 전용(adminOnly)은 관리자만, 나머지는 전체 공개.
  const canSee = (it: NavItem) => (it.adminOnly ? isAdmin : it.team ? isMember : true)
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0)

  return (
    <aside className="sidenav d-only">
      {visibleGroups.map((g, i) => (
        <div className="snav-group" key={g.label ?? i}>
          {g.label && <div className="snav-label">{g.label}</div>}
          {g.items.map((item) => {
            const badge = item.badgeKey ? badges[item.badgeKey] : undefined
            return (
            <button
              key={item.path}
              className={`snav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {/* 메뉴명 + 개선 메모 점(메뉴명 우상단, 노란 점·숫자 없음, 관리자 전용) */}
              <span className="snav-text">
                <span className="snav-name">{item.label}</span>
                {isAdmin && (memoCounts[item.path] || 0) > 0 && (
                  <Tooltip title={`개선 메모 ${memoCounts[item.path]}건`} placement="top" arrow>
                    <span className="snav-memo-dot" aria-label={`개선 메모 ${memoCounts[item.path]}건`} />
                  </Tooltip>
                )}
              </span>
              {/* 새 글 숫자 — 행 오른쪽 끝, 빨강 배경+숫자만(볼드 X). 0 숨김·99초과 99+ */}
              {badge !== undefined && badge > 0 && (
                <span className="snav-num" aria-label={`새 글 ${badge}건`}>{badge > 99 ? '99+' : badge}</span>
              )}
            </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
