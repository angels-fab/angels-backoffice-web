import { useLocation, useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MonitorIcon from '@mui/icons-material/Monitor'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import LinkIcon from '@mui/icons-material/Link'
import TimelineIcon from '@mui/icons-material/Timeline'
import SettingsIcon from '@mui/icons-material/Settings'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
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
      ],
    },
    {
      label: '장비',
      items: [
        { icon: <MonitorIcon />, label: '장비운영관리', path: '/equipment-ops' },
        { icon: <LocalShippingIcon />, label: '장비도입관리', path: '/equipment' },
      ],
    },
    {
      label: '소통',
      items: [
        { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badge: badges.improve },
      ],
    },
    {
      label: '정보',
      items: [
        { icon: <TimelineIcon />, label: '구축 로드맵', path: '/roadmap' },
        { icon: <LinkIcon />, label: '바로가기', path: '/links' },
        { icon: <SettingsIcon />, label: '설정', path: '/settings' },
      ],
    },
  ]

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  return (
    <aside className="sidenav d-only">
      {groups.map((g, i) => (
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
