import { useState, useEffect, useCallback, type MouseEvent } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { DEMO_RESULTS, type DemoResult, type DemoPhoto } from './demoData'

const fmtDate = (d: string) => d.replace(/-/g, '.')
const demoTitle = (d: DemoResult) => `${d.equipment} · ${d.maker}${d.model ? ` ${d.model}` : ''}`

/** 사진 타일 — 실제 이미지가 있으면 cover, 없으면 플레이스홀더(샘플). */
function Photo({ photo, radius = 0, onClick }: { photo?: DemoPhoto; radius?: number; onClick?: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative', width: '100%', height: '100%', bgcolor: 'background.default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled',
        borderRadius: `${radius}px`, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {photo?.src
        ? <Box component="img" src={photo.src} alt={photo.name || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <ImageOutlinedIcon sx={{ fontSize: 22 }} />}
    </Box>
  )
}

// 회차 칩(대표사진 좌상단) — 활성=파랑 채움 / 비활성=반투명 검정
const roundChip = (active: boolean) => (th: Theme) => ({
  fontSize: 10.5, fontWeight: 700, lineHeight: 1, px: '8px', py: '4px', borderRadius: '999px',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#fff',
  bgcolor: active ? th.palette.primary.main : 'rgba(0,0,0,.55)',
  boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.25)',
})

