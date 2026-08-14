import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import BeachAccessIcon from '@mui/icons-material/BeachAccess'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import { typescale, iconSize, radius, weight } from '@/theme/tokens'
import { CAT_META } from './catMeta'
import type { RealCat } from './catMeta'

/**
 * 달력 일정 칩 내용.
 *  구분(아이콘) → 시간 → 제목 → 해당자.
 *  해당자 표시(알약형 둥근 사각형 칩):
 *   - 첫 해당자는 이름이 보이고, 나머지는 첫 칩 뒤로 깊게 포개어 고유색 초승달 조각만 보임.
 *   - 겹침 순서 = 첫 해당자가 가장 위, 마지막이 가장 아래(z-index).
 *   - 주간 2줄: 둘째 줄에 전체 해당자 이름 칩을 +N 없이, 오른쪽 정렬로 표시.
 *  해당자 위치:
 *   - 단일/주 짧은 일정: 한 칸 오른쪽 끝.
 *   - 멀티데이: 첫 칸 오른쪽 끝(첫 칸을 넘칠 만큼 제목이 길면 제목 바로 뒤).
 */
export const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  work: WorkIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  leave: BeachAccessIcon,
  etc: MoreHorizIcon,
}

const PILL_H = 21
const CHIP_RADIUS = radius.chip // 모서리만 둥근 작은 사각형(알약/트랙 형태 아님)
const REST_W = 14 // 이름 없는 뒤쪽 칩의 폭
const SLIVER = 5 // 겹쳤을 때 보이는 초승달 폭 (REST_W - SLIVER 만큼 겹침)

export interface Participant {
  initials: string
  color: string
}

export interface ChipContentProps {
  participants: Participant[]
  catKey: RealCat
  catColor: string
  time?: string
  title: string
  /** 'daygrid'=월간·주 종일행 / 'timed'=주 시간표 시간일정 */
  variant?: 'daygrid' | 'timed'
  /** 멀티데이(여러 날 span) — daygrid에서 해당자를 첫 칸 우측 끝에 맞추기 위함 */
  multiDay?: boolean
  /**
   * 모바일 좁은칸(≤768px + 월간·주간) 전용 — 칸이 ≈66px(주말 숨김 5열)뿐이라 한 줄에
   * 아이콘·시간·제목·해당자를 다 넣으면 제목 몫이 0px이 된다(개선요청 #59).
   */
  compact?: boolean
  /**
   * 목록(listMonth) 전용 — 아이콘만 박지 않고 종류칩(아이콘+이름)을 단다.
   * 시간은 FullCalendar 가 왼쪽 셀에 따로 그리고, 그 셀을 12px로 줄여 제목칸이 넓어진 만큼 쓴다.
   */
  catChip?: boolean
  /**
   * 제목만 한 줄(2026-08-14 사용자 지시 — 모바일 월간). 아이콘·시간을 지워 66px 칸을 제목이
   * 전부 쓴다. 숨긴 정보는 탭하면 뜨는 상세 카드가 보여 준다(EventPopover).
   */
  titleOnly?: boolean
}

/** 이름이 보이는 알약형 칩(첫 해당자·주간 전체) */
function NamePill({ text, color }: { text: string; color: string }) {
  return (
    <Box
      sx={{
        height: PILL_H,
        display: 'inline-flex',
        alignItems: 'center',
        px: '5px',
        borderRadius: `${CHIP_RADIUS}px`,
        bgcolor: color,
        color: 'common.white',
        fontSize: typescale.small.size,
        fontWeight: typescale.emphasis.weight,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        flex: 'none',
        border: '1px solid rgba(255,255,255,.28)',
        boxShadow: '0 0 0 0.5px rgba(0,0,0,.25)', /* design-lint-ok(shadow): 0 0 0 = 0.5px 헤어라인 테두리(레이아웃을 밀지 않으려고 boxShadow 로 그린다) */
      }}
    >
      {/* 한글 잉크 상단쏠림 보정 — ManagerChip과 동일하게 글자만 0.5px 하향(실측 중앙정렬) */}
      <Box component="span" sx={{ display: 'inline-block', transform: 'translateY(0.5px)' }}>{text}</Box>
    </Box>
  )
}

