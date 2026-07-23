import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import TuneIcon from '@mui/icons-material/Tune'
import HistoryIcon from '@mui/icons-material/History'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { iconSize, radius, shadow, typescale } from '@/theme/tokens'
import { useSnack, LoadingState } from '@/components/ds'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { useRole } from '@/auth/role'
import {
  fetchMetricDefs, fetchDemoResults, fetchDemoChat, fetchValueHistory, groupDemoResults, demoFileUrl, postDemoChat, updateDemoChat, deleteDemoChat, updateDemoResult, deleteDemoResult, uploadDemoFile, removeDemoFiles, metricParts,
  type DemoMetricDef, type DemoRoundRow, type DemoChatMsg, type DemoPhotoRef, type DemoFileRef, type DemoMakerGroup, type ValueHistory, type MetricVal,
} from '@/api/demo'
import { verifyPassword } from '@/api/session'
import { prepDemoPhoto, isPhotoFile } from '@/utils/imagePrep'
import { MetricEditorDialog, MetricHistoryDialog, ValueHistoryDialog } from './DemoMetricEditor'
import DemoResultForm from './DemoResultForm'
import { MEMBERS, given } from '@/pages/Calendar/members'
import { RichBodyEditor } from '@/components/richText'
import { RichBodyView } from '@/utils/richBody'
import { createPortal } from 'react-dom'

const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')
/** 메모 날짜 — MM.DD (KST, 기존 코멘트보드 관례) */
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '') } catch { return '' } }
/** 작성자 색 — 업무/일정 담당자 색과 동일 출처 */
const memberOf = (name: string) => MEMBERS.find((m) => m.name === name || given(m.name) === name)
const AUTHOR_FALLBACK = '#8a8f98'

// 서명 URL 캐시 — 사진(비공개 버킷)을 매번 재요청하지 않도록
const urlCache = new Map<string, string>()

