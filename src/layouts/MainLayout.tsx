import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import SideNav from './SideNav'
import BottomNav from './BottomNav'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { loadWorkData } from '@/store/slices/workSlice'
import { loadNoticeData } from '@/store/slices/noticeSlice'
import { loadCalEvents } from '@/store/slices/calSlice'
import { loadImproveData } from '@/store/slices/improveSlice'
import { loadReplies } from '@/store/slices/replySlice'

export default function MainLayout() {
  const { pathname } = useLocation()
  const { isAdmin } = useRole()
  const dispatch = useAppDispatch()
  const eqReady = useAppSelector(s => s.eq.ready)
  const workReady = useAppSelector(s => s.work.ready)
  const noticeReady = useAppSelector(s => s.notice.ready)
  const calReady = useAppSelector(s => s.cal.ready)
  const improveReady = useAppSelector(s => s.improve.ready)
  const replyReady = useAppSelector(s => s.reply.ready)

  // 앱 진입 시 데이터 미리 로드. 장비 데이터는 로그인(관리자) 전용이라 게스트일 땐 요청하지 않음.
  // isAdmin 의존 → 로그인 시 effect 재실행으로 장비 데이터 로드(새로고침 불필요).
  useEffect(() => {
    if (isAdmin && !eqReady) dispatch(loadEqData())
    if (!workReady) dispatch(loadWorkData())
    if (!noticeReady) dispatch(loadNoticeData())
    if (!calReady) dispatch(loadCalEvents())
    if (!improveReady) dispatch(loadImproveData())
    if (!replyReady) dispatch(loadReplies())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  // 원본의 body 클래스 토글: 페이지 진입 시 in-page, 장비현황은 eq-wide(넓은 레이아웃)
  useEffect(() => {
    document.body.classList.toggle('in-page', pathname !== '/')
    document.body.classList.toggle('eq-wide', pathname === '/equipment')
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <TopBar />
      <header style={{ height: 0, padding: 0, border: 'none', overflow: 'hidden' }} />
      <div className="app-shell">
        <SideNav />
        <div className="app-content">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </>
  )
}