const metricTag = (th: Theme) => ({
  display: 'inline-block', fontSize: 10.5, padding: '2px 7px', borderRadius: '6px',
  background: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`,
  color: 'text.secondary', whiteSpace: 'nowrap' as const,
})

/**
 * 데모결과 카드 — 장비+제조사 = 카드 1장. 기본은 최신 회차, 다회차면 좌상단 회차 칩으로 그 자리에서 내용만 교체.
 * 구성: 대표사진(좌상단 회차칩·우상단 날짜/장소) → 썸네일 한 줄(+N) → 제목+첨부아이콘 → 핵심수치.
 */
function DemoCard({ d, onOpenPhoto }: { d: DemoResult; onOpenPhoto: (photos: DemoPhoto[], idx: number) => void }) {
  const latest = d.rounds.length - 1
  const [ri, setRi] = useState(latest)
  const r = d.rounds[Math.min(ri, latest)]
  const multi = d.rounds.length > 1
  const cover = r.photos[0]
  const rest = r.photos.slice(1)
  const THUMB_MAX = 5
  const shown = rest.slice(0, THUMB_MAX)
  const more = rest.length - shown.length
  const cols = shown.length + (more > 0 ? 1 : 0)

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', overflow: 'hidden', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', transition: 'border-color .15s', '&:hover': { borderColor: 'text.disabled' } }}>
      {/* 대표사진 + 오버레이 */}
      <Box sx={{ position: 'relative', height: 128, flex: 'none' }}>
        <Photo photo={cover} onClick={() => onOpenPhoto(r.photos, 0)} />
        {/* 좌상단 회차 칩 (다회차만) */}
        {multi && (
          <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: '4px' }}>
            {d.rounds.map((rr, i) => (
              <Box key={rr.round} component="button" aria-label={`${rr.round}차 결과 보기`} aria-pressed={i === ri}
                onClick={(e) => { e.stopPropagation(); setRi(i) }} sx={roundChip(i === ri)}>
                {rr.round}차
              </Box>
            ))}
          </Box>
        )}
        {/* 우상단 날짜·장소 */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, textAlign: 'right', bgcolor: 'rgba(0,0,0,.55)', borderRadius: '7px', px: '8px', py: '4px', color: '#fff', lineHeight: 1.35 }}>
          <Box sx={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(r.date)}</Box>
          <Box sx={{ fontSize: 9.5, opacity: 0.85 }}>{r.place}</Box>
        </Box>
      </Box>

      {/* 대표사진 바로 밑 썸네일 한 줄 + 우측 +N (사진 1장뿐이면 사진 수 표기로 높이 유지) */}
      <Box sx={{ height: 46, flex: 'none', p: '3px', display: 'grid', gridTemplateColumns: cols > 0 ? `repeat(${cols}, 1fr)` : '1fr', gap: '3px', bgcolor: 'background.default' }}>
        {cols > 0 ? (
          <>
            {shown.map((p, i) => (
              <Box key={i} sx={{ borderRadius: '4px', overflow: 'hidden' }}><Photo photo={p} radius={4} onClick={() => onOpenPhoto(r.photos, i + 1)} /></Box>
            ))}
            {more > 0 && (
              <Box onClick={() => onOpenPhoto(r.photos, shown.length + 1)} sx={{ borderRadius: '4px', bgcolor: (th) => alpha(th.palette.text.primary, 0.06), color: 'text.secondary', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+{more}</Box>
            )}
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 10.5 }}>사진 {r.photos.length}장</Box>
        )}
      </Box>

      {/* 제목 + (우측) 첨부파일 아이콘 — hover=파일명, 클릭=새 탭으로 바로 열림(다운로드 아님) */}
      <Box sx={{ px: 1.25, pt: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{demoTitle(d)}</Box>
        {r.files.length > 0 && (
          <Box sx={{ display: 'flex', gap: '3px', flex: 'none' }}>
            {r.files.map((f, i) => (
              <Tooltip key={i} title={f.name} arrow>
                <Box component={f.src ? 'a' : 'span'} href={f.src} target="_blank" rel="noopener noreferrer" aria-label={`${f.name} 열기`}
                  onClick={(e: MouseEvent) => e.stopPropagation()} sx={{ display: 'inline-flex', lineHeight: 0, cursor: f.src ? 'pointer' : 'default', opacity: f.src ? 1 : 0.85 }}>
                  <AttachmentIcon type={f.type} name={f.name} size={18} />
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>

      {/* 핵심 수치(앞 3개) */}
      <Box sx={{ px: 1.25, pb: 1.25, pt: 0.75, display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: 26 }}>
        {r.metrics.slice(0, 3).map((m, i) => (
          <Box key={i} component="span" sx={metricTag}><Box component="span" sx={{ color: 'text.disabled', mr: 0.4 }}>{m.label}</Box>{m.value}</Box>
        ))}
      </Box>
    </Box>
  )
}

/** 사진 확대 뷰(라이트박스) — 좌우 이동·Esc·바깥클릭 닫기. 샘플은 플레이스홀더로 표시. */
function Lightbox({ photos, idx, onIdx, onClose }: { photos: DemoPhoto[]; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  const move = useCallback((delta: number) => onIdx((idx + delta + photos.length) % photos.length), [idx, photos.length, onIdx])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') move(1)
      else if (e.key === 'ArrowLeft') move(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move, onClose])
  const p = photos[idx]
  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)', '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}><CloseIcon /></IconButton>
      {photos.length > 1 && (
        <IconButton onClick={(e) => { e.stopPropagation(); move(-1) }} aria-label="이전" sx={{ position: 'absolute', left: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)', '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}><ChevronLeftIcon /></IconButton>
      )}
      <Box onClick={(e) => e.stopPropagation()} sx={{ maxWidth: '90vw', maxHeight: '86vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        {p?.src
          ? <Box component="img" src={p.src} alt={p.name || ''} sx={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 1 }} />
          : <Box sx={{ width: 'min(78vw, 520px)', height: 'min(58vh, 380px)', bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,.6)' }}>
              <ImageOutlinedIcon sx={{ fontSize: 44 }} />
              <Box sx={{ fontSize: 12 }}>미리보기 (샘플)</Box>
            </Box>}
        <Box sx={{ color: 'rgba(255,255,255,.9)', fontSize: 13, textAlign: 'center' }}>{p?.name}<Box component="span" sx={{ color: 'rgba(255,255,255,.5)', ml: 1 }}>{idx + 1} / {photos.length}</Box></Box>
      </Box>
      {photos.length > 1 && (
        <IconButton onClick={(e) => { e.stopPropagation(); move(1) }} aria-label="다음" sx={{ position: 'absolute', right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)', '&:hover': { bgcolor: 'rgba(0,0,0,.65)' } }}><ChevronRightIcon /></IconButton>
      )}
    </Box>
  )
}

/**
 * 데모결과 뷰 — 장비도입 페이지의 '데모결과' 탭. 카드 그리드 + 사진 라이트박스.
 * 현재는 샘플 상수(DEMO_RESULTS)로 화면 확인용. 저장/입력(팀원+)은 다음 단계.
 */
export default function DemoResults() {
  const [viewer, setViewer] = useState<{ photos: DemoPhoto[]; idx: number } | null>(null)
  return (
    <Box sx={{ p: 1.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(auto-fill, minmax(210px, 1fr))' }, gap: 1.5, alignItems: 'start' }}>
        {DEMO_RESULTS.map((d) => (
          <DemoCard key={d.id} d={d} onOpenPhoto={(photos, idx) => setViewer({ photos, idx })} />
        ))}
      </Box>
      {viewer && <Lightbox photos={viewer.photos} idx={viewer.idx} onIdx={(i) => setViewer((v) => (v ? { ...v, idx: i } : v))} onClose={() => setViewer(null)} />}
    </Box>
  )
}
