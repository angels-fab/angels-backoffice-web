import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import { NavBadge } from '@/components/ds'
import { radius, typescale } from '@/theme/tokens'
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
  // 홈은 레일에서 제외(2026-07-23 확정: 로고 클릭=홈) — NAV_GROUPS 자체는 유지(개선위치·모바일 탭바 파생용).
  const canSee = (it: NavItem) => (it.adminOnly ? isAdmin : it.team ? isMember : true)
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee).filter((it) => it.path !== '/') }))
    .filter((g) => g.items.length > 0)

  return (
    <aside className="sidenav d-only">
      {/* 레일: 평소 아이콘만(64px), 호버·포커스 시 메뉴명 폭만큼 오버레이 펼침 — 스타일은 index.css .snav-* */}
      <nav className="snav-panel" aria-label="주 메뉴">
        {visibleGroups.map((g, i) => (
          <div className="snav-group" key={g.label ?? i}>
            {g.label && <div className="snav-label"><span>{g.label}</span></div>}
            {g.items.map((item) => {
              const newCnt = item.badgeKey ? badges[item.badgeKey] || 0 : 0
              const memoCnt = isMaintainer ? memoCounts[item.path] || 0 : 0
              return (
              <button
                key={item.path}
                className={`snav-item${isActive(item.path) ? ' active' : ''}`}
                // 클릭 후 blur — 포커스가 남으면 focus-within 때문에 마우스가 떠나도 패널이 안 닫힘
                onClick={(e) => { e.currentTarget.blur(); navigate(item.path) }}
              >
                {item.icon}
                {/* 접힘 상태 배지 — 아이콘 우상단 빨강 숫자·우하단 앰버 점(펼치면 CSS로 숨김) */}
                {newCnt > 0 && <span className="snav-rnew" aria-hidden="true">{newCnt > 99 ? '99+' : newCnt}</span>}
                {memoCnt > 0 && <span className="snav-rmemo" aria-hidden="true" />}
                {/* 메뉴명 칸(0fr↔1fr) — 펼침 폭이 이름 길이를 따라간다 */}
                <span className="snav-lcol">
                  <span className="snav-lin">
                    <Box component="span" className="snav-name">{item.label}</Box>
                    {/* 준비중 칩 — 완성 전 메뉴 표시(nav.tsx wip 플래그) */}
                    {item.wip && (
                      <Box
                        component="span"
                        sx={{
                          flexShrink: 0,
                          fontSize: typescale.caption.size,
                          lineHeight: 1.5,
                          color: 'accent.amber',
                          border: '1px solid',
                          borderColor: (t) => alpha(t.palette.accent.amber, 0.45),
                          bgcolor: (t) => alpha(t.palette.accent.amber, 0.12),
                          borderRadius: `${radius.chip}px`,
                          px: '5px',
                        }}
                      >
                        준비중
                      </Box>
                    )}
                    {/* 아이폰식 위첨자 배지(D7 표준): 메뉴명 뒤 위첨자, 빨강=새 글·앰버=개선 메모 나란히 */}
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
                </span>
              </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
