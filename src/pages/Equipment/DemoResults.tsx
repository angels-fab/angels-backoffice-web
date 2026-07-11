import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
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
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CheckIcon from '@mui/icons-material/Check'
import TuneIcon from '@mui/icons-material/Tune'
import HistoryIcon from '@mui/icons-material/History'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { useRole } from '@/auth/role'
import {
  fetchMetricDefs, fetchDemoResults, fetchDemoChat, fetchValueHistory, groupDemoResults, bestMakers, demoFileUrl, postDemoChat, updateDemoChat, deleteDemoChat, reorderDemoChat, setDemoChatWidth, updateDemoResult, deleteDemoResult, updateMetricDef, uploadDemoFile, removeDemoFiles,
  type DemoMetricDef, type DemoRoundRow, type DemoChatMsg, type DemoPhotoRef, type DemoFileRef, type DemoMakerGroup, type ValueHistory,
} from '@/api/demo'
import { verifyPassword } from '@/api/session'
import { prepDemoPhoto, isPhotoFile } from '@/utils/imagePrep'
import { MetricEditorDialog, MetricHistoryDialog, ValueHistoryDialog } from './DemoMetricEditor'
import DemoChat from './DemoChat'
import DemoResultForm from './DemoResultForm'
import AddIcon from '@mui/icons-material/Add'
import { createPortal } from 'react-dom'

const COL_W = 118 // 제조사 열 고정폭(1·2·3개사 통일, 타이트)
const LABEL_W = 100 // 지표/장비명 열 폭

const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')

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
      {url ? <Box component="img" src={url} alt={photo?.name || ''} sx={{ width: '100%', height: '100%', objectFit: fit }} /> : <ImageOutlinedIcon sx={{ fontSize: 20 }} />}
    </Box>
  )
}

/** versus(≤2사) 카드 간격 — 코멘트 카드 간격(10px)과 통일. 카드 크기는 '그룹 절반 영역의 반씩'이라 1·2사 모두 동일 */
const VS_GAP = 10

/** versus 레이아웃 셀 — 값 셀(VCell) / 지표명 셀(LCell). 값 | 지표명 | 값 그리드에서 사용 */
function VCell({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: '6px 6px', fontSize: 12.5, borderTop: 1, borderColor: 'divider', minWidth: 0 }}>{children}</Box>
}
function LCell({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: '6px 10px', fontSize: 11.5, color: 'text.secondary', bgcolor: 'action.hover', borderTop: 1, borderColor: 'divider', maxWidth: 170, wordBreak: 'keep-all', lineHeight: 1.35 }}>{children}</Box>
}

const roundChip = (active: boolean) => (th: Theme) => ({
  fontSize: 9.5, fontWeight: 700, lineHeight: 1, px: '6px', py: '3px', borderRadius: '999px', border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', color: '#fff', bgcolor: active ? th.palette.primary.main : 'rgba(0,0,0,.5)',
  boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.28)',
})

// 회차 칩 옆 '+' — 같은 장비+제조사의 다음 회차 등록
const plusChip = (th: Theme) => ({
  fontSize: 10.5, fontWeight: 700, lineHeight: 1, px: '6px', py: '2.5px', borderRadius: '999px',
  cursor: 'pointer', fontFamily: 'inherit', color: '#fff', bgcolor: 'rgba(0,0,0,.5)',
  border: '1px dashed rgba(255,255,255,.55)', '&:hover': { bgcolor: th.palette.primary.main, borderColor: 'transparent' },
})

/**
 * 인라인 편집 텍스트 — 평소엔 텍스트(또는 display), 호버 시 오른쪽에 연필. 클릭하면 그 항목만 노란 테두리 인풋으로.
 * Enter/blur=저장(변경 시 onCommit), Esc=취소. 헤더·값·샘플·조건 등 공용.
 */
