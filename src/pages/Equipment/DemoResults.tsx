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
// 인라인 편집 공용 노란 인풋 스타일 + 저장/취소 버튼(마우스 조작). 버튼 onMouseDown preventDefault로 인풋 blur 선발생 방지
const editInputSx = (th: Theme) => ({ fontSize: 12, bgcolor: alpha(th.palette.warning.main, 0.1), border: `1px solid ${alpha(th.palette.warning.main, 0.65)}`, borderRadius: '5px', px: 0.5, py: '1px' })
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
  const start = (e: React.MouseEvent) => { e.stopPropagation(); setV(text); setEditing(true) }
  const commit = () => { setEditing(false); const nv = v.trim(); if (nv !== (text || '').trim()) onCommit(nv) }
  if (editing) {
    const onKey = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
      else if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
    }
    // 한 줄 값 = [좁은 인풋][✓][✕] 한 줄(그 자리 그대로) / 여러 줄(샘플·조건) = 인풋 아래 버튼
    if (!multiline) {
      return (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, maxWidth: '100%', verticalAlign: 'middle' }}>
          <InputBase autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} onKeyDown={onKey}
            sx={(th) => ({ width: `${Math.max(5, Math.min(14, v.length + 2))}ch`, ...editInputSx(th), '& input': { textAlign: align, p: 0 } })} />
          <SaveCancel onSave={commit} onCancel={() => setEditing(false)} />
        </Box>
      )
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, width: '100%' }}>
        <InputBase autoFocus multiline value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} placeholder={placeholder} onKeyDown={onKey}
          sx={(th) => ({ width: '100%', ...editInputSx(th), '& textarea, & input': { textAlign: align, p: 0 } })} />
        <SaveCancel onSave={commit} onCancel={() => setEditing(false)} />
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, maxWidth: '100%', verticalAlign: 'middle', '& .pen': { opacity: 0, transition: 'opacity .12s' }, '&:hover .pen': { opacity: canEdit ? 0.75 : 0 } }}>
      <Box component="span" sx={{ minWidth: 0, ...(multiline ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : {}) }}>{display ?? (text || (canEdit ? placeholder : '-'))}</Box>
      {canEdit && <IconButton className="pen" size="small" aria-label="수정" onClick={start} sx={{ p: '1px', flex: 'none', color: 'text.disabled', '&:hover': { color: 'warning.main' } }}><EditIcon sx={{ fontSize: 12 }} /></IconButton>}
    </Box>
  )
}

/** 지표명+단위 통합 인라인 편집 — 연필 하나로 [지표명] [단위] 동시 수정 + 저장/취소 버튼 */
function EditLabelUnit({ label, unit, canEdit, onCommit }: { label: string; unit: string; canEdit: boolean; onCommit: (label: string, unit: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [l, setL] = useState(''); const [u, setU] = useState('')
  const start = (e: React.MouseEvent) => { e.stopPropagation(); setL(label); setU(unit); setEditing(true) }
  const commit = () => { setEditing(false); if (l.trim() !== label.trim() || u.trim() !== unit.trim()) onCommit(l.trim(), u.trim()) }
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false) } else if (e.key === 'Enter') { e.preventDefault(); commit() } }
  if (editing) {
    // 지표명·단위가 써진 그 자리에서 그대로 — 좁은 인풋(내용 길이 맞춤) 가운데 스택, 단위 줄에 저장/취소 인라인
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.3 }}>
        <InputBase autoFocus value={l} onChange={(e) => setL(e.target.value)} placeholder="지표명" onKeyDown={onKey}
          sx={(th) => ({ width: `${Math.max(6, Math.min(16, l.length + 2))}ch`, maxWidth: '100%', ...editInputSx(th), '& input': { textAlign: 'center', p: 0 } })} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>[</Box>
          <InputBase value={u} onChange={(e) => setU(e.target.value)} placeholder="단위" onKeyDown={onKey}
            sx={(th) => ({ width: `${Math.max(4, Math.min(10, u.length + 2))}ch`, ...editInputSx(th), fontSize: 11, '& input': { textAlign: 'center', p: 0 } })} />
          <Box component="span" sx={{ fontSize: 10, color: 'text.disabled' }}>]</Box>
          <SaveCancel onSave={commit} onCancel={() => setEditing(false)} />
        </Box>
      </Box>
    )
  }
  return (
    // 표시 — 두 줄로 줄바꿈돼도 가운데정렬(셀 textAlign center와 함께)
    <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.25, maxWidth: '100%', textAlign: 'center', '& .pen': { opacity: 0, transition: 'opacity .12s' }, '&:hover .pen': { opacity: canEdit ? 0.75 : 0 } }}>
      <Box component="span" sx={{ minWidth: 0 }}>{label || (canEdit ? '지표명' : '-')}{unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.4, fontSize: 10 }}>[{unit}]</Box> : null}</Box>
      {canEdit && <IconButton className="pen" size="small" aria-label="지표 수정" onClick={start} sx={{ p: '1px', flex: 'none', color: 'text.disabled', '&:hover': { color: 'warning.main' } }}><EditIcon sx={{ fontSize: 12 }} /></IconButton>}
    </Box>
  )
}

