import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CoPresentIcon from '@mui/icons-material/CoPresent'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EventIcon from '@mui/icons-material/Event'
import PlaceIcon from '@mui/icons-material/Place'
import BusinessIcon from '@mui/icons-material/Business'
import SchoolIcon from '@mui/icons-material/School'
import GroupsIcon from '@mui/icons-material/Groups'
import ForumIcon from '@mui/icons-material/Forum'
import StorefrontIcon from '@mui/icons-material/Storefront'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { darken } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { PageContainer, PageHeader, ContentSection, AppCard, EmptyState } from '@/components/ds'
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

// 하단 '행사 사이트' 버튼 색
const KIND_BLUE = '#3b82f6'

const toneColor = (th: Theme, tone: 'green' | 'amber' | 'gray') =>
  tone === 'green' ? th.palette.accent.green : tone === 'amber' ? th.palette.accent.amber : th.palette.text.disabled

const posterUrl = (poster?: string) => (poster ? `${import.meta.env.BASE_URL}${poster}` : undefined)

// 분류 → 아이콘 (포스터 없을 때 카드 가운데에 크게)
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

// 포스터 초점 정렬 — 행사 제목(posterFocus.y)이 와야 할 카드 세로 위치(%)
const FOCUS_TARGET_Y = 40
const FOCUS_DEFAULT = { x: 50, y: 40, scale: 1, fit: 'cover' as const }

