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
  const { isMember, isAdmin, isMaintainer } = useRole()
  // 경로별 활성 개선 메모 건수(장비도입/장비운영은 /equipment로 합산) — 유지보수자(조성범) 전용 앰버 배지
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
            const memoCnt = isMaintainer ? memoCounts[item.path] || 0 : 0
            return (
            <button
              key={item.path}
              className={`snav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {/* 아이폰식 위첨자 배지(D7 표준): 메뉴명 뒤 위첨자, 빨강=새 글·앰버=개선 메모 나란히.
                  배지는 .snav-name(overflow:hidden 말줄임) 밖 형제로 둬야 잘리지 않음 — ds NavBadge 1스펙 */}
              <span className="snav-text">
                <Box component="span" className="snav-name">{item.label}</Box>
                {(newCnt > 0 || memoCnt > 0) && (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, mt: '-2px' }}>
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
              </span>
            </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}
