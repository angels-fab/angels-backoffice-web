import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import SchoolIcon from '@mui/icons-material/School'
import GroupsIcon from '@mui/icons-material/Groups'
import ForumIcon from '@mui/icons-material/Forum'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { darken } from '@mui/material/styles'
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

// 행사 분류칩(국제/국내) 텍스트색 = 하단 '행사 사이트 바로가기' 버튼 배경색(통일). 진한 비비드 블루.
const KIND_BLUE = '#3b82f6'

const toneColor = (th: Theme, tone: 'green' | 'amber' | 'gray') =>
  tone === 'green' ? th.palette.accent.green : tone === 'amber' ? th.palette.accent.amber : th.palette.text.disabled

const posterUrl = (poster?: string) => (poster ? `${import.meta.env.BASE_URL}${poster}` : undefined)

// 분류 → 아이콘 (포스터 없을 때 카드/팝업 가운데에 크게)
function categoryIcon(kind?: string) {
  const k = kind ?? ''
  if (/교육|세미나|실습|강좌/.test(k)) return SchoolIcon
  if (/전시|박람|산업전|쇼|show/i.test(k)) return StorefrontIcon
  if (/컨퍼런스|conference|summit|포럼|forum/i.test(k)) return ForumIcon
  if (/학회|학술|심포지엄|symposium/i.test(k)) return GroupsIcon
  return CoPresentIcon
}

// kind → 메뉴 3대 분류(학술·교육·전시) + 분류별 칩 색 (학술=블루, 교육=그린, 전시=퍼플)
type EventCat = '학술' | '교육' | '전시'
function eventCategory(kind?: string): EventCat {
  const k = kind ?? ''
  if (/교육|세미나|실습|강좌|워크숍|튜토리얼/.test(k)) return '교육'
  if (/전시|박람|산업전|쇼|show|expo/i.test(k)) return '전시'
  return '학술' // 국제·국내학회·심포지엄·컨퍼런스·포럼 등
}
const CAT_COLOR: Record<EventCat, string> = { 학술: '#3b82f6', 교육: '#10b981', 전시: '#a855f7' }

/** 포스터 영역(이미지 or 그라데이션) + 하단 그라데이션 오버레이 */
function PosterBg({ e }: { e: FabEvent }) {
  const url = posterUrl(e.poster)
  return (
    <>
      {url ? (
        <Box component="img" src={url} alt={e.title} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          <Box sx={{ position: 'absolute', inset: 0, background: GRAD[e.accent ?? 'blue'] }} />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(() => { const Ico = categoryIcon(e.kind); return <Ico sx={{ fontSize: 92, color: 'rgba(255,255,255,.5)' }} /> })()}
          </Box>
        </>
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,10,15,.92) 0%, rgba(8,10,15,.42) 40%, rgba(8,10,15,0) 66%)' }} />
    </>
  )
}

