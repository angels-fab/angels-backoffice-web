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
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { ComboField } from '@/pages/Work/inlineFields'
import { AttachmentIcon, formatBytes } from '@/pages/Notice/attachmentUI'
import { addDemoResult, uploadDemoFile, createMetricDef, updateMetricDef, type DemoMetricDef, type DemoRoundRow } from '@/api/demo'
import { prepDemoPhoto, isPhotoFile } from '@/utils/imagePrep'

const field = (th: Theme) => ({ bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.chip}px`, px: 1.1, py: '7px', fontSize: typescale.body.size, color: 'text.primary', width: '100%' })
const label = { fontSize: typescale.caption.size, fontWeight: 700, color: 'text.disabled', letterSpacing: '.02em', mb: 0.35 }

type Pic = { file: File; url: string; name: string }
/** 폼 지표 행 — 표준 지표 프리필(수정 가능) + 신규 추가. 저장 시 정의 생성/수정 후 값 매핑 */
type MetricRow = { defId?: number; key: string; label: string; unit: string; value: string; isNew: boolean; origLabel: string; origUnit: string }

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
  const [sample, setSample] = useState('')
  const [condItems, setCondItems] = useState<string[]>([''])
  const [mrows, setMrows] = useState<MetricRow[]>([])
  const [photos, setPhotos] = useState<Pic[]>([])
  const [cover, setCover] = useState(0)
  const [docs, setDocs] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState('')
  const [drag, setDrag] = useState(false)
  const [dragDoc, setDragDoc] = useState(false) // 파일 첨부 드롭존 하이라이트
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
  // 장비종류가 정해지면 표준 지표를 편집 가능한 행으로 프리필(지표명·단위 수정 가능, 값만 입력)
  useEffect(() => {
    setMrows(eqDefs.map((d) => ({ defId: d.id, key: d.key, label: d.label, unit: d.unit, value: '', isNew: false, origLabel: d.label, origUnit: d.unit })))
  }, [eqDefs])
  const addMetricRow = () => setMrows((r) => [...r, { key: `k_${crypto.randomUUID().slice(0, 8)}`, label: '', unit: '', value: '', isNew: true, origLabel: '', origUnit: '' }])
  const setMrow = (i: number, patch: Partial<MetricRow>) => setMrows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  // 다음 회차 자동 — 같은 장비+제조사+모델이 있으면 그 마지막+1, 없으면 같은 장비+제조사(모델 무관)의 마지막+1
  const nextRound = useMemo(() => {
    const eq = equipment.trim(), mk = maker.trim()
    const sameModel = rows.filter((r) => r.equipment === eq && r.maker === mk && r.model === (model.trim() || ''))
    if (sameModel.length) return Math.max(...sameModel.map((r) => r.round)) + 1
    const sameMaker = rows.filter((r) => r.equipment === eq && r.maker === mk)
    return sameMaker.length ? Math.max(...sameMaker.map((r) => r.round)) + 1 : 1
  }, [rows, equipment, maker, model])
  useEffect(() => { setRound(nextRound) }, [nextRound])
  // 열릴 때 프리필 — '+ 칩'(다음 회차)이면 장비종류+제조사+모델까지 채워짐(회차는 자동)
  useEffect(() => {
    if (!open) return
    setEquipment(initialEquipment || ''); setMaker(initialMaker || ''); setModel(initialModel || '')
  }, [open, initialEquipment, initialMaker, initialModel])

  // 사진 추가 — TIF는 JPEG 변환·대용량은 1600px 리사이즈(prepDemoPhoto) 후 썸네일 표시(순서 유지)
  const addPics = (files: FileList | File[] | null) => {
    if (!files) return
    const imgs = Array.from(files).filter(isPhotoFile)
    if (!imgs.length) return
    void (async () => {
      for (const f of imgs) {
        const p = await prepDemoPhoto(f)
        setPhotos((prev) => [...prev, { file: p, url: URL.createObjectURL(p), name: p.name }])
      }
    })()
  }
  const rmPic = (i: number) => setPhotos((p) => { const x = p[i]; if (x) URL.revokeObjectURL(x.url); const next = p.filter((_, j) => j !== i); if (cover >= next.length) setCover(0); return next })

  const reset = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setEquipment(''); setMaker(''); setModel(''); setRound(1); setDate(''); setPlace(''); setSample(''); setCondItems([''])
    setMrows([]); setPhotos([]); setCover(0); setDocs([]); setProg('')
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
      // 지표 정의 반영 — 신규 행은 정의 생성(direction none, 이후 '지표 편집'에서 조정), 라벨/단위 바뀐 표준 행은 수정(이력 자동)
      const metricsObj: Record<string, string> = {}
      let sortNext = eqDefs.reduce((m, d) => Math.max(m, d.sort), 0)
      for (const r of mrows) {
        const lab = r.label.trim(), un = r.unit.trim(), val = r.value.trim()
        if (r.isNew) {
          if (!lab) continue // 이름 없는 신규 행은 무시
          sortNext += 1
          setProg('지표 정의 저장…')
          await createMetricDef({ equipment: equipment.trim(), key: r.key, label: lab, unit: un, direction: 'none', sort: sortNext }, user)
        } else if (r.defId != null && lab && (lab !== r.origLabel || un !== r.origUnit)) {
          setProg('지표 정의 수정…')
          await updateMetricDef(r.defId, { label: lab, unit: un }, user)
        }
        if (val) metricsObj[r.key] = val
      }
      const upPhotos: { name: string; path: string }[] = []
      for (let i = 0; i < photos.length; i++) { setProg(`사진 업로드 ${i + 1}/${photos.length}`); const m = await uploadDemoFile(photos[i].file); upPhotos.push({ name: m.name, path: m.path }) }
      const upFiles: { name: string; path: string; type: string }[] = []
      for (let i = 0; i < docs.length; i++) { setProg(`파일 업로드 ${i + 1}/${docs.length}`); const m = await uploadDemoFile(docs[i]); upFiles.push({ name: m.name, path: m.path, type: m.type }) }
      setProg('저장 중…')
      await addDemoResult({
        equipment: equipment.trim(), maker: maker.trim(), model: model.trim(), round, date, place: place.trim(),
        conditions: condItems.map((t) => t.trim()).filter(Boolean).join('\n'), sample: sample.trim(),
        metrics: metricsObj, photos: upPhotos, files: upFiles, cover: Math.min(cover, Math.max(0, upPhotos.length - 1)), author: user,
      })
      setBusy(false); reset(); onSaved()
    } catch (e) { setBusy(false); setProg(''); onError(e instanceof Error ? e.message : '저장에 실패했습니다') }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: typescale.cardTitle.size, fontWeight: typescale.cardTitle.weight }}>데모결과 추가</DialogTitle>
      <DialogContent>
        {/* 장비/제조사/모델/회차 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '2fr 2fr 2fr 1fr' }, gap: 1, mb: 1 }}>
          <Box><Box sx={label}>장비종류</Box><ComboField value={equipment} onChange={setEquipment} options={equipmentOpts} placeholder="예: 건식식각" ariaLabel="장비종류" /></Box>
          <Box><Box sx={label}>제조사</Box><ComboField value={maker} onChange={setMaker} options={makerOpts} placeholder="예: A사" ariaLabel="제조사" /></Box>
          <Box><Box sx={label}>모델</Box><ComboField value={model} onChange={setModel} options={modelOpts} placeholder="예: X-200" ariaLabel="모델" /></Box>
          <Box><Box sx={label}>회차</Box><Box component="input" type="number" min={1} value={round} onChange={(e) => setRound(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} sx={(th) => ({ ...field(th) })} /></Box>
        </Box>
        {makerCapReached && (
          <Box sx={{ fontSize: typescale.small.size, color: 'warning.main', mb: 1, mt: -0.25 }}>
            비교 장비사는 한 장비당 최대 2곳입니다. 기존: {existingMakers.join(', ')} — 이 중 선택하거나 회차를 추가하세요.
          </Box>
        )}
        {/* 방문일/데모센터 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, mb: 1 }}>
          <Box><Box sx={label}>방문일</Box><Box component="input" type="date" value={date} onChange={(e) => setDate((e.target as HTMLInputElement).value)} sx={(th) => ({ ...field(th), colorScheme: 'dark' })} /></Box>
          <Box><Box sx={label}>데모센터</Box><ComboField value={place} onChange={setPlace} options={placeOpts} placeholder="예: 용인 데모센터" ariaLabel="데모센터" /></Box>
        </Box>
        {/* 샘플 정보 */}
        <Box sx={{ mb: 1 }}><Box sx={label}>샘플 정보</Box><InputBase value={sample} onChange={(e) => setSample(e.target.value)} placeholder="예: 유리 기판 위 SiO2 1μm 패턴 웨이퍼" sx={(th) => ({ ...field(th) })} /></Box>

        {/* 테스트 조건 — ⊕로 조건 항목 추가(여러 개) */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={{ ...label, display: 'flex', alignItems: 'center', gap: 0.5 }}>테스트 조건
            <Tooltip title="조건 항목 추가"><IconButton size="small" aria-label="테스트 조건 추가" onClick={() => setCondItems((c) => [...c, ''])} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'primary.main' } }}><AddCircleOutlineIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
            {condItems.map((cv, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InputBase value={cv} onChange={(e) => setCondItems((c) => c.map((x, j) => (j === i ? e.target.value : x)))} placeholder={i === 0 ? '예: 챔버압 20mTorr · RF 700W' : '조건 추가…'} sx={(th) => ({ ...field(th), flex: 1 })} />
                {condItems.length > 1 && <IconButton size="small" aria-label="조건 삭제" onClick={() => setCondItems((c) => c.filter((_, j) => j !== i))} sx={{ p: '2px', color: 'text.disabled' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>}
              </Box>
            ))}
          </Box>
        </Box>

        {/* 핵심 지표 — 표준 지표 프리필(지표명·단위 수정 가능) + ⊕ 지표 추가 */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={{ ...label, display: 'flex', alignItems: 'center', gap: 0.5 }}>핵심 지표 {equipment && <Box component="span" sx={{ color: 'text.disabled', fontWeight: typescale.body.weight }}>· {equipment} 표준(수정 가능)</Box>}
            {!!equipment && <Tooltip title="지표 추가"><IconButton size="small" aria-label="지표 추가" onClick={addMetricRow} sx={{ p: '1px', color: 'text.disabled', '&:hover': { color: 'primary.main' } }}><AddCircleOutlineIcon sx={{ fontSize: iconSize.body }} /></IconButton></Tooltip>}
          </Box>
          {!equipment ? (
            <Box sx={{ fontSize: typescale.small.size, color: 'text.disabled', py: 0.5 }}>장비종류를 먼저 선택하세요.</Box>
          ) : mrows.length === 0 ? (
            <Box sx={{ fontSize: typescale.small.size, color: 'text.disabled', py: 0.5 }}>이 장비의 표준 지표가 없습니다. 위 ⊕로 지표를 추가하세요.</Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
              {mrows.map((r, i) => (
                <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InputBase value={r.label} onChange={(e) => setMrow(i, { label: e.target.value })} placeholder="지표명" sx={(th) => ({ ...field(th), flex: '0 0 34%' })} />
                  <InputBase value={r.unit} onChange={(e) => setMrow(i, { unit: e.target.value })} placeholder="단위" sx={(th) => ({ ...field(th), flex: '0 0 72px', fontSize: typescale.small.size })} />
                  <InputBase value={r.value} onChange={(e) => setMrow(i, { value: e.target.value })} placeholder="값" sx={(th) => ({ ...field(th), flex: 1 })} />
                  {r.isNew && <IconButton size="small" aria-label="지표 행 삭제" onClick={() => setMrows((rows) => rows.filter((_, j) => j !== i))} sx={{ p: '2px', color: 'text.disabled' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* 사진 — 드래그&드롭 / 클릭, 대표 지정 */}
        <Box sx={{ mb: 1.25 }}>
          <Box sx={label}>사진 (여러 장 · 대표 1장 지정)</Box>
          <input ref={photoInput} type="file" accept="image/*,.tif,.tiff" multiple hidden onChange={(e) => { addPics(e.target.files); if (photoInput.current) photoInput.current.value = '' }} />
          <Box onClick={() => photoInput.current?.click()} onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); addPics(e.dataTransfer.files) }}
            sx={(th) => ({ border: '2px dashed', borderColor: drag ? th.palette.primary.main : th.palette.divider, bgcolor: drag ? alpha(th.palette.primary.main, 0.06) : 'transparent', borderRadius: `${radius.input}px`, p: 1, cursor: 'pointer', textAlign: 'center' })}>
            {photos.length === 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, color: 'text.disabled', py: 1 }}>
                <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 26 }} /><Box sx={{ fontSize: typescale.small.size }}>사진을 끌어놓거나 클릭해 추가</Box>
              </Box>
            ) : (
              <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 0.75 }}>
                {photos.map((p, i) => (
                  <Box key={i} sx={{ position: 'relative', height: 64, borderRadius: `${radius.chip}px`, overflow: 'hidden', border: i === cover ? '2px solid' : '1px solid', borderColor: i === cover ? 'primary.main' : 'divider' }}>
                    <Box component="img" src={p.url} alt={p.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <Tooltip title={i === cover ? '대표사진' : '대표로 지정'}><IconButton size="small" onClick={() => setCover(i)} sx={{ position: 'absolute', top: 1, left: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}>{i === cover ? <StarIcon sx={{ fontSize: iconSize.caption, color: '#ffca28' }} /> : <StarBorderIcon sx={{ fontSize: iconSize.caption }} />}</IconButton></Tooltip>
                    <IconButton size="small" onClick={() => rmPic(i)} sx={{ position: 'absolute', top: 1, right: 1, p: '2px', color: 'common.white', bgcolor: 'rgba(0,0,0,.4)' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>
                  </Box>
                ))}
                <Box onClick={() => photoInput.current?.click()} sx={{ height: 64, borderRadius: `${radius.chip}px`, border: '1px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', cursor: 'pointer' }}><AddPhotoAlternateOutlinedIcon sx={{ fontSize: iconSize.header }} /></Box>
              </Box>
            )}
          </Box>
        </Box>

        {/* 파일 첨부 — 버튼 또는 드래그&드롭 */}
        <Box onDragOver={(e) => { e.preventDefault(); setDragDoc(true) }} onDragLeave={() => setDragDoc(false)}
          onDrop={(e) => { e.preventDefault(); setDragDoc(false); const fs = e.dataTransfer.files; if (fs?.length) setDocs((d) => [...d, ...Array.from(fs)]) }}
          sx={(th) => ({ border: '2px dashed', borderColor: dragDoc ? th.palette.primary.main : th.palette.divider, bgcolor: dragDoc ? alpha(th.palette.primary.main, 0.06) : 'transparent', borderRadius: `${radius.input}px`, p: 1 })}>
          <Box sx={label}>파일 첨부 (결과 PDF·측정 데이터 등 — 끌어놓기 가능)</Box>
          <input ref={docInput} type="file" multiple hidden onChange={(e) => { const fs = e.target.files; if (fs) setDocs((d) => [...d, ...Array.from(fs)]); if (docInput.current) docInput.current.value = '' }} />
          <Button size="small" variant="outlined" startIcon={<AttachFileIcon sx={{ fontSize: iconSize.body }} />} onClick={() => docInput.current?.click()} sx={{ color: 'text.secondary', borderColor: 'divider' }}>파일 선택</Button>
          {docs.length > 0 && (
            <Box sx={{ mt: 0.75, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
              {docs.map((f, i) => (
                <Box key={i} sx={(th) => ({ display: 'flex', alignItems: 'center', gap: 0.6, px: 0.75, py: '4px', borderRadius: `${radius.chip}px`, border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper' })}>
                  <AttachmentIcon type={f.type} name={f.name} size={16} />
                  <Box sx={{ flex: 1, minWidth: 0, fontSize: typescale.small.size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</Box>
                  <Box sx={{ fontSize: typescale.caption.size, color: 'text.disabled', flex: 'none' }}>{formatBytes(f.size)}</Box>
                  <IconButton size="small" onClick={() => setDocs((d) => d.filter((_, j) => j !== i))} sx={{ p: '2px', color: 'text.disabled' }}><CloseIcon sx={{ fontSize: iconSize.caption }} /></IconButton>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {busy && prog && <Box sx={{ flex: 1, fontSize: typescale.small.size, color: 'text.secondary' }}>{prog}</Box>}
        <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={() => void save()} disabled={busy || makerCapReached} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>{busy ? '저장 중…' : '저장'}</Button>
      </DialogActions>
    </Dialog>
  )
}