/** 제조사 열 헤더 — 색깔 밴드(제조사·모델·파일, 상단 라운드) → 사진영역(대표 크게 + 우측 썸네일 그리드 + 더보기) → 값수정 트리거 */
function MakerHead({ mg, sel, onSel, onOpen, canEdit, onAddRound, onDeleteRound, onManagePhotos }: {
  mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; onOpen: (photos: DemoPhotoRef[], idx: number) => void
  canEdit: boolean; onAddRound: () => void; onDeleteRound: () => void; onManagePhotos: () => void
}) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const coverIdx = Math.min(Math.max(r.cover || 0, 0), Math.max(r.photos.length - 1, 0))
  const cover = r.photos[coverIdx]
  const others = r.photos.map((_, i) => i).filter((i) => i !== coverIdx)
  const CELLS = 4 // 하단 4:3 썸네일 4칸 고정(빈 칸은 검은 자리). 4개 초과면 마지막 칸이 +N
  const overflow = others.length > CELLS
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
      <Box sx={{ border: 1, borderTop: 0, borderColor: 'divider', borderRadius: '0 0 8px 8px', overflow: 'hidden', bgcolor: 'background.default' }}>
        <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3' }}>
          <Photo photo={cover} fit="contain" onClick={() => { if (r.photos.length) onOpen(r.photos, coverIdx) }} />
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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px', p: '2px' }}>
          {Array.from({ length: CELLS }).map((_, k) => {
            const isPlus = overflow && k === CELLS - 1
            const pi = isPlus ? others[CELLS - 1] : others[k]
            const has = pi !== undefined
            return (
              <Box key={k} onClick={() => { if (has) onOpen(r.photos, pi) }}
                sx={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', borderRadius: '3px', bgcolor: '#000', cursor: has ? 'pointer' : 'default' }}>
                {has && <Photo photo={r.photos[pi]} fit="contain" />}
                {isPlus && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>+{others.length - (CELLS - 1)}</Box>}
              </Box>
            )
          })}
        </Box>
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

// 갤러리 콘택트시트 제조사 열 색(A/B 구분용) — 앱 accent 톤
const MK_COLORS = ['#5491DA', '#4DA167', '#A98AE0', '#D6A23E']
interface GItem { roundNo: number; idx: number; name: string; path?: string; photos: DemoPhotoRef[] }
interface GCol { key: string; maker: string; color: string; items: GItem[] }

/**
 * 사진 갤러리 시트(B+C 절충) — 비교표는 위에 유지, 화면 하단 고정 시트로 뜬다.
 *  · 미리보기 = 제조사 카드 배열과 같은 고정 슬롯(1개사=가운데 1칸, 2개사=좌우 분할 고정)
 *  · 제조사 칩 토글(색 채움) = 그 슬롯에 사진 표시/해제 · 썸네일 클릭 = 해당 슬롯 사진 교체
 *  · 시트 높이 = 16:9 사진 2장이 나란히 꽉 차는 높이(화면 폭 기준 자동)
 *  · 닫힘 = 내려가는 모션(백드롭·X·Esc 공통)
 */
function GallerySheet({ equipment, columns, initial, onClose }: { equipment: string; columns: GCol[]; initial: { c: number; i: number }; onClose: () => void }) {
  const [slots, setSlots] = useState<number[]>(() => columns.map((_, c) => (c === initial.c ? initial.i : 0)))
  const [active, setActive] = useState<number[]>([initial.c]) // 켜진 제조사(슬롯에 사진 표시). 배열이지만 표시는 항상 카드 배열 순서
  const [zoom, setZoom] = useState<{ photos: DemoPhotoRef[]; idx: number } | null>(null)
  const [closing, setClosing] = useState(false) // 닫힘 모션 재생 후 실제 unmount
  const total = columns.reduce((s, c) => s + c.items.length, 0)
  // 닫기 = 모션(.2s) 후 타이머로 unmount — animationend 이벤트는 환경에 따라 안 올 수 있어 타이머가 확실
  const closeTimer = useRef<number | null>(null)
  const requestClose = useCallback(() => {
    setClosing(true)
    if (closeTimer.current == null) closeTimer.current = window.setTimeout(onClose, 230)
  }, [onClose])
  useEffect(() => () => { if (closeTimer.current != null) clearTimeout(closeTimer.current) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(null); else requestClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom, requestClose])

  const openZoom = (it?: GItem) => { if (it && it.photos.length) setZoom({ photos: it.photos, idx: it.idx }) }
  const toggleMaker = (c: number) => setActive((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]))
  // 썸네일 클릭 — 그 제조사 슬롯을 켜고(꺼져 있었다면) 사진 교체
  const pickThumb = (c: number, i: number) => {
    setActive((a) => (a.includes(c) ? a : [...a, c]))
    setSlots((s) => s.map((v, ci) => (ci === c ? i : v)))
  }

  // 미리보기 슬롯 — 카드 배열 순서 고정(1개사=가운데 한 칸, 2개사=양옆). 칩 꺼짐 = 빈 슬롯(자리 유지), 켜짐 = 사진+캡션+확대
  const single = columns.length === 1
  const previewSlot = (c: number) => {
    const col = columns[c]
    const on = active.includes(c)
    const it = on ? col.items[slots[c]] : undefined
    return (
      <Box key={col.key} onClick={() => openZoom(it)}
        sx={{ ...(single ? { flex: '0 0 auto', height: '100%', aspectRatio: '4 / 3' } : { flex: 1 }), minWidth: 0, position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.default', border: 1, borderColor: 'divider', cursor: it && it.photos.length ? 'zoom-in' : 'default' }}>
        {it ? <Photo photo={{ name: it.name, path: it.path }} fit="contain" /> : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75, color: 'text.disabled' }}>
            <ImageOutlinedIcon sx={{ fontSize: 26, opacity: 0.6 }} />
            <Box sx={{ fontSize: 11.5 }}>{col.maker} — 칩이나 사진을 눌러 표시</Box>
          </Box>
        )}
        {columns.length > 1 && <Box sx={{ position: 'absolute', top: 8, left: 8, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: alpha(col.color, on ? 0.92 : 0.4), borderRadius: '6px', px: 1, py: '2px' }}>{col.maker}</Box>}
        {it && <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: '8px 10px', fontSize: 12, color: '#fff', background: 'linear-gradient(0deg, rgba(0,0,0,.6), transparent)' }}><b>{col.maker} · {it.roundNo}차</b> · {it.name}</Box>}
        {it && it.photos.length > 0 && <ZoomOutMapIcon sx={{ position: 'absolute', bottom: 8, right: 8, fontSize: 16, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', borderRadius: '4px', p: '2px' }} />}
      </Box>
    )
  }

  return (
    <>
    {/* 백드롭 — 시트 밖(비교표 등) 클릭 시 닫힘. 옅은 스크림으로 클릭 가능함을 암시 */}
    <Box aria-hidden onClick={requestClose} sx={(th) => ({ position: 'fixed', inset: 0, zIndex: th.zIndex.drawer, bgcolor: 'rgba(0,0,0,.2)', opacity: closing ? 0 : 1, transition: 'opacity .2s ease', pointerEvents: closing ? 'none' : 'auto' })} />
    <Box
      sx={(th) => ({ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: th.zIndex.drawer + 1,
        // 높이 = 모든 그룹 공통 고정: 4:3 사진 2장을 좌우로 나란히 뒀을 때 여백 없이 가득 차는 값(항상 2슬롯)
        height: { xs: '56vh', md: 'clamp(340px, calc((100vw - 343px) / 2 * 0.75 + 58px), 84vh)' },
        bgcolor: 'background.paper', borderTop: `1px solid ${th.palette.divider}`, borderRadius: '16px 16px 0 0', boxShadow: '0 -12px 32px rgba(0,0,0,.42)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: closing ? 'gsDown .2s ease forwards' : 'gsUp .22s ease', '@keyframes gsUp': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } }, '@keyframes gsDown': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } } })}>
      {/* 헤더 — 장비명·장수 + 닫기 */}
      <Box sx={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flex: 'none' }} />
        <Box sx={{ fontSize: 13.5, fontWeight: 800 }}>{equipment} 사진</Box>
        <Box sx={{ fontSize: 11.5, color: 'text.disabled' }}>· {total}장</Box>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ fontSize: 11, color: 'text.disabled' }}>제조사 칩을 눌러 나란히 비교</Box>
        <IconButton size="small" aria-label="닫기" onClick={requestClose}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      {/* 본문 — 미리보기(1개사=가운데, 2개사=양옆 고정 슬롯) + 콘택트시트(오른쪽) */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', gap: 0.75, p: 1, justifyContent: single ? 'center' : 'stretch' }}>
          {columns.map((_, c) => previewSlot(c))}
        </Box>
        <Box sx={{ flex: 'none', width: { xs: '100%', md: 320 }, minHeight: 0, borderLeft: { md: 1 }, borderTop: { xs: 1, md: 0 }, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 'none', fontSize: 11, color: 'text.disabled', px: 1.25, pt: 1, pb: 0.5 }}>훑어보기 — 제조사별</Box>
          <Box sx={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', gap: 1, px: 1.25, pb: 1.25 }}>
            {/* 항상 2열 분할 — 1개사면 왼쪽만 차고 오른쪽은 공란(비교 슬롯 자리) */}
            {[0, 1].map((c) => {
              const col = columns[c]
              if (!col) return <Box key={`empty-${c}`} aria-hidden sx={{ flex: 1, minWidth: 0 }} />
              const on = active.includes(c)
              return (
              <Box key={col.key} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                {/* 제조사 칩 — 클릭 = 그 슬롯 표시 토글. 켜짐=색 채움, 꺼짐=옅은 틴트(테두리 효과 없음) */}
                <Box role="button" tabIndex={0} aria-pressed={on} onClick={() => toggleMaker(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMaker(c) } }}
                  sx={{ position: 'sticky', top: 0, zIndex: 1, fontSize: 11.5, fontWeight: 700, borderRadius: '6px', textAlign: 'center', py: '3px', cursor: 'pointer', userSelect: 'none', transition: 'background-color .18s, color .18s',
                    ...(on ? { bgcolor: col.color, color: '#fff' } : { bgcolor: alpha(col.color, 0.16), color: col.color, '&:hover': { bgcolor: alpha(col.color, 0.3) } }) }}>
                  {col.maker}
                </Box>
                {col.items.length === 0 && <Box sx={{ fontSize: 10.5, color: 'text.disabled', textAlign: 'center', py: 1 }}>사진 없음</Box>}
                {col.items.map((it, i) => {
                  const picked = on && slots[c] === i
                  return (
                    <Box key={i} role="button" tabIndex={0} aria-pressed={picked}
                      onClick={() => pickThumb(c, i)}
                      sx={(th) => ({ position: 'relative', height: 64, flex: 'none', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', outline: picked ? `2px solid ${th.palette.primary.main}` : '2px solid transparent', outlineOffset: '-2px' })}>
                      <Photo photo={{ name: it.name, path: it.path }} />
                      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', px: '4px', py: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.roundNo}차 · {it.name}</Box>
                    </Box>
                  )
                })}
              </Box>
              )
            })}
            {/* 하단 페이드 — 스크롤바 숨김 대신 '아래 더 있음' 힌트(H안) */}
            <Box aria-hidden sx={(th) => ({ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, pointerEvents: 'none', background: `linear-gradient(0deg, ${th.palette.background.paper} 18%, transparent)` })} />
          </Box>
        </Box>
      </Box>
      {zoom && <Lightbox photos={zoom.photos} idx={zoom.idx} onIdx={(i) => setZoom((z) => (z ? { ...z, idx: i } : z))} onClose={() => setZoom(null)} />}
    </Box>
    </>
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

  // 사진 갤러리(B+C 절충) — 제조사별 전 회차 사진을 열로 모아 시트로 열람
  const columns: GCol[] = makers.map((m, ci) => ({
    key: m.key, maker: m.maker, color: MK_COLORS[ci % MK_COLORS.length],
    items: m.rounds.flatMap((rd) => rd.photos.map((ph, i) => ({ roundNo: rd.round, idx: i, name: ph.name, path: ph.path, photos: rd.photos }))),
  }))
  const [gallery, setGallery] = useState<{ c: number; i: number } | null>(null)
  // 사진 관리(추가·삭제·대표) — 선택 회차 대상
  const [photoMg, setPhotoMg] = useState<DemoMakerGroup | null>(null)
  const openGallery = (m: DemoMakerGroup, photoIdxInShown: number) => {
    const c = Math.max(0, makers.indexOf(m))
    const rn = shown(m).round
    const it = columns[c]?.items.findIndex((x) => x.roundNo === rn && x.idx === photoIdxInShown) ?? -1
    setGallery({ c, i: it >= 0 ? it : 0 })
  }

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
    // 그룹 셸 — 한 데모(장비종류) 단위 묶음. 그룹끼리는 카드 경계로 구분, 내부는 표(밝은 면) vs 코멘트(어두운 인셋)로 역할 대비
    <Box sx={{ mb: 3, border: 1, borderColor: 'divider', borderRadius: '14px', bgcolor: 'background.paper', p: { xs: 1.25, md: 1.5 }, boxShadow: '0 6px 18px rgba(0,0,0,.16)' }}>

      {/* 비교표(왼쪽·PC 절반 폭) + 코멘트(오른쪽 절반 인셋 패널, 좁은 화면은 표 아래) */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch', gap: 1.5 }}>
      <Box sx={{ flex: { xs: '0 1 auto', md: '1 1 0' }, minWidth: 0, maxWidth: '100%', p: 0.25, overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
          {/* 열 정의 — 라벨(고정) + 등분 서브컬럼(카드 1장 = 2칸) */}
          <Box component="colgroup">
            <Box component="col" sx={{ width: LABEL_W }} />
            {Array.from({ length: subCols }).map((_, i) => <Box component="col" key={i} />)}
          </Box>
          <Box component="thead">
            <Box component="tr">
              {/* 1행1열 = 장비명 + 지표편집·변경이력 아이콘(값 변경 시 점 배지) */}
              <Box component="th" sx={{ textAlign: 'center', verticalAlign: 'middle', p: '4px 8px', borderRight: 1, borderColor: 'divider' }}>
                <Box sx={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.3 }}>{equipment}</Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.25, mt: 0.5 }}>
                  {canEdit && (
                    <Tooltip title="지표 편집"><IconButton size="small" aria-label="지표 편집" onClick={onEditMetrics} sx={{ p: '2px', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}><TuneIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
                  )}
                  {/* 값 변경이 있으면 아이콘 색으로 알림(앰버). '확인' 표시는 사용자 개인화 패치 완료 시 latestValueChange를 seen 타임스탬프와 비교해 해제 → 그때까지는 변경 존재만 색으로. (코드 유지) */}
                  <Tooltip title={latestValueChange ? `변경 이력 — 최근: ${latestValueChange.maker} · ${latestValueChange.changedBy}` : '변경 이력'} arrow>
                    <IconButton size="small" aria-label="변경 이력" onClick={onViewValueHistory} sx={{ p: '2px', color: latestValueChange ? 'warning.main' : 'text.disabled', '&:hover': { color: latestValueChange ? 'warning.main' : 'text.secondary' } }}><HistoryIcon sx={{ fontSize: 15 }} /></IconButton>
                  </Tooltip>
                </Box>
              </Box>
              {padSpan > 0 && <Box component="th" aria-hidden colSpan={padSpan} sx={{ p: 0, border: 0 }} />}
              {makers.map((m, mi) => (
                <Box component="th" key={m.key} colSpan={2} sx={{ p: '4px 6px', textAlign: 'center', verticalAlign: 'top', borderLeft: mi > 0 ? 1 : 0, borderColor: 'divider' }}>
                  <MakerHead mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={(i) => setSel((s) => ({ ...s, [m.key]: i }))} onOpen={(_photos, idx) => openGallery(m, idx)}
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
      </Box>
        {/* 코멘트 — 어두운 인셋 패널(그룹 안에서 표와 역할 대비). 헤더 라벨 없이 카드만(무슨 공간인지 자명) */}
        <Box sx={{ flex: { xs: '0 0 auto', md: '1 1 0' }, minWidth: 0, width: { xs: '100%', md: 'auto' }, bgcolor: 'background.default', border: 1, borderColor: 'divider', borderRadius: '10px', p: 1.25 }}>
          <DemoChat memos={messages} canPost={canEdit} canModerate={canModerate} user={user} busy={chatBusy}
            onPost={(title, body) => onPostChat(equipment, title, body)} onEdit={onEditChat} onDelete={onDeleteChat}
            onReorder={onReorderChat} onWidth={onWidthChat} />
        </Box>
      </Box>

      {/* 사진 갤러리 시트(B+C 절충) — 표 유지 + 하단 시트에서 훑기·2장 비교·전체화면 확대 */}
      {gallery && <GallerySheet equipment={equipment} columns={columns} initial={gallery} onClose={() => setGallery(null)} />}

      {/* 사진 관리 — 선택 회차의 추가/삭제/대표 지정 */}
      {photoMg && <PhotoManageDialog round={shown(photoMg)} maker={photoMg.maker} user={user} onClose={() => setPhotoMg(null)} onSaved={onReload} />}

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
  // 보드 배치 — 순서(드래그)·너비(1~3열). 낙관 갱신 없이 저장 후 재조회(카드 수 적어 충분히 빠름)
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
