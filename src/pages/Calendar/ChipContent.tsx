import { useLayoutEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import GroupsIcon from '@mui/icons-material/Groups'
import WorkIcon from '@mui/icons-material/Work'
import SchoolIcon from '@mui/icons-material/School'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import FlightIcon from '@mui/icons-material/Flight'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import type { SvgIconComponent } from '@mui/icons-material'
import type { RealCat } from './catMeta'

/**
 * 달력 일정 칩 내용.
 *  구분(아이콘) → 시간 → 장소-목적(말줄임) → 해당자.
 *  해당자 표시:
 *   - 월간/한 줄: 첫 해당자는 이름이 보이고, 나머지는 첫 칩 뒤로 포개어 초승달(색만)로만 보임.
 *     겹침 순서 = 첫 해당자가 가장 위, 마지막이 가장 아래(z-index).
 *   - 주간 2줄: 둘째 줄에 전체 해당자 이름을 +N 없이 모두 표시(공간 부족 시 줄바꿈).
 *  해당자 위치:
 *   - 단일/주 짧은 일정: 한 칸 오른쪽 끝.
 *   - 멀티데이: 첫 칸 오른쪽 끝(첫 칸을 넘칠 만큼 제목이 길면 제목 바로 뒤로 밀림).
 */
const CAT_ICON: Record<RealCat, SvgIconComponent> = {
  meeting: GroupsIcon,
  work: WorkIcon,
  edu: SchoolIcon,
  recruit: PersonAddAlt1Icon,
  trip_dom: DirectionsCarIcon,
  trip_intl: FlightIcon,
  etc: MoreHorizIcon,
}

const AVATAR = 20
const PEEK = 7 // 포갤 때 보이는 초승달 폭
const OVERLAP = AVATAR - PEEK // = 13

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
}

/** 이름이 보이는 원형 칩(첫 해당자·주간 전체) */
function NameCircle({ text, color }: { text: string; color: string }) {
  return (
    <Box
      sx={{
        width: AVATAR,
        height: AVATAR,
        borderRadius: '50%',
        bgcolor: color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '-0.04em',
        flex: 'none',
        border: '1px solid rgba(255,255,255,.3)',
      }}
    >
      {text}
    </Box>
  )
}

/** 월간/한 줄 — 첫 칩=이름, 나머지=첫 칩 뒤로 포갠 초승달(색만). 첫번째가 위(z-index 큼). */
function CrescentStack({ participants }: { participants: Participant[] }) {
  return (
    <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', pl: '1px' }}>
      {participants.map((p, i) => (
        <Box key={i} sx={{ position: 'relative', zIndex: participants.length - i, ml: i === 0 ? 0 : `-${OVERLAP}px` }}>
          {i === 0 ? (
            <NameCircle text={p.initials} color={p.color} />
          ) : (
            <Box sx={{ width: AVATAR, height: AVATAR, borderRadius: '50%', bgcolor: p.color, border: '1px solid rgba(255,255,255,.3)' }} />
          )}
        </Box>
      ))}
    </Box>
  )
}

/** 주간 2줄 둘째 줄 — 전체 해당자 이름(+N 없음). 겹치지 않게 배치(부족하면 줄바꿈), 순서 z-index 유지. */
function NameRow({ participants }: { participants: Participant[] }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px', mt: '2px' }}>
      {participants.map((p, i) => (
        <Box key={i} sx={{ position: 'relative', zIndex: participants.length - i }}>
          <NameCircle text={p.initials} color={p.color} />
        </Box>
      ))}
    </Box>
  )
}

export default function ChipContent({ participants, catKey, catColor, time, title, variant = 'daygrid', multiDay }: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  const iconSx = { fontSize: 16, color: catColor, flex: 'none', ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }
  const timeSx = { fontSize: 11.5, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' } as const
  const titleSx = { flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 } as const

  const rootRef = useRef<HTMLDivElement | null>(null)

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
      setTwoLine(h >= 44)
    }
    measure()
    const el = host()
    const ro = new ResizeObserver(measure)
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [variant, participants.length, title])

  // 월간 멀티데이: 좌블록 최소폭=첫 칸 폭에 맞춰 해당자 묶음을 첫 칸 오른쪽 끝에 정렬.
  const [reserve, setReserve] = useState(0)
  useLayoutEffect(() => {
    if (variant !== 'daygrid' || !multiDay) {
      setReserve(0)
      return
    }
    const groupW = participants.length ? AVATAR + (participants.length - 1) * PEEK : 0
    const measure = () => {
      const cell = document.querySelector('.fc-daygrid-day') as HTMLElement | null
      const cw = cell ? cell.getBoundingClientRect().width : 0
      setReserve(cw > 0 ? Math.max(40, cw - groupW - 14) : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [variant, multiDay, participants.length])

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
  // 멀티데이: 좌블록 min-width=첫 칸 폭 → 해당자가 첫 칸 우측 끝. 제목이 길면 제목 뒤로 밀려(바 끝까지 사용) 말줄임.
  // 그 외(단일·주 짧은 일정): 제목 flex:1 → 해당자 묶음을 한 칸 우측 끝에.
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
      {participants.length > 0 && <CrescentStack participants={participants} />}
    </Box>
  )
}
