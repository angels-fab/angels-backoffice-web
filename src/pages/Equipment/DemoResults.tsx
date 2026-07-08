import { useState, useEffect, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap'
import EditIcon from '@mui/icons-material/Edit'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { useRole } from '@/auth/role'
import {
  fetchMetricDefs, fetchDemoResults, fetchDemoMemos, groupDemoResults, bestMakers, demoFileUrl, saveDemoMemo,
  type DemoMetricDef, type DemoRoundRow, type DemoMemo, type DemoPhotoRef, type DemoFileRef, type DemoMakerGroup,
} from '@/api/demo'

const fmtDate = (d: string) => (d ? d.replace(/-/g, '.').slice(2) : '')

// 서명 URL 캐시 — 사진(비공개 버킷)을 매번 재요청하지 않도록
const urlCache = new Map<string, string>()

/** 사진 타일 — path 있으면 서명URL로 이미지, 없으면(샘플) 플레이스홀더 */
function Photo({ photo, onClick }: { photo?: DemoPhotoRef; onClick?: () => void }) {
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
      {url ? <Box component="img" src={url} alt={photo?.name || ''} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOutlinedIcon sx={{ fontSize: 20 }} />}
    </Box>
  )
}

const roundChip = (active: boolean) => (th: Theme) => ({
  fontSize: 9.5, fontWeight: 700, lineHeight: 1, px: '6px', py: '3px', borderRadius: '999px', border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', color: '#fff', bgcolor: active ? th.palette.primary.main : 'rgba(0,0,0,.5)',
  boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(255,255,255,.28)',
})