// 제자리 편집 인풋 — 표시 텍스트와 같은 폰트·크기·자리(레이아웃 무이동)지만 '수정칸'임이 보이게
// 앰버 틴트 배경 + 안쪽 밑줄(inset boxShadow = 높이 변화 0). 저장/취소는 onMouseDown preventDefault로 blur 선발생 방지
const editInputSx = (th: Theme) => ({ font: 'inherit', color: 'inherit', bgcolor: alpha(th.palette.warning.main, 0.11), boxShadow: `inset 0 -2px 0 ${alpha(th.palette.warning.main, 0.75)}`, borderRadius: '3px', p: 0 })
function SaveCancel({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
      <Tooltip title="저장"><IconButton size="small" aria-label="저장" onMouseDown={(e) => e.preventDefault()} onClick={onSave} sx={{ p: '1px', color: 'success.main' }}><CheckIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
      <Tooltip title="취소"><IconButton size="small" aria-label="취소" onMouseDown={(e) => e.preventDefault()} onClick={onCancel} sx={{ p: '1px', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
    </Box>
  )
}
function EditText({ text, canEdit, onCommit, align = 'left', multiline = false, placeholder = '-', display }: {
  text: string; canEdit: boolean; onCommit: (v: string) => void
  align?: 'left' | 'center'; multiline?: boolean; placeholder?: string; display?: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState('')
  const start = (e: React.MouseEvent) => { e.stopPropagation(); editBus.dispatchEvent(new Event('editopen')); setV(text); setEditing(true) }
  const commit = () => { setEditing(false); const nv = v.trim(); if (nv !== (text || '').trim()) onCommit(nv) }
  // 단일 오픈 — 다른 연필이 눌리면 이 수정란을 닫는다(새로 여는 쪽은 dispatch 후에 구독하므로 자기 자신은 안 닫힘)
  useEffect(() => {
    if (!editing) return
    const close = () => setEditing(false)
    editBus.addEventListener('editopen', close)
    return () => editBus.removeEventListener('editopen', close)
  }, [editing])
  // 바깥 클릭 = 취소 — 저장은 ✓/Enter로만(실수 저장 방지). 캡처 단계라 다른 클릭 핸들러보다 먼저 판정
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
    // 제자리 수정 — 적힌 텍스트가 그대로 인풋으로 바뀜(같은 폰트·크기·위치). 저장/취소는 연필 자리(오른쪽).
    // 한 줄 폭 = 숨은 사이저(in-flow)가 입력값 실측 폭으로 결정, 인풋은 그 위에 절대배치(인풋 고유 최소폭 무시).
    return (
      <Box ref={wrapRef} sx={{ position: 'relative', display: multiline ? 'block' : 'inline-block', width: multiline ? '100%' : 'auto', maxWidth: '100%', verticalAlign: 'middle' }}>
        {!multiline && <Box component="span" aria-hidden sx={{ visibility: 'hidden', whiteSpace: 'pre', display: 'inline-block', minWidth: '2ch' }}>{v || placeholder}</Box>}
        <InputBase autoFocus multiline={multiline} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} onKeyDown={onKey}
          sx={(th) => ({ ...editInputSx(th), ...(multiline ? { width: '100%' } : { position: 'absolute', inset: 0, width: '100%' }), '& textarea, & input': { textAlign: align, p: 0, font: 'inherit', minWidth: 0 } })} />
        <EditActions onSave={commit} onCancel={() => setEditing(false)} />
      </Box>
    )
  }
  return (
    // 수정 = 연필 클릭. 연필은 텍스트 바로 옆 절대배치(흐름 밖 = 가운데정렬 안 밀림)이고 래퍼와 간극이 없어
    // 텍스트→연필로 이동해도 호버가 끊기지 않으며(연필도 래퍼의 자식), 연필 위에서도 계속 보인다.
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', maxWidth: '100%', verticalAlign: 'middle', '& .pen': { opacity: 0, transition: 'opacity .12s' }, '&:hover .pen': { opacity: canEdit ? 0.8 : 0 } }}>
      <Box component="span" sx={{ minWidth: 0, ...(multiline ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {}) }}>{display ?? (text || (canEdit ? placeholder : '-'))}</Box>
      {canEdit && <IconButton className="pen" size="small" aria-label="수정" onClick={start}
        sx={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', p: '3px', color: 'text.disabled', '&:hover': { color: 'warning.main', opacity: 1 } }}>
        <EditIcon sx={{ fontSize: 12 }} />
      </IconButton>}
    </Box>
  )
}

/** 저장/취소 — 편집 중 '연필이 있던 자리'(입력칸 오른쪽)에 플로팅. 흐름 밖 절대배치라 레이아웃을 밀지 않음 */
function EditActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <Box sx={(th) => ({ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', ml: '3px', zIndex: 6, display: 'flex', bgcolor: 'background.paper', border: `1px solid ${th.palette.divider}`, borderRadius: '7px', px: 0.25, boxShadow: '0 2px 8px rgba(0,0,0,.3)' })}>
      <SaveCancel onSave={onSave} onCancel={onCancel} />
    </Box>
  )
}

// 지표 편집 단일 오픈 — 어떤 연필을 누르면 'editopen'을 쏘고, 열려 있던 다른 수정란은 이를 듣고 닫힌다
const editBus = new EventTarget()

/** 지표명+단위 통합 인라인 편집 — 연필 하나로 [지표명] [단위] 동시 수정 + 저장/취소 버튼 */
function EditLabelUnit({ label, unit, canEdit, onCommit }: { label: string; unit: string; canEdit: boolean; onCommit: (label: string, unit: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [l, setL] = useState(''); const [u, setU] = useState('')
  const start = (e: React.MouseEvent) => { e.stopPropagation(); editBus.dispatchEvent(new Event('editopen')); setL(label); setU(unit); setEditing(true) }
  const commit = () => { setEditing(false); if (l.trim() !== label.trim() || u.trim() !== unit.trim()) onCommit(l.trim(), u.trim()) }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false) } else if (e.key === 'Enter') { e.preventDefault(); commit() } }
  // 단일 오픈 — 다른 연필이 눌리면 이 수정란을 닫는다
  useEffect(() => {
    if (!editing) return
    const close = () => setEditing(false)
    editBus.addEventListener('editopen', close)
    return () => editBus.removeEventListener('editopen', close)
  }, [editing])
  // 바깥 클릭 = 취소 — 저장은 ✓/Enter로만
  const wrapRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!editing) return
    const onDown = (e: PointerEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setEditing(false) }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [editing])
  if (editing) {
    // 제자리 수정 — 표시(지표명 [단위]) 그대로 인풋으로 바뀜(같은 폰트·크기·자리, 앰버 밑줄만).
    // 폭 = 숨은 사이저(in-flow)가 결정, 인풋은 절대배치로 겹침(인풋 고유 최소폭 무시).
    const sizerCell = { position: 'relative', display: 'inline-block' } as const
    const overlayInput = (th: Theme) => ({ ...editInputSx(th), position: 'absolute', inset: 0, width: '100%', '& input': { textAlign: 'center', p: 0, font: 'inherit', minWidth: 0 } })
    return (
      <Box ref={wrapRef} sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 0.3, maxWidth: '100%' }}>
        <Box component="span" sx={sizerCell}>
          <Box component="span" aria-hidden sx={{ visibility: 'hidden', whiteSpace: 'pre', display: 'inline-block', minWidth: '3ch' }}>{l || '지표명'}</Box>
          <InputBase autoFocus value={l} onChange={(e) => setL(e.target.value)} placeholder="지표명" onKeyDown={onKey} sx={overlayInput} />
        </Box>
        <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>[</Box>
        <Box component="span" sx={{ ...sizerCell, fontSize: 10 }}>
          <Box component="span" aria-hidden sx={{ visibility: 'hidden', whiteSpace: 'pre', display: 'inline-block', minWidth: '2ch' }}>{u || '단위'}</Box>
          <InputBase value={u} onChange={(e) => setU(e.target.value)} placeholder="단위" onKeyDown={onKey} sx={overlayInput} />
        </Box>
        <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>]</Box>
        <EditActions onSave={commit} onCancel={() => setEditing(false)} />
      </Box>
    )
  }
  return (
    // 수정 = 연필 클릭. 연필은 절대배치(가운데정렬 안 밀림)·간극 0(호버 안 끊김 = 안 숨음)
    <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', textAlign: 'center', '& .pen': { opacity: 0, transition: 'opacity .12s' }, '&:hover .pen': { opacity: canEdit ? 0.8 : 0 } }}>
      <Box component="span" sx={{ minWidth: 0 }}>{label || (canEdit ? '지표명' : '-')}{unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.4, fontSize: 10 }}>[{unit}]</Box> : null}</Box>
      {canEdit && <IconButton className="pen" size="small" aria-label="지표 수정" onClick={start}
        sx={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', p: '3px', color: 'text.disabled', '&:hover': { color: 'warning.main', opacity: 1 } }}>
        <EditIcon sx={{ fontSize: 12 }} />
      </IconButton>}
    </Box>
  )
}

