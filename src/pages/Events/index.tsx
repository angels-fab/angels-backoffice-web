import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'
import BusinessIcon from '@mui/icons-material/Business'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState, StatusChip } from '@/components/ds'
import { useRole } from '@/auth/role'
import { FAB_EVENTS, EVENT_REQUEST_FORM_URL, eventStatus, fmtEventDate, type FabEvent, type EventAccent } from '@/constants/events'

const GRAD: Record<EventAccent, string> = {
  blue: 'linear-gradient(150deg,#1e3a6b,#2f5fa6 60%,#3f7bd0)',
  teal: 'linear-gradient(150deg,#0f3f3a,#15756b 60%,#1fa192)',
  green: 'linear-gradient(150deg,#1c4a2f,#2f7d4d 60%,#4da167)',
  purple: 'linear-gradient(150deg,#332a6b,#5a4bb0 60%,#9b8cff)',
  amber: 'linear-gradient(150deg,#5b4410,#9a7420 60%,#d6a23e)',
  red: 'linear-gradient(150deg,#5b1f1c,#a23a34 60%,#e05b54)',
}

const toneColor = (th: Theme, tone: 'green' | 'amber' | 'gray') =>
  tone === 'green' ? th.palette.accent.green : tone === 'amber' ? th.palette.accent.amber : th.palette.text.disabled

const posterUrl = (poster?: string) => (poster ? `${import.meta.env.BASE_URL}${poster}` : undefined)

/** 포스터 영역(이미지 or 그라데이션) + 하단 그라데이션 오버레이 */
function PosterBg({ e }: { e: FabEvent }) {
  const url = posterUrl(e.poster)
  return (
    <>
      {url ? (
        <Box component="img" src={url} alt={e.title} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Box sx={{ position: 'absolute', inset: 0, background: GRAD[e.accent ?? 'blue'] }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,15,.92) 0%, rgba(8,10,15,.42) 40%, rgba(8,10,15,0) 66%)' }} />
    </>
  )
}

function EventCard({ e, onOpen }: { e: FabEvent; onOpen: () => void }) {
  const st = eventStatus(e.start, e.end)
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`행사: ${e.title}`}
      onClick={onOpen}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen() } }}
      sx={{
        position: 'relative',
        borderRadius: '18px',
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'transform .18s ease, box-shadow .18s ease',
        '&:hover': { transform: 'translateY(-3px) scale(1.012)', boxShadow: '0 12px 30px rgba(0,0,0,.45)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '3 / 4' }}>
        <PosterBg e={e} />

        {/* 상태 pill */}
        <Box
          sx={(th) => ({
            position: 'absolute', top: 11, left: 11,
            fontSize: 10.5, fontWeight: 800, letterSpacing: '.02em',
            px: 1, py: '3px', borderRadius: 999,
            bgcolor: alpha(toneColor(th, st.tone), 0.92), color: '#fff',
          })}
        >
          {st.label}
        </Box>

        {/* 링크 아이콘 */}
        <IconButton
          component="a"
          href={e.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="행사 사이트"
          onClick={(ev) => ev.stopPropagation()}
          sx={{ position: 'absolute', top: 7, right: 7, width: 30, height: 30, color: '#fff', bgcolor: 'rgba(255,255,255,.14)', backdropFilter: 'blur(4px)', '&:hover': { bgcolor: 'rgba(255,255,255,.26)' } }}
        >
          <OpenInNewIcon sx={{ fontSize: 16 }} />
        </IconButton>

        {/* 하단 오버레이: 제목 + 일시 */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '13px 13px 14px' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3, mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 6px rgba(0,0,0,.5)' }}>
            {e.title}
          </Typography>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11, fontWeight: 600, color: '#fff', bgcolor: 'rgba(255,255,255,.16)', backdropFilter: 'blur(3px)', px: 1, py: '3px', borderRadius: 999 }}>
            <EventIcon sx={{ fontSize: 13 }} /> {fmtEventDate(e.start, e.end)}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function EventDetail({ e, onClose }: { e: FabEvent; onClose: () => void }) {
  const st = eventStatus(e.start, e.end)
  const url = posterUrl(e.poster)
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.paper', borderRadius: '16px', overflow: 'hidden' } } }}>
      {/* 배너 */}
      <Box sx={{ position: 'relative', aspectRatio: '16 / 7' }}>
        {url ? (
          <Box component="img" src={url} alt={e.title} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, background: GRAD[e.accent ?? 'blue'] }} />
        )}
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,15,.85), rgba(8,10,15,.1) 70%)' }} />
        <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,.35)', '&:hover': { bgcolor: 'rgba(0,0,0,.55)' } }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '16px 18px', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <StatusChip status={st.tone === 'green' ? 'success' : st.tone === 'amber' ? 'warning' : 'neutral'} label={st.label} />
          <StatusChip status="info" label={e.kind} />
        </Box>
      </Box>

      {/* 본문 */}
      <Box sx={{ p: '18px 20px 20px' }}>
        <Typography variant="h3" sx={{ mb: 1.5, lineHeight: 1.35 }}>{e.title}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 1.75 }}>
          <Meta icon={<EventIcon />} value={fmtEventDate(e.start, e.end)} />
          <Meta icon={<PlaceIcon />} value={e.venue} />
          {e.organizer && <Meta icon={<BusinessIcon />} value={e.organizer} />}
        </Box>
        {e.summary && e.summary.length > 0 && (
          <Box component="ul" sx={{ m: 0, mb: 2, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {e.summary.map((s, i) => (
              <Box component="li" key={i} sx={{ position: 'relative', pl: '14px', fontSize: 13.5, lineHeight: 1.6, color: 'text.secondary', '&::before': { content: '""', position: 'absolute', left: 0, top: '9px', width: 5, height: 5, borderRadius: '50%', bgcolor: 'primary.main' } }}>
                {s}
              </Box>
            ))}
          </Box>
        )}
        <Button variant="contained" fullWidth startIcon={<OpenInNewIcon />} onClick={() => window.open(e.link, '_blank', 'noopener,noreferrer')}>
          행사 사이트 바로가기
        </Button>
      </Box>
    </Dialog>
  )
}