/** 포스터 영역 — 포컬 포인트 크롭(블러 배경층 + 초점 정렬 전경층) + 하단 가독 그라데이션 */
function PosterBg({ e }: { e: FabEvent }) {
  const url = posterUrl(e.poster)
  const f = { ...FOCUS_DEFAULT, ...e.posterFocus }
  return (
    <>
      {url ? (
        <>
          {/* 배경층: 같은 포스터를 블러로 — 초점 정렬·비율차로 생긴 빈 영역을 자연스럽게 채움(이미지 왜곡 X) */}
          <Box
            component="img"
            aria-hidden
            src={url}
            loading="lazy"
            sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.18)', filter: 'blur(18px) brightness(.55)' }}
          />
          {/* 전경층: 실제 포스터 — 초점 y를 카드 ~40%로 정렬, 넘침은 카드에서 크롭, 비율 유지 */}
          <Box
            component="img"
            src={url}
            alt={e.title}
            loading="lazy"
            sx={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: f.fit,
              objectPosition: `${f.x}% ${f.y}%`,
              transform:
                f.fit === 'cover'
                  ? `translate(${50 - f.x}%, ${FOCUS_TARGET_Y - f.y}%) scale(${f.scale})`
                  : `scale(${f.scale})`,
              transformOrigin: `${f.x}% ${f.y}%`,
            }}
          />
        </>
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

// 제목 분리 — ' - ' 앞(약칭)은 한 줄 유지, 줄바꿈 시 dash 빼고 한글명부터 다음 줄.
function splitTitle(title: string): ReactNode {
  const idx = title.indexOf(' - ')
  if (idx === -1) return title
  return (
    <>
      <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{title.slice(0, idx)}</Box>
      <Box component="span" sx={{ minWidth: 0 }}>{title.slice(idx + 1)}</Box>
    </>
  )
}

// 기본카드 제목 — 한 줄에 들어가면 'ISPSA 2026 - 한글명', 줄바꿈되면 dash 빼고 한글명부터 다음 줄.
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
  const fontSx = { fontSize: { xs: 13, sm: 14 }, fontWeight: 800, color: '#fff', lineHeight: 1.3, mb: 1, textShadow: '0 1px 6px rgba(0,0,0,.5)' }
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

// 상세 패널 메타 한 줄(아이콘 + 말줄임 텍스트)
function MiniMeta({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, textShadow: '0 1px 5px rgba(0,0,0,.75)' }}>
      <Box sx={{ display: 'flex', flexShrink: 0, color: 'rgba(255,255,255,.62)', '& .MuiSvgIcon-root': { fontSize: { xs: 13, sm: 15 } } }}>{icon}</Box>
      <Box sx={{ fontSize: { xs: 11, sm: 12.5 }, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</Box>
    </Box>
  )
}

// 카드 내부 상세 패널 — 아래에서 슬라이드업. 모든 포스터에서 일정한 가독성(스크림+0.92 어둠).
function InCardDetail({ e }: { e: FabEvent }) {
  const items = (e.summary ?? []).slice(0, 3)
  return (
    <Box
      sx={{
        position: 'relative',
        pt: { xs: '28px', sm: '38px' },
        px: { xs: '11px', sm: '14px' },
        pb: { xs: '12px', sm: '15px' },
        background: 'linear-gradient(to top, rgba(5,8,14,.93) 0%, rgba(5,8,14,.92) 74%, rgba(5,8,14,0) 100%)',
      }}
    >
      {/* 접기 chevron (카드 클릭으로 닫힘 — 시각적 안내) */}
      <Box aria-hidden sx={{ position: 'absolute', top: { xs: 1, sm: 3 }, left: 0, right: 0, display: 'flex', justifyContent: 'center', color: 'rgba(255,255,255,.6)', pointerEvents: 'none' }}>
        <KeyboardArrowDownIcon sx={{ fontSize: { xs: 20, sm: 22 } }} />
      </Box>
      {/* 제목 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '0.3em', fontSize: { xs: 12.5, sm: 14.5 }, fontWeight: 800, color: '#fff', lineHeight: 1.3, mb: { xs: 0.7, sm: 1 }, textShadow: '0 1px 6px rgba(0,0,0,.6)', maxHeight: '2.6em', overflow: 'hidden' }}>{splitTitle(e.title)}</Box>
      {/* 메타: 일시·장소·주최 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: '3px', sm: '5px' }, mb: { xs: 0.8, sm: 1.1 } }}>
        <MiniMeta icon={<EventIcon />} value={fmtEventDate(e.start, e.end)} />
        <MiniMeta icon={<PlaceIcon />} value={e.venue} />
        {e.organizer && <MiniMeta icon={<BusinessIcon />} value={e.organizer} />}
      </Box>
      {/* 요약 2~3 (말줄임, 모바일은 2개) */}
      {items.length > 0 && (
        <Box component="ul" sx={{ m: 0, mb: { xs: 1, sm: 1.4 }, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: { xs: '2px', sm: '4px' } }}>
          {items.map((s, i) => (
            <Box
              component="li"
              key={i}
              sx={{
                fontSize: { xs: 11, sm: 12.5 }, lineHeight: 1.45, color: 'rgba(255,255,255,.88)',
                textShadow: '0 1px 5px rgba(0,0,0,.75)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                ...(i === 2 ? { display: { xs: 'none', sm: 'block' } } : null),
              }}
            >
              {s.label && <Box component="span" sx={{ fontWeight: 700, color: '#fff', mr: 0.6 }}>{s.label}</Box>}
              {s.speakers && s.speakers.length > 0 ? s.speakers.slice(0, 4).join(' · ') + (s.speakers.length > 4 ? ' 등' : '') : s.value}
            </Box>
          ))}
        </Box>
      )}
      {/* 행사 사이트 버튼 — 클릭 시 카드 토글 막음 */}
      <Button
        component="a"
        href={e.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(ev) => ev.stopPropagation()}
        variant="contained"
        fullWidth
        size="small"
        startIcon={<OpenInNewIcon />}
        sx={{ bgcolor: KIND_BLUE, color: '#fff', fontSize: { xs: 11.5, sm: 12.5 }, py: { xs: '5px', sm: '6px' }, '&:hover': { bgcolor: darken(KIND_BLUE, 0.14) } }}
      >
        행사 사이트 바로가기
      </Button>
    </Box>
  )
}

function EventCard({ e, open, onToggle }: { e: FabEvent; open: boolean; onToggle: () => void }) {
  const st = eventStatus(e.start, e.end)
  const cat = eventCategory(e.kind)
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
      {/* 카드 크기·비율 고정 — 상세는 이 박스 안 absolute로만 처리(레이아웃 불변) */}
      <Box sx={{ position: 'relative', aspectRatio: '800 / 1122', overflow: 'hidden' }}>
        <PosterBg e={e} />

        {/* 열림 시 포스터 전체 반투명 스크림(원본 색감 보존) */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            bgcolor: 'rgba(5,8,14,.70)',
            opacity: open ? 1 : 0,
            transition: 'opacity 220ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />

        {/* 좌상단 칩 — 항상 선명(스크림 위) */}
        <Box sx={{ position: 'absolute', top: 11, left: 11, right: 11, zIndex: 3, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', fontSize: { xs: 11.5, sm: 12.5 }, fontWeight: 800, letterSpacing: '.02em', px: '10px', py: '6px', borderRadius: 999, bgcolor: CAT_COLOR[cat], color: '#fff' }}>{cat}</Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: { xs: 12, sm: 13 }, fontWeight: 700, letterSpacing: '.02em', px: '11px', py: '6px', borderRadius: 999, bgcolor: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', color: '#fff' }}>
            <Box component="span" className={st.tone === 'green' ? 'live-dot' : undefined} sx={(th) => ({ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, bgcolor: toneColor(th, st.tone) })} />
            {st.label}
          </Box>
        </Box>

        {/* 기본 하단 오버레이: 제목 + 일시 (열리면 페이드아웃) */}
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, p: '13px 13px 14px', opacity: open ? 0 : 1, pointerEvents: open ? 'none' : 'auto', transition: 'opacity 160ms ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } }}>
          <CardTitle title={e.title} />
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: { xs: 12, sm: 13 }, fontWeight: 500, color: '#fff', bgcolor: 'rgba(255,255,255,.16)', backdropFilter: 'blur(3px)', px: 1.1, py: '4px', borderRadius: 999 }}>
            <EventIcon sx={{ fontSize: 16 }} /> {fmtEventDate(e.start, e.end)}
          </Box>
        </Box>

        {/* 상세 패널 — 아래에서 위로 슬라이드(absolute, 카드 높이 불변) */}
        <Box
          sx={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2,
            transform: open ? 'translateY(0)' : 'translateY(101%)',
            opacity: open ? 1 : 0,
            transition: 'transform 250ms cubic-bezier(.22,.61,.36,1), opacity 220ms ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'opacity 1ms linear' },
          }}
        >
          <InCardDetail e={e} />
        </Box>
      </Box>
    </Box>
  )
}

/** 학술·교육·전시 행사 — 포스터 카드 + 클릭 시 인카드 슬라이드업 상세. */
export default function Events() {
  const { isAdmin } = useRole()
  const [openId, setOpenId] = useState<string | null>(null)

  // Escape로 열린 카드 닫기
  useEffect(() => {
    if (!openId) return
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpenId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

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
