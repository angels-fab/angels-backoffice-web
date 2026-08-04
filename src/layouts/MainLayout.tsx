import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import TopBar from './TopBar'
import SideNav from './SideNav'
import BottomNav from './BottomNav'
import WhatsNewDialog from '@/components/WhatsNewDialog'
import StickyMemoLayer from '@/components/StickyMemo'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { loadWorkData } from '@/store/slices/workSlice'
import { loadNoticeData } from '@/store/slices/noticeSlice'
import { loadCalEvents } from '@/store/slices/calSlice'
import { loadImproveData } from '@/store/slices/improveSlice'
import { loadReplies } from '@/store/slices/replySlice'
import { loadUserSettings, setUserName, resetUserSettings } from '@/store/slices/userSettingsSlice'

export default function MainLayout() {
  const { pathname } = useLocation()
  const { loggedIn, isMember, user } = useRole()
  const dispatch = useAppDispatch()
  const eqReady = useAppSelector(s => s.eq.ready)
  const workReady = useAppSelector(s => s.work.ready)
  const noticeReady = useAppSelector(s => s.notice.ready)
  const calReady = useAppSelector(s => s.cal.ready)
  const improveReady = useAppSelector(s => s.improve.ready)
  const replyReady = useAppSelector(s => s.reply.ready)

  // 앱 진입 시 팀 데이터 미리 로드. 팀 콘텐츠·장비는 팀원 이상만 열람하므로 팀원일 때만 요청.
  // (게스트·유관자는 미로드 — 홈 로드맵·행사·바로가기만.) isMember 의존 → 로그인 시 effect 재실행.
  useEffect(() => {
    if (!isMember) return
    if (!eqReady) dispatch(loadEqData())
    if (!workReady) dispatch(loadWorkData())
    if (!noticeReady) dispatch(loadNoticeData())
    if (!calReady) dispatch(loadCalEvents())
    if (!improveReady) dispatch(loadImproveData())
    if (!replyReady) dispatch(loadReplies())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember])

  // 로그인 사용자별 개인화 설정(캘린더·업무 뷰 등) 로드 — 로그아웃 시 초기화(계정 전환 대비)
  useEffect(() => {
    if (loggedIn && user) {
      dispatch(setUserName(user))
      dispatch(loadUserSettings())
    } else {
      dispatch(resetUserSettings())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, user])

  // 원본의 body 클래스 토글: 페이지 진입 시 in-page
  useEffect(() => {
    document.body.classList.toggle('in-page', pathname !== '/')
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <TopBar />
      {/* 앱 골격: 좌 사이드바 + 우 콘텐츠(구 .app-shell/.app-content) */}
      <Box sx={{ display: 'flex', flex: 1, width: '100%', alignItems: 'stretch' }}>
        <SideNav />
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </Box>
      </Box>
      <BottomNav />
      {/* 이 화면에 붙은 개선요청 쪽지(PC 전용) — 콘텐츠 위에 고정으로 뜬다 */}
      <StickyMemoLayer />
      {/* 새 기능 안내(개인화) — 팀원+ 로그인 후 계정당 1회(whatsnew.seen 버전 저장) */}
      <WhatsNewDialog />
    </>
  )
}
