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
 *  구분(아이콘) → 시간 → 제목 → 해당자.
 *  해당자 표시(알약형 둥근 사각형 칩):
 *   - 첫 해당자는 이름이 보이고, 나머지는 첫 칩 뒤로 깊게 포개어 고유색 초승달 조각만 보임.
 *   - 겹침 순서 = 첫 해당자가 가장 위, 마지막이 가장 아래(z-index).
 *   - 주간 2줄: 둘째 줄에 전체 해당자 이름 칩을 +N 없이, 오른쪽 정렬로 표시.
 *  해당자 위치:
 *   - 단일/주 짧은 일정: 한 칸 오른쪽 끝.
 *   - 멀티데이: 첫 칸 오른쪽 끝(첫 칸을 넘칠 만큼 제목이 길면 제목 바로 뒤).
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

const PILL_H = 21
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
}

/** 이름이 보이는 알약형 칩(첫 해당자·주간 전체) */
function NamePill({ text, color }: { text: string; color: string }) {
  return (
    <Box
      sx={{
        height: PILL_H,
        display: 'inline-flex',
        alignItems: 'center',
        px: '7px',
        borderRadius: `${PILL_H / 2}px`,
        bgcolor: color,
        color: '#fff',
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
        flex: 'none',
        border: '1px solid rgba(255,255,255,.28)',
        boxShadow: '0 0 0 0.5px rgba(0,0,0,.25)',
      }}
    >
      {text}
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
            <Box sx={{ width: REST_W, height: PILL_H, borderRadius: `${PILL_H / 2}px`, bgcolor: p.color, border: '1px solid rgba(255,255,255,.28)' }} />
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

export default function ChipContent({ participants, catKey, catColor, time, title, variant = 'daygrid', multiDay }: ChipContentProps) {
  const Icon = CAT_ICON[catKey]
  const iconSx = { fontSize: 16, color: catColor, flex: 'none', ...(catKey === 'trip_intl' ? { transform: 'rotate(45deg)' } : {}) }
  const timeSx = { fontSize: 11.5, fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' } as const
  const titleSx = { flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 } as const

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
      setTwoLine(h >= 46)
    }
    measure()
    const el = host()
    const ro = new ResizeObserver(measure)
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [variant, participants.length, title])

  // 월간 멀티데이: 좌블록 최소폭=첫 칸 폭에 맞춰 해당자 묶음을 첫 칸 오른쪽 끝에 정렬.
  // 알약 칩은 폭이 가변이라 그룹 실제 폭을 측정해 reserve 계산.
  const [reserve, setReserve] = useState(0)
  useLayoutEffect(() => {
    if (variant !== 'daygrid' || !multiDay) {
      setReserve(0)
      return
    }
    const measure = () => {
      const cell = document.querySelector('.fc-daygrid-day') as HTMLElement | null
      const cw = cell ? cell.getBoundingClientRect().width : 0
      const gw = groupRef.current ? groupRef.current.getBoundingClientRect().width : 0
      setReserve(cw > 0 ? Math.max(40, cw - gw - 14) : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (rootRef.current) ro.observe(rootRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [variant, multiDay, participants])

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
