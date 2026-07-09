import { useState, useEffect, useCallback, useMemo } from 'react'
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
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CheckIcon from '@mui/icons-material/Check'
import TuneIcon from '@mui/icons-material/Tune'
import HistoryIcon from '@mui/icons-material/History'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { useRole } from '@/auth/role'
import {
  fetchMetricDefs, fetchDemoResults, fetchDemoChat, fetchValueHistory, groupDemoResults, bestMakers, demoFileUrl, downloadDemoBlob, postDemoChat, updateDemoChat, deleteDemoChat, updateDemoResult, deleteDemoResult,
  type DemoMetricDef, type DemoRoundRow, type DemoChatMsg, type DemoPhotoRef, type DemoFileRef, type DemoMakerGroup, type ValueHistory,
} from '@/api/demo'
import { verifyPassword } from '@/api/session'
import { MetricEditorDialog, MetricHistoryDialog, ValueHistoryDialog } from './DemoMetricEditor'
import DemoChat from './DemoChat'
import DemoResultForm from './DemoResultForm'
import AddIcon from '@mui/icons-material/Add'
import { createPortal } from 'react-dom'

const COL_W = 118 // 제조사 열 고정폭(1·2·3개사 통일, 타이트)
const LABEL_W = 100 // 지표/장비명 열 폭

const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')
const fmtWhen = (iso: string) => { try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return iso.slice(0, 10) } }

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

