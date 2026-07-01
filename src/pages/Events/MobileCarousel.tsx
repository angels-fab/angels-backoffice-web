import { useCallback, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { EmptyState } from '@/components/ds'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { type FabEvent } from '@/constants/events'
import { EventCardInner } from './eventCard'

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
 * 모바일(<=768px) 진행·예정 캐러셀 — 단일 스냅 레일 + 인카드 상세 리빌.
 * 상태 분류(진행·예정 / 종료)는 상위 페이지 탭이 담당하므로 내부 상태탭 없음.
 */
export default function MobileCarousel({ events }: { events: FabEvent[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  const [pager, setPager] = useState(0)
  const railRef = useRef<HTMLDivElement | null>(null)

  const toggleOpen = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const onRailScroll = () => {
    const rail = railRef.current
    if (!rail) return
    const cards = rail.querySelectorAll<HTMLElement>('[data-card]')
    if (!cards.length) return
    const center = rail.scrollLeft + rail.clientWidth / 2
    let best = 0, bestDist = Infinity
    cards.forEach((c, i) => {
      const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    setPager((prev) => (prev === best ? prev : best))
  }

  if (!events.length) {
    return <EmptyState icon={<CoPresentIcon />} title="진행 중이거나 예정된 행사가 없습니다" description="새 행사가 등록되면 여기에 표시됩니다." />
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: '4px', pb: '10px', fontSize: 11.5, color: 'text.secondary' }}>카드를 누르면 상세가 열립니다</Box>
      <Box
        ref={railRef}
        onScroll={onRailScroll}
        sx={{
          display: 'grid', gridAutoFlow: 'column', gridAutoColumns: '86%', gap: '12px',
          overflowX: 'auto', overscrollBehaviorInline: 'contain', scrollSnapType: 'x mandatory',
          scrollPaddingInline: '4px', px: '4px', pb: '12px', scrollbarWidth: 'none', touchAction: 'pan-x pan-y',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {events.map((e) => (
          <MobileCard key={e.id} e={e} open={openIds.has(e.id)} onToggle={() => toggleOpen(e.id)} />
        ))}
      </Box>
      <Box
        aria-live="polite"
        sx={{
          minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
          color: 'text.secondary', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          '&::before, &::after': { content: '""', width: 30, height: '1px', bgcolor: 'divider' },
        }}
      >
        {pager + 1} / {events.length}
      </Box>
    </Box>
  )
}
