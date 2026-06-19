import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Autocomplete from '@mui/material/Autocomplete'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import { createImprovement, fetchAuthors } from '@/api/sheets'
import { useRole } from '@/auth/role'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  /** 자동완성 후보(기존 데이터) */
  typeOptions: string[]
  locOptions: string[]
}

const MGR_FALLBACK = ['센터', '신현진', '박주봉', '박세리', '조성범']

/** 개선제안 등록 모달 — 로그인 사용자만. 작성자=로그인 이름(자동), 담당자=작성자가 선택. */
export default function ImproveWrite({ open, onClose, onSaved, typeOptions, locOptions }: Props) {
  const { user, authKey } = useRole()
  const [urgent, setUrgent] = useState(false)
  const [type, setType] = useState('')
  const [loc, setLoc] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [mgr, setMgr] = useState('')
  const [authors, setAuthors] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setUrgent(false); setType(''); setLoc(''); setTitle(''); setContent(''); setLink('')
    setMgr(user || ''); setError(null); setSaving(false)
    if (authors === null) fetchAuthors().then(setAuthors).catch(() => setAuthors(MGR_FALLBACK))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user])

  const mgrOptions = authors && authors.length ? authors : MGR_FALLBACK

  const submit = async () => {
    if (saving) return
    if (!user || !authKey) return setError('로그인이 필요합니다')
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!mgr.trim()) return setError('담당자를 선택해주세요')
    setSaving(true)
    setError(null)
    try {
      await createImprovement({
        author: user, key: authKey,
        urgent, type: type.trim(), loc: loc.trim(),
        title: title.trim(), content: content.trim(), link: link.trim(), mgr: mgr.trim(),
      })
      setSaving(false)
      onSaved()
    } catch (err) {
      setSaving(false)
      setError(err instanceof Error ? err.message : '저장 실패')
    }
  }

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { bgcolor: 'background.paper' } } }}>
      <DialogTitle>개선제안 등록</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
          <FormControlLabel
            control={<Checkbox checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />}
            label="긴급"
          />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Autocomplete
              freeSolo openOnFocus size="small" options={typeOptions} value={type}
              onInputChange={(_, v) => setType(v)}
              sx={{ flex: 1, minWidth: 140 }}
              renderInput={(p) => <TextField {...p} label="유형" />}
            />
            <Autocomplete
              freeSolo openOnFocus size="small" options={locOptions} value={loc}
              onInputChange={(_, v) => setLoc(v)}
              sx={{ flex: 1, minWidth: 140 }}
              renderInput={(p) => <TextField {...p} label="개선위치" />}
            />
          </Box>
          <TextField label="제목" size="small" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
          <TextField label="개선내용" size="small" value={content} onChange={(e) => setContent(e.target.value)} multiline minRows={3} fullWidth />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="관련자료 (링크)" size="small" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" sx={{ flex: 1, minWidth: 140 }} />
            <TextField label="담당자" size="small" select value={mgr} onChange={(e) => setMgr(e.target.value)} required sx={{ flex: 1, minWidth: 140 }}>
              {mgrOptions.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
        <Button variant="contained" onClick={submit} disabled={saving}>{saving ? '저장 중…' : '등록'}</Button>
      </DialogActions>
    </Dialog>
  )
}
