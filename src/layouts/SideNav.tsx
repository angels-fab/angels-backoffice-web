import { useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { alpha } from '@mui/material/styles'
import { NavBadge } from '@/components/ds'
import { iconSize, motion, radius, shadow, typescale, weight, z } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { useAppSelector } from '@/store/hooks'
import { memoCountByPath } from '@/utils/improveMemo'
import { NAV_GROUPS, type NavItem } from '@/constants/nav'
import { useNavBadges } from './useNavBadges'

// PC 전용 좌측 사이드바 (모바일은 하단 탭바). 메뉴 정의는 @/constants/nav(단일 출처).
export default function SideNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const badges = useNavBadges()
  const { isMember, isAdmin, isMaintainer } = useRole()
  // 경로별 활성 개선 메모 건수(장비도입/장비운영은 /equipment로 합산) — 유지보수자(조성범) 전용 앰버 배지
  const improveItems = useAppSelector((s) => s.improve.items)
  const memoCounts = memoCountByPath(improveItems)

  const isActive = (path: string) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/')

  // 팀 콘텐츠(team)는 팀원 이상, 관리자 전용(adminOnly)은 관리자만, 나머지는 전체 공개.
  // 홈은 레일에서 제외(2026-07-23 확정: 로고 클릭=홈) — NAV_GROUPS 자체는 유지(개선위치·모바일 탭바 파생용).
  const canSee = (it: NavItem) => (it.adminOnly ? isAdmin : it.team ? isMember : true)
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee).filter((it) => it.path !== '/') }))
    .filter((g) => g.items.length > 0)

  // 접힘 배지·그룹라벨은 패널 호버/포커스에 반응한다(부모→자식 규칙). className 대신 data-snav 로 건다.
  const railTransition = `opacity ${motion.fast} ${motion.ease}`

  return (
    /* 구 index.css .sidenav/.d-only/.snav-* 를 sx 로 이관(2026-08-01). 값은 그대로.
       z=100(z.sidenav): 페이지 콘텐츠(최대 z30 — Work 스티키 KPI)보다 위, MUI 모달·드로어(1100+)보다 아래.
       53px = 상단바 높이 — 토큰이 없어 리터럴 유지(index.css 모바일 body padding-top:53 과 같은 수). */
    <Box
      component="aside"
      sx={{
        width: '64px',
        flexShrink: 0,
        position: 'sticky',
        top: '53px',
        height: 'calc(100vh - 53px)',
        zIndex: z.sidenav,
        // 구 .d-only(전역 유틸) — 사용처가 여기뿐이라 반응형 display 로 흡수.
        // 셸 분기는 theme.breakpoints 의 'shell'(768) 하나로 통일한다 — 문자열 '(max-width:768px)'는
        // 768 을 포함해서 MUI up('shell')(=min-width:768)과 정확히 768px 한 점에서 둘 다 참이 된다.
        // 그러면 상단바만 PC, 사이드바·하단탭은 모바일인 상태가 1px 폭으로 생긴다.
        display: { xs: 'none', shell: 'block' },
      }}
    >
      {/* 서랍 방식(2026-07-24): 애니메이션을 이름 칸이 아니라 '패널 폭'에 건다. 이름은 항상 제자리에
          렌더되어 있고(아이콘 뒤 22px = 접힘 64px 경계 밖), 패널이 max-width 64↔200으로 커튼처럼
          열리고 닫히며 이름을 드러냈다 가린다. 진입 지연 0·이탈만 .12s(경계 깜빡임 방지). */}
      <Box
        component="nav"
        aria-label="주 메뉴"
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 'max-content',
          minWidth: '64px',
          maxWidth: '64px',
          boxSizing: 'border-box',
          backgroundColor: 'background.default',
          // 구 CSS와 같은 값(--border). divider 는 한 단 옅어 선이 흐려진다
          borderRight: '1px solid var(--border)',
          padding: '18px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto',
          overflowX: 'hidden',
          transition: `max-width 0.3s cubic-bezier(.4,0,.2,1) ${motion.fast},box-shadow 0.3s ${motion.ease} ${motion.fast}`,
          '&:hover, &:focus-within': {
            maxWidth: '200px',
            boxShadow: shadow.md,
            transitionDelay: '0s',
            // 펼치면 그룹명이 뜨고, 헤어라인과 접힘 배지는 사라진다
            '& [data-snav="labeltext"]': { opacity: 1, transitionDelay: '0s' },
            '& [data-snav="label"]::before': { opacity: 0, transitionDelay: '0s' },
            '& [data-snav="rail"]': { opacity: 0 },
          },
          '@media(prefers-reduced-motion:reduce)': {
            '&, & [data-snav="labeltext"], & [data-snav="label"]::before, & [data-snav="rail"]': {
              transition: 'none',
            },
          },
        }}
      >
        {visibleGroups.map((g, i) => (
          <Box key={g.label ?? i} sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* 그룹 라벨 — 접힘 땐 텍스트 대신 헤어라인(요소 높이 고정이라 세로 위치 불변) */}
            {g.label && (
              <Box
                data-snav="label"
                sx={{
                  position: 'relative',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 10px',
                  marginBottom: '5px',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '11px',
                    width: '18px',
                    top: '50%',
                    height: '1px',
                    background: 'var(--border)',
                    transition: `opacity ${motion.fast} ${motion.ease} ${motion.fast}`,
                  },
                }}
              >
                <Box
                  component="span"
                  data-snav="labeltext"
                  sx={{
                    fontSize: typescale.micro.size,
                    fontWeight: weight.bold,
                    color: 'text.disabled',
                    letterSpacing: '.09em',
                    whiteSpace: 'nowrap',
                    opacity: 0,
                    transition: `opacity ${motion.fast} ${motion.ease} ${motion.fast}`,
                  }}
                >
                  {g.label}
                </Box>
              </Box>
            )}
            {g.items.map((item) => {
              const newCnt = item.badgeKey ? badges[item.badgeKey] || 0 : 0
              const memoCnt = isMaintainer ? memoCounts[item.path] || 0 : 0
              const active = isActive(item.path)
              return (
              <Box
                component="button"
                key={item.path}
                // 클릭 후 blur — 포커스가 남으면 focus-within 때문에 마우스가 떠나도 패널이 안 닫힘
                onClick={(e) => { e.currentTarget.blur(); navigate(item.path) }}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  padding: '9px 10px',
                  border: 'none',
                  borderRadius: `${radius.chip}px`,
                  background: 'none',
                  color: active ? 'accentText.blue' : 'text.secondary',
                  fontSize: typescale.body.size,
                  fontWeight: active ? weight.bold : weight.medium,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: `background ${motion.base},color ${motion.base}`,
                  WebkitTapHighlightColor: 'transparent',
                  // 아이콘 가시성(2026-07-23): 20px + 본문보다 밝은 색
                  '& svg': {
                    fontSize: iconSize.header,
                    flexShrink: 0,
                    color: active ? 'accentText.blue' : 'var(--nav-icon)',
                    transition: `color ${motion.base}`,
                  },
                  // 구 CSS에서 .snav-item.active 가 :hover 보다 뒤에 있어 활성 항목은 호버해도 파란 상태를 유지했다
                  ...(active
                    ? {
                        backgroundColor: (t) => alpha(t.palette.accent.blue, 0.12),
                      }
                    : {
                        '&:hover': {
                          backgroundColor: 'background.paper',
                          color: 'text.primary',
                          '& svg': { color: 'text.primary' },
                        },
                      }),
                }}
              >
                {item.icon}
                {/* 접힘 상태 배지 — 아이콘 우상단 빨강 숫자·우하단 앰버 점(펼치면 숨김) */}
                {newCnt > 0 && (
                  <Box
                    component="span"
                    data-snav="rail"
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      top: '2px',
                      left: '24px',
                      minWidth: '14px',
                      height: '14px',
                      padding: '0 3px',
                      borderRadius: `${radius.pill}px`,
                      background: 'var(--red-solid)',
                      color: 'common.white',
                      fontSize: typescale.micro.size,
                      fontWeight: weight.bold,
                      lineHeight: '14px',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      transition: railTransition,
                    }}
                  >
                    {newCnt > 99 ? '99+' : newCnt}
                  </Box>
                )}
                {memoCnt > 0 && (
                  <Box
                    component="span"
                    data-snav="rail"
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '27px',
                      width: '7px',
                      height: '7px',
                      borderRadius: radius.circle,
                      backgroundColor: 'accent.amber',
                      pointerEvents: 'none',
                      transition: railTransition,
                    }}
                  />
                )}
                {/* 메뉴명 칸 — 애니메이션 없음. 항상 제자리에 렌더되고, 접힘 상태에선 패널 64px 경계 밖
                    (아이콘 뒤 22px 간격: 12+10+20+22=64)이라 잘려서 안 보인다. */}
                <Box component="span" sx={{ minWidth: 0 }}>
                  <Box
                    component="span"
                    sx={{
                      minWidth: 0,
                      display: 'inline-flex',
                      alignItems: 'flex-start',
                      gap: '3px',
                      whiteSpace: 'nowrap',
                      paddingLeft: '22px',
                    }}
                  >
                    <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.label}
                    </Box>
                    {/* 준비중 칩 — 완성 전 메뉴 표시(nav.tsx wip 플래그) */}
                    {item.wip && (
                      <Box
                        component="span"
                        sx={{
                          flexShrink: 0,
                          fontSize: typescale.caption.size,
                          lineHeight: 1.5,
                          color: 'accentText.amber',
                          border: '1px solid',
                          borderColor: (t) => alpha(t.palette.accent.amber, 0.45),
                          bgcolor: (t) => alpha(t.palette.accent.amber, 0.12),
                          borderRadius: `${radius.chip}px`,
                          px: '5px',
                        }}
                      >
                        준비중
                      </Box>
                    )}
                    {/* 아이폰식 위첨자 배지(D7 표준): 메뉴명 뒤 위첨자, 빨강=새 글·앰버=개선 메모 나란히 */}
                    {(newCnt > 0 || memoCnt > 0) && (
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '3px', flexShrink: 0, mt: '-2px' }}>
                        <NavBadge count={newCnt} kind="new" />
                        {memoCnt > 0 && (
                          <Tooltip title={`개선 메모 ${memoCnt}건`} placement="top" arrow>
                            {/* Tooltip 자식은 ref 필요 — span 래퍼 */}
                            <Box component="span" sx={{ display: 'inline-flex' }}>
                              <NavBadge count={memoCnt} kind="memo" />
                            </Box>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
              )
            })}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
