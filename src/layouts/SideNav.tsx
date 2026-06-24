import { useLocation, useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MonitorIcon from '@mui/icons-material/Monitor'
import LinkIcon from '@mui/icons-material/Link'
import TimelineIcon from '@mui/icons-material/Timeline'
import SettingsIcon from '@mui/icons-material/Settings'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { useRole } from '@/auth/role'
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
  const { isAdmin } = useRole()

  const groups: SideNavGroup[] = [
    {
      label: null,
      items: [{ icon: <HomeIcon />, label: '홈', path: '/' }],
    },
    {
      label: '업무',
      items: [
        { icon: <CampaignIcon />, label: '공지사항', path: '/notice', badge: badges.notice },
        { icon: <CalendarMonthIcon />, label: '업무일정', path: '/calendar', badge: badges.cal },
        { icon: <AssessmentIcon />, label: '업무현황', path: '/work', badge: badges.work },
        // 장비운영관리 + 장비도입관리 통합 — 페이지 내 상단탭(장비도입/장비운영)으로 전환
        { icon: <MonitorIcon />, label: '장비관리', path: '/equipment' },
      ],
    },
    {
      label: '정보',
      items: [
        { icon: <CoPresentIcon />, label: '학술·교육 행사', path: '/events' },
        { icon: <TimelineIcon />, label: '구축 로드맵', path: '/roadmap' },
        { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badge: badges.improve },
        { icon: <LinkIcon />, label: '바로가기', path: '/links' },
        // 설정은 로그인(관리자) 전용 — 게스트에겐 숨김(라우트도 RequireAdmin로 보호)
        ...(isAdmin ? [{ icon: <SettingsIcon />, label: '설정', path: '/settings' }] : []),
      ],
    },
  ]

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  // 게스트(로그아웃)는 공개 메뉴만: 홈 · 장비도입관리 · 구축 로드맵 · 바로가기. 로그인 시 전체.
  const GUEST_PATHS = new Set(['/', '/equipment', '/roadmap', '/links'])
  const visibleGroups = groups
    .map((g) => ({ ...g, items: isAdmin ? g.items : g.items.filter((it) => GUEST_PATHS.has(it.path)) }))
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
              <span className="snav-text">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="snav-badge">{item.badge > 99 ? '99+' : item.badge}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </aside>
  )
}
