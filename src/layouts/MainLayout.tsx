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
  const { role, isAdmin } = useRole()
  const loggedIn = role !== 'guest'
  const dispatch = useAppDispatch()
  const eqReady = useAppSelector(s => s.eq.ready)
  const workReady = useAppSelector(s => s.work.ready)
  const noticeReady = useAppSelector(s => s.notice.ready)
  const calReady = useAppSelector(s => s.cal.ready)
  const improveReady = useAppSelector(s => s.improve.ready)
  const replyReady = useAppSelector(s => s.reply.ready)

  // 앱 진입 시 데이터 미리 로드. 사내 데이터는 로그인해야 읽히므로(RLS: authenticated) 게스트일 땐 요청하지 않음.
  // 장비 데이터는 관리자 전용. loggedIn/isAdmin 의존 → 로그인 시 effect 재실행으로 로드(새로고침 불필요).
  useEffect(() => {
    if (!loggedIn) return // 게스트: 사내 데이터 미로드(홈은 공개 로드맵만 노출)
    if (isAdmin && !eqReady) dispatch(loadEqData())
    if (!workReady) dispatch(loadWorkData())
    if (!noticeReady) dispatch(loadNoticeData())
    if (!calReady) dispatch(loadCalEvents())
    if (!improveReady) dispatch(loadImproveData())
    if (!replyReady) dispatch(loadReplies())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, isAdmin])

  // 원본의 body 클래스 토글: 페이지 진입 시 in-page
  useEffect(() => {
    document.body.classList.toggle('in-page', pathname !== '/')
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