/** 한 줄 — 첫 칩=이름, 나머지=깊게 포갠 초승달(색 조각). 첫번째가 위(z-index 큼). */
function PillStack({ participants, refEl }: { participants: Participant[]; refEl?: React.Ref<HTMLDivElement> }) {
  return (
    <Box ref={refEl} sx={{ flex: 'none', display: 'flex', alignItems: 'center' }}>
      {participants.map((p, i) => (
        <Box key={i} sx={{ position: 'relative', zIndex: participants.length - i, ml: i === 0 ? 0 : `-${REST_W - SLIVER}px` }}>
          {i === 0 ? (
            <NamePill text={p.initials} color={p.color} />
          ) : (
            <Box sx={{ width: REST_W, height: PILL_H, borderRadius: `${CHIP_RADIUS}px`, bgcolor: p.color, border: '1px solid rgba(255,255,255,.28)' }} />
          )}
        </Box>
      ))}
    </Box>
  )
}

/** 주간 2줄 둘째 줄 — 전체 해당자 이름 칩(+N 없음), 오른쪽 정렬. 공간 부족 시 줄바꿈. */
function NameRow({ participants }: { participants: Participant[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '3px', mt: '3px' }}>
      {participants.map((p, i) => (
        <NamePill key={i} text={p.initials} color={p.color} />
      ))}
    </Box>
  )
}

