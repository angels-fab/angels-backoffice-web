import { useLocation, useNavigate } from 'react-router-dom'
import Tooltip from '@mui/material/Tooltip'
import HomeIcon from '@mui/icons-material/Home'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MonitorIcon from '@mui/icons-material/Monitor'
import LinkIcon from '@mui/icons-material/Link'
import SettingsIcon from '@mui/icons-material/Settings'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { memoCountByPath } from '@/utils/improveMemo'
import { useNavBadges } from './useNavBadges'

interface SideNavItem {
  icon: JSX.Element
  label: string
  path: string
  badge?: number
}

interface SideNavGroup {
  label: string | null
  items: SideNavItem[]
}

// PC 전용 좌측 사이드바 (모바일은 하단 탭바)
export default function SideNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const badges = useNavBadges()
  const { loggedIn, isAdmin } = useRole()
  // 경로별 활성 개선 메모 건수(장비도입/장비운영은 /equipment로 합산) — 관리자 전용 앰버 배지
  const improveItems = useAppSelector((s) => s.improve.items)
  const memoCounts = memoCountByPath(improveItems)

  const groups: SideNavGroup[] = [
    {
      label: null,
      items: [{ icon: <HomeIcon />, label: '홈', path: '/' }],
    },
    {
      label: '업무',
      items: [
        { icon: <CampaignIcon />, label: '공지사항', path: '/notice', badge: badges.notice },
        // 업무일정은 새 글 개념 미사용 → 배지 없음
        { icon: <CalendarMonthIcon />, label: '업무일정', path: '/calendar' },
        { icon: <AssessmentIcon />, label: '업무현황', path: '/work', badge: badges.work },
        // 장비운영관리 + 장비도입관리 통합 — 페이지 내 상단탭(장비도입/장비운영)으로 전환
        { icon: <MonitorIcon />, label: '장비관리', path: '/equipment' },
      ],
    },
    {
      label: '정보',
      items: [
        { icon: <CoPresentIcon />, label: '학술·교육·전시', path: '/events' },
        { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badge: badges.improve },
        { icon: <LinkIcon />, label: '바로가기', path: '/links' },
        // 설정은 로그인(관리자) 전용 — 게스트에겐 숨김(라우트도 RequireAdmin로 보호)
        ...(isAdmin ? [{ icon: <SettingsIcon />, label: '설정', path: '/settings' }] : []),
      ],
    },
  ]

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  // 게스트(로그아웃)는 공개 메뉴만: 홈 · 학술·교육 행사 · 바로가기.
  // member(일반)는 장비관리(관리자 전용·RLS) 빼고 전체 열람. admin은 전부(설정 포함).
  const GUEST_PATHS = new Set(['/', '/events', '/links'])
  const MEMBER_HIDDEN = new Set(['/equipment']) // 장비 = 관리자 전용(RLS). 설정은 애초에 isAdmin일 때만 목록에 추가됨.
  const canSee = (path: string) => (isAdmin ? true : loggedIn ? !MEMBER_HIDDEN.has(path) : GUEST_PATHS.has(path))
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((it) => canSee(it.path)) }))
    .filter((g) => g.items.length > 0)

  return (
    <aside className="sidenav d-only">
      {visibleGroups.map((g, i) => (
        <div className="snav-group" key={g.label ?? i}>
          {g.label && <div className="snav-label">{g.label}</div>}
          {g.items.map(item => (
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
              {item.badge !== undefined && item.badge > 0 && (
                <span className="snav-num" aria-label={`새 글 ${item.badge}건`}>{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