/** 제조사 열 헤더 — 색깔 밴드(제조사·모델·파일, 상단 라운드) → 사진영역(대표 크게 + 우측 썸네일 그리드 + 더보기) → 값수정 트리거 */
/** 썸네일 가로 스트립 — 스크롤바 숨김 + 좌/우 호버 화살표로 이동(라이트박스 엣지 내비와 동일 결). 클릭 = 대표사진 지정 */
function ThumbStrip({ photos, sel, onPick, scrollerRef }: { photos: DemoPhotoRef[]; sel: number; onPick: (i: number) => void; scrollerRef?: React.MutableRefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState(false)
  // 좌/우로 더 있는지 — 있는 쪽 끝을 페이드시켜 조작 전에도 '이쪽에 더 있음'이 보이게 + 화살표 표시 기준
  const [edge, setEdge] = useState({ l: false, r: false })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setEdge((prev) => {
      const l = el.scrollLeft > 2
      const r = el.scrollLeft < el.scrollWidth - el.clientWidth - 2
      return prev.l === l && prev.r === r ? prev : { l, r }
    })
    check()
    const roz = new ResizeObserver(check)
    roz.observe(el)
    el.addEventListener('scroll', check, { passive: true })
    return () => { roz.disconnect(); el.removeEventListener('scroll', check) }
  }, [photos.length])
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 100, behavior: 'smooth' })
  const arrow = (dir: -1 | 1) => (
    <Box role="button" aria-label={dir < 0 ? '이전 사진들' : '다음 사진들'} onClick={(e) => { e.stopPropagation(); scroll(dir) }}
      sx={{ position: 'absolute', top: 0, bottom: 0, ...(dir < 0 ? { left: 0 } : { right: 0 }), width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', zIndex: 1,
        background: dir < 0 ? 'linear-gradient(90deg, rgba(0,0,0,.55), transparent)' : 'linear-gradient(270deg, rgba(0,0,0,.55), transparent)' }}>
      {dir < 0 ? <ChevronLeftIcon sx={{ fontSize: 20 }} /> : <ChevronRightIcon sx={{ fontSize: 20 }} />}
    </Box>
  )
  // 끝단 페이드 — 더 있는 쪽 끝의 마지막 썸네일이 흐려져 잘려 보임(스크롤 가능 힌트)
  const mask = `linear-gradient(90deg, ${edge.l ? 'transparent 0, #000 24px' : '#000 0'}, ${edge.r ? '#000 calc(100% - 28px), transparent 100%' : '#000 100%'})`
  return (
    <Box sx={{ position: 'relative' }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <Box ref={(el: HTMLDivElement | null) => { ref.current = el; if (scrollerRef) scrollerRef.current = el }}
        sx={{ display: 'flex', gap: '2px', overflowX: 'auto', p: '2px', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, maskImage: mask, WebkitMaskImage: mask }}>
        {photos.map((p, i) => (
          <Box key={i} onClick={() => onPick(i)} sx={{ flex: '0 0 auto', width: 46, height: 34, overflow: 'hidden', borderRadius: '3px', bgcolor: '#000', cursor: 'pointer', border: i === sel ? '2px solid' : '1px solid', borderColor: i === sel ? 'primary.main' : 'divider' }}>
            <Photo photo={p} fit="cover" />
          </Box>
        ))}
      </Box>
      {edge.l && hover && arrow(-1)}
      {edge.r && hover && arrow(1)}
    </Box>
  )
}

