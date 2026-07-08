import { useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import LinkIcon from '@mui/icons-material/Link'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { CAT_COLOR, type EventCat } from './eventCard'
import { uploadSubmissionPoster, submitEvent } from '@/api/events'

const CATS: EventCat[] = ['학술', '교육', '전시']
const field = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: '8px',
  px: 1.2, py: '8px', fontSize: 13, color: 'text.primary', width: '100%',
  '&.Mui-focused': { borderColor: th.palette.primary.main },
  '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})
const label = { fontSize: 11.5, fontWeight: 700, color: 'text.disabled', letterSpacing: '.02em', mb: 0.4 }

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
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([{ label: '', value: '' }, { label: '', value: '' }])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : '')
  }
  const setSum = (i: number, patch: Partial<{ label: string; value: string }>) => setSummary((s) => s.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const addSum = () => setSummary((s) => (s.length < 5 ? [...s, { label: '', value: '' }] : s))
  const rmSum = (i: number) => setSummary((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s))

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview)
    setCat('학술'); setFile(null); setPreview(''); setLink(''); setTitle(''); setStart(''); setEnd(''); setVenue(''); setOrganizer('')
    setSummary([{ label: '', value: '' }, { label: '', value: '' }])
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
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default', borderRadius: '16px' } } }}>
      <Box sx={{ position: 'relative', p: { xs: 1.5, sm: 2 } }}>
        <IconButton onClick={close} aria-label="닫기" size="small" sx={{ position: 'absolute', top: 8, right: 8, zIndex: 5, color: 'text.secondary' }}><CloseIcon fontSize="small" /></IconButton>
        <Box sx={{ fontSize: 15, fontWeight: 800, color: 'text.primary', mb: 1.5 }}>새 행사 신청</Box>

        {/* 포스터 첨부 영역 — 드래그&드롭 또는 클릭. 좌상단 분류(학술/교육/전시) 선택. */}
        <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
          sx={(th) => ({
            position: 'relative', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', minHeight: 200,
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
              <Box sx={{ fontSize: 12.5 }}>{file.name}</Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.8, color: 'text.disabled', py: 4, px: 2, textAlign: 'center' }}>
              <UploadFileIcon sx={{ fontSize: 34 }} />
              <Box sx={{ fontSize: 12.5 }}>포스터 이미지(또는 PDF)를 여기로 끌어오거나 클릭해서 첨부</Box>
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
                  onClick={() => setCat(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCat(c) } }}
                  sx={{
                    fontSize: 12, fontWeight: 800, px: '10px', py: '5px', borderRadius: 999, cursor: 'pointer', userSelect: 'none',
                    border: `1.5px solid ${color}`,
                    ...(on ? { bgcolor: color, color: '#fff' } : { bgcolor: 'rgba(0,0,0,.5)', color: '#fff' }),
                  }}
                >{c}</Box>
              )
            })}
          </Box>
        </Box>

        {/* URL */}
        <Box sx={{ mt: 1.5 }}>
          <Box sx={label}>행사 URL</Box>
          <InputBase value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" startAdornment={<LinkIcon sx={{ fontSize: 17, color: 'text.disabled', mr: 0.75 }} />} sx={(th) => ({ ...field(th) })} />
        </Box>

        {/* 제목 / 날짜 / 장소 / 주관 */}
        <Box sx={{ mt: 1.25 }}>
          <Box sx={label}>제목</Box>
          <InputBase value={title} onChange={(e) => setTitle(e.target.value)} placeholder="행사명" sx={(th) => ({ ...field(th) })} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>시작일</Box>
            <Box component="input" type="date" value={start} onChange={(e) => setStart((e.target as HTMLInputElement).value)} sx={(th) => ({ ...field(th), colorScheme: 'dark' })} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>종료일(선택)</Box>
            <Box component="input" type="date" value={end} onChange={(e) => setEnd((e.target as HTMLInputElement).value)} sx={(th) => ({ ...field(th), colorScheme: 'dark' })} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>장소</Box>
            <InputBase value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="장소" sx={(th) => ({ ...field(th) })} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={label}>주관</Box>
            <InputBase value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="주관 기관" sx={(th) => ({ ...field(th) })} />
          </Box>
        </Box>

        {/* 요약 2~3 (라벨 + 내용) */}
        <Box sx={{ mt: 1.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={label}>요약 (2~3개)</Box>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={addSum} disabled={summary.length >= 5} sx={{ fontSize: 11.5, minWidth: 0, py: 0, color: 'text.secondary' }}>줄 추가</Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {summary.map((r, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <InputBase value={r.label} onChange={(e) => setSum(i, { label: e.target.value })} placeholder="항목(예: 사전등록)" sx={(th) => ({ ...field(th), width: 130, flex: 'none' })} />
                <InputBase value={r.value} onChange={(e) => setSum(i, { value: e.target.value })} placeholder="내용" sx={(th) => ({ ...field(th), flex: 1 })} />
                <IconButton size="small" aria-label="요약 줄 삭제" onClick={() => rmSum(i)} disabled={summary.length <= 1} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
              </Box>
            ))}
          </Box>
        </Box>

        {/* 액션 */}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button onClick={close} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" color="success" onClick={() => void submit()} disabled={busy} startIcon={busy ? <CircularProgress size={15} thickness={5} color="inherit" /> : undefined}>
            {busy ? '신청 중…' : '신청하기'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  )
}