/** 제조사 열 헤더 — 색깔 밴드(제조사·모델·파일, 상단 라운드) → 사진영역(대표 크게 + 우측 썸네일 그리드 + 더보기) → 값수정 트리거 */
function MakerHead({ mg, sel, onSel, onOpen, canEdit, editing, savingVal, onStartVal, onSaveVal, onCancelVal, onAddRound, onDeleteRound }: {
  mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; onOpen: (photos: DemoPhotoRef[], idx: number) => void
  canEdit: boolean; editing: boolean; savingVal: boolean; onStartVal: () => void; onSaveVal: () => void; onCancelVal: () => void
  onAddRound: () => void; onDeleteRound: () => void
}) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const coverIdx = Math.min(Math.max(r.cover || 0, 0), Math.max(r.photos.length - 1, 0))
  const cover = r.photos[coverIdx]
  const otherIdx = r.photos.map((_, i) => i).filter((i) => i !== coverIdx)
  const MAX_THUMB = 4 // 하단 그리드 한 줄(4칸). 넘치면 마지막 칸이 +N
  const thumbs = otherIdx.length <= MAX_THUMB ? otherIdx : otherIdx.slice(0, MAX_THUMB - 1)
  const extra = otherIdx.length - thumbs.length
  return (
    <Box sx={{ width: '100%' }}>
      {/* 색깔 밴드 — 제조사·모델·파일 나란히 가운데 정렬, 상단 두 모서리만 라운드 */}
      <Box sx={(th) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.6, px: 0.75, py: '4px', bgcolor: th.palette.primary.main, borderRadius: '8px 8px 0 0', minWidth: 0 })}>
        <Box sx={{ fontSize: 11.5, fontWeight: 700, color: '#fff', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mg.maker}{mg.model ? <Box component="span" sx={{ opacity: 0.85, fontWeight: 500, ml: 0.5 }}>{mg.model}</Box> : null}
        </Box>
        {r.files.map((f, i) => (
          <Box key={i} sx={{ display: 'inline-flex', alignItems: 'center', gap: '1px', flex: 'none' }}>
            <Tooltip title={`${f.name} 열기`} arrow>
              <Box component="span" onClick={() => void openFile(f)} sx={{ display: 'inline-flex', lineHeight: 0, cursor: f.path ? 'pointer' : 'default' }}>
                <AttachmentIcon type={f.type} name={f.name} size={14} />
              </Box>
            </Tooltip>
            {f.path && (
              <Tooltip title="다운로드(원본 파일명)" arrow>
                <Box component="span" onClick={() => void saveFile(f)} sx={{ display: 'inline-flex', lineHeight: 0, cursor: 'pointer', color: 'rgba(255,255,255,.75)', '&:hover': { color: '#fff' } }}>
                  <FileDownloadOutlinedIcon sx={{ fontSize: 13 }} />
                </Box>
              </Tooltip>
            )}
          </Box>
        ))}
      </Box>
      {/* 사진 영역 — 대표사진(상단, 4:3 비율 유지) + 나머지 작은 그리드(하단) + 넘치면 +N */}
      <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', borderRadius: '0 0 8px 8px', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
          <Photo photo={cover} onClick={() => { if (r.photos.length) onOpen(r.photos, coverIdx) }} />
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
        {thumbs.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', p: '2px' }}>
            {thumbs.map((pi) => (
              <Box key={pi} sx={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: '3px' }}>
                <Photo photo={r.photos[pi]} onClick={() => onOpen(r.photos, pi)} />
              </Box>
            ))}
            {extra > 0 && (
              <Box onClick={() => onOpen(r.photos, otherIdx[thumbs.length])} sx={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: '3px', cursor: 'pointer' }}>
                <Photo photo={r.photos[otherIdx[thumbs.length]]} />
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>+{extra}</Box>
              </Box>
            )}
          </Box>
        )}
      </Box>
      {/* 값 수정(작은 트리거 — 실수 방지용 최소 노출). 편집 중이면 저장·취소 */}
      {canEdit && (
        <Box sx={{ mt: 0.4, display: 'flex', justifyContent: 'center', minHeight: 18 }}>
          {editing ? (
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <Tooltip title="값 저장"><span><IconButton size="small" color="success" disabled={savingVal} onClick={onSaveVal} sx={{ p: '1px' }}>{savingVal ? <CircularProgress size={12} thickness={5} color="inherit" /> : <CheckIcon sx={{ fontSize: 15 }} />}</IconButton></span></Tooltip>
              <Tooltip title="취소"><IconButton size="small" onClick={onCancelVal} sx={{ p: '1px', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={`${r.round}차 지표값 수정`}><IconButton size="small" onClick={onStartVal} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}><EditIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
              <Tooltip title={`${r.round}차 데모결과 삭제`}><IconButton size="small" onClick={onDeleteRound} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'error.main' } }}><DeleteOutlineIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
            </Box>
          )}
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
// 파일 저장 — blob + anchor download로 원본(한글) 파일명 그대로 저장(공지 첨부와 동일 방식)
async function saveFile(f: DemoFileRef) {
  if (!f.path) return
  try {
    const blob = await downloadDemoBlob(f.path)
    const u = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = u; a.download = f.name || 'file'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(u)
  } catch { /* noop */ }
}