function Meta({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
      <Box sx={{ display: 'flex', color: 'text.disabled', '& .MuiSvgIcon-root': { fontSize: 18 } }}>{icon}</Box>
      <Typography variant="body2" sx={{ color: 'text.primary' }}>{value}</Typography>
    </Box>
  )
}

/** 학술·교육 행사 — 포스터 카드(유형3) + 클릭 시 상세. */
export default function Events() {
  const { isAdmin } = useRole()
  const [selected, setSelected] = useState<FabEvent | null>(null)

  return (
    <PageContainer>
      <PageHeader
        icon={<CoPresentIcon />}
        title="학술·교육 행사"
        subtitle="세미나 · 학회 · 교육 행사"
        actions={
          isAdmin ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => window.open(EVENT_REQUEST_FORM_URL, '_blank', 'noopener,noreferrer')}
            >
              새 예정행사 등록
            </Button>
          ) : undefined
        }
      />
      <ContentSection last>
        {FAB_EVENTS.length === 0 ? (
          <AppCard padding={0}>
            <EmptyState icon={<CoPresentIcon />} title="등록된 행사가 없습니다" description="다가오는 행사가 등록되면 여기에 표시됩니다." />
          </AppCard>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }, gap: '14px' }}>
            {FAB_EVENTS.map((e) => (
              <EventCard key={e.id} e={e} onOpen={() => setSelected(e)} />
            ))}
          </Box>
        )}
      </ContentSection>
      {selected && <EventDetail e={selected} onClose={() => setSelected(null)} />}
    </PageContainer>
  )
}