/** 제조사 열 헤더 — 대표사진 배너(회차칩·확대) + 제조사/모델 + 날짜 + 첨부아이콘 */
function MakerHead({ mg, sel, onSel, onOpen }: { mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; onOpen: (photos: DemoPhotoRef[], idx: number) => void }) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const cover = r.photos[r.cover] || r.photos[0]
  const multi = mg.rounds.length > 1
  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ position: 'relative', height: 82, borderRadius: '9px', overflow: 'hidden', border: 1, borderColor: 'divider', mb: 0.75 }}>
        <Photo photo={cover} onClick={() => onOpen(r.photos, r.cover || 0)} />
        {multi && (
          <Box sx={{ position: 'absolute', top: 5, left: 5, display: 'flex', gap: '3px' }}>
            {mg.rounds.map((rr, i) => (
              <Box key={rr.round} component="button" aria-label={`${rr.round}차`} aria-pressed={i === sel} onClick={(e) => { e.stopPropagation(); onSel(i) }} sx={roundChip(i === sel)}>{rr.round}차</Box>
            ))}
          </Box>
        )}
        <Box sx={{ position: 'absolute', top: 5, right: 5, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', borderRadius: '5px', px: '5px', py: '1px', fontWeight: 700 }}>{fmtDate(r.date)}</Box>
        {r.photos.length > 0 && <ZoomOutMapIcon sx={{ position: 'absolute', bottom: 5, right: 5, fontSize: 15, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', borderRadius: '4px', p: '2px' }} />}
      </Box>
      <Box sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.25 }}>{mg.maker}</Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: '1px' }}>
        <Box sx={{ fontSize: 10.5, color: 'text.secondary' }}>{mg.model}</Box>
        {r.files.map((f, i) => (
          <Tooltip key={i} title={f.name} arrow>
            <Box component="span" onClick={(e) => { e.stopPropagation(); void openFile(f) }} sx={{ display: 'inline-flex', lineHeight: 0, cursor: f.path ? 'pointer' : 'default' }}>
              <AttachmentIcon type={f.type} name={f.name} size={15} />
            </Box>
          </Tooltip>
        ))}
      </Box>
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

/** 장비종류 1묶음 — 경쟁 제조사 매트릭스 + 비교 메모 */
function EquipGroup({ equipment, defs, makers, memo, canEdit, onOpen, onSaveMemo }: {
  equipment: string; defs: DemoMetricDef[]; makers: DemoMakerGroup[]; memo?: DemoMemo; canEdit: boolean
  onOpen: (photos: DemoPhotoRef[], idx: number) => void; onSaveMemo: (equipment: string, body: string) => Promise<void>
}) {
  // 제조사별 선택 회차(기본=최신)
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(makers.map((m) => [m.key, m.rounds.length - 1])))
  const shown = (m: DemoMakerGroup) => m.rounds[Math.min(sel[m.key] ?? m.rounds.length - 1, m.rounds.length - 1)]

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memo?.body || '')
  const [savingMemo, setSavingMemo] = useState(false)

  const bestFor = (def: DemoMetricDef) => bestMakers(def, makers.map((m) => ({ key: m.key, value: shown(m).metrics[def.key] })))

  const startEdit = () => { setDraft(memo?.body || ''); setEditing(true) }
  const doSave = async () => { setSavingMemo(true); try { await onSaveMemo(equipment, draft.trim()); setEditing(false) } finally { setSavingMemo(false) } }

  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, fontSize: 14, fontWeight: 700 }}>
        {equipment}<Box component="span" sx={{ fontSize: 11.5, fontWeight: 400, color: 'text.disabled' }}>· 경쟁 {makers.length}개사</Box>
      </Box>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper', p: 1.25, overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: makers.length > 3 ? 560 : 0 }}>
          <Box component="thead">
            <Box component="tr">
              <Box component="th" sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', textAlign: 'left', verticalAlign: 'bottom', p: '6px 8px', fontSize: 10.5, fontWeight: 700, color: 'text.disabled', borderRight: 1, borderColor: 'divider', minWidth: 92 }}>지표</Box>
              {makers.map((m) => (
                <Box component="th" key={m.key} sx={{ p: '6px 8px', textAlign: 'center', verticalAlign: 'bottom' }}>
                  <MakerHead mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={(i) => setSel((s) => ({ ...s, [m.key]: i }))} onOpen={onOpen} />
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {defs.length === 0 && (
              <Box component="tr"><Box component="td" colSpan={makers.length + 1} sx={{ p: 1.5, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>등록된 표준 지표가 없습니다(관리자 지표 설정 필요).</Box></Box>
            )}
            {defs.map((def) => {
              const best = bestFor(def)
              return (
                <Box component="tr" key={def.key}>
                  <Box component="td" sx={{ position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper', textAlign: 'left', p: '7px 8px', fontSize: 11.5, color: 'text.secondary', borderRight: 1, borderTop: 1, borderColor: 'divider', whiteSpace: 'nowrap' }}>
                    {def.label}{def.unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.4, fontSize: 10 }}>{def.unit}</Box> : null}
                  </Box>
                  {makers.map((m) => {
                    const v = shown(m).metrics[def.key]
                    const isBest = best.has(m.key)
                    return (
                      <Box component="td" key={m.key} sx={{ textAlign: 'center', p: '6px 8px', fontSize: 12.5, borderTop: 1, borderColor: 'divider' }}>
                        <Box component="span" sx={(th) => ({ display: 'inline-block', px: isBest ? '8px' : 0, py: isBest ? '2px' : 0, borderRadius: '6px', fontWeight: isBest ? 700 : 400, ...(isBest && { bgcolor: alpha(th.palette.success.main, 0.16), color: th.palette.success.main }) })}>{v || '-'}</Box>
                      </Box>
                    )
                  })}
                </Box>
              )
            })}
          </Box>
        </Box>
      </Box>

      {/* 비교 메모 */}
      <Box sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: '10px', bgcolor: (th) => alpha(th.palette.text.primary, 0.02), p: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: 'text.disabled' }}>비교 메모</Box>
          <Box sx={{ flex: 1 }} />
          {canEdit && !editing && <Button size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />} onClick={startEdit} sx={{ fontSize: 11, minWidth: 0, color: 'text.secondary' }}>{memo?.body ? '수정' : '작성'}</Button>}
        </Box>
        {editing ? (
          <Box>
            <InputBase multiline minRows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="제조사 비교·판단·후속 계획을 적어주세요" sx={(th) => ({ width: '100%', fontSize: 12.5, bgcolor: 'background.paper', border: `1px solid ${th.palette.divider}`, borderRadius: '8px', px: 1, py: 0.75 })} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 0.75 }}>
              <Button size="small" onClick={() => setEditing(false)} disabled={savingMemo} sx={{ color: 'text.secondary', fontSize: 12 }}>취소</Button>
              <Button size="small" variant="contained" onClick={() => void doSave()} disabled={savingMemo} startIcon={savingMemo ? <CircularProgress size={13} thickness={5} color="inherit" /> : undefined} sx={{ fontSize: 12 }}>저장</Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ fontSize: 12.5, color: memo?.body ? 'text.primary' : 'text.disabled', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {memo?.body || '아직 비교 메모가 없습니다.'}
            {memo?.body && memo.updatedBy && <Box component="span" sx={{ fontSize: 10.5, color: 'text.disabled', ml: 1 }}>— {memo.updatedBy}</Box>}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * 데모결과 뷰 — 장비도입 '데모결과' 탭. 장비종류별로 경쟁 제조사를 매트릭스로 묶어 핵심지표 비교.
 * 지표는 표준 정의(demo_metric_defs)를 따름. 사진 탭=라이트박스. 비교 메모(팀원 작성).
 */
export default function DemoResults() {
  const { isMember, user } = useRole()
  const [defs, setDefs] = useState<DemoMetricDef[]>([])
  const [rows, setRows] = useState<DemoRoundRow[]>([])
  const [memos, setMemos] = useState<DemoMemo[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ photos: DemoPhotoRef[]; idx: number } | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'error' }>({ open: false, msg: '', sev: 'success' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([fetchMetricDefs(), fetchDemoResults(), fetchDemoMemos()])
      .then(([d, r, m]) => { setDefs(d); setRows(r); setMemos(m) })
      .catch((e) => setSnack({ open: true, msg: e instanceof Error ? e.message : '불러오기 실패', sev: 'error' }))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const groups = useMemo(() => groupDemoResults(rows, defs), [rows, defs])
  const memoOf = (eq: string) => memos.find((m) => m.equipment === eq)

  const onSaveMemo = async (equipment: string, body: string) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await saveDemoMemo(equipment, body, user); setSnack({ open: true, msg: '메모를 저장했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '메모 저장 실패', sev: 'error' }); throw e }
  }

  return (
    <Box sx={{ p: 1.5 }}>
      {loading ? (
        <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>불러오는 중…</Box>
      ) : groups.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>등록된 데모결과가 없습니다.</Box>
      ) : (
        groups.map((g) => (
          <EquipGroup
            key={g.equipment}
            equipment={g.equipment} defs={g.defs} makers={g.makers}
            memo={memoOf(g.equipment)} canEdit={isMember}
            onOpen={(photos, idx) => setViewer({ photos, idx })} onSaveMemo={onSaveMemo}
          />
        ))
      )}
      {viewer && <Lightbox photos={viewer.photos} idx={viewer.idx} onIdx={(i) => setViewer((v) => (v ? { ...v, idx: i } : v))} onClose={() => setViewer(null)} />}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
