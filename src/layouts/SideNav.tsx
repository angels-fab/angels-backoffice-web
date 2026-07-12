import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { NavBadge } from '@/components/ds'
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
            const newCnt = item.badgeKey ? badges[item.badgeKey] || 0 : 0
            const memoCnt = isAdmin ? memoCounts[item.path] || 0 : 0
            return (
            <button
              key={item.path}
              className={`snav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {/* 아이폰식 위첨자 배지(D7 표준): 메뉴명 우상단, 빨강=새 글·앰버=개선 메모 나란히.
                  행 오른쪽 배지·메모 점 폐지 — ds NavBadge 1스펙 */}
              <span className="snav-text">
                <Box component="span" className="snav-name" sx={{ position: 'relative', display: 'inline-block' }}>
                  {item.label}
                  {(newCnt > 0 || memoCnt > 0) && (
                    <Box component="span" sx={{ position: 'absolute', left: '100%', top: -7, ml: '3px', display: 'inline-flex', gap: '3px' }}>
                      <NavBadge count={newCnt} kind="new" />
                      {memoCnt > 0 && (
                        <Tooltip title={`개선 메모 ${memoCnt}건`} placement="top" arrow>
                          {/* Tooltip 자식은 ref 필요 — span 래퍼 */}
                          <Box component="span" sx={{ display: 'inline-flex' }}>
                            <NavBadge count={memoCnt} kind="memo" />
                          </Box>
                        </Tooltip>
                      )}
                    </Box>
                  )}
                </Box>
              </span>
            </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
