import type { ReactNode } from 'react'
import HomeIcon from '@mui/icons-material/Home'
import CampaignIcon from '@mui/icons-material/Campaign'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AssessmentIcon from '@mui/icons-material/Assessment'
import MonitorIcon from '@mui/icons-material/Monitor'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined'
import LinkIcon from '@mui/icons-material/Link'
import SettingsIcon from '@mui/icons-material/Settings'

/**
 * 내비게이션 메뉴 — 단일 출처.
 * SideNav 렌더에 쓰이고, 포털개선요청 '개선위치' 옵션도 여기서 파생한다.
 * 메뉴를 추가/삭제하면 사이드바와 개선위치 드롭다운에 함께 반영된다.
 */

export type NavBadgeKey = 'notice' | 'work' | 'improve'

export interface NavItem {
  icon: ReactNode
  label: string
  path: string
  /** 새 글 배지 키(useNavBadges) — 있으면 배지 표시 */
  badgeKey?: NavBadgeKey
  /** 팀원 이상만 노출(팀 콘텐츠) */
  team?: boolean
  /** 관리자만 노출 */
  adminOnly?: boolean
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ icon: <HomeIcon />, label: '홈', path: '/' }] },
  {
    label: '업무',
    items: [
      { icon: <CampaignIcon />, label: '공지사항', path: '/notice', badgeKey: 'notice', team: true },
      { icon: <CalendarMonthIcon />, label: '업무일정', path: '/calendar', team: true },
      { icon: <AssessmentIcon />, label: '업무현황', path: '/work', badgeKey: 'work', team: true },
      { icon: <MonitorIcon />, label: '장비관리', path: '/equipment', team: true },
    ],
  },
  {
    label: '정보',
    items: [
      { icon: <CoPresentIcon />, label: '학술·교육·전시', path: '/events' },
      { icon: <LightbulbOutlinedIcon />, label: '포털개선요청', path: '/improve', badgeKey: 'improve', team: true },
      { icon: <LinkIcon />, label: '바로가기', path: '/links' },
      { icon: <SettingsIcon />, label: '설정', path: '/settings', adminOnly: true },
    ],
  },
]

/** 평면 메뉴 목록 */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
/** 메뉴 라벨 목록 — 개선요청 개선위치 옵션 등 파생용 */
export const NAV_LABELS: string[] = NAV_ITEMS.map((i) => i.label)
