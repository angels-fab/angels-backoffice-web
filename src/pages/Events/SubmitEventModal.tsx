import { useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import LinkIcon from '@mui/icons-material/Link'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { CAT_COLOR, type EventCat } from './eventCard'
import { radius, iconSize } from '@/theme/tokens'
import { uploadSubmissionPoster, submitEvent } from '@/api/events'
import { FormField, DateField } from '@/components/ds'

const CATS: EventCat[] = ['학술', '교육', '전시']
// 분류별 요약 항목(최대 3) — 분류 선택 시 자동으로 채워짐. 값 안 적은 항목은 게시 시 빠짐.
const SUMMARY_PRESETS: Record<EventCat, string[]> = {
  학술: ['사전등록', '초록마감', 'Plenary'],
  교육: ['신청기간', '대상', '강사'],
  전시: ['관람기간', '입장방법', '규모'],
}
const presetRows = (c: EventCat) => SUMMARY_PRESETS[c].map((l) => ({ label: l, value: '' }))
const field = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: `${radius.chip}px`,
  px: 1.2, py: '8px', fontSize: 13, color: 'text.primary', width: '100%',
  '&.Mui-focused': { borderColor: th.palette.primary.main },
  '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})
const label = { fontSize: 12, fontWeight: 700, color: 'text.disabled', letterSpacing: '.02em', mb: 0.4 }

/**
 * 새 행사 '신청' 팝업 — 팀원이 최소 정보 + URL + 포스터를 올려 제출(대기 상태).
 * 카드처럼 위=포스터 첨부(좌상단 분류 선택), 아래=URL·제목·날짜·장소·주관·요약.
 */
export default function SubmitEventModal({ open, onClose, user, onSubmitted, onError }: {
  open: boolean; onClose: () => void; user: string | null; onSubmitted: () => void; onError: (msg: string) => void
}) {
  const [cat, setCat] = useState<EventCat>('학술')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [venue, setVenue] = useState('')
  const [organizer, setOrganizer] = useState('')
  const [summary, setSummary] = useState<{ label: string; value: string }[]>(() => presetRows('학술'))
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 분류 선택 → 요약 항목을 그 분류 프리셋으로 교체(값은 비움)
  const chooseCat = (c: EventCat) => { setCat(c); setSummary(presetRows(c)) }

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '')
  }
  const setSum = (i: number, patch: Partial<{ label: string; value: string }>) => setSummary((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setCat('학술'); setFile(null); setPreview(''); setLink(''); setTitle(''); setStart(''); setEnd(''); setVenue(''); setOrganizer('')
    setSummary(presetRows('학술'))
  }
  const close = () => { if (busy) return; reset(); onClose() }

  const submit = async () => {
    if (busy) return
    if (!title.trim()) return onError('제목을 입력해주세요.')
    if (!user) return onError('로그인이 필요합니다.')
    setBusy(true)
    try {
      const poster = file ? await uploadSubmissionPoster(file) : ''
      await submitEvent({ category: cat, title, start, end, venue, organizer, link, poster, summary, submitter: user })
      setBusy(false); reset(); onSubmitted()
    } catch (err) { setBusy(false); onError(err instanceof Error ? err.message : '신청에 실패했습니다') }
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: `${radius.modal}px` } } }}>
      <Box sx={{ position: 'relative', p: { xs: 1.5, sm: 2 } }}>
        <IconButton onClick={close} aria-label="닫기" size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 5, color: 'text.secondary' }}><CloseIcon fontSize="small" /></IconButton>
        <Box sx={{ fontSize: 16, fontWeight: 800, color: 'text.primary', mb: 1.5 }}>새 행사 신청</Box>

        {/* 포스터 첨부 영역 — 드래그&드롭 또는 클릭. 좌상단 분류(학술/교육/전시) 선택. */}
        <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
          sx={(th) => ({
            position: 'relative', borderRadius: `${radius.card}px`, overflow: 'hidden', cursor: 'pointer', minHeight: 200,
            border: '2px dashed', borderColor: drag ? th.palette.primary.main : th.palette.divider,
            bgcolor: drag ? alpha(th.palette.primary.main, 0.08) : '#0b0e14',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .15s, background-color .15s',
          })}
        >
          {preview ? (
            <Box component="img" src={preview} alt="포스터 미리보기" sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 360, objectFit: 'contain' }} />
          ) : file ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.secondary', py: 3 }}>
              <PictureAsPdfIcon sx={{ fontSize: 40, color: '#e2453c' }} />
              <Box sx={{ fontSize: 13 }}>{file.name}</Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8, color: 'text.disabled', py: 4, px: 2, textAlign: 'center' }}>
              <UploadFileIcon sx={{ fontSize: 34 }} />
              <Box sx={{ fontSize: 13 }}>포스터 이미지(또는 PDF)를 여기로 끌어오거나 클릭해서 첨부</Box>
            </Box>
          )}
          {/* 좌상단 분류 선택 칩 — 클릭이 파일선택으로 번지지 않게 정지 */}
          <Box onClick={(e) => e.stopPropagation()} sx={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '6px' }}>
            {CATS.map((c) => {
              const on = cat === c
              const color = CAT_COLOR[c]
              return (
                <Box
                  key={c}
                  role="button" tabIndex={0} aria-pressed={on} aria-label={`분류 ${c}`}
                  onClick={() => chooseCat(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseCat(c) } }}
                  sx={{
                    fontSize: 12, fontWeight: 800, px: '10px', py: '5px', borderRadius: radius.pill, cursor: 'pointer', userSelect: 'none',
                    border: `1.5px solid ${color}`,
                    ...(on ? { bgcolor: color, color: 'common.white' } : { bgcolor: 'rgba(0,0,0,.5)', color: 'common.white' }),
                  }}
                >{c}</Box>
              )
            })}
          </Box>
        </Box>

        {/* URL */}
        <Box sx={{ mt: 1.5 }}>
          <Box sx={label}>행사 URL</Box>
          <InputBase value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" startAdornment={<LinkIcon sx={{ fontSize: iconSize.action, color: 'text.disabled', mr: 0.75 }} />} sx={(th) => ({ ...field(th) })} />
        </Box>

        {/* 제목 / 날짜 / 장소 / 주관 */}
        <Box sx={{ mt: 1.25 }}>
          <Box sx={label}>제목</Box>
          <FormField variant="inline" value={title} onChange={setTitle} placeholder="행사명" />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>시작일</Box>
            <DateField variant="inline" value={start} onChange={setStart} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>종료일(선택)</Box>
            <DateField variant="inline" value={end} onChange={setEnd} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>장소</Box>
            <FormField variant="inline" value={venue} onChange={setVenue} placeholder="장소" />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>주관</Box>
            <FormField variant="inline" value={organizer} onChange={setOrganizer} placeholder="주관 기관" />
          </Box>
        </Box>

        {/* 요약 — 분류별 항목이 자동으로 나옴(최대 3). 값을 적은 항목만 게시됨. */}
        <Box sx={{ mt: 1.25 }}>
          <Box sx={label}>요약 · {cat} (값을 적은 항목만 표시됩니다)</Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {summary.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ width: 92, flex: 'none', fontSize: 13, fontWeight: 700, color: 'text.secondary', textAlign: 'right', pr: 0.5, whiteSpace: 'nowrap' }}>{r.label}</Box>
                <Box sx={{ flex: 1 }}>
                  <FormField variant="inline" value={r.value} onChange={(v) => setSum(i, { value: v })} placeholder={`${r.label} 내용`} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 액션 */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" color="success" onClick={() => void submit()} disabled={busy} startIcon={busy ? <CircularProgress size={14} thickness={5} color="inherit" /> : undefined}>
            {busy ? '신청 중…' : '신청하기'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}