export default function ChipContent({ participants, catKey, catColor, time, title, variant = 'daygrid', multiDay, compact, catChip, titleOnly }: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  // 아이콘 색은 채움색(catColor)이 아니라 글자용 짝 — 자기 색 18% 틴트 위에 원색을 얹으면
  // 라이트에서 2.0:1(비문자 기준 3:1 미달)로 사라진다. 칩에 종류 '글자'가 없어 이 아이콘이 유일한 표식.
  const tone = CAT_META[catKey].tone
  const iconSx = {
    fontSize: iconSize.body,
    color: tone === 'neutral' ? 'text.primary' : `accentText.${tone}`,
    flex: 'none',
    ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}),
  }
  // 목록·월간·주간 세 뷰의 글자를 12px/500/자간 -0.05em 으로 통일(사용자 지시 2026-08-08).
  // 구글캘린더 모바일 실측(12px/500)과 같은 크기·굵기이고, 자간은 그보다 한 단 좁혀 글자를 더 담는다.
  const timeSx = { fontSize: typescale.small.size, fontWeight: weight.medium, letterSpacing: '-0.05em', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' } as const
  const titleSx = { flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: typescale.small.size, fontWeight: weight.medium, letterSpacing: '-0.05em', lineHeight: 1.4 } as const

  const rootRef = useRef<HTMLDivElement | null>(null)
  const groupRef = useRef<HTMLDivElement | null>(null)

  // 주 시간표: 세로로 충분하면(여러 시간 칸) 2줄(아이콘·시간·제목 / 해당자), 아니면 1줄.
  const [twoLine, setTwoLine] = useState(false)
  useLayoutEffect(() => {
    if (variant !== 'timed') {
      setTwoLine(false)
      return
    }
    const host = () => rootRef.current?.closest('.fc-timegrid-event') as HTMLElement | null
    const measure = () => {
      const h = host()?.clientHeight ?? rootRef.current?.parentElement?.clientHeight ?? 0
      // compact 2줄은 12px×1.4 두 줄 + 패딩 ≈ 36px면 들어간다. 46은 해당자 이름줄까지 있던 옛 배치의 기준이라
      // 1시간 칩(슬롯 40px)이 전부 1줄로 떨어져 제목이 0px로 짜부라졌다(사용자 캡처 2026-08-08).
      setTwoLine(h >= (compact ? 34 : 46))
    }
    measure()
    const el = host()
    const ro = new ResizeObserver(measure)
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [variant, participants.length, title, compact])

  // 월간 멀티데이: 해당자 그룹의 오른쪽 끝을 '단일 일정의 첫 칸 오른쪽 끝'과 동일 x좌표로.
  // 멀티데이는 abs harness라 좌측 정렬이 단일과 달라, 단일(인플로우) 일정의 '셀 우측 - event-main 우측'
  // 인셋을 실제로 측정해 재사용 → group.right = 막대 시작 셀.right - 단일우측인셋 (막대 자체 좌측 오프셋과 무관).
  const [reserve, setReserve] = useState(0)
  useLayoutEffect(() => {
    // compact(해당자 미표시)·목록(격자 자체가 없음)은 맞출 대상이 없다 — 측정을 건너뛴다
    if (variant !== 'daygrid' || !multiDay || compact || catChip) {
      setReserve(0)
      return
    }
    const measure = () => {
      const root = rootRef.current
      if (!root) return
      const rr = root.getBoundingClientRect()
      const cells = Array.from(document.querySelectorAll('.fc-daygrid-day')) as HTMLElement[]
      const firstCell = cells.find((c) => {
        const r = c.getBoundingClientRect()
        return rr.left >= r.left - 1 && rr.left < r.right
      })
      if (!firstCell) return
      // 단일(인플로우, abs 아님) 일정의 우측 인셋 측정
      let singleRightInset = 0
      const ref = (Array.from(document.querySelectorAll('.fc-daygrid-event')) as HTMLElement[]).find(
        (el) => !el.closest('.fc-daygrid-event-harness-abs') && el.querySelector('.fc-event-main'),
      )
      const refMain = ref?.querySelector('.fc-event-main') as HTMLElement | null
      const refCell = ref?.closest('.fc-daygrid-day') as HTMLElement | null
      if (refMain && refCell) {
        singleRightInset = refCell.getBoundingClientRect().right - refMain.getBoundingClientRect().right
      }
      const targetRight = firstCell.getBoundingClientRect().right - singleRightInset
      const gw = groupRef.current ? groupRef.current.getBoundingClientRect().width : 0
      setReserve(Math.max(24, targetRight - rr.left - 5 - gw)) // 5 = 좌블록↔해당자 gap
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [variant, multiDay, participants, compact, catChip])

  // ── 목록(listMonth) — 종류칩 + 제목 + 해당자 (사용자 지시 2026-08-08) ──
  // 시간·종일은 FullCalendar 가 왼쪽 셀에 그린다. 그 셀이 font-size 지정 없이 브라우저 기본 16px로
  // 렌더되고 있었고(실측), 12px로 줄이자 제목칸이 왼쪽으로 그만큼 넓어졌다 — 그 폭을 종류칩에 쓴다.
  // 앞의 색 점(.fc-list-event-dot)은 종류칩이 색과 이름을 다 말해 주므로 index.css 에서 지웠다.
  if (catChip) {
    return (
      <Box ref={rootRef} sx={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, width: '100%' }}>
        {/* 필터바 종류칩(CalFilterBar CatChip = TintChip on)과 같은 규격 — 높이 24·pill·틴트 .18·테두리 .6.
            같은 종류가 필터와 목록에서 다르게 보이지 않게 값을 그대로 맞춘다(사용자 지시 2026-08-08). */}
        <Box
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: '5px', flex: 'none',
            height: 24, boxSizing: 'border-box', px: '9px', lineHeight: 1,
            borderRadius: `${radius.pill}px`,
            bgcolor: alpha(catColor, 0.18), border: '1px solid', borderColor: alpha(catColor, 0.6),
            '& > span': { transform: 'translateY(0.5px)' },
          }}
        >
          <Icon sx={{ fontSize: iconSize.caption, color: catColor, ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }} />
          <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: weight.semibold, letterSpacing: '-0.05em', color: 'text.primary' }}>
            {CAT_META[catKey].label.split('/')[0]}
          </Box>
        </Box>
        <Box component="span" sx={{ ...titleSx, flex: 1 }}>{title}</Box>
        {participants.length > 0 && <PillStack participants={participants} />}
      </Box>
    )
  }

  // ── 모바일 좁은칸(compact) — 월간·주간 공통. 사용자 확정 2026-08-08 ──
  // 칸 ≈66px(주말 숨김 5열) 중 칩 내부에 쓸 수 있는 폭은 52px뿐이다. 넷을 한 줄에 두면 제목이 0px이 되므로
  //  · 당일 일정 = 2줄. 윗줄에 아이콘·시간을 몰아 두고 아랫줄 제목이 52px 전부를 쓴다(한글 5자).
  //  · 구간(멀티데이) 막대 = 1줄 유지. 여러 칸에 걸쳐 폭이 넉넉하다.
  //  · 해당자는 안 그린다 — 윗줄 예산 52px이 아이콘 13 + 시간 30 + 간격 3 = 46px으로 이미 찬다.
  //    (색점 3개를 더하면 71px로 넘친다 — 시안에서 실측 확인)
  if (compact) {
    // 제목만(모바일 월간·주간, 2026-08-14) — 아이콘·시간을 지우고 칸 전체를 제목이 쓴다.
    // 숨긴 정보는 탭하면 뜨는 상세 카드가 보여 준다. 당일/멀티데이 구분 없이 같은 모양.
    // 주간 시간일정은 칸이 세로로 넉넉하면(twoLine) 두 줄까지, 그 외(월간·종일행·낮은 칸)는 한 줄.
    if (titleOnly) {
      const clamp2 = variant === 'timed' && twoLine
      return (
        <Box ref={rootRef} sx={{ display: 'flex', alignItems: 'center', minWidth: 0, width: '100%', overflow: 'hidden' }}>
          <Box
            component="span"
            sx={clamp2
              ? { ...titleSx, whiteSpace: 'normal', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflowWrap: 'anywhere' }
              : titleSx}
          >
            {title}
          </Box>
        </Box>
      )
    }
    const cIconSx = { ...iconSx, fontSize: iconSize.caption }
    // 구간 막대 / 낮은 시간일정(2줄이 잘리는 높이)은 1줄로
    if ((variant === 'daygrid' && multiDay) || (variant === 'timed' && !twoLine)) {
      return (
        <Box ref={rootRef} sx={{ display: 'flex', alignItems: 'center', gap: '3px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
          <Icon sx={cIconSx} />
          {variant === 'timed' && time && <Box component="span" sx={timeSx}>{time}</Box>}
          <Box component="span" sx={titleSx}>{title}</Box>
        </Box>
      )
    }
    return (
      <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3px', minWidth: 0 }}>
          <Icon sx={cIconSx} />
          {time && <Box component="span" sx={timeSx}>{time}</Box>}
        </Box>
        <Box component="span" sx={{ ...titleSx, flex: 'none' }}>{title}</Box>
      </Box>
    )
  }

  // ── 주 시간표 2줄 ──
  if (variant === 'timed' && twoLine) {
    return (
      <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
          <Icon sx={iconSx} />
          {time && (
            <Box component="span" sx={timeSx}>
              {time}
            </Box>
          )}
          <Box component="span" sx={titleSx}>
            {title}
          </Box>
        </Box>
        {participants.length > 0 && <NameRow participants={participants} />}
      </Box>
    )
  }

  // ── 한 줄 ──
  const isMulti = variant === 'daygrid' && multiDay
  const leftSx = isMulti
    ? { display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: '0 1 auto', ...(reserve ? { minWidth: `${reserve}px` } : null) }
    : { display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, flex: 1 }

  return (
    <Box ref={rootRef} sx={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, width: '100%', overflow: 'hidden' }}>
      <Box sx={leftSx}>
        <Icon sx={iconSx} />
        {time && (
          <Box component="span" sx={timeSx}>
            {time}
          </Box>
        )}
        <Box component="span" sx={titleSx}>
          {title}
        </Box>
      </Box>
      {participants.length > 0 && <PillStack participants={participants} refEl={groupRef} />}
    </Box>
  )
}
