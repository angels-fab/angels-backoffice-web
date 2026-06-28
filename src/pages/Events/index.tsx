import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import useMediaQuery from '@mui/material/useMediaQuery'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import AddIcon from '@mui/icons-material/Add'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState } from '@/components/ds'
import { useRole } from '@/auth/role'
import { FAB_EVENTS, EVENT_REQUEST_FORM_URL, type FabEvent } from '@/constants/events'
import { EventCardInner } from './eventCard'
import MobileCarousel from './MobileCarousel'

// PC 카드 — 인터랙션(클릭/포커스/hover) 래퍼 + 공용 비주얼(EventCardInner).
function EventCard({ e, open, onToggle }: { e: FabEvent; open: boolean; onToggle: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${e.title} 상세 ${open ? '닫기' : '열기'}`}
      onClick={onToggle}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle() } }}
      sx={{
        position: 'relative',
        borderRadius: '18px',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'box-shadow .18s ease, transform .18s ease',
        ...(open
          ? { boxShadow: '0 14px 34px rgba(0,0,0,.5)' }
          : { '&:hover': { transform: 'translateY(-3px) scale(1.012)', boxShadow: '0 12px 30px rgba(0,0,0,.45)' } }),
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <EventCardInner e={e} open={open} />
    </Box>
  )
}

/** 학술·교육·전시 행사 — PC는 4열 그리드, 모바일(<=768px)은 상태별 스냅 캐러셀. 둘 다 인카드 슬라이드업 상세. */
export default function Events() {
  const { isAdmin } = useRole()
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true })
  const [openId, setOpenId] = useState<string | null>(null)

  // Escape로 열린 카드 닫기 (PC 그리드)
  useEffect(() => {
    if (isMobile || !openId) return
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, isMobile])

  return (
    <PageContainer>
      <PageHeader
        icon={<CoPresentIcon />}
        title="학술·교육·전시"
        subtitle="학회 · 교육 · 전시 행사"
        actions={
          isAdmin ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => window.open(EVENT_REQUEST_FORM_URL, '_blank', 'noopener,noreferrer')}
            >
              새 행사
            </Button>
          ) : undefined
        }
      />
      <ContentSection last>
        {FAB_EVENTS.length === 0 ? (
          <AppCard padding={0}>
            <EmptyState icon={<CoPresentIcon />} title="등록된 행사가 없습니다" description="다가오는 행사가 등록되면 여기에 표시됩니다." />
          </AppCard>
        ) : isMobile ? (
          <MobileCarousel events={FAB_EVENTS} />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '14px', alignItems: 'start' }}>
            {FAB_EVENTS.map((e) => (
              <EventCard
                key={e.id}
                e={e}
                open={openId === e.id}
                onToggle={() => setOpenId((prev) => (prev === e.id ? null : e.id))}
              />
            ))}
          </Box>
        )}
      </ContentSection>
    </PageContainer>
  )
}
