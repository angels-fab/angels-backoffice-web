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
import CheckIcon from '@mui/icons-material/Check'
import TuneIcon from '@mui/icons-material/Tune'
import HistoryIcon from '@mui/icons-material/History'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
import { useRole } from '@/auth/role'
import {
  fetchMetricDefs, fetchDemoResults, fetchDemoMemos, groupDemoResults, bestMakers, demoFileUrl, saveDemoMemo, updateDemoResult,
  type DemoMetricDef, type DemoRoundRow, type DemoMemo, type DemoPhotoRef, type DemoFileRef, type DemoMakerGroup,
} from '@/api/demo'
import { MetricEditorDialog, MetricHistoryDialog } from './DemoMetricEditor'

const COL_W = 118 // 제조사 열 고정폭(1·2·3개사 통일, 타이트)
const LABEL_W = 100 // 지표/장비명 열 폭

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

/** 제조사 열 헤더 — (사진 위) 제조사·모델·파일 한 줄 → 대표사진(회차칩·날짜·확대) → 값수정 트리거 */
function MakerHead({ mg, sel, onSel, onOpen, canEdit, editing, savingVal, onStartVal, onSaveVal, onCancelVal }: {
  mg: DemoMakerGroup; sel: number; onSel: (i: number) => void; onOpen: (photos: DemoPhotoRef[], idx: number) => void
  canEdit: boolean; editing: boolean; savingVal: boolean; onStartVal: () => void; onSaveVal: () => void; onCancelVal: () => void
}) {
  const r = mg.rounds[Math.min(sel, mg.rounds.length - 1)]
  const cover = r.photos[r.cover] || r.photos[0]
  const multi = mg.rounds.length > 1
  return (
    <Box sx={{ width: '100%' }}>
      {/* 사진 위 헤더 한 줄: 제조사 · 모델명 · 파일 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, mb: 0.5, minWidth: 0 }}>
        <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700 }}>
          {mg.maker}{mg.model ? <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500, ml: 0.4 }}>{mg.model}</Box> : null}
        </Box>
        <Box sx={{ flex: 1 }} />
        {r.files.map((f, i) => (
          <Tooltip key={i} title={f.name} arrow>
            <Box component="span" onClick={() => void openFile(f)} sx={{ display: 'inline-flex', lineHeight: 0, flex: 'none', cursor: f.path ? 'pointer' : 'default' }}>
              <AttachmentIcon type={f.type} name={f.name} size={14} />
            </Box>
          </Tooltip>
        ))}
      </Box>
      {/* 대표사진 */}
      <Box sx={{ position: 'relative', height: 74, borderRadius: '8px', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
        <Photo photo={cover} onClick={() => onOpen(r.photos, r.cover || 0)} />
        {multi && (
          <Box sx={{ position: 'absolute', top: 4, left: 4, display: 'flex', gap: '3px' }}>
            {mg.rounds.map((rr, i) => (
              <Box key={rr.round} component="button" aria-label={`${rr.round}차`} aria-pressed={i === sel} onClick={(e) => { e.stopPropagation(); onSel(i) }} sx={roundChip(i === sel)}>{rr.round}차</Box>
            ))}
          </Box>
        )}
        <Box sx={{ position: 'absolute', top: 4, right: 4, fontSize: 9, color: '#fff', bgcolor: 'rgba(0,0,0,.5)', borderRadius: '4px', px: '4px', py: '1px', fontWeight: 700 }}>{fmtDate(r.date)}</Box>
        {r.photos.length > 0 && <ZoomOutMapIcon sx={{ position: 'absolute', bottom: 4, right: 4, fontSize: 14, color: '#fff', bgcolor: 'rgba(0,0,0,.45)', borderRadius: '4px', p: '2px' }} />}
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
            <Tooltip title={`${r.round}차 지표값 수정`}><IconButton size="small" onClick={onStartVal} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}><EditIcon sx={{ fontSize: 12 }} /></IconButton></Tooltip>
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
function EquipGroup({ equipment, defs, makers, memo, canEdit, onOpen, onSaveMemo, onSaveValues, onEditMetrics, onViewHistory }: {
  equipment: string; defs: DemoMetricDef[]; makers: DemoMakerGroup[]; memo?: DemoMemo; canEdit: boolean
  onOpen: (photos: DemoPhotoRef[], idx: number) => void; onSaveMemo: (equipment: string, body: string) => Promise<void>
  onSaveValues: (roundId: number, metrics: Record<string, string>) => Promise<void>
  onEditMetrics: () => void; onViewHistory: () => void
}) {
  // 제조사별 선택 회차(기본=최신)
  const [sel, setSel] = useState<Record<string, number>>(() => Object.fromEntries(makers.map((m) => [m.key, m.rounds.length - 1])))
  const shown = (m: DemoMakerGroup) => m.rounds[Math.min(sel[m.key] ?? m.rounds.length - 1, m.rounds.length - 1)]

  // 제조사 지표값 수정 — 실수 방지로 열 단위 명시 편집(작은 트리거 → 인풋 → 저장)
  const [valEditKey, setValEditKey] = useState<string | null>(null)
  const [valDraft, setValDraft] = useState<Record<string, string>>({})
  const [savingVal, setSavingVal] = useState(false)
  const startVal = (m: DemoMakerGroup) => { setValEditKey(m.key); setValDraft({ ...shown(m).metrics }) }
  const cancelVal = () => { setValEditKey(null); setValDraft({}) }
  const saveVal = async (m: DemoMakerGroup) => { setSavingVal(true); try { await onSaveValues(shown(m).id, valDraft); setValEditKey(null); setValDraft({}) } finally { setSavingVal(false) } }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(memo?.body || '')
  const [savingMemo, setSavingMemo] = useState(false)

  // 편집 중인 열은 draft 값으로 비교(우수 강조가 입력 즉시 반영)
  const bestFor = (def: DemoMetricDef) => bestMakers(def, makers.map((m) => ({ key: m.key, value: valEditKey === m.key ? valDraft[def.key] : shown(m).metrics[def.key] })))

  const startEdit = () => { setDraft(memo?.body || ''); setEditing(true) }
  const doSave = async () => { setSavingMemo(true); try { await onSaveMemo(equipment, draft.trim()); setEditing(false) } finally { setSavingMemo(false) } }
  const tableW = LABEL_W + makers.length * COL_W

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* 상단 = 버튼만(제목은 표 좌상단 셀로 이동) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Box sx={{ flex: 1 }} />
        {canEdit && <Button size="small" startIcon={<TuneIcon sx={{ fontSize: 15 }} />} onClick={onEditMetrics} sx={{ fontSize: 11.5, minWidth: 0, color: 'text.secondary' }}>지표 편집</Button>}
        <Button size="small" startIcon={<HistoryIcon sx={{ fontSize: 15 }} />} onClick={onViewHistory} sx={{ fontSize: 11.5, minWidth: 0, color: 'text.secondary' }}>변경 이력</Button>
      </Box>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: '12px', bgcolor: 'background.paper', p: 1.25, overflowX: 'auto' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: tableW }}>
          <Box component="thead">
            <Box component="tr">
              {/* 1행1열 = 장비명(높이 있는 좌상단 코너, 지표열과 같은 셀) */}
              <Box component="th" sx={{ width: LABEL_W, textAlign: 'left', verticalAlign: 'top', p: '4px 8px', borderRight: 1, borderColor: 'divider' }}>
                <Box sx={{ fontSize: 13.5, fontWeight: 800, lineHeight: 1.2 }}>{equipment}</Box>
                <Box sx={{ fontSize: 10, color: 'text.disabled', mt: 0.25 }}>경쟁 {makers.length}개사</Box>
              </Box>
              {makers.map((m, mi) => (
                <Box component="th" key={m.key} sx={{ width: COL_W, p: '4px 6px', textAlign: 'center', verticalAlign: 'top', borderLeft: mi > 0 ? 1 : 0, borderColor: 'divider' }}>
                  <MakerHead mg={m} sel={sel[m.key] ?? m.rounds.length - 1} onSel={(i) => setSel((s) => ({ ...s, [m.key]: i }))} onOpen={onOpen}
                    canEdit={canEdit} editing={valEditKey === m.key} savingVal={savingVal}
                    onStartVal={() => startVal(m)} onSaveVal={() => void saveVal(m)} onCancelVal={cancelVal} />
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {defs.length === 0 && (
              <Box component="tr"><Box component="td" colSpan={makers.length + 1} sx={{ p: 1.5, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>등록된 표준 지표가 없습니다. 위 "지표 편집"에서 추가하세요.</Box></Box>
            )}
            {defs.map((def) => {
              const best = bestFor(def)
              return (
                <Box component="tr" key={def.key}>
                  <Box component="td" sx={{ width: LABEL_W, textAlign: 'left', p: '6px 8px', fontSize: 11.5, color: 'text.secondary', borderRight: 1, borderTop: 1, borderColor: 'divider' }}>
                    {def.label}{def.unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.4, fontSize: 10 }}>{def.unit}</Box> : null}
                  </Box>
                  {makers.map((m, mi) => {
                    const editingThis = valEditKey === m.key
                    const v = shown(m).metrics[def.key]
                    const isBest = best.has(m.key)
                    return (
                      <Box component="td" key={m.key} sx={{ width: COL_W, textAlign: 'center', p: '5px 6px', fontSize: 12.5, borderLeft: mi > 0 ? 1 : 0, borderTop: 1, borderColor: 'divider' }}>
                        {editingThis ? (
                          <InputBase value={valDraft[def.key] ?? ''} onChange={(e) => setValDraft((d) => ({ ...d, [def.key]: e.target.value }))} placeholder="-"
                            sx={(th) => ({ width: '100%', fontSize: 12, bgcolor: alpha(th.palette.warning.main, 0.08), border: `1px solid ${alpha(th.palette.warning.main, 0.5)}`, borderRadius: '5px', px: 0.5, py: '1px', '& input': { textAlign: 'center', p: 0 } })} />
                        ) : (
                          <Box component="span" sx={(th) => ({ display: 'inline-block', px: isBest ? '7px' : 0, py: isBest ? '2px' : 0, borderRadius: '6px', fontWeight: isBest ? 700 : 400, ...(isBest && { bgcolor: alpha(th.palette.success.main, 0.16), color: th.palette.success.main }) })}>{v || '-'}</Box>
                        )}
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
  const [editorEquip, setEditorEquip] = useState<string | null>(null)
  const [historyEquip, setHistoryEquip] = useState<string | null>(null)
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

  const onSaveValues = async (roundId: number, metrics: Record<string, string>) => {
    if (!user) throw new Error('로그인이 필요합니다')
    try { await updateDemoResult(roundId, { metrics, author: user }); setSnack({ open: true, msg: '지표값을 수정했습니다.', sev: 'success' }); load() }
    catch (e) { setSnack({ open: true, msg: e instanceof Error ? e.message : '값 수정 실패', sev: 'error' }); throw e }
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
            onOpen={(photos, idx) => setViewer({ photos, idx })} onSaveMemo={onSaveMemo} onSaveValues={onSaveValues}
            onEditMetrics={() => setEditorEquip(g.equipment)} onViewHistory={() => setHistoryEquip(g.equipment)}
          />
        ))
      )}
      {viewer && <Lightbox photos={viewer.photos} idx={viewer.idx} onIdx={(i) => setViewer((v) => (v ? { ...v, idx: i } : v))} onClose={() => setViewer(null)} />}
      {editorEquip && (
        <MetricEditorDialog open equipment={editorEquip} defs={defs} author={user}
          onClose={() => setEditorEquip(null)}
          onChanged={() => { load(); setSnack({ open: true, msg: '지표를 변경했습니다(이력 기록됨).', sev: 'success' }) }}
          onError={(msg) => setSnack({ open: true, msg, sev: 'error' })} />
      )}
      {historyEquip && <MetricHistoryDialog open equipment={historyEquip} onClose={() => setHistoryEquip(null)} />}
      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ width: '100%' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