/** 사진 타일 — path 있으면 서명URL로 이미지, 없으면(샘플) 플레이스홀더. fit=contain이면 전체 보기(미리보기용) */
function Photo({ photo, onClick, fit = 'cover' }: { photo?: DemoPhotoRef; onClick?: () => void; fit?: 'cover' | 'contain' }) {
  const path = photo?.path
  const [url, setUrl] = useState<string | null>(path ? urlCache.get(path) ?? null : null)
  useEffect(() => {
    let alive = true
    if (path && !urlCache.has(path)) {
      demoFileUrl(path).then((u) => { urlCache.set(path, u); if (alive) setUrl(u) }).catch(() => {})
    } else if (path) setUrl(urlCache.get(path) ?? null)
    else setUrl(null)
    return () => { alive = false }
  }, [path])
  return (
    <Box onClick={onClick} sx={{ width: '100%', height: '100%', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', cursor: onClick ? 'pointer' : 'default', overflow: 'hidden' }}>
      {url ? <Box component="img" src={url} alt={photo?.name || ''} draggable={false} sx={{ width: '100%', height: '100%', objectFit: fit }} /> : <ImageOutlinedIcon sx={{ fontSize: iconSize.header }} />}
    </Box>
  )
}

// 가독성(2026-07-24): 9.5px → 11px(caption) — 사진 위 조작 칩은 작아서 못 읽는 일이 없어야 함
const roundChip = (active: boolean) => (th: Theme) => ({
  fontSize: typescale.caption.size, fontWeight: 700, lineHeight: 1, px: '7px', py: '3.5px', borderRadius: `${radius.pill}px`, border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', color: th.palette.common.white, bgcolor: active ? th.palette.primary.main : 'rgba(0,0,0,.55)',
  boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.32)',
})

// 회차 칩 옆 '+' — 같은 장비+제조사의 다음 회차 등록
const plusChip = (th: Theme) => ({
  fontSize: typescale.caption.size, fontWeight: 700, lineHeight: 1, px: '6px', py: '2.5px', borderRadius: `${radius.pill}px`,
  cursor: 'pointer', fontFamily: 'inherit', color: th.palette.common.white, bgcolor: 'rgba(0,0,0,.5)',
  border: '1px dashed rgba(255,255,255,.55)', '&:hover': { bgcolor: th.palette.primary.main, borderColor: 'transparent' },
})

/**
 * 인라인 편집 텍스트 — 평소엔 텍스트, 호버 시 연필. 클릭하면 그 항목만 앰버 밑줄 인풋으로.
 * Enter=저장(변경 시 onCommit), Esc/바깥클릭=취소. 샘플·조건 줄에서 사용.
 */
const editInputSx = (th: Theme) => ({ font: 'inherit', color: 'inherit', bgcolor: alpha(th.palette.warning.main, 0.11), boxShadow: `inset 0 -2px 0 ${alpha(th.palette.warning.main, 0.75)}`, borderRadius: '3px', p: 0 })
function SaveCancel({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
      <Tooltip title="저장"><IconButton size="small" aria-label="저장" onMouseDown={(e) => e.preventDefault()} onClick={onSave} sx={{ p: '1px', color: 'success.main' }}><CheckIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
      <Tooltip title="취소"><IconButton size="small" aria-label="취소" onMouseDown={(e) => e.preventDefault()} onClick={onCancel} sx={{ p: '1px', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
    </Box>
  )
}
// 지표 편집 단일 오픈 — 어떤 연필을 누르면 'editopen'을 쏘고, 열려 있던 다른 수정란은 이를 듣고 닫힌다
const editBus = new EventTarget()
function EditText({ text, canEdit, onCommit, align = 'left', multiline = false, placeholder = '-', display }: {
  text: string; canEdit: boolean; onCommit: (v: string) => void
  align?: 'left' | 'center'; multiline?: boolean; placeholder?: string; display?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  const start = (e: React.MouseEvent) => { e.stopPropagation(); editBus.dispatchEvent(new Event('editopen')); setV(text); setEditing(true) }
  const commit = () => { setEditing(false); const nv = v.trim(); if (nv !== (text || '').trim()) onCommit(nv) }
  useEffect(() => {
    if (!editing) return
    const close = () => setEditing(false)
    editBus.addEventListener('editopen', close)
    return () => editBus.removeEventListener('editopen', close)
  }, [editing])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!editing) return
    const onDown = (e: PointerEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false) }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [editing])
  if (editing) {
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
      else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
    }
    return (
      <Box ref={wrapRef} sx={{ position: 'relative', display: multiline ? 'block' : 'inline-block', width: multiline ? '100%' : 'auto', maxWidth: '100%', verticalAlign: 'middle' }}>
        {!multiline && <Box component="span" aria-hidden sx={{ visibility: 'hidden', whiteSpace: 'pre', display: 'inline-block', minWidth: '2ch' }}>{v || placeholder}</Box>}
        <InputBase autoFocus multiline={multiline} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} onKeyDown={onKey}
          sx={(th) => ({ ...editInputSx(th), ...(multiline ? { width: '100%' } : { position: 'absolute', inset: 0, width: '100%' }), '& textarea, & input': { textAlign: align, p: 0, font: 'inherit', minWidth: 0 } })} />
        <Box sx={(th) => ({ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', ml: '3px', zIndex: 6, display: 'flex', bgcolor: 'background.paper', border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.chip}px`, px: 0.25, boxShadow: shadow.sm })}>
          <SaveCancel onSave={commit} onCancel={() => setEditing(false)} />
        </Box>
      </Box>
    )
  }
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', maxWidth: '100%', verticalAlign: 'middle', '& .pen': { opacity: 0, transition: 'opacity .12s' }, '&:hover .pen': { opacity: canEdit ? 0.8 : 0 } }}>
      <Box component="span" sx={{ minWidth: 0, ...(multiline ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {}) }}>{display ?? (text || (canEdit ? placeholder : '-'))}</Box>
      {canEdit && <IconButton className="pen" size="small" aria-label="수정" onClick={start}
        sx={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', p: '3px', color: 'text.secondary', '&:hover': { color: 'warning.main', opacity: 1 } }}>
        <EditIcon sx={{ fontSize: iconSize.body }} />
      </IconButton>}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────
// 사진 캐러셀 — 2026-07-23 리뉴얼 확정안.
// 썸네일 없음: 사진을 옆으로 넘긴다(스크롤 스냅). 캡션은 시네마 스크림(하단 그라데이션) 위에
// 사진마다 얹히고, 인덱스는 점·대시(...ㅡ...  현재 장만 가로줄). PC = 잡고 드래그·가로휠(Shift+휠)·
// 엣지 화살표·도트 클릭 / 모바일 = 스와이프. 세로휠은 페이지 스크롤에 양보(휠 트랩 방지).
// 동작 로직은 docs/mockups/demo-photo-hscroll.html에서 적대검증·실측 완료한 코드의 React 이식.
// ─────────────────────────────────────────────────────────────
const SCRIM_GRAD = 'linear-gradient(to top, rgba(0,0,0,.88) 0%, rgba(0,0,0,.868) 12%, rgba(0,0,0,.842) 22%, rgba(0,0,0,.80) 32%, rgba(0,0,0,.742) 41%, rgba(0,0,0,.668) 49%, rgba(0,0,0,.578) 57%, rgba(0,0,0,.478) 64.5%, rgba(0,0,0,.374) 71.5%, rgba(0,0,0,.274) 78%, rgba(0,0,0,.185) 84%, rgba(0,0,0,.112) 89%, rgba(0,0,0,.058) 93%, rgba(0,0,0,.024) 96.2%, rgba(0,0,0,.006) 98.6%, rgba(0,0,0,0) 100%)'
const prefersReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

function PhotoCarousel({ photos, cover, onZoom, children }: {
  photos: DemoPhotoRef[]; cover: number; onZoom?: (idx: number) => void
  /** 무대 위에 얹을 오버레이(회차 칩·날짜 등) — data-nodrag 표기 시 드래그 시작에서 제외 */
  children?: React.ReactNode
}) {
  const n = photos.length
  const stageRef = useRef<HTMLDivElement | null>(null)
  const scRef = useRef<HTMLDivElement | null>(null)
  const clamp = useCallback((i: number) => Math.max(0, Math.min(Math.max(n - 1, 0), i)), [n])
  const [active, setActive] = useState(() => clamp(cover))
  const [dragging, setDragging] = useState(false)
  const curRef = useRef(clamp(cover))
  const suppressRef = useRef(false) // 드래그 직후 클릭(확대·화살표) 무시

  const go = useCallback((i: number, inst = false) => {
    const sc = scRef.current; if (!sc) return
    const t = Math.max(0, Math.min(n - 1, i))
    curRef.current = t
    sc.scrollTo({ left: t * (sc.clientWidth || 1), behavior: inst || prefersReduced ? 'auto' : 'smooth' })
    setActive(t)
  }, [n])

  // 시작 장 = 대표사진(cover). 폭이 바뀌면(창 리사이즈) 현재 장 위치로 재정렬
  useEffect(() => {
    const sc = scRef.current; if (!sc) return
    const start = clamp(cover)
    curRef.current = start; setActive(start)
    sc.scrollTo({ left: start * (sc.clientWidth || 1) })
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => { sc.scrollTo({ left: curRef.current * (sc.clientWidth || 1) }) })
    ro.observe(sc)
    return () => ro.disconnect()
  }, [cover, clamp])

  // 휠·드래그 — 무대 전체에서 받음(투명 화살표 위에서도 동일). 검증 완료 로직 이식.
  useEffect(() => {
    const stage = stageRef.current, sc = scRef.current
    if (!stage || !sc || n < 2) return
    const W = () => sc.clientWidth || 1
    const idx = () => Math.max(0, Math.min(n - 1, Math.round(sc.scrollLeft / W())))
    const goIn = (i: number) => {
      const t = Math.max(0, Math.min(n - 1, i))
      curRef.current = t
      sc.scrollTo({ left: t * W(), behavior: prefersReduced ? 'auto' : 'smooth' })
      setActive(t)
    }
    let snapT: ReturnType<typeof setTimeout> | undefined
    const lockSnap = () => { clearTimeout(snapT); setDragging(true) }
    const releaseSnap = () => { clearTimeout(snapT); snapT = setTimeout(() => setDragging(false), 450) }

    // 가로 휠(트랙패드 가로·틸트휠)·Shift+휠만 넘김 — 세로 휠은 페이지에, Ctrl+휠(확대)은 브라우저에 양보
    let acc = 0, at = 0, cool = 0
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return
      const horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
      if (!horiz) return
      e.preventDefault()
      const raw = horiz * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? 400 : 1)
      const now = performance.now()
      if (now < cool) return
      if (now - at > 300) acc = 0
      at = now; acc += raw
      if (Math.abs(acc) >= 40) { goIn(curRef.current + (acc > 0 ? 1 : -1)); acc = 0; cool = now + 400 }
    }

    let pd: { x: number; l: number; id: number; moved: boolean } | null = null
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      const t = e.target as HTMLElement
      if (t.closest && t.closest('[data-nodrag]')) return // 도트·회차칩 등 자체 클릭 요소
      e.preventDefault()
      lockSnap()
      pd = { x: e.clientX, l: sc.scrollLeft, id: e.pointerId, moved: false }
    }
    const onMove = (e: PointerEvent) => {
      if (!pd || e.pointerId !== pd.id) return
      if (e.buttons === 0) { onUp(e); return } // 창 전환 등으로 up 유실 시 고착 방지
      const dx = e.clientX - pd.x
      if (Math.abs(dx) > 4) pd.moved = true
      sc.scrollLeft = pd.l - dx
      setActive(idx()) // 드래그 중에도 대시가 실시간으로 따라오게
    }
    const onUp = (e: PointerEvent) => {
      if (!pd || e.pointerId !== pd.id) return
      const moved = pd.moved; pd = null
      if (moved) {
        suppressRef.current = true
        setTimeout(() => { suppressRef.current = false }, 80)
        goIn(idx()); releaseSnap()
      } else setDragging(false)
    }
    // 터치 스와이프·스무스 스크롤 중에도 대시가 실시간으로 따라오게(매 이벤트), 멈추면 현재 장 확정
    let settleT: ReturnType<typeof setTimeout> | undefined
    const onScroll = () => {
      setActive(idx())
      clearTimeout(settleT)
      settleT = setTimeout(() => { if (!pd) { curRef.current = idx(); setActive(idx()) } }, 150)
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    stage.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(snapT); clearTimeout(settleT)
      stage.removeEventListener('wheel', onWheel)
      stage.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      sc.removeEventListener('scroll', onScroll)
    }
  }, [n])

  const navBtn = (dir: -1 | 1) => (
    <Box component="button" type="button" aria-label={dir < 0 ? '이전 사진' : '다음 사진'} className="pc-nav"
      onClick={() => { if (suppressRef.current) return; go(curRef.current + dir) }}
      sx={{
        position: 'absolute', top: 0, bottom: 22, width: '18%', zIndex: 6, display: 'flex', alignItems: 'center',
        justifyContent: dir < 0 ? 'flex-start' : 'flex-end', p: '0 4px', border: 0, color: 'common.white', opacity: 0,
        cursor: 'pointer', transition: 'opacity .15s ease',
        ...(dir < 0 ? { left: 0 } : { right: 0 }),
        background: dir < 0
          ? 'linear-gradient(90deg, rgba(255,255,255,.16), rgba(255,255,255,.04) 55%, transparent 80%)'
          : 'linear-gradient(270deg, rgba(255,255,255,.16), rgba(255,255,255,.04) 55%, transparent 80%)',
        '&:focus-visible': { opacity: 1, outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
        '@media (hover: none)': { display: 'none' },
      }}>
      {dir < 0 ? <ChevronLeftIcon sx={{ fontSize: 30, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} /> : <ChevronRightIcon sx={{ fontSize: 30, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />}
    </Box>
  )

  return (
    <Box ref={stageRef}
      onClickCapture={(e) => { if (suppressRef.current) { e.preventDefault(); e.stopPropagation() } }}
      sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', bgcolor: 'background.default', '&:hover .pc-nav': { opacity: 1 } }}>
      {/* 슬라이드 스크롤러 — 스크롤바 숨김, 장당 100% 스냅 */}
      <Box ref={scRef} sx={{
        position: 'absolute', inset: 0, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
        scrollSnapType: dragging ? 'none' : 'x mandatory', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        cursor: n > 1 ? (dragging ? 'grabbing' : 'grab') : 'default', userSelect: 'none', WebkitUserSelect: 'none', overscrollBehaviorX: 'contain',
      }}>
        {n === 0 ? (
          <Box sx={{ flex: '0 0 100%', minWidth: '100%' }}><Photo /></Box>
        ) : photos.map((p, i) => (
          <Box key={`${p.path || p.name}-${i}`} sx={{ position: 'relative', flex: '0 0 100%', minWidth: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always', overflow: 'hidden' }}>
            <Photo photo={p} fit="contain" onClick={onZoom ? () => onZoom(i) : undefined} />
            {/* 시네마 스크림 + 캡션(사진마다) — 하단 44% 그라데이션 위에 설명·내부 인덱스 */}
            {(p.caption || n > 1) && (
              <>
                <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '44%', zIndex: 2, pointerEvents: 'none', background: SCRIM_GRAD }} />
                <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 3, pointerEvents: 'none', px: 1.5, pb: '20px', display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0, fontSize: typescale.body.size, lineHeight: 1.5, color: '#f0f4f9', textShadow: '0 1px 2px rgba(0,0,0,.55)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.caption || ''}</Box>
                  {n > 1 && <Box sx={{ flex: 'none', fontSize: typescale.caption.size, fontWeight: 500, letterSpacing: '.04em', color: 'rgba(255,255,255,.8)', fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 3px rgba(0,0,0,.6)' }}>{i + 1} / {n}</Box>}
                </Box>
              </>
            )}
          </Box>
        ))}
      </Box>
      {/* 인덱스 — 점(다른 장)·가로줄(현재 장). 클릭 = 그 장으로 */}
      {n > 1 && (
        <Box data-nodrag role="tablist" aria-label="사진 선택" sx={{ position: 'absolute', left: 0, right: 0, bottom: '4px', zIndex: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', pointerEvents: 'none' }}>
          {photos.map((_, i) => (
            <Box key={i} component="button" type="button" aria-label={`${i + 1}번째 사진`} aria-selected={i === active} role="tab"
              onClick={(e) => { e.stopPropagation(); go(i) }}
              sx={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', width: i === active ? 26 : 16, height: 16, p: 0, border: 0, background: 'none', cursor: 'pointer', transition: 'width .18s cubic-bezier(.2,.7,.3,1)' }}>
              <Box component="span" sx={{ display: 'block', width: i === active ? 20 : 6, height: 6, borderRadius: `${radius.pill}px`, bgcolor: i === active ? 'common.white' : 'rgba(255,255,255,.45)', boxShadow: '0 1px 3px rgba(0,0,0,.55)', transition: 'width .18s cubic-bezier(.2,.7,.3,1), background-color .15s ease', '&:hover': { bgcolor: i === active ? 'common.white' : 'rgba(255,255,255,.75)' } }} />
            </Box>
          ))}
        </Box>
      )}
      {n > 1 && navBtn(-1)}
      {n > 1 && navBtn(1)}
      {children}
    </Box>
  )
}

// 파일 열기 — 서명URL로 새 탭(다운로드 아님). path 없으면(샘플) 무시
async function openFile(f: DemoFileRef) {
  if (!f.path) return
  try { const u = await demoFileUrl(f.path); window.open(u, '_blank', 'noopener,noreferrer') } catch { /* noop */ }
}

// ── 지표 칩박스 — 측정한 것만 사진 밑에 칩으로. 라벨(회색)·값+단위(흰색 크게)·조건(회색) ──
interface ChipInfo { key: string; label: string; value: string; unit: string; cond: string; isDef: boolean }
/** 값이 실제로 있는가 — 구형 데이터의 빈 문자열('')·공백은 '측정 안 함'으로 취급(칩 숨김·재입력 허용) */
const hasMetricVal = (m: MetricVal | undefined) => m != null && String(metricParts(m).v ?? '').trim() !== ''
function chipsOf(round: DemoRoundRow, defs: DemoMetricDef[], defsAll: DemoMetricDef[]): ChipInfo[] {
  const out: ChipInfo[] = []
  const used = new Set<string>()
  // 비활성 지표 값은 구 표와 동일하게 화면에서 숨김(키는 데이터에 보존)
  const inactive = new Set(defsAll.filter((d) => !d.active).map((d) => d.key))
  const push = (key: string, def?: DemoMetricDef) => {
    const raw = round.metrics[key]
    if (!hasMetricVal(raw)) return
    const p = metricParts(raw!)
    out.push({ key, label: def?.label || key, value: p.v, unit: p.unit ?? def?.unit ?? '', cond: p.cond || '', isDef: !!def })
    used.add(key)
  }
  for (const d of defs) push(d.key, d) // 표준 지표 먼저(정의 순서 — 제조사 간 같은 순서 보장)
  for (const k of Object.keys(round.metrics)) if (!used.has(k) && !inactive.has(k)) push(k)
  return out
}

function ChipRow({ round, defs, defsAll, canEdit, onEditChip, onAddChip }: {
  round: DemoRoundRow; defs: DemoMetricDef[]; defsAll: DemoMetricDef[]; canEdit: boolean
  onEditChip: (chip: ChipInfo) => void; onAddChip: () => void
}) {
  const chips = chipsOf(round, defs, defsAll)
  if (chips.length === 0 && !canEdit) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
      {chips.map((c) => (
        <Box key={c.key} component={canEdit ? 'button' : 'div'} type={canEdit ? 'button' : undefined}
          onClick={canEdit ? () => onEditChip(c) : undefined}
          sx={(th) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px', minWidth: 92, maxWidth: 260,
            px: 1.25, py: '7px', textAlign: 'left', fontFamily: 'inherit',
            bgcolor: 'background.default', border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.button}px`,
            ...(canEdit ? { cursor: 'pointer', transition: 'border-color .15s ease', '&:hover': { borderColor: th.palette.primary.main } } : {}),
          })}>
          {/* 가독성(2026-07-24): 라벨·단위·조건을 한 단계 키우고(11→12) 조건은 흐림→보조색으로 */}
          <Box sx={{ fontSize: typescale.small.size, fontWeight: 500, color: 'text.secondary', lineHeight: 1.3 }}>{c.label}</Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
            <Box component="span" sx={{ fontSize: typescale.cardTitle.size, fontWeight: 700, color: 'text.primary', lineHeight: 1.25, fontVariantNumeric: 'tabular-nums' }}>{c.value}</Box>
            {c.unit && <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: 500, color: 'text.secondary' }}>{c.unit}</Box>}
          </Box>
          {c.cond && (
            <Tooltip title={c.cond} placement="bottom-start" enterDelay={400}>
              <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary', lineHeight: 1.4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cond}</Box>
            </Tooltip>
          )}
        </Box>
      ))}
      {canEdit && (
        <Box component="button" type="button" onClick={onAddChip}
          sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: 0.5, alignSelf: 'stretch', minHeight: 52, px: 1.25, border: `1px dashed ${th.palette.divider}`, borderRadius: `${radius.button}px`, background: 'none', color: 'text.secondary', fontSize: typescale.small.size, fontFamily: 'inherit', cursor: 'pointer', transition: 'color .15s ease, border-color .15s ease', '&:hover': { color: th.palette.primary.main, borderColor: th.palette.primary.main } })}>
          <AddIcon sx={{ fontSize: iconSize.body }} /> 지표
        </Box>
      )}
    </Box>
  )
}

/** 지표 칩 추가/수정 다이얼로그 — 저장·삭제 모두 metrics 병합 후 비밀번호 재확인(조작방지)으로 이어짐 */
function ChipDialog({ mode, round, defs, chip, onClose, onSubmit }: {
  mode: 'add' | 'edit'; round: DemoRoundRow; defs: DemoMetricDef[]; chip?: ChipInfo
  onClose: () => void
  onSubmit: (metrics: Record<string, MetricVal>, what: string) => void
}) {
  const [label, setLabel] = useState(chip?.label || '')
  const [v, setV] = useState(chip?.value || '')
  const [unit, setUnit] = useState(chip?.unit || '')
  const [cond, setCond] = useState(chip?.cond || '')
  const [err, setErr] = useState('')
  const listId = `chip-defs-${round.id}`
  // 자동완성 후보 — 표준 지표 정의(같은 이름을 고르면 제조사 간 표기가 통일됨).
  // '이미 씀' 판정은 실제 값 존재 기준(hasMetricVal) — 구형 빈 값('') 키는 재입력 가능해야 함
  const options = defs.filter((d) => mode === 'edit' || !hasMetricVal(round.metrics[d.key])).map((d) => d.label)
  const matchedDef = mode === 'edit'
    ? (chip?.isDef ? defs.find((d) => d.key === chip.key) : undefined)
    : defs.find((d) => d.label === label.trim())
  const save = () => {
    const lb = label.trim()
    if (!lb) { setErr('지표명을 입력해주세요'); return }
    if (!v.trim()) { setErr('값을 입력해주세요'); return }
    const key = mode === 'edit' ? chip!.key : matchedDef ? matchedDef.key : lb
    if (mode === 'add' && hasMetricVal(round.metrics[key])) { setErr('이미 있는 지표입니다 — 칩을 눌러 수정하세요'); return }
    const useUnit = matchedDef ? '' : unit.trim() // 표준 지표는 정의의 단위를 쓰므로 값에 안 넣음
    const val: MetricVal = cond.trim() || useUnit ? { v: v.trim(), ...(useUnit ? { unit: useUnit } : {}), ...(cond.trim() ? { cond: cond.trim() } : {}) } : v.trim()
    onSubmit({ ...round.metrics, [key]: val }, `${lb} ${mode === 'add' ? '추가' : '수정'}`)
  }
  const del = () => {
    if (!chip) return
    const nm = { ...round.metrics }
    delete nm[chip.key]
    onSubmit(nm, `${chip.label} 삭제`)
  }
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight }}>{mode === 'add' ? '지표 추가' : `${chip?.label} 수정`} · {round.round}차</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        {mode === 'add' && (
          <>
            <TextField size="small" label="지표명" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus
              slotProps={{ htmlInput: { list: listId } }} helperText={matchedDef ? `표준 지표(단위 ${matchedDef.unit || '없음'})와 연결됩니다` : '자유 입력 가능 — 같은 이름이면 제조사끼리 나란히 보입니다'} />
            <Box component="datalist" id={listId}>{options.map((o) => <option key={o} value={o} />)}</Box>
          </>
        )}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" label="값" value={v} onChange={(e) => setV(e.target.value)} autoFocus={mode === 'edit'} sx={{ flex: 1.4 }} />
          {matchedDef
            ? <TextField size="small" label="단위" value={matchedDef.unit || ''} disabled sx={{ flex: 1 }} />
            : <TextField size="small" label="단위(선택)" value={unit} onChange={(e) => setUnit(e.target.value)} sx={{ flex: 1 }} />}
        </Box>
        <TextField size="small" label="조건(선택)" value={cond} onChange={(e) => setCond(e.target.value)} placeholder="예: CF4 80sccm · 20mTorr · 5포인트" multiline maxRows={2}
          helperText="이 값이 나온 측정 조건 — 칩 아래 회색 글씨로 함께 보입니다" />
        {err && <Box sx={{ fontSize: typescale.small.size, color: 'error.main' }}>{err}</Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {mode === 'edit' && <Button color="error" onClick={del} sx={{ mr: 'auto' }}>삭제</Button>}
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={save}>저장</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── 검토 메모 스트림 — 풀폭 1열 행 리스트(장비 공용, 제조사 무관이 배치로 읽히게) ──
function MemoRow({ m, own, busy, onEdit, onDelete }: { m: DemoChatMsg; own: boolean; busy: boolean; onEdit: (body: string) => Promise<void>; onDelete: () => void }) {
  const c = memberOf(m.author)?.color || AUTHOR_FALLBACK
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState('')
  // 구형(제목만 있는) 메모 호환 — 본문이 비면 제목을 편집기에 시드(수정 불가 데드락 방지)
  const startEdit = () => { setBody(m.body || m.title || ''); setEditing(true) }
  const save = async () => { try { await onEdit(body); setEditing(false) } catch { /* 스낵바는 상위에서 */ } }
  return (
    <Box sx={{ display: 'flex', gap: 1.25, py: 1.1, alignItems: 'flex-start', '& + &': { borderTop: 1, borderColor: 'divider' }, '&:hover .memo-act': { opacity: 1 } }}>
      <Box aria-hidden sx={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', bgcolor: c, color: 'common.white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: typescale.caption.size, fontWeight: 700, mt: '1px' }}>{(given(m.author) || m.author || '?').charAt(0)}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <Box>
            <RichBodyEditor value={body} onChange={setBody} placeholder="내용" ariaLabel="메모 수정" fontSize={typescale.body.size} minHeight={40} onCtrlEnter={() => void save()} compact />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
              <Button size="small" onClick={() => setEditing(false)} disabled={busy} sx={{ color: 'text.secondary', fontSize: typescale.small.size, minWidth: 0 }}>취소</Button>
              <Button size="small" variant="contained" onClick={() => void save()} disabled={busy || !body.trim()} sx={{ fontSize: typescale.small.size, minWidth: 0 }}>수정</Button>
            </Box>
          </Box>
        ) : (
          <>
            {/* 구버전(제목 있는 카드) 호환 — 제목은 굵은 첫 줄로 */}
            {m.title && <Box sx={{ fontSize: typescale.body.size, fontWeight: 600, lineHeight: 1.45, wordBreak: 'break-word' }}>{m.title}</Box>}
            {m.body && <Box sx={{ fontSize: typescale.body.size, lineHeight: 1.55, color: 'text.primary', wordBreak: 'break-word' }}><RichBodyView html={m.body} /></Box>}
          </>
        )}
      </Box>
      <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 0.75, mt: '2px' }}>
        <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: 500, color: c }}>{given(m.author) || m.author}</Box>
        <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>{fmtDay(m.createdAt)}</Box>
        {own && !editing && (
          <Box className="memo-act" sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity .12s' }}>
            <Tooltip title="수정"><IconButton size="small" aria-label="메모 수정" onClick={startEdit} sx={{ p: '2px', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}><EditIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
            <Tooltip title="삭제"><IconButton size="small" aria-label="메모 삭제" onClick={onDelete} sx={{ p: '2px', color: 'text.secondary', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function MemoStream({ memos, canPost, canModerate, user, busy, onPost, onEdit, onDelete }: {
  memos: DemoChatMsg[]; canPost: boolean; canModerate: boolean; user: string | null; busy: boolean
  onPost: (body: string) => Promise<void>
  onEdit: (id: number, title: string, body: string) => Promise<void>
  onDelete: (id: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const ownOf = (m: DemoChatMsg) => canModerate || (!!user && m.author === user)
  const save = async () => { try { await onPost(draft); setAdding(false); setDraft('') } catch { /* 스낵바는 상위에서 */ } }
  return (
    <Box sx={{ mt: 2, borderTop: 1, borderColor: 'divider', pt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.25 }}>
        <Box sx={{ fontSize: typescale.body.size, fontWeight: 800, letterSpacing: '.02em', color: 'text.secondary' }}>검토 메모</Box>
        <Box sx={{ fontSize: typescale.small.size, color: 'text.secondary', opacity: 0.85 }}>{memos.length > 0 ? `${memos.length}건 · ` : ''}장비 공용(제조사 무관)</Box>
      </Box>
      {memos.map((m) => (
        <MemoRow key={m.id} m={m} own={ownOf(m)} busy={busy}
          // 구형(제목만) 메모는 수정 저장 시 신형 포맷으로 이관(제목 비우고 본문에) — 제목+본문 메모는 제목 유지
          onEdit={(body) => onEdit(m.id, m.body ? m.title : '', body)} onDelete={() => onDelete(m.id)} />
      ))}
      {memos.length === 0 && !canPost && <Box sx={{ py: 1, fontSize: typescale.small.size, color: 'text.disabled' }}>메모가 없습니다.</Box>}
      {canPost && (
        adding ? (
          <Box sx={{ mt: 1 }}>
            <RichBodyEditor value={draft} onChange={setDraft} placeholder="메모 입력…" ariaLabel="메모 작성" fontSize={typescale.body.size} minHeight={44} onCtrlEnter={() => void save()} compact />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.5 }}>
              <Button size="small" onClick={() => { setAdding(false); setDraft('') }} disabled={busy} sx={{ color: 'text.secondary', fontSize: typescale.small.size, minWidth: 0 }}>취소</Button>
              <Button size="small" variant="contained" onClick={() => void save()} disabled={busy || !draft.trim()} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: typescale.small.size, minWidth: 0 }}>저장</Button>
            </Box>
          </Box>
        ) : (
          <Box role="button" tabIndex={0} onClick={() => setAdding(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdding(true) } }}
            sx={(th) => ({ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.4, minHeight: 34, border: `1px dashed ${th.palette.divider}`, borderRadius: `${radius.button}px`, color: 'text.secondary', cursor: 'pointer', fontSize: typescale.small.size, '&:hover': { borderColor: th.palette.primary.main, color: th.palette.primary.main } })}>
            <AddIcon sx={{ fontSize: iconSize.body }} /> 코멘트
          </Box>
        )
      )}
    </Box>
  )
}

/** 사진 확대(라이트박스) — 캡션이 있으면 파일명 줄 위에 함께 표시 */
function Lightbox({ photos, idx, onIdx, onClose }: { photos: DemoPhotoRef[]; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  const move = useCallback((d: number) => onIdx((idx + d + photos.length) % photos.length), [idx, photos.length, onIdx])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft') move(-1) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [move, onClose])
  const p = photos[idx]
  const edgeZone = (dir: -1 | 1) => (
    <Box role="button" aria-label={dir < 0 ? '이전 사진' : '다음 사진'}
      onClick={(e) => { e.stopPropagation(); move(dir) }}
      sx={{
        position: 'absolute', top: 0, bottom: 0, width: '40%', cursor: 'pointer',
        ...(dir < 0 ? { left: 0, borderRadius: `${radius.chip}px 0 0 ${radius.chip}px` } : { right: 0, borderTopRightRadius: `${radius.chip}px`, borderBottomRightRadius: `${radius.chip}px` }),
        display: 'flex', alignItems: 'center', justifyContent: dir < 0 ? 'flex-start' : 'flex-end',
        opacity: 0, transition: 'opacity .18s ease',
        background: dir < 0
          ? 'linear-gradient(90deg, rgba(255,255,255,.2), rgba(255,255,255,.05) 45%, transparent 75%)'
          : 'linear-gradient(270deg, rgba(255,255,255,.2), rgba(255,255,255,.05) 45%, transparent 75%)',
        '&:hover': { opacity: 1 },
      }}>
      {dir < 0
        ? <ChevronLeftIcon sx={{ fontSize: 38, color: 'common.white', ml: 0.5, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />
        : <ChevronRightIcon sx={{ fontSize: 38, color: 'common.white', mr: 0.5, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />}
    </Box>
  )
  return (
    <Box onClick={onClose} sx={(th) => ({ position: 'fixed', inset: 0, zIndex: th.zIndex.snackbar, bgcolor: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 })}>
      <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 12, right: 12, color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon /></IconButton>
      <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25, maxWidth: '92vw' }}>
        <Box sx={{ position: 'relative' }}>
          <LightboxImg photo={p} />
          {photos.length > 1 && edgeZone(-1)}
          {photos.length > 1 && edgeZone(1)}
        </Box>
        {p?.caption && <Box sx={{ color: 'rgba(255,255,255,.92)', fontSize: typescale.body.size, lineHeight: 1.5, textAlign: 'center', maxWidth: 720 }}>{p.caption}</Box>}
        <Box sx={{ color: 'rgba(255,255,255,.6)', fontSize: typescale.small.size }}>{p?.name}<Box component="span" sx={{ color: 'rgba(255,255,255,.4)', ml: 1 }}>{idx + 1} / {photos.length}</Box></Box>
      </Box>
    </Box>
  )
}
function LightboxImg({ photo }: { photo?: DemoPhotoRef }) {
  const path = photo?.path
  const [url, setUrl] = useState<string | null>(path ? urlCache.get(path) ?? null : null)
  useEffect(() => { let alive = true; if (path) demoFileUrl(path).then((u) => { urlCache.set(path, u); if (alive) setUrl(u) }).catch(() => {}); else setUrl(null); return () => { alive = false } }, [path])
  if (url) return <Box component="img" src={url} alt={photo?.name || ''} sx={{ maxWidth: '90vw', maxHeight: '74vh', objectFit: 'contain', borderRadius: `${radius.card}px` }} />
  return (
    <Box sx={{ width: 'min(78vw,520px)', height: 'min(56vh,360px)', bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,.6)' }}>
      <ImageOutlinedIcon sx={{ fontSize: 44 }} /><Box sx={{ fontSize: typescale.small.size }}>미리보기 (샘플 — 사진 업로드 시 표시)</Box>
    </Box>
  )
}

/** 사진 관리(팀원+) — 추가/삭제/대표 지정 + 사진별 캡션(시네마 스크림에 표시될 설명) */
function PhotoManageDialog({ round, maker, user, onClose, onSaved }: {
  round: DemoRoundRow; maker: string; user: string | null; onClose: () => void; onSaved: () => void
}) {
  const [kept, setKept] = useState<DemoPhotoRef[]>(round.photos)
  const [removed, setRemoved] = useState<DemoPhotoRef[]>([])
  const [added, setAdded] = useState<{ file: File; url: string; caption: string }[]>([])
  const [cover, setCover] = useState(() => Math.min(Math.max(round.cover || 0, 0), Math.max(round.photos.length - 1, 0)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const total = kept.length + added.length

  // 사진 추가 — TIF는 JPEG 변환·대용량은 1600px 리사이즈(prepDemoPhoto) 후 썸네일 표시(순서 유지)
  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return
    const imgs = Array.from(files).filter(isPhotoFile)
    if (!imgs.length) return
    void (async () => {
      for (const f of imgs) {
        const p = await prepDemoPhoto(f)
        setAdded((a) => [...a, { file: p, url: URL.createObjectURL(p), caption: '' }])
      }
    })()
  }
  // 통합 인덱스(kept 먼저, added 뒤) 기준 삭제 — 대표 인덱스 보정
  const rmAt = (i: number) => {
    if (i < kept.length) { setRemoved((r) => [...r, kept[i]]); setKept((k) => k.filter((_, j) => j !== i)) }
    else { const j = i - kept.length; URL.revokeObjectURL(added[j].url); setAdded((a) => a.filter((_, x) => x !== j)) }
    setCover((c) => (c === i ? 0 : c > i ? c - 1 : c))
  }
  const setKeptCaption = (i: number, caption: string) => setKept((k) => k.map((p, j) => (j === i ? { ...p, caption } : p)))
  const setAddedCaption = (j: number, caption: string) => setAdded((a) => a.map((p, x) => (x === j ? { ...p, caption } : p)))
  const close = () => { if (busy) return; added.forEach((a) => URL.revokeObjectURL(a.url)); onClose() }
  const save = async () => {
    if (busy) return
    if (!user) { setErr('로그인이 필요합니다'); return }
    setBusy(true); setErr('')
    try {
      const ups: DemoPhotoRef[] = []
      for (const a of added) { const m = await uploadDemoFile(a.file); ups.push({ name: m.name, path: m.path, ...(a.caption.trim() ? { caption: a.caption.trim() } : {}) }) }
      const photos = [...kept.map((p) => ({ ...p, caption: (p.caption || '').trim() || undefined })), ...ups]
      await updateDemoResult(round.id, { photos, cover: Math.min(Math.max(cover, 0), Math.max(photos.length - 1, 0)), author: user })
      void removeDemoFiles(removed.map((p) => p.path).filter(Boolean) as string[]).catch(() => {})
      added.forEach((a) => URL.revokeObjectURL(a.url))
      onSaved(); onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : '저장에 실패했습니다') }
    finally { setBusy(false) }
  }

  const capInput = (value: string, onChange: (v: string) => void) => (
    <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder="캡션(선택)"
      sx={(th) => ({ mt: '3px', width: '100%', fontSize: typescale.caption.size, color: 'text.secondary', px: 0.5, py: '1px', borderRadius: '4px', border: `1px solid transparent`, '&.Mui-focused': { border: `1px solid ${th.palette.primary.main}`, color: 'text.primary' }, '&:hover': { border: `1px solid ${th.palette.divider}` }, '& input': { p: 0 } })} />
  )
  const tileSx = (isCover: boolean, dashed = false) => ({ position: 'relative', height: 68, borderRadius: `${radius.chip}px`, overflow: 'hidden', border: isCover ? '2px solid' : `1px ${dashed ? 'dashed' : 'solid'}`, borderColor: isCover ? 'primary.main' : 'divider' }) as const

  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight }}>{maker} · {round.round}차 사진 관리</DialogTitle>
      <DialogContent>
        <input ref={inputRef} type="file" accept="image/*,.tif,.tiff" multiple hidden onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
        <Box onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
          sx={(th) => ({ border: '2px dashed', borderColor: drag ? th.palette.primary.main : th.palette.divider, bgcolor: drag ? alpha(th.palette.primary.main, 0.06) : 'transparent', borderRadius: `${radius.button}px`, p: 1, cursor: 'pointer' })}>
          {total === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.disabled', py: 1.5 }}>
              <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 26 }} /><Box sx={{ fontSize: typescale.small.size }}>사진을 끌어놓거나 클릭해 추가</Box>
            </Box>
          ) : (
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 0.75 }}>
              {kept.map((p, i) => (
                <Box key={`k${i}`}>
                  <Box sx={tileSx(i === cover)}>
                    <Photo photo={p} />
                    <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: iconSize.caption, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: iconSize.caption }} />}</IconButton></Tooltip>
                    <IconButton size="small" aria-label="사진 삭제" onClick={() => rmAt(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>
                  </Box>
                  {capInput(kept[i].caption || '', (v2) => setKeptCaption(i, v2))}
                </Box>
              ))}
              {added.map((a, j) => {
                const i = kept.length + j
                return (
                  <Box key={`a${j}`}>
                    <Box sx={tileSx(i === cover, true)}>
                      <Box component="img" src={a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: iconSize.caption, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: iconSize.caption }} />}</IconButton></Tooltip>
                      <IconButton size="small" aria-label="사진 삭제" onClick={() => rmAt(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>
                    </Box>
                    {capInput(a.caption, (v2) => setAddedCaption(j, v2))}
                  </Box>
                )
              })}
              <Box onClick={() => inputRef.current?.click()} sx={{ height: 68, borderRadius: `${radius.chip}px`, border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', cursor: 'pointer' }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: iconSize.header }} /></Box>
            </Box>
          )}
        </Box>
        <Box sx={{ mt: 0.75, fontSize: typescale.caption.size, color: 'text.disabled' }}>캡션은 사진 하단(시네마 스크림)에 표시됩니다. 사진을 넘기면 캡션도 같이 바뀝니다.</Box>
        {removed.length > 0 && <Box sx={{ mt: 0.75, fontSize: typescale.small.size, color: 'warning.main' }}>삭제 {removed.length}장 — 저장을 눌러야 반영됩니다.</Box>}
        {err && <Box sx={{ mt: 0.75, fontSize: typescale.small.size, color: 'error.main' }}>{err}</Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{busy ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * 제조사 레인 — 색 밴드(제조사·모델·첨부) + 사진 캐러셀(회차칩·날짜 오버레이) + 도구줄 + 지표 칩박스.
 * 위치=소속: 이 레인의 칩은 이 제조사 것(왼쪽 사진 아래 = 왼쪽 회사).
 */
function MakerLane({ mg, sel, onSel, defs, defsAll, canEdit, onZoom, onAddRound, onDeleteRound, onManagePhotos, onEditChip, onAddChip, onSaveMeta }: {
  mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; defs: DemoMetricDef[]; defsAll: DemoMetricDef[]; canEdit: boolean
  onZoom: (photos: DemoPhotoRef[], idx: number) => void
  onAddRound: () => void; onDeleteRound: () => void; onManagePhotos: () => void
  onEditChip: (round: DemoRoundRow, chip: ChipInfo) => void; onAddChip: (round: DemoRoundRow) => void
  onSaveMeta: (roundId: number, patch: { sample?: string; conditions?: string }) => void
}) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const cover = Math.min(Math.max(r.cover || 0, 0), Math.max(r.photos.length - 1, 0))
  const metaVisible = canEdit || !!(r.sample || '').trim() || !!(r.conditions || '').trim()
  return (
    <Box sx={{ minWidth: 0 }}>
      {/* 색깔 밴드 — 제조사·모델은 가운데, 첨부는 우측 절대배치 */}
      <Box sx={(th) => ({ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1.5, py: '4px', bgcolor: th.palette.primary.main, borderRadius: `${radius.chip}px ${radius.chip}px 0 0`, minWidth: 0 })}>
        <Box sx={{ fontSize: typescale.small.size, fontWeight: 700, color: 'common.white', minWidth: 0, maxWidth: r.files.length ? 'calc(100% - 34px)' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mg.maker}{mg.model ? <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, ml: 0.5 }}>{mg.model}</Box> : null}
        </Box>
        {r.files.length > 0 && (
          <Box sx={{ position: 'absolute', right: 5, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {r.files.map((f, i) => (
              <Tooltip key={i} title={`${f.name} 열기`} arrow>
                <Box component="span" onClick={() => void openFile(f)} sx={{ display: 'inline-flex', lineHeight: 0, flex: 'none', cursor: f.path ? 'pointer' : 'default' }}>
                  <AttachmentIcon type={f.type} name={f.name} size={16} />
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>
      {/* 사진 캐러셀 — 회차 전환 시 key로 리셋(시작 장=대표사진) */}
      <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', borderBottomLeftRadius: `${radius.chip}px`, borderBottomRightRadius: `${radius.chip}px`, overflow: 'hidden' }}>
        <PhotoCarousel key={r.id} photos={r.photos} cover={cover} onZoom={(i) => onZoom(r.photos, i)}>
          {/* 회차 칩 + '+'(다음 회차) — 캐러셀 화살표(z6)보다 위(z8) */}
          <Box data-nodrag sx={{ position: 'absolute', top: 4, left: 4, zIndex: 8, display: 'flex', gap: '3px', flexWrap: 'wrap', pr: 4 }}>
            {mg.rounds.map((rr, i) => (
              <Box key={rr.round} component="button" aria-label={`${rr.round}차`} aria-pressed={i === sel} onClick={(e) => { e.stopPropagation(); onSel(i) }} sx={roundChip(i === sel)}>{rr.round}차</Box>
            ))}
            {canEdit && (
              <Tooltip title={`${mg.maker} 다음 회차(${mg.rounds[mg.rounds.length - 1].round + 1}차) 등록`}>
                <Box component="button" aria-label="다음 회차 등록" onClick={(e) => { e.stopPropagation(); onAddRound() }} sx={plusChip}>+</Box>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ position: 'absolute', top: 4, right: 4, zIndex: 8, fontSize: typescale.caption.size, color: 'common.white', bgcolor: 'rgba(0,0,0,.55)', borderRadius: `${radius.chip}px`, px: '6px', py: '2px', fontWeight: 700, pointerEvents: 'none' }}>{fmtDate(r.date)}</Box>
        </PhotoCarousel>
      </Box>
      {/* 회차 도구 — 사진(캡션) 관리 · 데모결과 삭제 */}
      {canEdit && (
        <Box sx={{ mt: 0.4, display: 'flex', justifyContent: 'center', gap: 0.75, minHeight: 22 }}>
          {/* 가독성(2026-07-24): 도구 아이콘 13→16px, 흐림→보조색 */}
          <Tooltip title={`${r.round}차 사진·캡션 관리`}><IconButton size="small" onClick={onManagePhotos} sx={{ p: '2px', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
          <Tooltip title={`${r.round}차 데모결과 삭제`}><IconButton size="small" onClick={onDeleteRound} sx={{ p: '2px', color: 'text.secondary', '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
        </Box>
      )}
      {/* 회차 공통 정보(샘플·조건) — 인라인 수정. 칩별 상세 조건은 각 칩 안에 */}
      {metaVisible && (
        <Box sx={{ mt: canEdit ? 0.25 : 0.75, fontSize: typescale.small.size, color: 'text.secondary', lineHeight: 1.6, display: 'flex', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0 }}>
          {/* multiline 필수 — 폼이 여러 줄(\n)로 저장하는 필드라 한 줄 인풋이면 개행이 뭉개져 저장됨 */}
          <Box sx={{ display: 'inline-flex', gap: 0.5, minWidth: 0, maxWidth: '100%' }}><Box component="span" sx={{ flex: 'none', fontWeight: 500 }}>샘플</Box><EditText text={r.sample} canEdit={canEdit} multiline onCommit={(v) => onSaveMeta(r.id, { sample: v })} /></Box>
          <Box sx={{ display: 'inline-flex', gap: 0.5, minWidth: 0, maxWidth: '100%' }}><Box component="span" sx={{ flex: 'none', fontWeight: 500 }}>조건</Box><EditText text={r.conditions} canEdit={canEdit} multiline onCommit={(v) => onSaveMeta(r.id, { conditions: v })} /></Box>
        </Box>
      )}
      {/* 지표 칩박스 — 측정한 것만, 이 제조사 열 아래 */}
      <ChipRow round={r} defs={defs} defsAll={defsAll} canEdit={canEdit} onEditChip={(c) => onEditChip(r, c)} onAddChip={() => onAddChip(r)} />
    </Box>
  )
}

/** 장비종류 1묶음 — [사진+칩박스] 제조사 레인들 + 아래 풀폭 검토 메모 스트림 */
function EquipGroup({ equipment, defs, defsAll, makers, messages, canEdit, canModerate, user, chatBusy, latestValueChange, onPostChat, onEditChat, onDeleteChat, onSaveValues, onSaveMeta, onEditMetrics, onViewValueHistory, onAddRound, onDeleteRound, onReload }: {
  equipment: string; defs: DemoMetricDef[]; defsAll: DemoMetricDef[]; makers: DemoMakerGroup[]; messages: DemoChatMsg[]; canEdit: boolean; canModerate: boolean; user: string | null; chatBusy: boolean; latestValueChange?: ValueHistory
  onPostChat: (equipment: string, body: string) => Promise<void>
  onEditChat: (id: number, title: string, body: string) => Promise<void>; onDeleteChat: (id: number) => void
  onSaveValues: (roundId: number, metrics: Record<string, MetricVal>) => Promise<void>
  onSaveMeta: (roundId: number, patch: { sample?: string; conditions?: string }) => void
  onEditMetrics: () => void; onViewValueHistory: () => void; onAddRound: (mg: DemoMakerGroup) => void
  onDeleteRound: (roundId: number) => Promise<void>; onReload: () => void
}) {
  // 제조사별 선택 회차(기본=최신)
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(makers.map((m) => [m.key, m.rounds.length - 1])))
  const shown = (m: DemoMakerGroup) => m.rounds[Math.min(sel[m.key] ?? m.rounds.length - 1, m.rounds.length - 1)]
  const selOf = (m: DemoMakerGroup) => (i: number) => setSel((s) => ({ ...s, [m.key]: i }))

  const [lightbox, setLightbox] = useState<{ photos: DemoPhotoRef[]; idx: number } | null>(null)
  const [photoMg, setPhotoMg] = useState<DemoMakerGroup | null>(null)
  // 지표 칩 추가/수정 다이얼로그
  const [chipDlg, setChipDlg] = useState<{ round: DemoRoundRow; mode: 'add' | 'edit'; chip?: ChipInfo } | null>(null)

  // 지표값 저장(추가·수정·삭제 공통) — 비밀번호 재확인(조작방지) 후 metrics 통째 저장
  const [savingVal, setSavingVal] = useState(false)
  const [pwPrompt, setPwPrompt] = useState<{ roundId: number; metrics: Record<string, MetricVal>; label: string } | null>(null)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState('')
  const askChipSave = (round: DemoRoundRow, mg: DemoMakerGroup, metrics: Record<string, MetricVal>, what: string) => {
    setChipDlg(null)
    setPw(''); setPwErr(''); setPwPrompt({ roundId: round.id, metrics, label: `${mg.maker}${mg.model ? ` ${mg.model}` : ''} · ${round.round}차 — ${what}` })
  }
  const confirmSaveVal = async () => {
    if (!pwPrompt) return
    setSavingVal(true); setPwErr('')
    try {
      const ok = await verifyPassword(pw)
      if (!ok) { setPwErr('비밀번호가 올바르지 않습니다.'); return }
      await onSaveValues(pwPrompt.roundId, pwPrompt.metrics)
      setPwPrompt(null); setPw('')
    } catch (e) { setPwErr(e instanceof Error ? e.message : '저장에 실패했습니다') }
    finally { setSavingVal(false) }
  }

  // 회차 삭제 — 비밀번호 재확인(값 수정과 동일한 조작방지)
  const [delPrompt, setDelPrompt] = useState<DemoMakerGroup | null>(null)
  const [delPw, setDelPw] = useState('')
  const [delErr, setDelErr] = useState('')
  const [deleting, setDeleting] = useState(false)
  const askDelete = (m: DemoMakerGroup) => { setDelPw(''); setDelErr(''); setDelPrompt(m) }
  const confirmDelete = async () => {
    if (!delPrompt) return
    setDeleting(true); setDelErr('')
    try {
      const ok = await verifyPassword(delPw)
      if (!ok) { setDelErr('비밀번호가 올바르지 않습니다.'); return }
      await onDeleteRound(shown(delPrompt).id)
      setDelPrompt(null); setDelPw('')
    } catch (e) { setDelErr(e instanceof Error ? e.message : '삭제에 실패했습니다') }
    finally { setDeleting(false) }
  }

  const chipMakerOf = (round: DemoRoundRow) => makers.find((m) => m.rounds.some((r) => r.id === round.id))

  return (
    // 그룹 셸 — 제목띠(장비명+도구)가 레인들+메모를 통째로 감쌈
    <Box sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: `${radius.modal}px`, bgcolor: 'background.paper', boxShadow: shadow.sm, overflow: 'hidden' }}>
      {/* 제목띠 — 장비명 + 지표편집·변경이력 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: '8px', bgcolor: '#39415a', color: 'common.white' }}>
        <Box sx={{ fontSize: typescale.emphasis.size, fontWeight: 800 }}>{equipment}</Box>
        <Box sx={{ fontSize: typescale.caption.size, opacity: 0.8 }}>데모 기록 · 지표는 각 사 조건 기준</Box>
        <Box sx={{ flex: 1 }} />
        {canEdit && <Tooltip title="표준 지표 관리(자동완성 후보)"><IconButton size="small" aria-label="지표 편집" onClick={onEditMetrics} sx={{ p: '3px', color: 'rgba(255,255,255,.75)', '&:hover': { color: 'common.white' } }}><TuneIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>}
        <Tooltip title={latestValueChange ? `변경 이력 — 최근: ${latestValueChange.maker} · ${latestValueChange.changedBy}` : '변경 이력'} arrow>
          <IconButton size="small" aria-label="변경 이력" onClick={onViewValueHistory} sx={{ p: '3px', color: latestValueChange ? 'warning.light' : 'rgba(255,255,255,.75)', '&:hover': { color: 'common.white' } }}><HistoryIcon sx={{ fontSize: iconSize.body }} /></IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ p: { xs: 1.25, md: 1.75 } }}>
        {/* 제조사 레인 — 1사=풀폭 크게, 2사=반씩, 3사=1/3씩. 위치=소속(그 레인의 칩=그 제조사) */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.max(makers.length, 1)}, minmax(0, 1fr))` }, gap: { xs: 2, md: 1.5 }, alignItems: 'start' }}>
          {makers.map((m) => (
            <MakerLane key={m.key} mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={selOf(m)} defs={defs} defsAll={defsAll} canEdit={canEdit}
              onZoom={(photos, idx) => setLightbox({ photos, idx })}
              onAddRound={() => onAddRound(m)} onDeleteRound={() => askDelete(m)} onManagePhotos={() => setPhotoMg(m)}
              onEditChip={(round, chip) => setChipDlg({ round, mode: 'edit', chip })}
              onAddChip={(round) => setChipDlg({ round, mode: 'add' })}
              onSaveMeta={onSaveMeta} />
          ))}
        </Box>

        {/* 검토 메모 — 풀폭 1열 스트림(레인 열과 정렬을 끊어 '장비 공용'이 배치로 읽힘) */}
        <MemoStream memos={messages} canPost={canEdit} canModerate={canModerate} user={user} busy={chatBusy}
          onPost={(body) => onPostChat(equipment, body)} onEdit={onEditChat} onDelete={onDeleteChat} />
      </Box>

      {/* 사진 확대 — 캡션 포함 라이트박스 */}
      {lightbox && <Lightbox photos={lightbox.photos} idx={lightbox.idx} onIdx={(i) => setLightbox((l) => (l ? { ...l, idx: i } : l))} onClose={() => setLightbox(null)} />}

      {/* 사진·캡션 관리 */}
      {photoMg && (
        <PhotoManageDialog round={shown(photoMg)} maker={photoMg.maker} user={user}
          onClose={() => setPhotoMg(null)} onSaved={onReload} />
      )}

      {/* 지표 칩 추가/수정 */}
      {chipDlg && (
        <ChipDialog mode={chipDlg.mode} round={chipDlg.round} defs={defs} chip={chipDlg.chip}
          onClose={() => setChipDlg(null)}
          onSubmit={(metrics, what) => { const mg = chipMakerOf(chipDlg.round); if (mg) askChipSave(chipDlg.round, mg, metrics, what) }} />
      )}

      {/* 지표값 저장 — 비밀번호 재확인(조작방지). Enter 제출·빈값 비활성 유지 */}
      {pwPrompt && (
        <Dialog open onClose={() => !savingVal && setPwPrompt(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight }}>지표값 변경 확인</DialogTitle>
          <DialogContent>
            <Box sx={{ fontSize: typescale.body.size, color: 'text.secondary', mb: 1.25, lineHeight: 1.6 }}>
              <b>{pwPrompt.label}</b> — 변경 내용은 이력에 기록됩니다. 본인 비밀번호를 입력해주세요.
            </Box>
            <InputBase autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호"
              onKeyDown={(e) => { if (e.key === 'Enter' && pw && !savingVal) void confirmSaveVal() }}
              sx={(th) => ({ width: '100%', px: 1.25, py: 0.75, border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.input}px`, fontSize: typescale.body.size })} />
            {pwErr && <Box sx={{ mt: 0.75, fontSize: typescale.small.size, color: 'error.main' }}>{pwErr}</Box>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPwPrompt(null)} disabled={savingVal} sx={{ color: 'text.secondary' }}>취소</Button>
            <Button variant="contained" onClick={() => void confirmSaveVal()} disabled={!pw || savingVal} startIcon={savingVal ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>확인</Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 회차 삭제 — 비밀번호 재확인. 사진·첨부도 함께 삭제, 이력에 기록됨 */}
      {delPrompt && (
        <Dialog open onClose={() => !deleting && setDelPrompt(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight }}>{delPrompt.maker} · {shown(delPrompt).round}차 삭제</DialogTitle>
          <DialogContent>
            <Box sx={{ fontSize: typescale.body.size, color: 'text.secondary', mb: 1.25, lineHeight: 1.6 }}>
              사진·첨부파일도 함께 삭제되며 <b>되돌릴 수 없습니다</b>(삭제 기록은 변경 이력에 남음). 본인 비밀번호를 입력해주세요.
            </Box>
            <InputBase autoFocus type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="비밀번호"
              onKeyDown={(e) => { if (e.key === 'Enter' && delPw && !deleting) void confirmDelete() }}
              sx={(th) => ({ width: '100%', px: 1.25, py: 0.75, border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.input}px`, fontSize: typescale.body.size })} />
            {delErr && <Box sx={{ mt: 0.75, fontSize: typescale.small.size, color: 'error.main' }}>{delErr}</Box>}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDelPrompt(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
            <Button color="error" variant="contained" onClick={() => void confirmDelete()} disabled={!delPw || deleting} startIcon={deleting ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>삭제</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}

/**
 * 데모결과 뷰 — 장비도입 '데모결과' 탭. 2026-07-23 리뉴얼:
 * 사진(가로 스크롤 캐러셀 + 시네마 스크림 캡션 + 도트·대시 인덱스)이 주인공,
 * 지표는 사진 밑 칩박스(측정한 것만·조건 병기·교차 우수 판정 없음), 메모는 풀폭 스트림(장비 공용).
 */
export default function DemoResults({ addSlot }: { addSlot?: HTMLElement | null }) {
  const { isMember, isAdmin, user } = useRole()
  const [defs, setDefs] = useState<DemoMetricDef[]>([])
  const [rows, setRows] = useState<DemoRoundRow[]>([])
  const [chat, setChat] = useState<DemoChatMsg[]>([])
  const [chatBusy, setChatBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editorEquip, setEditorEquip] = useState<string | null>(null)
  const [historyEquip, setHistoryEquip] = useState<string | null>(null)
  const [valHist, setValHist] = useState<ValueHistory[]>([])
  const [valHistEquip, setValHistEquip] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formPre, setFormPre] = useState<{ equipment: string; maker?: string; model?: string }>({ equipment: '' })
  const snack = useSnack()

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchMetricDefs(), fetchDemoResults(), fetchDemoChat(), fetchValueHistory()])
      .then(([d, r, c, v]) => { setDefs(d); setRows(r); setChat(c); setValHist(v) })
      .catch((e) => snack(e instanceof Error ? e.message : '불러오기 실패', 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])
  const refetchChat = () => { void fetchDemoChat().then(setChat).catch(() => {}) }

  const groups = useMemo(() => groupDemoResults(rows, defs), [rows, defs])
  const chatOf = (eq: string) => chat.filter((m) => m.equipment === eq)
  const latestValueChangeOf = (eq: string) => valHist.find((v) => v.equipment === eq)

  const onPostChat = async (equipment: string, body: string) => {
    if (!user) throw new Error('로그인이 필요합니다')
    setChatBusy(true)
    try { await postDemoChat({ equipment, body, author: user }); refetchChat() }
    catch (e) { snack(e instanceof Error ? e.message : '메모 저장 실패', 'error'); throw e }
    finally { setChatBusy(false) }
  }
  const onEditChat = async (id: number, title: string, body: string) => {
    setChatBusy(true)
    try { await updateDemoChat(id, { title, body }); refetchChat() }
    catch (e) { snack(e instanceof Error ? e.message : '메모 수정 실패', 'error'); throw e }
    finally { setChatBusy(false) }
  }
  const onDeleteChat = async (id: number) => {
    try { await deleteDemoChat(id); refetchChat() } catch (e) { snack(e instanceof Error ? e.message : '삭제 실패', 'error') }
  }

  const onSaveValues = async (roundId: number, metrics: Record<string, MetricVal>) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateDemoResult(roundId, { metrics, author: user }); snack('지표를 저장했습니다.', 'success'); load() }
    catch (e) { snack(e instanceof Error ? e.message : '값 저장 실패', 'error'); throw e }
  }
  // 샘플·테스트조건 인라인 저장(비밀번호 없이)
  const onSaveMeta = (roundId: number, patch: { sample?: string; conditions?: string }) => {
    if (!user) { snack('로그인이 필요합니다', 'error'); return }
    updateDemoResult(roundId, { ...patch, author: user }).then(load)
      .catch((e) => snack(e instanceof Error ? e.message : '저장 실패', 'error'))
  }

  const onDeleteRound = async (roundId: number) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await deleteDemoResult(roundId, user); snack('데모결과를 삭제했습니다.', 'success'); load() }
    catch (e) { snack(e instanceof Error ? e.message : '삭제 실패', 'error'); throw e }
  }

  // '데모결과 추가' — 뷰탭(…/목록/데모결과) 옆 슬롯에 포탈로 배치되는 + 아이콘 버튼(데모결과 탭에서만 슬롯 존재)
  const addBtn = (
    <Tooltip title="데모결과 추가" arrow>
      <IconButton aria-label="데모결과 추가" onClick={() => { setFormPre({ equipment: '' }); setFormOpen(true) }}
        sx={(th) => ({ width: 30, height: 30, borderRadius: `${radius.chip}px`, bgcolor: th.palette.primary.main, color: th.palette.primary.contrastText, '&:hover': { bgcolor: th.palette.primary.dark } })}>
        <AddIcon sx={{ fontSize: iconSize.header }} />
      </IconButton>
    </Tooltip>
  )

  return (
    <>
    {/* 포탈은 프래그먼트 루트에 — Box children에 ReactPortal을 넣으면 MUI propTypes 경고 발생 */}
    {isMember && addSlot && createPortal(addBtn, addSlot)}
    <Box sx={{ p: 1.5 }}>
      {isMember && !addSlot && <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.25 }}>{addBtn}</Box>}
      {loading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: typescale.body.size }}>등록된 데모결과가 없습니다. {isMember && '“데모결과 추가”로 등록하세요.'}</Box>
      ) : (
        groups.map((g) => (
          <EquipGroup
            key={g.equipment}
            equipment={g.equipment} defs={g.defs} defsAll={defs.filter((d) => d.equipment === g.equipment)} makers={g.makers}
            messages={chatOf(g.equipment)} canEdit={isMember} canModerate={isAdmin} user={user} chatBusy={chatBusy} latestValueChange={latestValueChangeOf(g.equipment)}
            onPostChat={onPostChat} onEditChat={onEditChat} onDeleteChat={onDeleteChat} onSaveValues={onSaveValues} onSaveMeta={onSaveMeta} onReload={load}
            onEditMetrics={() => setEditorEquip(g.equipment)} onViewValueHistory={() => setValHistEquip(g.equipment)}
            onAddRound={(mg) => { setFormPre({ equipment: g.equipment, maker: mg.maker, model: mg.model }); setFormOpen(true) }}
            onDeleteRound={onDeleteRound}
          />
        ))
      )}
      {editorEquip && (
        <MetricEditorDialog open equipment={editorEquip} defs={defs} author={user}
          onClose={() => setEditorEquip(null)}
          onChanged={() => { load(); snack('지표를 변경했습니다(이력 기록됨).', 'success') }}
          onError={(msg) => snack(msg, 'error')}
          onViewDefHistory={() => setHistoryEquip(editorEquip)} />
      )}
      {historyEquip && <MetricHistoryDialog open equipment={historyEquip} onClose={() => setHistoryEquip(null)} />}
      {valHistEquip && <ValueHistoryDialog open equipment={valHistEquip} defs={defs} onClose={() => setValHistEquip(null)} />}
      <DemoResultForm open={formOpen} onClose={() => setFormOpen(false)} defs={defs} rows={rows}
        initialEquipment={formPre.equipment} initialMaker={formPre.maker} initialModel={formPre.model} user={user}
        onSaved={() => { setFormOpen(false); snack('데모결과를 추가했습니다.', 'success'); load() }}
        onError={(msg) => snack(msg, 'error')} />
    </Box>
    </>
  )
}