function MakerHead({ mg, sel, onSel, onZoom, repIdx, onPick, canEdit, onAddRound, onDeleteRound, onManagePhotos }: {
  mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; onZoom: (photos: DemoPhotoRef[], idx: number) => void
  repIdx: number; onPick: (i: number) => void
  canEdit: boolean; onAddRound: () => void; onDeleteRound: () => void; onManagePhotos: () => void
}) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const ri = Math.min(Math.max(repIdx, 0), Math.max(r.photos.length - 1, 0))
  const rep = r.photos[ri]
  // 휠 = 썸네일 가로 스크롤. 38px 스트립을 정확히 겨누지 않아도 되게 '사진 카드 영역 전체'에서 받음
  const areaRef = useRef<HTMLDivElement | null>(null)
  const stripScrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const onWheel = (e: WheelEvent) => {
      const s = stripScrollRef.current
      if (!s || s.scrollWidth <= s.clientWidth + 2) return
      e.preventDefault()
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      s.scrollLeft += e.deltaMode === 1 ? raw * 16 : raw // deltaMode 1 = 줄 단위(Firefox) → px 환산
    }
    area.addEventListener('wheel', onWheel, { passive: false })
    return () => area.removeEventListener('wheel', onWheel)
  }, [])
  return (
    <Box sx={{ width: '100%' }}>
      {/* 색깔 밴드 — 제조사·모델은 항상 가운데(첨부 아이콘과 무관하게 중앙), 첨부는 우측 절대배치 */}
      <Box sx={(th) => ({ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 1.5, py: '4px', bgcolor: th.palette.primary.main, borderRadius: '8px 8px 0 0', minWidth: 0 })}>
        <Box sx={{ fontSize: 11.5, fontWeight: 700, color: '#fff', minWidth: 0, maxWidth: r.files.length ? 'calc(100% - 34px)' : '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mg.maker}{mg.model ? <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, ml: 0.5 }}>{mg.model}</Box> : null}
        </Box>
        {r.files.length > 0 && (
          <Box sx={{ position: 'absolute', right: 5, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {r.files.map((f, i) => (
              <Tooltip key={i} title={`${f.name} 열기`} arrow>
                <Box component="span" onClick={() => void openFile(f)} sx={{ display: 'inline-flex', lineHeight: 0, flex: 'none', cursor: f.path ? 'pointer' : 'default' }}>
                  <AttachmentIcon type={f.type} name={f.name} size={14} />
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}
      </Box>
      {/* 사진 영역 — 대표사진(4:3, 전체 보기·비율 다르면 검은 여백) + 하단 4:3 썸네일 4칸 고정(정렬 일관) */}
      <Box ref={areaRef} sx={{ border: 1, borderTop: 0, borderColor: 'divider', borderRadius: '0 0 8px 8px', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
          <Photo photo={rep} fit="contain" onClick={r.photos.length ? () => onZoom(r.photos, ri) : undefined} />
          {/* 회차 칩 + '+'(다음 회차 등록) */}
          <Box sx={{ position: 'absolute', top: 4, left: 4, display: 'flex', gap: '3px', flexWrap: 'wrap', pr: 4 }}>
            {mg.rounds.map((rr, i) => (
              <Box key={rr.round} component="button" aria-label={`${rr.round}차`} aria-pressed={i === sel} onClick={(e) => { e.stopPropagation(); onSel(i) }} sx={roundChip(i === sel)}>{rr.round}차</Box>
            ))}
            {canEdit && (
              <Tooltip title={`${mg.maker} 다음 회차(${mg.rounds[mg.rounds.length - 1].round + 1}차) 등록`}>
                <Box component="button" aria-label="다음 회차 등록" onClick={(e) => { e.stopPropagation(); onAddRound() }} sx={plusChip}>+</Box>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ position: 'absolute', top: 4, right: 4, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', borderRadius: '4px', px: '4px', py: '1px', fontWeight: 700 }}>{fmtDate(r.date)}</Box>
          {r.photos.length > 0 && <ZoomOutMapIcon sx={{ position: 'absolute', bottom: 4, right: 4, fontSize: 14, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', borderRadius: '4px', p: '2px' }} />}
        </Box>
        {/* 썸네일 자리 상시 확보 — 기타 사진이 없어도 공란(높이 38)으로 비워 A/B 카드·도구줄 높이 정렬 */}
        {r.photos.length > 1 ? <ThumbStrip photos={r.photos} sel={ri} onPick={onPick} scrollerRef={stripScrollRef} /> : <Box aria-hidden sx={{ height: 38 }} />}
      </Box>
      {/* 회차 도구 — 사진 관리 · 데모결과 삭제(지표값은 표 셀에서 직접 인라인 편집) */}
      {canEdit && (
        <Box sx={{ mt: 0.4, display: 'flex', justifyContent: 'center', gap: 0.5, minHeight: 18 }}>
          <Tooltip title={`${r.round}차 사진 추가·삭제`}><IconButton size="small" onClick={onManagePhotos} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
          <Tooltip title={`${r.round}차 데모결과 삭제`}><IconButton size="small" onClick={onDeleteRound} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
        </Box>
      )}
    </Box>
  )
}

// 파일 열기 — 서명URL로 새 탭(다운로드 아님). path 없으면(샘플) 무시
async function openFile(f: DemoFileRef) {
  if (!f.path) return
  try { const u = await demoFileUrl(f.path); window.open(u, '_blank', 'noopener,noreferrer') } catch { /* noop */ }
}

/** 사진 확대(라이트박스) */
function Lightbox({ photos, idx, onIdx, onClose }: { photos: DemoPhotoRef[]; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  const move = useCallback((d: number) => onIdx((idx + d + photos.length) % photos.length), [idx, photos.length, onIdx])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft') move(-1) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [move, onClose])
  const p = photos[idx]
  // 좌/우 엣지 호버 내비게이션 — 사진 안 좌·우 영역에 마우스를 올리면 끝단이 은은하게 빛나며(glossy)
  // 쉐브론이 떠오르고, 클릭하면 그 방향으로 넘어간다(화살표 버튼 대체). 키보드 ←→도 유지.
  const edgeZone = (dir: -1 | 1) => (
    <Box role="button" aria-label={dir < 0 ? '이전 사진' : '다음 사진'}
      onClick={(e) => { e.stopPropagation(); move(dir) }}
      sx={{
        position: 'absolute', top: 0, bottom: 0, width: '40%', cursor: 'pointer',
        ...(dir < 0 ? { left: 0, borderRadius: '8px 0 0 8px' } : { right: 0, borderRadius: '0 8px 8px 0' }),
        display: 'flex', alignItems: 'center', justifyContent: dir < 0 ? 'flex-start' : 'flex-end',
        opacity: 0, transition: 'opacity .18s ease',
        background: dir < 0
          ? 'linear-gradient(90deg, rgba(255,255,255,.2), rgba(255,255,255,.05) 45%, transparent 75%)'
          : 'linear-gradient(270deg, rgba(255,255,255,.2), rgba(255,255,255,.05) 45%, transparent 75%)',
        '&:hover': { opacity: 1 },
      }}>
      {dir < 0
        ? <ChevronLeftIcon sx={{ fontSize: 38, color: '#fff', ml: 0.5, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />
        : <ChevronRightIcon sx={{ fontSize: 38, color: '#fff', mr: 0.5, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />}
    </Box>
  )
  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon /></IconButton>
      <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ position: 'relative' }}>
          <LightboxImg photo={p} />
          {photos.length > 1 && edgeZone(-1)}
          {photos.length > 1 && edgeZone(1)}
        </Box>
        <Box sx={{ color: 'rgba(255,255,255,.9)', fontSize: 13 }}>{p?.name}<Box component="span" sx={{ color: 'rgba(255,255,255,.5)', ml: 1 }}>{idx + 1} / {photos.length}</Box></Box>
      </Box>
    </Box>
  )
}
function LightboxImg({ photo }: { photo?: DemoPhotoRef }) {
  const path = photo?.path
  const [url, setUrl] = useState<string | null>(path ? urlCache.get(path) ?? null : null)
  useEffect(() => { let alive = true; if (path) demoFileUrl(path).then((u) => { urlCache.set(path, u); if (alive) setUrl(u) }).catch(() => {}); else setUrl(null); return () => { alive = false } }, [path])
  if (url) return <Box component="img" src={url} alt={photo?.name || ''} sx={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 1 }} />
  return (
    <Box sx={{ width: 'min(78vw,520px)', height: 'min(56vh,360px)', bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,.6)' }}>
      <ImageOutlinedIcon sx={{ fontSize: 44 }} /><Box sx={{ fontSize: 12 }}>미리보기 (샘플 — 사진 업로드 시 표시)</Box>
    </Box>
  )
}

/** 사진 관리(팀원+) — 선택 회차의 사진 추가/삭제/대표 지정. 저장 시 업로드·행 갱신·삭제분 저장소 정리 */
function PhotoManageDialog({ round, maker, user, onClose, onSaved }: {
  round: DemoRoundRow; maker: string; user: string | null; onClose: () => void; onSaved: () => void
}) {
  const [kept, setKept] = useState<DemoPhotoRef[]>(round.photos)
  const [removed, setRemoved] = useState<DemoPhotoRef[]>([])
  const [added, setAdded] = useState<{ file: File; url: string }[]>([])
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
        setAdded((a) => [...a, { file: p, url: URL.createObjectURL(p) }])
      }
    })()
  }
  // 통합 인덱스(kept 먼저, added 뒤) 기준 삭제 — 대표 인덱스 보정
  const rmAt = (i: number) => {
    if (i < kept.length) { setRemoved((r) => [...r, kept[i]]); setKept((k) => k.filter((_, j) => j !== i)) }
    else { const j = i - kept.length; URL.revokeObjectURL(added[j].url); setAdded((a) => a.filter((_, x) => x !== j)) }
    setCover((c) => (c === i ? 0 : c > i ? c - 1 : c))
  }
  const close = () => { if (busy) return; added.forEach((a) => URL.revokeObjectURL(a.url)); onClose() }
  const save = async () => {
    if (busy) return
    if (!user) { setErr('로그인이 필요합니다'); return }
    setBusy(true); setErr('')
    try {
      const ups: DemoPhotoRef[] = []
      for (const a of added) { const m = await uploadDemoFile(a.file); ups.push({ name: m.name, path: m.path }) }
      const photos = [...kept, ...ups]
      await updateDemoResult(round.id, { photos, cover: Math.min(Math.max(cover, 0), Math.max(photos.length - 1, 0)), author: user })
      void removeDemoFiles(removed.map((p) => p.path).filter(Boolean) as string[]).catch(() => {})
      added.forEach((a) => URL.revokeObjectURL(a.url))
      onSaved(); onClose()
    } catch (e) { setErr(e instanceof Error ? e.message : '저장에 실패했습니다') }
    finally { setBusy(false) }
  }

  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>{maker} · {round.round}차 사진 관리</DialogTitle>
      <DialogContent>
        <input ref={inputRef} type="file" accept="image/*,.tif,.tiff" multiple hidden onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = '' }} />
        <Box onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
          sx={(th) => ({ border: '2px dashed', borderColor: drag ? th.palette.primary.main : th.palette.divider, bgcolor: drag ? alpha(th.palette.primary.main, 0.06) : 'transparent', borderRadius: '10px', p: 1, cursor: 'pointer' })}>
          {total === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.disabled', py: 1.5 }}>
              <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 26 }} /><Box sx={{ fontSize: 12 }}>사진을 끌어놓거나 클릭해 추가</Box>
            </Box>
          ) : (
            <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 0.75 }}>
              {kept.map((p, i) => (
                <Box key={`k${i}`} sx={{ position: 'relative', height: 68, borderRadius: '8px', overflow: 'hidden', border: i === cover ? '2px solid' : '1px solid', borderColor: i === cover ? 'primary.main' : 'divider' }}>
                  <Photo photo={p} />
                  <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: 14, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: 14 }} />}</IconButton></Tooltip>
                  <IconButton size="small" aria-label="사진 삭제" onClick={() => rmAt(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
                </Box>
              ))}
              {added.map((a, j) => {
                const i = kept.length + j
                return (
                  <Box key={`a${j}`} sx={{ position: 'relative', height: 68, borderRadius: '8px', overflow: 'hidden', border: i === cover ? '2px solid' : '1px dashed', borderColor: i === cover ? 'primary.main' : 'divider' }}>
                    <Box component="img" src={a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: 14, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: 14 }} />}</IconButton></Tooltip>
                    <IconButton size="small" aria-label="사진 삭제" onClick={() => rmAt(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
                  </Box>
                )
              })}
              <Box onClick={() => inputRef.current?.click()} sx={{ height: 68, borderRadius: '8px', border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', cursor: 'pointer' }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20 }} /></Box>
            </Box>
          )}
        </Box>
        {removed.length > 0 && <Box sx={{ mt: 0.75, fontSize: 11.5, color: 'warning.main' }}>삭제 {removed.length}장 — 저장을 눌러야 반영됩니다.</Box>}
        {err && <Box sx={{ mt: 0.75, fontSize: 12, color: 'error.main' }}>{err}</Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{busy ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  )
}

/** 장비종류 1묶음 — 경쟁 제조사 매트릭스 + (오른쪽) 비교 채팅 */
function EquipGroup({ equipment, defs, makers, messages, canEdit, canModerate, user, chatBusy, latestValueChange, onPostChat, onEditChat, onDeleteChat, onReorderChat, onWidthChat, onSaveValues, onSaveMeta, onSaveMetricDef, onEditMetrics, onViewValueHistory, onAddRound, onDeleteRound, onReload }: {
  equipment: string; defs: DemoMetricDef[]; makers: DemoMakerGroup[]; messages: DemoChatMsg[]; canEdit: boolean; canModerate: boolean; user: string | null; chatBusy: boolean; latestValueChange?: ValueHistory
  onPostChat: (equipment: string, title: string, body: string) => Promise<void>
  onEditChat: (id: number, title: string, body: string) => Promise<void>; onDeleteChat: (id: number) => void
  onReorderChat: (ids: number[]) => void; onWidthChat: (id: number, width: number) => void
  onSaveValues: (roundId: number, metrics: Record<string, string>) => Promise<void>
  onSaveMeta: (roundId: number, patch: { sample?: string; conditions?: string }) => Promise<void>
  onSaveMetricDef: (defId: number, patch: { label?: string; unit?: string }) => Promise<void>
  onEditMetrics: () => void; onViewValueHistory: () => void; onAddRound: (mg: DemoMakerGroup) => void
  onDeleteRound: (roundId: number) => Promise<void>; onReload: () => void
}) {
  // 제조사별 선택 회차(기본=최신)
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(makers.map((m) => [m.key, m.rounds.length - 1])))
  const shown = (m: DemoMakerGroup) => m.rounds[Math.min(sel[m.key] ?? m.rounds.length - 1, m.rounds.length - 1)]

  // 대표사진(크게 보이는 사진) 인덱스 — 제조사별. 기본=회차 cover, 썸네일 클릭 시 교체. 회차 바뀌면 리셋(cover 폴백)
  const [repSel, setRepSel] = useState<Record<string, number>>({})
  const repIdxOf = (m: DemoMakerGroup) => {
    const rd = shown(m)
    const cover = Math.min(Math.max(rd.cover || 0, 0), Math.max(rd.photos.length - 1, 0))
    return repSel[m.key] ?? cover
  }
  const selOf = (m: DemoMakerGroup) => (i: number) => { setSel((s) => ({ ...s, [m.key]: i })); setRepSel((rs) => { const n = { ...rs }; delete n[m.key]; return n }) }
  const pickOf = (m: DemoMakerGroup) => (i: number) => setRepSel((rs) => ({ ...rs, [m.key]: i }))
  // 사진 확대(라이트박스) — 대표사진 클릭 시 그 자리 열람(드로어 없이 1단계)
  const [lightbox, setLightbox] = useState<{ photos: DemoPhotoRef[]; idx: number } | null>(null)
  // 사진 관리(추가·삭제·대표) — 선택 회차 대상
  const [photoMg, setPhotoMg] = useState<DemoMakerGroup | null>(null)

  // 지표값 수정 = 셀별 인라인 편집. 저장 시 비밀번호 재확인(조작방지). pwPrompt = 저장 대기(제조사·라운드·병합된 metrics)
  const [savingVal, setSavingVal] = useState(false)
  const [pwPrompt, setPwPrompt] = useState<{ maker: DemoMakerGroup; roundId: number; metrics: Record<string, string>; label: string } | null>(null)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState('')
  // 값 셀 한 칸 수정 → 변경 있으면 비밀번호창(전체 metrics에 병합해 저장)
  const askValueSave = (m: DemoMakerGroup, key: string, val: string) => {
    const round = shown(m)
    if ((round.metrics[key] ?? '') === val) return // 변경 없음
    setPw(''); setPwErr(''); setPwPrompt({ maker: m, roundId: round.id, metrics: { ...round.metrics, [key]: val }, label: `${m.maker}${m.model ? ` ${m.model}` : ''} · ${round.round}차` })
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

  const bestFor = (def: DemoMetricDef) => bestMakers(def, makers.map((m) => ({ key: m.key, value: shown(m).metrics[def.key] })))
  // 카드(제조사) 열 기준 너비 — 실사용 최대 2사. 1곳이면 좌우 패드로 가운데, 2곳이면 가득.
  // (혹시 3사 데이터가 있어도 basis가 그만큼 늘어 안전.) Chrome fixed 테이블 calc() 무시 우회 → colgroup 등분 + colSpan(카드=2칸).
  const basis = Math.max(2, makers.length)
  const tableMinW = LABEL_W + basis * COL_W
  const subCols = 2 * basis // 카드 1장 = 2 서브컬럼
  const padSpan = basis - makers.length // 좌우 각각의 패드 서브컬럼 수: 0(가득)·1(가운데)

  return (
    // 그룹 셸 — 제목띠(장비명+도구)가 표+코멘트를 통째로 감쌈. 그룹끼리는 카드 경계로 구분
    <Box sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: '14px', bgcolor: 'background.paper', boxShadow: '0 6px 18px rgba(0,0,0,.16)', overflow: 'hidden' }}>
      {/* 제목띠 — 장비명 + 지표편집·변경이력. 대비색 밴드로 표·코멘트 전체를 묶음 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: '8px', bgcolor: '#39415a', color: '#fff' }}>
        <Box sx={{ fontSize: 14, fontWeight: 800 }}>{equipment}</Box>
        <Box sx={{ fontSize: 11, opacity: 0.65 }}>데모 비교</Box>
        <Box sx={{ flex: 1 }} />
        {canEdit && <Tooltip title="지표 편집"><IconButton size="small" aria-label="지표 편집" onClick={onEditMetrics} sx={{ p: '3px', color: 'rgba(255,255,255,.75)', '&:hover': { color: '#fff' } }}><TuneIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
        <Tooltip title={latestValueChange ? `변경 이력 — 최근: ${latestValueChange.maker} · ${latestValueChange.changedBy}` : '변경 이력'} arrow>
          <IconButton size="small" aria-label="변경 이력" onClick={onViewValueHistory} sx={{ p: '3px', color: latestValueChange ? 'warning.light' : 'rgba(255,255,255,.75)', '&:hover': { color: '#fff' } }}><HistoryIcon sx={{ fontSize: 16 }} /></IconButton>
        </Tooltip>
      </Box>

      {/* 본문 — 데모카드(≤2사=versus / 3사+=표) + 코멘트(오른쪽, 좁은 화면은 아래) */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start', gap: 1.5, p: { xs: 1.25, md: 1.5 } }}>
      {/* 데모카드 영역 = 그룹의 절반(코멘트와 50:50). 가로스크롤은 3사+ 표에서만(2사 versus엔 불필요) */}
      <Box sx={{ flex: { xs: '0 1 auto', md: '1 1 0' }, minWidth: 0, maxWidth: '100%', overflowX: makers.length > 2 ? 'auto' : 'visible' }}>
        {makers.length > 2 ? (
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
          {/* 열 정의 — 라벨(고정) + 등분 서브컬럼(카드 1장 = 2칸) */}
          <Box component="colgroup">
            <Box component="col" sx={{ width: LABEL_W }} />
            {Array.from({ length: subCols }).map((_, i) => <Box component="col" key={i} />)}
          </Box>
          <Box component="thead">
            <Box component="tr">
              {/* 라벨 열 헤더 — 장비명·도구는 제목띠로 이동. 빈 칸 */}
              <Box component="th" aria-hidden sx={{ borderRight: 1, borderColor: 'divider' }} />
              {padSpan > 0 && <Box component="th" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
              {makers.map((m, mi) => (
                <Box component="th" key={m.key} colSpan={2} sx={{ p: '4px 6px', textAlign: 'center', verticalAlign: 'top', borderLeft: mi > 0 ? 1 : 0, borderColor: 'divider' }}>
                  <MakerHead mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={selOf(m)} onZoom={(photos, idx) => setLightbox({ photos, idx })} repIdx={repIdxOf(m)} onPick={pickOf(m)}
                    canEdit={canEdit}
                    onAddRound={() => onAddRound(m)} onDeleteRound={() => askDelete(m)} onManagePhotos={() => setPhotoMg(m)} />
                </Box>
              ))}
              {padSpan > 0 && <Box component="th" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
            </Box>
          </Box>
          <Box component="tbody">
            {defs.length === 0 && (
              <Box component="tr"><Box component="td" colSpan={1 + subCols} sx={{ p: 1.5, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>등록된 표준 지표가 없습니다. 위 "지표 편집"에서 추가하세요.</Box></Box>
            )}
            {/* 샘플·테스트조건 — 선택 회차 기준, 값 있거나 편집 가능하면 지표 위에 표시. 값은 가운데정렬 + 셀별 인라인 수정 */}
            {(([['샘플', 'sample'], ['테스트조건', 'conditions']]) as [string, 'sample' | 'conditions'][])
              .filter(([, field]) => canEdit || makers.some((m) => (shown(m)[field] || '').trim()))
              .map(([labelTxt, field]) => (
                <Box component="tr" key={labelTxt}>
                  <Box component="td" sx={{ textAlign: 'center', p: '6px 8px', fontSize: 11.5, color: 'text.secondary', borderRight: 1, borderTop: 1, borderColor: 'divider' }}>{labelTxt}</Box>
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0, borderTop: 1, borderColor: 'divider' }} />}
                  {makers.map((m, mi) => (
                    <Box component="td" key={m.key} colSpan={2} sx={{ textAlign: 'center', p: '5px 8px', fontSize: 11, lineHeight: 1.5, color: 'text.secondary', borderLeft: mi > 0 || padSpan > 0 ? 1 : 0, borderRight: padSpan > 0 && mi === makers.length - 1 ? 1 : 0, borderTop: 1, borderColor: 'divider' }}>
                      <EditText text={shown(m)[field] || ''} canEdit={canEdit} align="center" multiline onCommit={(v) => onSaveMeta(shown(m).id, { [field]: v })} />
                    </Box>
                  ))}
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0, borderTop: 1, borderColor: 'divider' }} />}
                </Box>
              ))}
            {defs.map((def) => {
              const best = bestFor(def)
              return (
                <Box component="tr" key={def.key}>
                  {/* 지표 헤더 — 연필 하나로 지표명·단위 동시 인라인 수정(updateMetricDef, 이력 자동). 가운데정렬 */}
                  <Box component="td" sx={{ textAlign: 'center', p: '6px 8px', fontSize: 11.5, color: 'text.secondary', borderRight: 1, borderTop: 1, borderColor: 'divider' }}>
                    <EditLabelUnit label={def.label} unit={def.unit} canEdit={canEdit} onCommit={(label, unit) => { if (label) onSaveMetricDef(def.id, { label, unit }) }} />
                  </Box>
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0, borderTop: 1, borderColor: 'divider' }} />}
                  {makers.map((m, mi) => {
                    const v = shown(m).metrics[def.key]
                    const isBest = best.has(m.key)
                    return (
                      <Box component="td" key={m.key} colSpan={2} sx={{ textAlign: 'center', p: '5px 6px', fontSize: 12.5, borderLeft: mi > 0 || padSpan > 0 ? 1 : 0, borderRight: padSpan > 0 && mi === makers.length - 1 ? 1 : 0, borderTop: 1, borderColor: 'divider' }}>
                        {/* 값 — 호버 연필로 그 셀만 수정(저장 시 비밀번호 재확인). 우수값은 초록 pill */}
                        <EditText text={v || ''} canEdit={canEdit} align="center" onCommit={(nv) => askValueSave(m, def.key, nv)}
                          display={<Box component="span" sx={(th) => ({ display: 'inline-block', px: isBest ? '7px' : 0, py: isBest ? '2px' : 0, borderRadius: '6px', fontWeight: isBest ? 700 : 400, ...(isBest && { bgcolor: alpha(th.palette.success.main, 0.16), color: th.palette.success.main }) })}>{v || '-'}</Box>} />
                      </Box>
                    )
                  })}
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0, borderTop: 1, borderColor: 'divider' }} />}
                </Box>
              )
            })}
          </Box>
        </Box>
        ) : (
          <Box>
            {/* 사진 카드 2칸 — 절반 영역을 반씩(모든 그룹이 같은 절반 폭이라 1·2사 카드 크기 동일), 사이 간격 10px */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: `${VS_GAP}px` }}>
              <MakerHead mg={makers[0]} sel={sel[makers[0].key] ?? makers[0].rounds.length - 1} onSel={selOf(makers[0])} onZoom={(photos, idx) => setLightbox({ photos, idx })} repIdx={repIdxOf(makers[0])} onPick={pickOf(makers[0])} canEdit={canEdit} onAddRound={() => onAddRound(makers[0])} onDeleteRound={() => askDelete(makers[0])} onManagePhotos={() => setPhotoMg(makers[0])} />
              {makers[1] ? (
                <MakerHead mg={makers[1]} sel={sel[makers[1].key] ?? makers[1].rounds.length - 1} onSel={selOf(makers[1])} onZoom={(photos, idx) => setLightbox({ photos, idx })} repIdx={repIdxOf(makers[1])} onPick={pickOf(makers[1])} canEdit={canEdit} onAddRound={() => onAddRound(makers[1])} onDeleteRound={() => askDelete(makers[1])} onManagePhotos={() => setPhotoMg(makers[1])} />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ py: '5px', textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'text.disabled', bgcolor: 'action.hover', borderRadius: '8px 8px 0 0' }}>비교사 없음</Box>
                  {/* 높이 = 그리드 stretch로 왼쪽 카드와 자동 일치(고정 비율 없음) */}
                  <Box sx={(th) => ({ flex: 1, minHeight: 120, border: 1, borderTop: 0, borderColor: 'divider', borderRadius: '0 0 8px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 11, background: `repeating-linear-gradient(45deg, ${th.palette.background.default}, ${th.palette.background.default} 7px, ${alpha(th.palette.text.primary, 0.03)} 7px, ${alpha(th.palette.text.primary, 0.03)} 14px)` })}>공란</Box>
                </Box>
              )}
            </Box>
            {/* 지표 — 값 | 지표명(가운데) | 값. 값 그리드 3열 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', mt: 0.75 }}>
              {defs.length === 0 && <Box sx={{ gridColumn: '1 / -1', p: 1.5, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>등록된 표준 지표가 없습니다. 제목띠의 "지표 편집"에서 추가하세요.</Box>}
              {(([['샘플', 'sample'], ['테스트조건', 'conditions']]) as [string, 'sample' | 'conditions'][])
                .filter(([, field]) => canEdit || makers.some((m) => (shown(m)[field] || '').trim()))
                .map(([labelTxt, field]) => (
                  <Box key={labelTxt} sx={{ display: 'contents' }}>
                    <VCell><EditText text={shown(makers[0])[field] || ''} canEdit={canEdit} align="center" multiline onCommit={(v) => onSaveMeta(shown(makers[0]).id, { [field]: v })} /></VCell>
                    <LCell>{labelTxt}</LCell>
                    {makers[1] ? <VCell><EditText text={shown(makers[1])[field] || ''} canEdit={canEdit} align="center" multiline onCommit={(v) => onSaveMeta(shown(makers[1]).id, { [field]: v })} /></VCell> : <VCell><Box sx={{ color: 'text.disabled' }}>—</Box></VCell>}
                  </Box>
                ))}
              {defs.map((def) => {
                const best = bestFor(def)
                const vcell = (m?: DemoMakerGroup) => {
                  if (!m) return <VCell><Box sx={{ color: 'text.disabled' }}>—</Box></VCell>
                  const v = shown(m).metrics[def.key]
                  const isBest = best.has(m.key)
                  return <VCell><EditText text={v || ''} canEdit={canEdit} align="center" onCommit={(nv) => askValueSave(m, def.key, nv)} display={<Box component="span" sx={(th) => ({ display: 'inline-block', px: isBest ? '7px' : 0, py: isBest ? '2px' : 0, borderRadius: '6px', fontWeight: isBest ? 700 : 400, ...(isBest && { bgcolor: alpha(th.palette.success.main, 0.16), color: th.palette.success.main }) })}>{v || '-'}</Box>} /></VCell>
                }
                return (
                  <Box key={def.key} sx={{ display: 'contents' }}>
                    {vcell(makers[0])}
                    <LCell><EditLabelUnit label={def.label} unit={def.unit} canEdit={canEdit} onCommit={(label, unit) => { if (label) onSaveMetricDef(def.id, { label, unit }) }} /></LCell>
                    {vcell(makers[1])}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </Box>
        {/* 코멘트 — 어두운 인셋 패널(그룹 안에서 표와 역할 대비). 헤더 라벨 없이 카드만(무슨 공간인지 자명) */}
        <Box sx={{ flex: { xs: '0 0 auto', md: '1 1 0' }, minWidth: 0, width: { xs: '100%', md: 'auto' }, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: '10px', p: 1.25 }}>
          <DemoChat memos={messages} canPost={canEdit} canModerate={canModerate} user={user} busy={chatBusy}
            onPost={(title, body) => onPostChat(equipment, title, body)} onEdit={onEditChat} onDelete={onDeleteChat}
            onReorder={onReorderChat} onWidth={onWidthChat} />
        </Box>
      </Box>

      {/* 사진 확대 — 대표사진 클릭 시 그 자리 라이트박스(드로어 없이 1단계) */}
      {lightbox && <Lightbox photos={lightbox.photos} idx={lightbox.idx} onIdx={(i) => setLightbox((l) => (l ? { ...l, idx: i } : l))} onClose={() => setLightbox(null)} />}

      {/* 사진 관리 — 선택 회차의 추가/삭제/대표 지정 */}
      {photoMg && <PhotoManageDialog round={shown(photoMg)} maker={photoMg.maker} user={user} onClose={() => setPhotoMg(null)}
        onSaved={() => { setRepSel((rs) => { const n = { ...rs }; delete n[photoMg.key]; return n }); onReload() }} />}

      {/* 지표값 저장 — 비밀번호 재확인(조작방지 보안강화) */}
      <Dialog open={!!pwPrompt} onClose={() => !savingVal && setPwPrompt(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>지표값 저장 확인</DialogTitle>
        <DialogContent>
          {pwPrompt && (
            <Box sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>
              <b>{pwPrompt.label}</b> 지표값을 저장합니다. 조작방지를 위해 <b>본인 비밀번호</b>를 입력해주세요.
            </Box>
          )}
          <InputBase type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="비밀번호"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmSaveVal() } }}
            sx={(th) => ({ width: '100%', fontSize: 13, bgcolor: 'background.paper', border: `1px solid ${pwErr ? th.palette.error.main : th.palette.divider}`, borderRadius: '8px', px: 1.25, py: 0.85 })} />
          {pwErr && <Box sx={{ fontSize: 11.5, color: 'error.main', mt: 0.5 }}>{pwErr}</Box>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPwPrompt(null)} disabled={savingVal} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" onClick={() => void confirmSaveVal()} disabled={savingVal || !pw.trim()} startIcon={savingVal ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{savingVal ? '확인 중…' : '저장'}</Button>
        </DialogActions>
      </Dialog>

      {/* 회차 삭제 — 비밀번호 재확인. 사진·파일도 함께 삭제, 이력에 기록됨 */}
      <Dialog open={!!delPrompt} onClose={() => !deleting && setDelPrompt(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>데모결과 삭제</DialogTitle>
        <DialogContent>
          {delPrompt && (
            <Box sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>
              <b>{delPrompt.maker}{delPrompt.model ? ` ${delPrompt.model}` : ''} · {shown(delPrompt).round}차</b> 데모결과를 삭제합니다.
              사진·첨부파일도 함께 삭제되며 <b>되돌릴 수 없습니다</b>(삭제 기록은 변경 이력에 남음). 본인 비밀번호를 입력해주세요.
            </Box>
          )}
          <InputBase type="password" autoFocus value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="비밀번호"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirmDelete() } }}
            sx={(th) => ({ width: '100%', fontSize: 13, bgcolor: 'background.paper', border: `1px solid ${delErr ? th.palette.error.main : th.palette.divider}`, borderRadius: '8px', px: 1.25, py: 0.85 })} />
          {delErr && <Box sx={{ fontSize: 11.5, color: 'error.main', mt: 0.5 }}>{delErr}</Box>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDelPrompt(null)} disabled={deleting} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" color="error" onClick={() => void confirmDelete()} disabled={deleting || !delPw.trim()} startIcon={deleting ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{deleting ? '삭제 중…' : '삭제'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