/** 사진 확대(라이트박스) */
function Lightbox({ photos, idx, onIdx, onClose }: { photos: DemoPhotoRef[]; idx: number; onIdx: (i: number) => void; onClose: () => void }) {
  const move = useCallback((d: number) => onIdx((idx + d + photos.length) % photos.length), [idx, photos.length, onIdx])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') move(1); else if (e.key === 'ArrowLeft') move(-1) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [move, onClose])
  const p = photos[idx]
  return (
    <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <IconButton onClick={onClose} aria-label="닫기" sx={{ position: 'absolute', top: 12, right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon /></IconButton>
      {photos.length > 1 && <IconButton onClick={(e) => { e.stopPropagation(); move(-1) }} aria-label="이전" sx={{ position: 'absolute', left: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><ChevronLeftIcon /></IconButton>}
      <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
        <LightboxImg photo={p} />
        <Box sx={{ color: 'rgba(255,255,255,.9)', fontSize: 13 }}>{p?.name}<Box component="span" sx={{ color: 'rgba(255,255,255,.5)', ml: 1 }}>{idx + 1} / {photos.length}</Box></Box>
      </Box>
      {photos.length > 1 && <IconButton onClick={(e) => { e.stopPropagation(); move(1) }} aria-label="다음" sx={{ position: 'absolute', right: 12, color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><ChevronRightIcon /></IconButton>}
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

// 갤러리 콘택트시트 제조사 열 색(A/B 구분용) — 앱 accent 톤
const MK_COLORS = ['#5491DA', '#4DA167', '#A98AE0', '#D6A23E']
interface GItem { roundNo: number; idx: number; name: string; path?: string; photos: DemoPhotoRef[] }
interface GCol { key: string; maker: string; color: string; items: GItem[] }

/**
 * 사진 갤러리 시트(B+C 절충) — 비교표는 위에 유지, 화면 하단 고정 시트로 뜬다.
 *  · 훑기: 제조사별 썸네일 스트립 + 큰 미리보기(클릭 = 전체화면 확대 라이트박스)
 *  · 2장 비교: 제조사별 미리보기를 좌우로 나란히(경쟁사 직접 비교)
 */
function GallerySheet({ equipment, columns, initial, onClose }: { equipment: string; columns: GCol[]; initial: { c: number; i: number }; onClose: () => void }) {
  const [mode, setMode] = useState<'one' | 'compare'>('one')
  const [sel, setSel] = useState(initial)
  const [slots, setSlots] = useState<number[]>(() => columns.map((_, c) => (c === initial.c ? initial.i : 0)))
  const [zoom, setZoom] = useState<{ photos: DemoPhotoRef[]; idx: number } | null>(null)
  const total = columns.reduce((s, c) => s + c.items.length, 0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(null); else onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, onClose])

  const openZoom = (it?: GItem) => { if (it && it.photos.length) setZoom({ photos: it.photos, idx: it.idx }) }

  // 미리보기 1칸 — 큰 사진(전체 보기) + 캡션 + 확대 아이콘. label 있으면(2장 비교) 제조사 슬롯 표시
  const preview = (c: number, i: number, label?: string) => {
    const col = columns[c]; const it = col?.items[i]
    return (
      <Box key={label ?? 'one'} onClick={() => openZoom(it)}
        sx={{ flex: 1, minWidth: 0, position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default', border: 1, borderColor: 'divider', cursor: it && it.photos.length ? 'zoom-in' : 'default' }}>
        <Photo photo={it ? { name: it.name, path: it.path } : undefined} fit="contain" />
        {label && <Box sx={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: alpha(col.color, 0.92), borderRadius: '6px', px: 1, py: '2px' }}>{label}</Box>}
        {it && <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '8px 10px', fontSize: 12, color: '#fff', background: 'linear-gradient(0deg, rgba(0,0,0,.6), transparent)' }}><b>{col.maker} · {it.roundNo}차</b> · {it.name}</Box>}
        {it && it.photos.length > 0 && <ZoomOutMapIcon sx={{ position: 'absolute', bottom: 8, right: 8, fontSize: 16, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', borderRadius: '4px', p: '2px' }} />}
      </Box>
    )
  }

  return (
    <Box sx={(th) => ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: th.zIndex.drawer, height: { xs: '82vh', md: '66vh' }, bgcolor: 'background.paper', borderTop: `1px solid ${th.palette.divider}`, borderRadius: '16px 16px 0 0', boxShadow: '0 -12px 32px rgba(0,0,0,.42)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'gsUp .22s ease', '@keyframes gsUp': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } } })}>
      {/* 헤더 — 장비명·장수 + 훑기/2장 비교 토글 + 닫기 */}
      <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flex: 'none' }} />
        <Box sx={{ fontSize: 13.5, fontWeight: 800 }}>{equipment} 사진</Box>
        <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>· {total}장</Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={(th) => ({ display: 'flex', border: `1px solid ${th.palette.divider}`, borderRadius: '999px', overflow: 'hidden', fontSize: 12 })}>
          {(['one', 'compare'] as const).map((m) => (
            <Box key={m} role="button" tabIndex={0} aria-pressed={mode === m} onClick={() => setMode(m)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMode(m) } }}
              sx={(th) => ({ px: 1.5, py: 0.5, cursor: 'pointer', userSelect: 'none', ...(mode === m ? { bgcolor: th.palette.primary.main, color: '#fff', fontWeight: 700 } : { color: 'text.secondary' }) })}>
              {m === 'one' ? '훑기' : '2장 비교'}
            </Box>
          ))}
        </Box>
        <IconButton size="small" aria-label="닫기" onClick={onClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      {/* 본문 — 미리보기(왼쪽/위) + 콘택트시트(오른쪽/아래) */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', gap: 0.75, p: 1 }}>
          {mode === 'one' ? preview(sel.c, sel.i) : columns.map((_, c) => preview(c, slots[c], columns[c].maker))}
        </Box>
        <Box sx={{ flex: 'none', width: { xs: '100%', md: 320 }, minHeight: 0, borderLeft: { md: 1 }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 'none', fontSize: 11, color: 'text.disabled', px: 1.25, pt: 1, pb: 0.5 }}>훑어보기 — 제조사별{mode === 'compare' && ' (열마다 골라 좌우 비교)'}</Box>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1, px: 1.25, pb: 1.25 }}>
            {columns.map((col, c) => (
              <Box key={col.key} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75, overflowY: 'auto' }}>
                <Box sx={{ position: 'sticky', top: 0, zIndex: 1, fontSize: 11.5, fontWeight: 700, color: '#fff', bgcolor: col.color, borderRadius: '6px', textAlign: 'center', py: '3px' }}>{col.maker}</Box>
                {col.items.length === 0 && <Box sx={{ fontSize: 10.5, color: 'text.disabled', textAlign: 'center', py: 1 }}>사진 없음</Box>}
                {col.items.map((it, i) => {
                  const on = mode === 'one' ? (sel.c === c && sel.i === i) : (slots[c] === i)
                  return (
                    <Box key={i} role="button" tabIndex={0} aria-pressed={on}
                      onClick={() => { if (mode === 'one') setSel({ c, i }); else setSlots((s) => s.map((v, ci) => (ci === c ? i : v))) }}
                      sx={(th) => ({ position: 'relative', height: 64, flex: 'none', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', outline: on ? `2px solid ${th.palette.primary.main}` : '2px solid transparent', outlineOffset: '-2px' })}>
                      <Photo photo={{ name: it.name, path: it.path }} />
                      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', px: '4px', py: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.roundNo}차 · {it.name}</Box>
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      {zoom && <Lightbox photos={zoom.photos} idx={zoom.idx} onIdx={(i) => setZoom((z) => (z ? { ...z, idx: i } : z))} onClose={() => setZoom(null)} />}
    </Box>
  )
}

/** 장비종류 1묶음 — 경쟁 제조사 매트릭스 + (오른쪽) 비교 채팅 */
function EquipGroup({ equipment, defs, makers, messages, canEdit, user, chatBusy, latestValueChange, onPostChat, onEditChat, onDeleteChat, onSaveValues, onEditMetrics, onViewValueHistory, onAddRound, onDeleteRound }: {
  equipment: string; defs: DemoMetricDef[]; makers: DemoMakerGroup[]; messages: DemoChatMsg[]; canEdit: boolean; user: string | null; chatBusy: boolean; latestValueChange?: ValueHistory
  onPostChat: (equipment: string, title: string, body: string) => Promise<void>
  onEditChat: (id: number, title: string, body: string) => Promise<void>; onDeleteChat: (id: number) => void
  onSaveValues: (roundId: number, metrics: Record<string, string>) => Promise<void>
  onEditMetrics: () => void; onViewValueHistory: () => void; onAddRound: (mg: DemoMakerGroup) => void
  onDeleteRound: (roundId: number) => Promise<void>
}) {
  // 제조사별 선택 회차(기본=최신)
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(makers.map((m) => [m.key, m.rounds.length - 1])))
  const shown = (m: DemoMakerGroup) => m.rounds[Math.min(sel[m.key] ?? m.rounds.length - 1, m.rounds.length - 1)]

  // 사진 갤러리(B+C 절충) — 제조사별 전 회차 사진을 열로 모아 시트로 열람
  const columns: GCol[] = makers.map((m, ci) => ({
    key: m.key, maker: m.maker, color: MK_COLORS[ci % MK_COLORS.length],
    items: m.rounds.flatMap((rd) => rd.photos.map((ph, i) => ({ roundNo: rd.round, idx: i, name: ph.name, path: ph.path, photos: rd.photos }))),
  }))
  const [gallery, setGallery] = useState<{ c: number; i: number } | null>(null)
  const openGallery = (m: DemoMakerGroup, photoIdxInShown: number) => {
    const c = Math.max(0, makers.indexOf(m))
    const rn = shown(m).round
    const it = columns[c]?.items.findIndex((x) => x.roundNo === rn && x.idx === photoIdxInShown) ?? -1
    setGallery({ c, i: it >= 0 ? it : 0 })
  }

  // 제조사 지표값 수정 — 실수 방지로 열 단위 명시 편집(작은 트리거 → 인풋 → 저장). 저장 시 비밀번호 재확인(조작방지)
  const [valEditKey, setValEditKey] = useState<string | null>(null)
  const [valDraft, setValDraft] = useState<Record<string, string>>({})
  const [savingVal, setSavingVal] = useState(false)
  const [pwPrompt, setPwPrompt] = useState<DemoMakerGroup | null>(null)
  const [pw, setPw] = useState('')
  const [pwErr, setPwErr] = useState('')
  const startVal = (m: DemoMakerGroup) => { setValEditKey(m.key); setValDraft({ ...shown(m).metrics }) }
  const cancelVal = () => { setValEditKey(null); setValDraft({}) }
  const isChanged = (m: DemoMakerGroup) => {
    const cur = shown(m).metrics
    for (const k of new Set([...Object.keys(cur), ...Object.keys(valDraft)])) if ((cur[k] ?? '') !== (valDraft[k] ?? '')) return true
    return false
  }
  const askSaveVal = (m: DemoMakerGroup) => {
    if (!isChanged(m)) { setValEditKey(null); setValDraft({}); return } // 변경 없으면 저장·비번·알림 없이 편집만 종료
    setPw(''); setPwErr(''); setPwPrompt(m)
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
      await onSaveValues(shown(pwPrompt).id, valDraft)
      setPwPrompt(null); setPw(''); setValEditKey(null); setValDraft({})
    } catch (e) { setPwErr(e instanceof Error ? e.message : '저장에 실패했습니다') }
    finally { setSavingVal(false) }
  }

  // 편집 중인 열은 draft 값으로 비교(우수 강조가 입력 즉시 반영)
  const bestFor = (def: DemoMetricDef) => bestMakers(def, makers.map((m) => ({ key: m.key, value: valEditKey === m.key ? valDraft[def.key] : shown(m).metrics[def.key] })))
  // 카드(제조사) 열 기준 너비 — 실사용 최대 2사. 1곳이면 좌우 패드로 가운데, 2곳이면 가득.
  // (혹시 3사 데이터가 있어도 basis가 그만큼 늘어 안전.) Chrome fixed 테이블 calc() 무시 우회 → colgroup 등분 + colSpan(카드=2칸).
  const basis = Math.max(2, makers.length)
  const tableMinW = LABEL_W + basis * COL_W
  const subCols = 2 * basis // 카드 1장 = 2 서브컬럼
  const padSpan = basis - makers.length // 좌우 각각의 패드 서브컬럼 수: 0(가득)·1(가운데)

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* 상단 = 버튼만(제목은 표 좌상단 셀). 변경 이력 = 지표'값' 변경 추적. 회차 추가는 카드의 + 칩으로 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Box sx={{ flex: 1 }} />
        {canEdit && <Button size="small" startIcon={<TuneIcon sx={{ fontSize: 15 }} />} onClick={onEditMetrics} sx={{ fontSize: 11.5, minWidth: 0, color: 'text.secondary' }}>지표 편집</Button>}
        <Button size="small" startIcon={<HistoryIcon sx={{ fontSize: 15 }} />} onClick={onViewValueHistory} sx={{ fontSize: 11.5, minWidth: 0, color: 'text.secondary' }}>변경 이력</Button>
      </Box>

      {/* 지표 '값' 변경 알림(조작방지) — 최근 값 변경이 있으면 표시. 클릭 시 값 변경 이력 */}
      {latestValueChange && (
        <Box role="button" tabIndex={0} onClick={onViewValueHistory} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewValueHistory() } }}
          sx={(th) => ({ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, px: 1.25, py: 0.8, borderRadius: '9px', cursor: 'pointer', bgcolor: alpha(th.palette.warning.main, 0.1), border: `1px solid ${alpha(th.palette.warning.main, 0.4)}` })}>
          <InfoOutlinedIcon sx={{ fontSize: 16, flex: 'none', color: 'warning.main' }} />
          <Box sx={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'text.primary' }}>
            <b>{latestValueChange.maker} 지표값이 변경되었습니다</b>
            <Box component="span" sx={{ color: 'text.disabled', ml: 0.75 }}>· {latestValueChange.changedBy} · {fmtWhen(latestValueChange.changedAt)}</Box>
          </Box>
          <Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, flex: 'none', color: 'warning.main' }}>이력 보기</Box>
        </Box>
      )}

      {/* 비교표(왼쪽·PC 절반 폭) + 코멘트(오른쪽 절반, 좁은 화면은 표 아래) */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start', gap: 1.5 }}>
      <Box sx={{ flex: { xs: '0 1 auto', md: '1 1 0' }, minWidth: 0, maxWidth: '100%', border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper', p: 1.25, overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
          {/* 열 정의 — 라벨(고정) + 등분 서브컬럼(카드 1장 = 2칸) */}
          <Box component="colgroup">
            <Box component="col" sx={{ width: LABEL_W }} />
            {Array.from({ length: subCols }).map((_, i) => <Box component="col" key={i} />)}
          </Box>
          <Box component="thead">
            <Box component="tr">
              {/* 1행1열 = 장비명(가운데·중앙 정렬) */}
              <Box component="th" sx={{ textAlign: 'center', verticalAlign: 'middle', p: '4px 8px', borderRight: 1, borderColor: 'divider' }}>
                <Box sx={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>{equipment}</Box>
              </Box>
              {padSpan > 0 && <Box component="th" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
              {makers.map((m, mi) => (
                <Box component="th" key={m.key} colSpan={2} sx={{ p: '4px 6px', textAlign: 'center', verticalAlign: 'top', borderLeft: mi > 0 ? 1 : 0, borderColor: 'divider' }}>
                  <MakerHead mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={(i) => setSel((s) => ({ ...s, [m.key]: i }))} onOpen={(_photos, idx) => openGallery(m, idx)}
                    canEdit={canEdit} editing={valEditKey === m.key} savingVal={savingVal}
                    onStartVal={() => startVal(m)} onSaveVal={() => askSaveVal(m)} onCancelVal={cancelVal}
                    onAddRound={() => onAddRound(m)} onDeleteRound={() => askDelete(m)} />
                </Box>
              ))}
              {padSpan > 0 && <Box component="th" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
            </Box>
          </Box>
          <Box component="tbody">
            {defs.length === 0 && (
              <Box component="tr"><Box component="td" colSpan={1 + subCols} sx={{ p: 1.5, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>등록된 표준 지표가 없습니다. 위 "지표 편집"에서 추가하세요.</Box></Box>
            )}
            {defs.map((def) => {
              const best = bestFor(def)
              return (
                <Box component="tr" key={def.key}>
                  <Box component="td" sx={{ textAlign: 'left', p: '6px 8px', fontSize: 11.5, color: 'text.secondary', borderRight: 1, borderTop: 1, borderColor: 'divider' }}>
                    {def.label}{def.unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.5, fontSize: 10 }}>[{def.unit}]</Box> : null}
                  </Box>
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
                  {makers.map((m, mi) => {
                    const editingThis = valEditKey === m.key
                    const v = shown(m).metrics[def.key]
                    const isBest = best.has(m.key)
                    return (
                      <Box component="td" key={m.key} colSpan={2} sx={{ textAlign: 'center', p: '5px 6px', fontSize: 12.5, borderLeft: mi > 0 ? 1 : 0, borderTop: 1, borderColor: 'divider' }}>
                        {editingThis ? (
                          <InputBase value={valDraft[def.key] ?? ''} onChange={(e) => setValDraft((d) => ({ ...d, [def.key]: e.target.value }))} placeholder="-"
                            sx={(th) => ({ width: '100%', fontSize: 12, bgcolor: alpha(th.palette.warning.main, 0.08), border: `1px solid ${alpha(th.palette.warning.main, 0.5)}`, borderRadius: '5px', px: 0.5, py: '1px', '& input': { textAlign: 'center', p: 0 } })} />
                        ) : (
                          <Box component="span" sx={(th) => ({ display: 'inline-block', px: isBest ? '7px' : 0, py: isBest ? '2px' : 0, borderRadius: '6px', fontWeight: isBest ? 700 : 400, ...(isBest && { bgcolor: alpha(th.palette.success.main, 0.16), color: th.palette.success.main }) })}>{v || '-'}</Box>
                        )}
                      </Box>
                    )
                  })}
                  {padSpan > 0 && <Box component="td" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>
        {/* 코멘트 — PC는 표 오른쪽 빈 공간, 좁은 화면은 표 아래로 */}
        <Box sx={{ flex: { xs: '0 0 auto', md: '1 1 0' }, minWidth: 0, width: { xs: '100%', md: 'auto' } }}>
          <Box sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.secondary', mb: 0.75 }}>코멘트</Box>
          <DemoChat memos={messages} canPost={canEdit} user={user} busy={chatBusy}
            onPost={(title, body) => onPostChat(equipment, title, body)} onEdit={onEditChat} onDelete={onDeleteChat} />
        </Box>
      </Box>

      {/* 사진 갤러리 시트(B+C 절충) — 표 유지 + 하단 시트에서 훑기·2장 비교·전체화면 확대 */}
      {gallery && <GallerySheet equipment={equipment} columns={columns} initial={gallery} onClose={() => setGallery(null)} />}

      {/* 지표값 저장 — 비밀번호 재확인(조작방지 보안강화) */}
      <Dialog open={!!pwPrompt} onClose={() => !savingVal && setPwPrompt(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>지표값 저장 확인</DialogTitle>
        <DialogContent>
          {pwPrompt && (
            <Box sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.25 }}>
              <b>{pwPrompt.maker}{pwPrompt.model ? ` ${pwPrompt.model}` : ''} · {shown(pwPrompt).round}차</b> 지표값을 저장합니다. 조작방지를 위해 <b>본인 비밀번호</b>를 입력해주세요.
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
  const { isMember, user } = useRole()
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

  const onSaveValues = async (roundId: number, metrics: Record<string, string>) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateDemoResult(roundId, { metrics, author: user }); setSnack({ open: true, msg: '지표값을 수정했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '값 수정 실패', sev: 'error' }); throw e }
  }

  const onDeleteRound = async (roundId: number) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await deleteDemoResult(roundId, user); setSnack({ open: true, msg: '데모결과를 삭제했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '삭제 실패', sev: 'error' }); throw e }
  }

  // '데모결과 추가' 버튼 — 뷰탭(단계별/타임라인/목록/데모결과)과 같은 행 우측 슬롯에 포탈로 배치
  const addBtn = (
    <Button variant="contained" size="small" startIcon={<AddIcon sx={{ fontSize: 18 }} />} onClick={() => { setFormPre({ equipment: '' }); setFormOpen(true) }} sx={{ whiteSpace: 'nowrap' }}>
      데모결과 추가
    </Button>
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
            messages={chatOf(g.equipment)} canEdit={isMember} user={user} chatBusy={chatBusy} latestValueChange={latestValueChangeOf(g.equipment)}
            onPostChat={onPostChat} onEditChat={onEditChat} onDeleteChat={onDeleteChat} onSaveValues={onSaveValues}
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
