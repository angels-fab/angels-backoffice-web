import { useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import useMediaQuery from '@mui/material/useMediaQuery'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import AddIcon from '@mui/icons-material/Add'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState } from '@/components/ds'
import { useRole } from '@/auth/role'
import { FAB_EVENTS, EVENT_REQUEST_FORM_URL, eventStatus, type FabEvent } from '@/constants/events'
import { EventCardInner } from './eventCard'
import MobileCarousel from './MobileCarousel'
import EndedList from './EndedList'

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
        position: 'relative', borderRadius: '18px', overflow: 'hidden', border: 1, borderColor: 'divider', cursor: 'pointer',
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

type Tab = 'active' | 'ended'

/**
 * 학술·교육·전시 행사 — 진행·예정 / 종료 2탭(PC·모바일 동일 분류).
 * 진행·예정 = 카드(PC 그리드 / 모바일 캐러셀, 진행중 먼저·예정 start asc). 종료 = 밀도 목록(end desc, 행 클릭 상세).
 */
export default function Events() {
  const { isAdmin } = useRole()
  const isMobile = useMediaQuery('(max-width:768px)', { noSsr: true })
  const [tab, setTab] = useState<Tab>('active')
  const [openId, setOpenId] = useState<string | null>(null)
  const [endedDetail, setEndedDetail] = useState<FabEvent | null>(null)

  // 날짜 기준 분류: 진행중(green)+예정(amber)=진행·예정 / 종료(gray). 진행중 먼저, 예정은 start asc / 종료는 end desc.
  const { active, ended } = useMemo(() => {
    const act: FabEvent[] = [], end: FabEvent[] = []
    FAB_EVENTS.forEach((e) => (eventStatus(e.start, e.end).tone === 'gray' ? end : act).push(e))
    act.sort((a, b) => {
      const ta = eventStatus(a.start, a.end).tone, tb = eventStatus(b.start, b.end).tone
      if (ta !== tb) return ta === 'green' ? -1 : 1 // 진행중 먼저
      return a.start.localeCompare(b.start) // 예정 start asc
    })
    end.sort((a, b) => (b.end || b.start).localeCompare(a.end || a.start)) // 종료 end desc
    return { active: act, ended: end }
  }, [])

  // Escape로 열린 카드/상세 닫기 (PC 그리드·종료 다이얼로그)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { setOpenId(null); setEndedDetail(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tabBtn = (v: Tab, label: string, count: number) => (
    <Button
      size="small" disableElevation variant={tab === v ? 'contained' : 'text'}
      onClick={() => setTab(v)}
      sx={{ minWidth: 0, px: 1.75, py: 0.5, fontSize: 13.5, fontWeight: 700, color: tab === v ? undefined : 'text.secondary' }}
    >
      {label} {count}
    </Button>
  )

  return (
    <PageContainer>
      <PageHeader
        icon={<CoPresentIcon />}
        title="학술·교육·전시"
        subtitle="학회 · 교육 · 전시 행사"
        actions={
          isAdmin ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => window.open(EVENT_REQUEST_FORM_URL, '_blank', 'noopener,noreferrer')}>
              새 행사
            </Button>
          ) : undefined
        }
      />

      {/* 진행·예정 / 종료 탭 (건수 표시) */}
      <Box sx={{ display: 'inline-flex', gap: 0.5, p: '4px', mb: 2, border: 1, borderColor: 'divider', borderRadius: '10px', bgcolor: 'background.paper' }}>
        {tabBtn('active', '진행·예정', active.length)}
        {tabBtn('ended', '종료', ended.length)}
      </Box>

      <ContentSection last>
        {tab === 'active' ? (
          active.length === 0 ? (
            <AppCard padding={0}>
              <EmptyState icon={<CoPresentIcon />} title="진행 중이거나 예정된 행사가 없습니다" description="새 행사가 등록되면 여기에 표시됩니다." />
            </AppCard>
          ) : isMobile ? (
            <MobileCarousel events={active} />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '14px', alignItems: 'start' }}>
              {active.map((e) => (
                <EventCard key={e.id} e={e} open={openId === e.id} onToggle={() => setOpenId((prev) => (prev === e.id ? null : e.id))} />
              ))}
            </Box>
          )
        ) : ended.length === 0 ? (
          <AppCard padding={0}>
            <EmptyState icon={<CoPresentIcon />} title="종료된 행사가 없습니다" />
          </AppCard>
        ) : (
          <AppCard padding={0}>
            <EndedList events={ended} onPick={setEndedDetail} />
          </AppCard>
        )}
      </ContentSection>

      {/* 종료 행사 상세 — 카드 상세 재사용(다이얼로그) */}
      <Dialog
        open={!!endedDetail}
        onClose={() => setEndedDetail(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible', m: { xs: 1.5, sm: 2 } } } }}
      >
        {endedDetail && (
          <Box sx={{ borderRadius: '18px', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
            <EventCardInner e={endedDetail} open />
          </Box>
        )}
      </Dialog>
    </PageContainer>
  )
}
