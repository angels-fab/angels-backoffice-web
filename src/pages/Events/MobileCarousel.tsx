import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { EmptyState } from '@/components/ds'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { eventStatus, type FabEvent } from '@/constants/events'
import { EventCardInner } from './eventCard'

type StatusKey = 'live' | 'upcoming' | 'ended'

const STATUS_META: { key: StatusKey; tab: string; title: string; tone: 'green' | 'amber' | 'gray' }[] = [
  { key: 'live', tab: '진행중', title: '진행 중인 행사', tone: 'green' },
  { key: 'upcoming', tab: '예정', title: '예정된 행사', tone: 'amber' },
  { key: 'ended', tab: '종료', title: '종료된 행사', tone: 'gray' },
]

// eventStatus 결과(tone) → 탭 분류
function toStatusKey(e: FabEvent): StatusKey {
  const t = eventStatus(e.start, e.end).tone
  return t === 'green' ? 'live' : t === 'amber' ? 'upcoming' : 'ended'
}

const toneHex = (th: Theme, tone: 'green' | 'amber' | 'gray') =>
  tone === 'green' ? th.palette.accent.green : tone === 'amber' ? th.palette.accent.amber : th.palette.text.disabled

/** 카드 한 장 — 스와이프(드래그)와 짧은 탭을 구분해 토글. 사이트 링크 클릭은 토글로 전파 안 됨. */
function MobileCard({ e, open, onToggle }: { e: FabEvent; open: boolean; onToggle: () => void }) {
  const drag = useRef({ x: 0, y: 0, moved: false })
  return (
    <Box
      data-card="true"
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${e.title} 상세 ${open ? '닫기' : '열기'}`}
      onPointerDown={(ev) => { drag.current = { x: ev.clientX, y: ev.clientY, moved: false } }}
      onPointerMove={(ev) => {
        if (Math.abs(ev.clientX - drag.current.x) > 9 || Math.abs(ev.clientY - drag.current.y) > 9) drag.current.moved = true
      }}
      onClick={(ev) => {
        if (drag.current.moved) return // 스와이프(드래그) 후에는 토글 금지
        if ((ev.target as HTMLElement).closest('a, button')) return // 사이트 링크 등은 카드 토글 안 함
        onToggle()
      }}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle() } }}
      sx={{
        scrollSnapAlign: 'center',
        minWidth: 0,
        borderRadius: '18px',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        boxShadow: open ? '0 14px 34px rgba(0,0,0,.5)' : '0 10px 26px rgba(0,0,0,.34)',
        transition: 'box-shadow .2s ease',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <EventCardInner e={e} open={open} />
    </Box>
  )
}

/**
 * 모바일(<=768px) 전용: 상태별 스냅 캐러셀 + 인카드 상세 리빌.
 * - 세 상태 패널을 모두 마운트하고 비활성만 display:none → scrollLeft·open 상태 보존.
 * - 카드 열림은 행사 id별 전역 Set(탭 무관) → 탭을 오가도 유지, React 상태라 탭 전환만으로는
 *   transform/scrim이 바뀌지 않아 애니메이션이 재생되지 않음(사용자 토글 때만 재생).
 */
export default function MobileCarousel({ events }: { events: FabEvent[] }) {
  const groups = useMemo(() => {
    const g: Record<StatusKey, FabEvent[]> = { live: [], upcoming: [], ended: [] }
    events.forEach((e) => g[toStatusKey(e)].push(e))
    return g
  }, [events])

  const [active, setActive] = useState<StatusKey>(() =>
    groups.live.length ? 'live' : groups.upcoming.length ? 'upcoming' : 'ended',
  )
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [pager, setPager] = useState<Record<StatusKey, number>>({ live: 0, upcoming: 0, ended: 0 })

  const railRefs = useRef<Record<StatusKey, HTMLDivElement | null>>({ live: null, upcoming: null, ended: null })
  const scrollPos = useRef<Record<StatusKey, number>>({ live: 0, upcoming: 0, ended: 0 })

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // 탭 전환 시: display 토글로 0이 된 scrollLeft를 마지막 위치로 복원(탭별 위치 기억).
  useLayoutEffect(() => {
    const rail = railRefs.current[active]
    if (rail) rail.scrollLeft = scrollPos.current[active]
  }, [active])

  // 스크롤 중: 위치 저장 + 화면 중앙에 가장 가까운 카드로 페이저 갱신.
  const onRailScroll = (key: StatusKey) => {
    const rail = railRefs.current[key]
    if (!rail) return
    scrollPos.current[key] = rail.scrollLeft
    const cards = rail.querySelectorAll<HTMLElement>('[data-card]')
    if (!cards.length) return
    const center = rail.scrollLeft + rail.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    cards.forEach((c, i) => {
      const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    setPager((prev) => (prev[key] === best ? prev : { ...prev, [key]: best }))
  }

  return (
    <Box>
      {/* 상태 탭 (진행중·예정·종료 + 건수) */}
      <Box
        role="tablist"
        aria-label="행사 상태"
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '5px',
          p: '4px',
          mb: '14px',
          borderRadius: '14px',
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {STATUS_META.map(({ key, tab, tone }) => {
          const selected = key === active
          const count = groups[key].length
          return (
            <Box
              key={key}
              component="button"
              type="button"
              role="tab"
              id={`evt-tab-${key}`}
              aria-selected={selected}
              aria-controls={`evt-panel-${key}`}
              onClick={() => setActive(key)}
              sx={(th) => {
                const hex = toneHex(th, tone)
                const onColor = th.palette.getContrastText(hex)
                return {
                  minHeight: 44,
                  border: 0,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: 13,
                  fontWeight: 750,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background-color .18s ease, color .18s ease, box-shadow .18s ease',
                  color: selected ? onColor : hex,
                  bgcolor: selected ? hex : alpha(hex, 0.09),
                  boxShadow: selected ? `0 5px 16px ${alpha(hex, 0.28)}` : 'none',
                  '&:hover': { bgcolor: selected ? hex : alpha(hex, 0.16) },
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }
              }}
            >
              {tab}
              <Box
                component="span"
                aria-hidden
                sx={(th) => ({
                  display: 'inline-grid',
                  placeItems: 'center',
                  minWidth: 20,
                  height: 20,
                  px: '5px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  bgcolor: selected
                    ? tone === 'amber'
                      ? 'rgba(0,0,0,.16)'
                      : 'rgba(255,255,255,.22)'
                    : alpha(th.palette.text.primary, 0.09),
                })}
              >
                {count}
              </Box>
            </Box>
          )
        })}
      </Box>

      {/* 패널: 세 상태 모두 마운트, 비활성은 display:none (scrollLeft·open 보존) */}
      {STATUS_META.map(({ key, title }) => {
        const list = groups[key]
        const selected = key === active
        return (
          <Box
            key={key}
            role="tabpanel"
            id={`evt-panel-${key}`}
            aria-labelledby={`evt-tab-${key}`}
            sx={{ display: selected ? 'block' : 'none' }}
          >
            {/* 섹션 헤드 */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: '4px', pb: '11px' }}>
              <Box sx={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.02em', color: 'text.primary' }}>{title}</Box>
              <Box sx={{ fontSize: 11.5, color: 'text.secondary' }}>카드를 누르면 상세가 열립니다</Box>
            </Box>

            {list.length === 0 ? (
              <Box sx={{ px: '4px', pb: '8px' }}>
                <EmptyState icon={<CoPresentIcon />} title="해당하는 행사가 없습니다" description="이 상태의 행사가 등록되면 여기에 표시됩니다." />
              </Box>
            ) : (
              <>
                {/* 스냅 레일 — 카드 86%, 다음 카드 살짝 보임 */}
                <Box
                  ref={(el: HTMLDivElement | null) => { railRefs.current[key] = el }}
                  onScroll={() => onRailScroll(key)}
                  sx={{
                    display: 'grid',
                    gridAutoFlow: 'column',
                    gridAutoColumns: '86%',
                    gap: '12px',
                    overflowX: 'auto',
                    overscrollBehaviorInline: 'contain',
                    scrollSnapType: 'x mandatory',
                    scrollPaddingInline: '4px',
                    px: '4px',
                    pb: '12px',
                    scrollbarWidth: 'none',
                    touchAction: 'pan-x pan-y',
                    '&::-webkit-scrollbar': { display: 'none' },
                  }}
                >
                  {list.map((e) => (
                    <MobileCard key={e.id} e={e} open={openIds.has(e.id)} onToggle={() => toggleOpen(e.id)} />
                  ))}
                </Box>

                {/* 위치 표시 1 / N */}
                <Box
                  aria-live="polite"
                  sx={{
                    minHeight: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '9px',
                    color: 'text.secondary',
                    fontSize: 12,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    '&::before, &::after': { content: '""', width: 30, height: '1px', bgcolor: 'divider' },
                  }}
                >
                  {(pager[key] ?? 0) + 1} / {list.length}
                </Box>
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
