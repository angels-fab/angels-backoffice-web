import { useLocation, useNavigate } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import MonitorIcon from '@mui/icons-material/Monitor'
import CampaignIcon from '@mui/icons-material/Campaign'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { useRole } from '@/auth/role'
import { useNavBadges } from './useNavBadges'

function Badge({ n }: { n: number }) {
  if (n <= 0) return null
  return <span className="bnav-badge">{n > 99 ? '99+' : String(n)}</span>
}

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isAdmin } = useRole()
  const { notice: noticeCnt, work: workCnt } = useNavBadges()

  const item = (path: string, label: string, icon: JSX.Element, badge?: number) => (
    <button
      className={`bnav-item${pathname === path || pathname.startsWith(path + '/') ? ' active' : ''}`}
      onClick={() => navigate(path)}
    >
      <span className="bnav-ico-wrap">
        {icon}
        {badge !== undefined && <Badge n={badge} />}
      </span>
      {label}
    </button>
  )

  return (
    <nav className="bottom-nav" id="bottom-nav">
      {item('/', '홈', <HomeIcon />)}
      {item('/equipment', '장비', <MonitorIcon />)}
      {/* 공지·업무·일정은 로그인(관리자) 시에만 */}
      {isAdmin && item('/notice', '공지', <CampaignIcon />, noticeCnt)}
      {isAdmin && item('/work', '업무', <TaskAltIcon />, workCnt)}
      {/* 업무일정은 새 글 개념 미사용 → 배지 없음 */}
      {isAdmin && item('/calendar', '일정', <CalendarMonthIcon />)}
    </nav>
  )
}
