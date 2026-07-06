import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import EditNoteIcon from '@mui/icons-material/EditNote'
import { createWork, updateWork } from '@/api/works'
import { useRole } from '@/auth/role'
import type { WorkItem } from '@/types'
import { WORK_STATUS_OPTIONS } from './workMeta'

interface Props {
  open: boolean
  onClose: () => void
  /** 수정 대상 — 있으면 수정 모드(자동 로드), 없으면 신규 등록 */
  editing?: WorkItem | null
  /** 저장/수정 성공 시: (번호, 수정여부) */
  onSaved: (num: number, isEdit: boolean) => void
}

// 업무 등록/수정 모달 — 게시자/비밀번호는 로그인한 관리자 정보를 자동 사용(재입력 없음).
// 상세 Drawer(포털) 위에 뜨도록 body로 포털한다. 오류는 모달 내(.merror)에 표시.
export default function WorkWrite({ open, onClose, editing, onSaved }: Props) {
  const { user, authKey } = useRole()
  const isEdit = !!editing
  const [cat, setCat] = useState('')
  const [task, setTask] = useState('')
  const [dept, setDept] = useState('')
  const [mat, setMat] = useState('')
  const [start, setStart] = useState('')
  const [plan, setPlan] = useState('')
  const [time, setTime] = useState('')
  const [loc, setLoc] = useState('')
  const [mgr, setMgr] = useState('')
  const [status, setStatus] = useState('진행중')
  const [link, setLink] = useState('')
  const [remind, setRemind] = useState(false)
  const [chief, setChief] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    const e = editing
    setCat(e?.cat || '')
    setTask(e?.task || '')
    setDept(e?.dept || '')
    setMat(e?.mat || '')
    setStart(e?.start || '')
    setPlan(e?.plan || '')
    setTime(e?.time || '')
    setLoc(e?.loc || '')
    setMgr(e?.mgr || '')
    setStatus(e?.status || '진행중')
    setLink(e?.link || '')
    setRemind(e?.remind ?? false)
    setChief(e?.chief ?? false)
  }, [open, editing])

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (saving) return
    setError(null)
    if (!user || !authKey) return setError('관리자 로그인이 필요합니다')
    if (!task.trim()) return setError('업무 내용을 입력해주세요')
    setSaving(true)
    const payload = {
      key: authKey, author: user,
      cat: cat.trim(), task: task.trim(), dept: dept.trim(), mat: mat.trim(),
      start, plan, time: time.trim(), loc: loc.trim(), mgr: mgr.trim(),
      status, link: link.trim(), remind, chief,
    }
    try {
      if (editing) {
        await updateWork({ num: editing.num, ...payload })
        setSaving(false)
        onSaved(Number(editing.num) || 0, true)
      } else {
        const num = await createWork(payload)
        setSaving(false)
        onSaved(num, false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : isEdit ? '수정 실패' : '저장 실패'
      setError(msg)
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => { if (!saving) onClose() }}
      slotProps={{
        paper: {
          sx: {
            width: 560, maxWidth: '100%', m: 2,
            bgcolor: 'background.paper', backgroundImage: 'none',
            border: 1, borderColor: 'divider', borderRadius: '16px', p: '22px 24px',
          },
        },
      }}
    >
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditNoteIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 600 }}>{isEdit ? '업무 수정' : '업무 등록'}</Typography>
          <IconButton onClick={onClose} disabled={saving} aria-label="닫기" size="small" sx={{ ml: 'auto', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="구분" size="small" fullWidth value={cat} onChange={(e) => setCat(e.target.value)} placeholder="예: 회의, 채용, 예산" />
          <TextField
            label="상태" size="small" fullWidth select value={status}
            onChange={(e) => { const v = e.target.value; setStatus(v); if (v === '완료') setChief(false) }}
          >
            {WORK_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Box>

        <TextField label="업무" size="small" fullWidth required multiline minRows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="업무 내용 (첫 줄이 제목으로 표시됩니다)" />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="관련부서" size="small" fullWidth value={dept} onChange={(e) => setDept(e.target.value)} />
          <TextField label="담당자" size="small" fullWidth value={mgr} onChange={(e) => setMgr(e.target.value)} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="발의일자" size="small" fullWidth type="date" value={start} onChange={(e) => setStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="예정일" size="small" fullWidth type="date" value={plan} onChange={(e) => setPlan(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="시간" size="small" fullWidth value={time} onChange={(e) => setTime(e.target.value)} placeholder="예: 14:00" />
          <TextField label="장소" size="small" fullWidth value={loc} onChange={(e) => setLoc(e.target.value)} />
        </Box>
        <TextField label="관련자료" size="small" fullWidth value={mat} onChange={(e) => setMat(e.target.value)} />
        <TextField label="링크" size="small" fullWidth value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 0.5 }}>
          <FormControlLabel control={<Checkbox size="small" checked={remind} onChange={(e) => setRemind(e.target.checked)} />} label="긴급 업무로 표시 (Remind)" />
          <FormControlLabel control={<Checkbox size="small" checked={chief} disabled={status === '완료'} onChange={(e) => setChief(e.target.checked)} />} label={status === '완료' ? '검토 필요 (완료 시 자동 해제)' : '검토 필요 표시'} />
        </Box>

        {error && <Typography color="error" variant="body2">{error}</Typography>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
          <Button onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? '저장 중...' : isEdit ? '수정' : '등록'}</Button>
        </Box>
      </Box>
    </Dialog>
  )
}
