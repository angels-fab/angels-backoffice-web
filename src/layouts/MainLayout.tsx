import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import TopBar from './TopBar'
import SideNav from './SideNav'
import BottomNav from './BottomNav'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { loadWorkData } from '@/store/slices/workSlice'
import { loadNoticeData } from '@/store/slices/noticeSlice'

export default function MainLayout() {
  const { pathname } = useLocation()
  const dispatch = useAppDispatch()
  const eqReady = useAppSelector(s => s.eq.ready)
  const workReady = useAppSelector(s => s.work.ready)
  const noticeReady = useAppSelector(s => s.notice.ready)

  // 앱 진입 시 장비/업무/공지 데이터 미리 로드 (홈 미리보기 표시용)
  useEffect(() => {
    if (!eqReady) dispatch(loadEqData())
    if (!workReady) dispatch(loadWorkData())
    if (!noticeReady) dispatch(loadNoticeData())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
