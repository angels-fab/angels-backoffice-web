import { useNavigate } from 'react-router-dom'
import topbarLogo from '@/assets/topbar-logo.jpg'

export default function TopBar() {
  const navigate = useNavigate()

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <div
          className="topbar-brand"
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
          title="메인화면으로"
        >
          <img src={topbarLogo} className="topbar-logo" alt="ANGELS FAB 구축 현황" />
        </div>
      </div>
    </div>
  )
}
