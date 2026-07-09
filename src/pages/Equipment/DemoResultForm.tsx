import { useState, useEffect, useMemo, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { ComboField } from '@/pages/Work/inlineFields'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import { addDemoResult, uploadDemoFile, type DemoMetricDef, type DemoRoundRow } from '@/api/demo'

const field = (th: Theme) => ({ bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: '8px', px: 1.1, py: '7px', fontSize: 13, color: 'text.primary', width: '100%' })
const label = { fontSize: 11, fontWeight: 700, color: 'text.disabled', letterSpacing: '.02em', mb: 0.35 }

type Pic = { file: File; url: string; name: string }

/**
 * 데모결과 추가 폼(팀원+) — 장비종류 선택 시 표준 지표 자동 표시(값만 입력).
 * 사진 여러 장(대표 지정)·파일 첨부는 저장 시 업로드. 회차는 같은 장비+제조사+모델이면 자동 다음 회차.
 */
export default function DemoResultForm({ open, onClose, defs, rows, initialEquipment, initialMaker, initialModel, user, onSaved, onError }: {
  open: boolean; onClose: () => void; defs: DemoMetricDef[]; rows: DemoRoundRow[]
  initialEquipment?: string; initialMaker?: string; initialModel?: string
  user: string | null; onSaved: () => void; onError: (msg: string) => void
}) {
  const [equipment, setEquipment] = useState('')
  const [maker, setMaker] = useState('')
  const [model, setModel] = useState('')
  const [round, setRound] = useState(1)
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [conditions, setConditions] = useState('')
  const [metricVals, setMetricVals] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Pic[]>([])
  const [cover, setCover] = useState(0)
  const [docs, setDocs] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState('')
  const [drag, setDrag] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const docInput = useRef<HTMLInputElement>(null)

  // 옵션(자동완성)
  const equipmentOpts = useMemo(() => [...new Set([...defs.map((d) => d.equipment), ...rows.map((r) => r.equipment)])], [defs, rows])
  const makerOpts = useMemo(() => [...new Set(rows.filter((r) => !equipment || r.equipment === equipment).map((r) => r.maker))], [rows, equipment])
  // 비교 장비사는 한 장비당 최대 2곳 — 기존 2곳에 없는 '3번째 신규 제조사'는 차단(기존 장비사 회차 추가는 허용)
  const existingMakers = useMemo(() => [...new Set(rows.filter((r) => r.equipment === equipment.trim()).map((r) => r.maker))], [rows, equipment])
  const makerCapReached = !!equipment.trim() && !!maker.trim() && existingMakers.length >= 2 && !existingMakers.includes(maker.trim())
  const modelOpts = useMemo(() => [...new Set(rows.filter((r) => r.equipment === equipment && r.maker === maker).map((r) => r.model).filter(Boolean))], [rows, equipment, maker])
  const placeOpts = useMemo(() => [...new Set(rows.map((r) => r.place).filter(Boolean))], [rows])
  const eqDefs = useMemo(() => defs.filter((d) => d.equipment === equipment && d.active).sort((a, b) => a.sort - b.sort), [defs, equipment])
  // 같은 장비+제조사+모델의 다음 회차
  const nextRound = useMemo(() => {
    const ex = rows.filter((r) => r.equipment === equipment && r.maker === maker && r.model === (model || ''))
    return ex.length ? Math.max(...ex.map((r) => r.round)) + 1 : 1
  }, [rows, equipment, maker, model])
  useEffect(() => { setRound(nextRound) }, [nextRound])
  // 열릴 때 프리필 — '+ 칩'(다음 회차)이면 장비종류+제조사+모델까지 채워짐(회차는 자동)
  useEffect(() => {
    if (!open) return
    setEquipment(initialEquipment || ''); setMaker(initialMaker || ''); setModel(initialModel || '')
  }, [open, initialEquipment, initialMaker, initialModel])

  const addPics = (files: FileList | File[] | null) => {
    if (!files) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length) setPhotos((p) => [...p, ...imgs.map((f) => ({ file: f, url: URL.createObjectURL(f), name: f.name }))])
  }
  const rmPic = (i: number) => setPhotos((p) => { const x = p[i]; if (x) URL.revokeObjectURL(x.url); const next = p.filter((_, j) => j !== i); if (cover >= next.length) setCover(0); return next })

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setEquipment(''); setMaker(''); setModel(''); setRound(1); setDate(''); setPlace(''); setConditions('')
    setMetricVals({}); setPhotos([]); setCover(0); setDocs([]); setProg('')
  }
  const close = () => { if (busy) return; reset(); onClose() }

  const save = async () => {
    if (busy) return
    if (!equipment.trim()) return onError('장비종류를 입력해주세요.')
    if (!maker.trim()) return onError('제조사를 입력해주세요.')
    if (makerCapReached) return onError(`비교 장비사는 한 장비당 최대 2곳입니다. 기존 장비사(${existingMakers.join(', ')}) 중에서 선택하거나 회차를 추가하세요.`)
    if (!user) return onError('로그인이 필요합니다.')
    setBusy(true)
    try {
      const upPhotos: { name: string; path: string }[] = []
      for (let i = 0; i < photos.length; i++) { setProg(`사진 업로드 ${i + 1}/${photos.length}`); const m = await uploadDemoFile(photos[i].file); upPhotos.push({ name: m.name, path: m.path }) }
      const upFiles: { name: string; path: string; type: string }[] = []
      for (let i = 0; i < docs.length; i++) { setProg(`파일 업로드 ${i + 1}/${docs.length}`); const m = await uploadDemoFile(docs[i]); upFiles.push({ name: m.name, path: m.path, type: m.type }) }
      setProg('저장 중…')
      await addDemoResult({
        equipment: equipment.trim(), maker: maker.trim(), model: model.trim(), round, date, place: place.trim(), conditions: conditions.trim(),
        metrics: metricVals, photos: upPhotos, files: upFiles, cover: Math.min(cover, Math.max(0, upPhotos.length - 1)), author: user,
      })
      setBusy(false); reset(); onSaved()
    } catch (e) { setBusy(false); setProg(''); onError(e instanceof Error ? e.message : '저장에 실패했습니다') }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>데모결과 추가</DialogTitle>
      <DialogContent>
        {/* 장비/제조사/모델/회차 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 2fr 2fr 1fr' }, gap: 1, mb: 1 }}>
          <Box><Box sx={label}>장비종류</Box><ComboField value={equipment} onChange={setEquipment} options={equipmentOpts} placeholder="예: 건식식각" ariaLabel="장비종류" /></Box>
          <Box><Box sx={label}>제조사</Box><ComboField value={maker} onChange={setMaker} options={makerOpts} placeholder="예: A사" ariaLabel="제조사" /></Box>
          <Box><Box sx={label}>모델</Box><ComboField value={model} onChange={setModel} options={modelOpts} placeholder="예: X-200" ariaLabel="모델" /></Box>
          <Box><Box sx={label}>회차</Box><Box component="input" type="number" min={1} value={round} onChange={(e) => setRound(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} sx={(th) => ({ ...field(th) })} /></Box>
        </Box>
        {makerCapReached && (
          <Box sx={{ fontSize: 11.5, color: 'warning.main', mb: 1, mt: -0.25 }}>
            비교 장비사는 한 장비당 최대 2곳입니다. 기존: {existingMakers.join(', ')} — 이 중 선택하거나 회차를 추가하세요.
          </Box>
        )}
        {/* 방문일/데모센터 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, mb: 1 }}>
          <Box><Box sx={label}>방문일</Box><Box component="input" type="date" value={date} onChange={(e) => setDate((e.target as HTMLInputElement).value)} sx={(th) => ({ ...field(th), colorScheme: 'dark' })} /></Box>
          <Box><Box sx={label}>데모센터</Box><ComboField value={place} onChange={setPlace} options={placeOpts} placeholder="예: 용인 데모센터" ariaLabel="데모센터" /></Box>
        </Box>
        <Box sx={{ mb: 1.25 }}><Box sx={label}>테스트 조건</Box><InputBase value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="예: 챔버압 20mTorr · RF 700W" sx={(th) => ({ ...field(th) })} /></Box>

        {/* 핵심 지표 — 장비종류의 표준 지표 자동 표시 */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={label}>핵심 지표 {equipment && <Box component="span" sx={{ color: 'text.disabled', fontWeight: 400 }}>· {equipment} 표준</Box>}</Box>
          {!equipment ? (
            <Box sx={{ fontSize: 12, color: 'text.disabled', py: 0.5 }}>장비종류를 먼저 선택하세요.</Box>
          ) : eqDefs.length === 0 ? (
            <Box sx={{ fontSize: 12, color: 'text.disabled', py: 0.5 }}>이 장비의 표준 지표가 없습니다. 저장 후 “지표 편집”에서 지표를 추가하고 값을 입력하세요.</Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {eqDefs.map((d) => (
                <Box key={d.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 120, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'text.secondary', textAlign: 'right', pr: 0.5 }}>{d.label}{d.unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.4, fontSize: 10.5 }}>{d.unit}</Box> : null}</Box>
                  <InputBase value={metricVals[d.key] ?? ''} onChange={(e) => setMetricVals((m) => ({ ...m, [d.key]: e.target.value }))} placeholder="값" sx={(th) => ({ ...field(th), flex: 1 })} />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* 사진 — 드래그&드롭 / 클릭, 대표 지정 */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={label}>사진 (여러 장 · 대표 1장 지정)</Box>
          <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addPics(e.target.files); if (photoInput.current) photoInput.current.value = '' }} />
          <Box onClick={() => photoInput.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addPics(e.dataTransfer.files) }}
            sx={(th) => ({ border: '2px dashed', borderColor: drag ? th.palette.primary.main : th.palette.divider, bgcolor: drag ? alpha(th.palette.primary.main, 0.06) : 'transparent', borderRadius: '10px', p: 1, cursor: 'pointer', textAlign: 'center' })}>
            {photos.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.disabled', py: 1 }}>
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 26 }} /><Box sx={{ fontSize: 12 }}>사진을 끌어놓거나 클릭해 추가</Box>
              </Box>
            ) : (
              <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 0.75 }}>
                {photos.map((p, i) => (
                  <Box key={i} sx={{ position: 'relative', height: 64, borderRadius: '8px', overflow: 'hidden', border: i === cover ? '2px solid' : '1px solid', borderColor: i === cover ? 'primary.main' : 'divider' }}>
                    <Box component="img" src={p.url} alt={p.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: 14, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: 14 }} />}</IconButton></Tooltip>
                    <IconButton size="small" onClick={() => rmPic(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: '#fff', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
                  </Box>
                ))}
                <Box onClick={() => photoInput.current?.click()} sx={{ height: 64, borderRadius: '8px', border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', cursor: 'pointer' }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20 }} /></Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* 파일 첨부 */}
        <Box>
          <Box sx={label}>파일 첨부 (결과 PDF·측정 데이터 등)</Box>
          <input ref={docInput} type="file" multiple hidden onChange={(e) => { const fs = e.target.files; if (fs) setDocs((d) => [...d, ...Array.from(fs)]); if (docInput.current) docInput.current.value = '' }} />
          <Button size="small" variant="outlined" startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />} onClick={() => docInput.current?.click()} sx={{ color: 'text.secondary', borderColor: 'divider' }}>파일 선택</Button>
          {docs.length > 0 && (
            <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              {docs.map((f, i) => (
                <Box key={i} sx={(th) => ({ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.75, py: '4px', borderRadius: '7px', border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper' })}>
                  <AttachmentIcon type={f.type} name={f.name} size={16} />
                  <Box sx={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Box>
                  <Box sx={{ fontSize: 10.5, color: 'text.disabled', flex: 'none' }}>{formatBytes(f.size)}</Box>
                  <IconButton size="small" onClick={() => setDocs((d) => d.filter((_, j) => j !== i))} sx={{ p: '2px', color: 'text.disabled' }}><CloseIcon sx={{ fontSize: 13 }} /></IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {busy && prog && <Box sx={{ flex: 1, fontSize: 11.5, color: 'text.secondary' }}>{prog}</Box>}
        <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || makerCapReached} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{busy ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  )
}