// 제목 분리 — ' - ' 앞(약칭)은 한 줄 유지, 줄바꿈 시 dash(한글명)부터 다음 줄.
// 부모는 display:flex; flexWrap:wrap 이어야 함(한 줄에 다 들어가면 한 줄, 아니면 한글명이 다음 줄로).
function splitTitle(title: string, clampTail?: number, dropDash?: boolean): ReactNode {
  const idx = title.indexOf(' - ')
  if (idx === -1) return title
  // dropDash: 줄바꿈 시 dash 없이 한글명만 다음 줄로 (카드용). 아니면 '- 한글명'으로 연결(팝업용).
  const tail = dropDash ? title.slice(idx + 3) : title.slice(idx + 1)
  return (
    <>
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{title.slice(0, idx)}</Box>
      <Box component="span" sx={{ minWidth: 0, ...(clampTail ? { display: '-webkit-box', WebkitLineClamp: clampTail, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : null) }}>{tail}</Box>
    </>
  )
}

// 카드 제목 — 한 줄에 들어가면 'ISPSA 2026 - 한글명'(dash 중간), 줄바꿈되면 dash 빼고 한글명부터 다음 줄.
// 한 줄 여부를 약칭/한글 span의 offsetTop으로 측정(폭 변할 때만 재측정 → 무한루프 방지).
function CardTitle({ title }: { title: string }) {
  const idx = title.indexOf(' - ')
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const headRef = useRef<HTMLSpanElement | null>(null)
  const tailRef = useRef<HTMLSpanElement | null>(null)
  const lastW = useRef(-1)
  const [oneLine, setOneLine] = useState(false)
  useLayoutEffect(() => {
    if (idx === -1) return
    const measure = () => {
      const c = wrapRef.current, h = headRef.current, t = tailRef.current
      if (!c || !h || !t) return
      const w = c.clientWidth
      if (w === lastW.current) return
      lastW.current = w
      setOneLine(h.offsetTop === t.offsetTop)
    }
    lastW.current = -1
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [title, idx])
  const fontSx = { fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.3, mb: 1, textShadow: '0 1px 6px rgba(0,0,0,.5)' }
  if (idx === -1) {
    return <Box sx={{ ...fontSx, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</Box>
  }
  const head = title.slice(0, idx)
  const korean = title.slice(idx + 3)
  return (
    <Box ref={wrapRef} sx={{ ...fontSx, display: 'flex', flexWrap: 'wrap', columnGap: '0.3em' }}>
      <Box component="span" ref={headRef} sx={{ whiteSpace: 'nowrap' }}>{oneLine ? `${head} -` : head}</Box>
      <Box component="span" ref={tailRef} sx={{ minWidth: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{korean}</Box>
    </Box>
  )
}

function EventCard({ e, onOpen }: { e: FabEvent; onOpen: () => void }) {
  const st = eventStatus(e.start, e.end)
  const cat = eventCategory(e.kind)
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
      <Box sx={{ position: 'relative', aspectRatio: '800 / 1122' }}>
        <PosterBg e={e} />

        {/* 좌상단: 분류칩(학술/교육/전시) → 상태칩 */}
        <Box sx={{ position: 'absolute', top: 11, left: 11, right: 44, display: 'flex', alignItems: 'flex-start', gap: '6px', flexWrap: 'wrap' }}>
          {/* 분류칩 — 학술=블루 / 교육=그린 / 전시=퍼플 */}
          <Box
            component="span"
            sx={(th) => ({
              display: 'inline-flex', alignItems: 'center',
              fontSize: 12.5, fontWeight: 800, letterSpacing: '.02em',
              px: '10px', py: '6px', borderRadius: 999,
              bgcolor: CAT_COLOR[cat], color: th.palette.getContrastText(CAT_COLOR[cat]),
            })}
          >
            {cat}
          </Box>
          {/* 상태칩 — 진행중=초록 점멸 dot / 예정=노랑 dot+D-# / 종료=회색 */}
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: 13, fontWeight: 700, letterSpacing: '.02em',
              px: '11px', py: '6px', borderRadius: 999,
              bgcolor: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', color: '#fff',
            }}
          >
            <Box
              component="span"
              className={st.tone === 'green' ? 'live-dot' : undefined}
              sx={(th) => ({ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: toneColor(th, st.tone) })}
            />
            {st.label}
          </Box>
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
          <CardTitle title={e.title} />
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13, fontWeight: 500, color: '#fff', bgcolor: 'rgba(255,255,255,.16)', backdropFilter: 'blur(3px)', px: 1.1, py: '4px', borderRadius: 999 }}>
            <EventIcon sx={{ fontSize: 16 }} /> {fmtEventDate(e.start, e.end)}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// 상세 정보 블록 (제목·구분/상태칩·메타·요약·버튼). light=포스터 위 오버레이용(밝은 텍스트).
function DetailInfo({ e, st, light }: { e: FabEvent; st: ReturnType<typeof eventStatus>; light?: boolean }) {
  const catColor = CAT_COLOR[eventCategory(e.kind)]
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.25 }}>
        {light ? (
          <>
            <Box component="span" sx={(th) => ({ display: 'inline-flex', alignItems: 'center', px: '11px', py: '4px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: th.palette.getContrastText(catColor), bgcolor: catColor })}>{e.kind}</Box>
            <Box component="span" sx={(th) => { const c = toneColor(th, st.tone); return { display: 'inline-flex', alignItems: 'center', px: '11px', py: '4px', borderRadius: 999, fontSize: 12, fontWeight: 800, color: th.palette.getContrastText(c), bgcolor: c } }}>{st.label}</Box>
          </>
        ) : (
          <>
            <StatusChip status="info" label={e.kind} />
            <StatusChip status={st.tone === 'green' ? 'success' : st.tone === 'amber' ? 'warning' : 'neutral'} label={st.label} />
          </>
        )}
      </Box>
      {light ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.35em', fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1.35, mb: 1.25, textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{splitTitle(e.title)}</Box>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.35em', fontSize: 20, fontWeight: 700, color: 'text.primary', lineHeight: 1.35, mb: 1.5 }}>{splitTitle(e.title)}</Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, mb: 1.5 }}>
        <Meta icon={<EventIcon />} value={fmtEventDate(e.start, e.end)} light={light} />
        <Meta icon={<PlaceIcon />} value={e.venue} light={light} />
        {e.organizer && <Meta icon={<BusinessIcon />} value={e.organizer} light={light} />}
      </Box>
      {e.summary && e.summary.length > 0 && (
        <Box component="ul" sx={{ m: 0, mb: 2, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          {e.summary.map((s, i) => (
            <Box component="li" key={i} sx={{ fontSize: 13.5, lineHeight: 1.6, color: light ? 'rgba(255,255,255,.86)' : 'text.secondary', ...(light ? { textShadow: '0 1px 6px rgba(0,0,0,.7)' } : null), ...(s.speakers ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : null) }}>
              {s.label && (
                <Box component="span" sx={{ fontWeight: 700, color: light ? '#fff' : 'text.primary', mr: 0.75 }}>{s.label}</Box>
              )}
              {s.speakers && s.speakers.length > 0
                ? s.speakers.slice(0, 4).join(' · ') + (s.speakers.length > 4 ? ' 등' : '')
                : s.value}
            </Box>
          ))}
        </Box>
      )}
      <Button variant="contained" fullWidth startIcon={<OpenInNewIcon />} onClick={() => window.open(e.link, '_blank', 'noopener,noreferrer')} sx={{ bgcolor: KIND_BLUE, color: '#fff', '&:hover': { bgcolor: darken(KIND_BLUE, 0.14) } }}>
        행사 사이트 바로가기
      </Button>
    </>
  )
}

function EventDetail({ e, onClose }: { e: FabEvent; onClose: () => void }) {
  const st = eventStatus(e.start, e.end)
  const url = posterUrl(e.poster)
  const Ico = categoryIcon(e.kind)
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.paper', borderRadius: '16px', overflow: 'hidden' } } }}>
      {/* 팝업 이미지 영역 — ISPSA(800x1122) 기준 고정. 가로 긴 이미지는 위 정렬 + 하단 배경색 채움, 세로 긴 이미지는 하단 크롭. */}
      <Box sx={{ position: 'relative', aspectRatio: '800 / 1122', overflow: 'hidden', bgcolor: url ? (e.posterBg ?? '#0b0e14') : undefined }}>
        {url ? (
          <Box component="img" src={url} alt={e.title} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'auto', display: 'block' }} />
        ) : (
          <>
            <Box sx={{ position: 'absolute', inset: 0, background: GRAD[e.accent ?? 'blue'] }} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico sx={{ fontSize: 150, color: 'rgba(255,255,255,.5)' }} />
            </Box>
          </>
        )}
        {/* 하단 정보 그라데이션 */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to top, rgba(8,10,15,.98) 0%, rgba(8,10,15,.9) 12%, rgba(8,10,15,0) 38%)' }} />
        <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '0 20px 20px', lineHeight: 'normal' }}>
          <DetailInfo e={e} st={st} light />
        </Box>
      </Box>
    </Dialog>
  )
}

function Meta({ icon, value, light }: { icon: React.ReactNode; value: string; light?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ...(light ? { textShadow: '0 1px 6px rgba(0,0,0,.7)' } : null) }}>
      <Box sx={{ display: 'flex', color: light ? 'rgba(255,255,255,.78)' : 'text.disabled', '& .MuiSvgIcon-root': { fontSize: 18 } }}>{icon}</Box>
      <Typography variant="body2" sx={{ color: light ? '#fff' : 'text.primary' }}>{value}</Typography>
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