/**
 * 데모결과 뷰 — 장비도입 '데모결과' 탭. 장비종류별로 경쟁 제조사를 매트릭스로 묶어 핵심지표 비교.
 * 지표는 표준 정의(demo_metric_defs)를 따름. 사진 탭=라이트박스. 비교 메모(팀원 작성).
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
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchMetricDefs(), fetchDemoResults(), fetchDemoChat(), fetchValueHistory()])
      .then(([d, r, c, v]) => { setDefs(d); setRows(r); setChat(c); setValHist(v) })
      .catch((e) => setSnack({ open: true, msg: e instanceof Error ? e.message : '불러오기 실패', sev: 'error' }))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])
  const refetchChat = () => { void fetchDemoChat().then(setChat).catch(() => {}) }

  const groups = useMemo(() => groupDemoResults(rows, defs), [rows, defs])
  const chatOf = (eq: string) => chat.filter((m) => m.equipment === eq)
  const latestValueChangeOf = (eq: string) => valHist.find((v) => v.equipment === eq)

  const onPostChat = async (equipment: string, title: string, body: string) => {
    if (!user) throw new Error('로그인이 필요합니다')
    setChatBusy(true)
    try { await postDemoChat({ equipment, title, body, author: user }); refetchChat() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '메모 저장 실패', sev: 'error' }); throw e }
    finally { setChatBusy(false) }
  }
  const onEditChat = async (id: number, title: string, body: string) => {
    setChatBusy(true)
    try { await updateDemoChat(id, { title, body }); refetchChat() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '메모 수정 실패', sev: 'error' }); throw e }
    finally { setChatBusy(false) }
  }
  const onDeleteChat = async (id: number) => {
    try { await deleteDemoChat(id); refetchChat() } catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '삭제 실패', sev: 'error' }) }
  }
  // 보드 배치 — 순서(드래그)·폭(엣지 리사이즈 1↔2열). 낙관 갱신 없이 저장 후 재조회(카드 수 적어 충분히 빠름)
  const onReorderChat = async (ids: number[]) => {
    try { await reorderDemoChat(ids); refetchChat() } catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '순서 변경 실패', sev: 'error' }) }
  }
  const onWidthChat = async (id: number, width: number) => {
    try { await setDemoChatWidth(id, width); refetchChat() } catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '너비 변경 실패', sev: 'error' }) }
  }

  const onSaveValues = async (roundId: number, metrics: Record<string, string>) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateDemoResult(roundId, { metrics, author: user }); setSnack({ open: true, msg: '지표값을 수정했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '값 수정 실패', sev: 'error' }); throw e }
  }
  // 샘플·테스트조건 셀 인라인 저장(비밀번호 없이)
  const onSaveMeta = async (roundId: number, patch: { sample?: string; conditions?: string }) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateDemoResult(roundId, { ...patch, author: user }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '저장 실패', sev: 'error' }) }
  }
  // 지표명·단위 셀 인라인 저장(정의 수정 → 변경 이력 자동)
  const onSaveMetricDef = async (defId: number, patch: { label?: string; unit?: string }) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateMetricDef(defId, patch, user); setSnack({ open: true, msg: '지표를 수정했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '지표 수정 실패', sev: 'error' }) }
  }

  const onDeleteRound = async (roundId: number) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await deleteDemoResult(roundId, user); setSnack({ open: true, msg: '데모결과를 삭제했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '삭제 실패', sev: 'error' }); throw e }
  }

  // '데모결과 추가' — 뷰탭(…/목록/데모결과) 옆 슬롯에 포탈로 배치되는 + 아이콘 버튼(데모결과 탭에서만 슬롯 존재)
  const addBtn = (
    <Tooltip title="데모결과 추가" arrow>
      <IconButton aria-label="데모결과 추가" onClick={() => { setFormPre({ equipment: '' }); setFormOpen(true) }}
        sx={(th) => ({ width: 30, height: 30, borderRadius: '8px', bgcolor: th.palette.primary.main, color: th.palette.primary.contrastText, '&:hover': { bgcolor: th.palette.primary.dark } })}>
        <AddIcon sx={{ fontSize: 20 }} />
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
        <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>불러오는 중…</Box>
      ) : groups.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>등록된 데모결과가 없습니다. {isMember && '“데모결과 추가”로 등록하세요.'}</Box>
      ) : (
        groups.map((g) => (
          <EquipGroup
            key={g.equipment}
            equipment={g.equipment} defs={g.defs} makers={g.makers}
            messages={chatOf(g.equipment)} canEdit={isMember} canModerate={isAdmin} user={user} chatBusy={chatBusy} latestValueChange={latestValueChangeOf(g.equipment)}
            onPostChat={onPostChat} onEditChat={onEditChat} onDeleteChat={onDeleteChat} onReorderChat={onReorderChat} onWidthChat={onWidthChat} onSaveValues={onSaveValues} onSaveMeta={onSaveMeta} onSaveMetricDef={onSaveMetricDef} onReload={load}
            onEditMetrics={() => setEditorEquip(g.equipment)} onViewValueHistory={() => setValHistEquip(g.equipment)}
            onAddRound={(mg) => { setFormPre({ equipment: g.equipment, maker: mg.maker, model: mg.model }); setFormOpen(true) }}
            onDeleteRound={onDeleteRound}
          />
        ))
      )}
      {editorEquip && (
        <MetricEditorDialog open equipment={editorEquip} defs={defs} author={user}
          onClose={() => setEditorEquip(null)}
          onChanged={() => { load(); setSnack({ open: true, msg: '지표를 변경했습니다(이력 기록됨).', sev: 'success' }) }}
          onError={(msg) => setSnack({ open: true, msg, sev: 'error' })}
          onViewDefHistory={() => setHistoryEquip(editorEquip)} />
      )}
      {historyEquip && <MetricHistoryDialog open equipment={historyEquip} onClose={() => setHistoryEquip(null)} />}
      {valHistEquip && <ValueHistoryDialog open equipment={valHistEquip} defs={defs} onClose={() => setValHistEquip(null)} />}
      <DemoResultForm open={formOpen} onClose={() => setFormOpen(false)} defs={defs} rows={rows}
        initialEquipment={formPre.equipment} initialMaker={formPre.maker} initialModel={formPre.model} user={user}
        onSaved={() => { setFormOpen(false); setSnack({ open: true, msg: '데모결과를 추가했습니다.', sev: 'success' }); load() }}
        onError={(msg) => setSnack({ open: true, msg, sev: 'error' })} />
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
    </>
  )
}
