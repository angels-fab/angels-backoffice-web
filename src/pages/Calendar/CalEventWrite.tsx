import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CloseIcon from '@mui/icons-material/Close'
import EventIcon from '@mui/icons-material/Event'
import { addCalEvent, updateCalEvent, deleteCalEvent, type CalScope } from '@/api/calendar'
import { useRole } from '@/auth/role'
import type { CalEvent } from '@/types'
import { MEMBERS, given, eventParticipants } from './members'

// 제목에서 '@참석자' 부분을 뗀 기본 제목([구분]·내용) — 참석자는 별도 피커가 관리
const baseTitle = (t: string): string => {
  const at = (t || '').indexOf('@')
  return (at >= 0 ? t.slice(0, at) : t).trim()
}
const memberColor = (name: string): string => MEMBERS.find((m) => m.name === name)?.color ?? 'var(--text3)'

interface Props {
  open: boolean
  mode: 'add' | 'edit'
  /** edit 모드의 대상 일정 */
  event: CalEvent | null
  /** add 모드에서 미리 채울 시작일 (선택한 날) */
  initialDate: string
  /** add 모드 종료일 프리필 — 범위 드래그 선택 시. 없으면 시작일과 동일 */
  initialEndDate?: string
  onClose: () => void
  /** 추가/수정/삭제 성공 → 부모가 새로고침 (안내 메시지 전달) */
  onSaved: (msg: string) => void
}

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
const REPEAT_LABEL: [Repeat, string][] = [
  ['none', '반복 안 함'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'],
]

const dateOnly = (dt: string) => (dt || '').slice(0, 10)
const timeOnly = (dt: string) => (dt || '').slice(11, 16)

// 종일 일정의 종료는 '미포함'(다음 날 0시)이라, 화면 표시용 마지막 날 = end - 1일
function inclusiveEndDate(endDt: string): string {
  const m = (endDt || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 캘린더 일정 추가/수정/삭제 모달 — 구글캘린더식 폼(Supabase, 세션 인증).
 * 이름·비밀번호 재입력 없음(로그인 관리자만 진입). 반복 = 없음/매일/매주/매월 + 종료일(lite).
 * 반복 일정의 수정·삭제는 시리즈 전체에 반영된다(개별 예외 미지원 — 폼에 안내).
 */
export default function CalEventWrite({ open, mode, event, initialDate, initialEndDate, onClose, onSaved }: Props) {
  const { user, isAdmin } = useRole()
  const [title, setTitle] = useState('') // 기본 제목([구분]·내용) — @참석자 제외
  const [attendees, setAttendees] = useState<string[]>([]) // 참석자 이름들(제목 @뒤로 합쳐 저장)
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState('') // 시작일
  const [endDate, setEndDate] = useState('') // 종료일(선택 — 비우면 시작일)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [loc, setLoc] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [repeatUntil, setRepeatUntil] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scopeAsk, setScopeAsk] = useState<null | 'save' | 'delete'>(null) // 반복 시리즈 범위 선택 대기

  const isSeries = !!(event && event.seriesId) // 반복 시리즈의 한 발생일(materialize) — 수정/삭제 시 범위 선택

  // 열릴 때마다 폼 초기화 (add: 선택일 / edit: 대상 일정 값 — 반복 일정은 시리즈 원본을 불러 프리필)
  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setScopeAsk(null)
    setRepeat('none')
    setRepeatUntil('')
    if (mode === 'edit' && event) {
      setTitle(baseTitle(event.title))
      setAttendees(eventParticipants(event.title))
      setAllDay(event.allDay)
      setDate(dateOnly(event.start))
      setLoc(event.loc && event.loc !== '-' ? event.loc : '')
      if (event.allDay) {
        const inc = inclusiveEndDate(event.end)
        setEndDate(inc && inc !== dateOnly(event.start) ? inc : '')
      } else {
        setStartTime(timeOnly(event.start) || '09:00')
        setEndTime(timeOnly(event.end) || '10:00')
        const e0 = dateOnly(event.end)
        setEndDate(e0 && e0 !== dateOnly(event.start) ? e0 : '')
      }
    } else {
      setTitle('')
      setAttendees([])
      setAllDay(false)
      setDate(initialDate || '')
      setEndDate(initialEndDate || initialDate || '')
      if (initialEndDate && initialEndDate !== initialDate) setAllDay(true) // 범위 드래그 = 종일 구간 일정
      setStartTime('09:00')
      setEndTime('10:00')
      setLoc('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, event])

  const buildInput = () => {
    const s = date
    const e = repeat !== 'none' ? date : (endDate || date) // 반복 일정은 단일 날짜 기준
    // 기본 제목 + '@참석자1, 참석자2'(있을 때만) — 표시/파싱 규칙과 동일 포맷
    const fullTitle = title.trim() + (attendees.length ? ` @${attendees.join(', ')}` : '')
    return {
      title: fullTitle,
      loc: loc.trim(),
      allDay,
      start: allDay ? s : `${s}T${startTime}`,
      end: allDay ? e : `${e}T${endTime}`,
      repeat,
      repeatUntil: repeat === 'none' ? '' : repeatUntil,
      createdBy: user || '',
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!isAdmin || !user) return setError('관리자 로그인이 필요합니다')
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!date) return setError('날짜를 선택해주세요')
    if (!allDay && repeat === 'none' && (endDate || date) === date && endTime <= startTime)
      return setError('종료 시간이 시작보다 빨라요')
    if (endDate && endDate < date) return setError('종료일이 시작일보다 빨라요')
    if (repeat !== 'none' && repeatUntil && repeatUntil < date) return setError('반복 종료일이 시작일보다 빨라요')
    setError(null)
    // 반복 시리즈 수정은 범위(이 일정만/이후/전체) 선택을 먼저 물음
    if (mode === 'edit' && isSeries) { setScopeAsk('save'); return }
    void doSave('one')
  }

  const doSave = async (scope: CalScope) => {
    setScopeAsk(null)
    setBusy(true)
    try {
      const input = buildInput()
      const res = mode === 'add'
        ? await addCalEvent(input)
        : await updateCalEvent({ ...input, id: event!.id, scope, seriesId: event!.seriesId, occDate: dateOnly(event!.start) })
      setBusy(false)
      onSaved(res.note || (mode === 'add' ? '일정을 추가했어요' : '일정을 수정했어요'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패')
      setBusy(false)
    }
  }

  const remove = () => {
    if (busy || !event) return
    if (!isAdmin || !user) return setError('관리자 로그인이 필요합니다')
    if (isSeries) { setScopeAsk('delete'); return }
    if (!window.confirm('이 일정을 삭제할까요? 되돌릴 수 없습니다.')) return
    void doDelete('one')
  }

  const doDelete = async (scope: CalScope) => {
    setScopeAsk(null)
    setError(null)
    setBusy(true)
    try {
      const res = await deleteCalEvent({ id: event!.id, scope, seriesId: event!.seriesId, occDate: dateOnly(event!.start) })
      setBusy(false)
      onSaved(res.note || '일정을 삭제했어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
      setBusy(false)
    }
  }

  return (
    <>
    <Dialog
      open={open}
      onClose={() => { if (!busy) onClose() }}
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
          <EventIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 600 }}>{mode === 'add' ? '일정 추가' : '일정 수정'}</Typography>
          <IconButton onClick={onClose} disabled={busy} aria-label="닫기" size="small" sx={{ ml: 'auto', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>

        <TextField label="제목" size="small" fullWidth required value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 제목 (참석자는 아래에서 선택)" />

        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.75 }}>참석자</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {[...new Set([...MEMBERS.filter((m) => m.id !== '센터').map((m) => m.name), ...attendees])].map((name) => {
                const on = attendees.includes(name)
                const c = memberColor(name)
                return (
                  <Box
                    key={name}
                    component="button"
                    type="button"
                    onClick={() => setAttendees((a) => (on ? a.filter((n) => n !== name) : [...a, name]))}
                    sx={{
                      px: 1.25, height: 28, borderRadius: '999px', cursor: 'pointer',
                      fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1,
                      border: '1.5px solid', transition: 'all .12s',
                      borderColor: on ? c : 'divider',
                      bgcolor: on ? c : 'transparent',
                      color: on ? '#fff' : 'text.secondary',
                    }}
                  >
                    {given(name)}
                  </Box>
                )
              })}
            </Box>
          </Box>

          <FormControlLabel
            control={<Checkbox size="small" checked={allDay} onChange={e => setAllDay(e.target.checked)} />}
            label="종일"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField label="시작일" size="small" fullWidth required type="date" value={date} onChange={e => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            {repeat === 'none' && (
              <TextField label="종료일 (선택)" size="small" fullWidth type="date" value={endDate} onChange={e => setEndDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            )}
          </Box>

          {!allDay && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField label="시작 시간" size="small" fullWidth type="time" value={startTime} onChange={e => setStartTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="종료 시간" size="small" fullWidth type="time" value={endTime} onChange={e => setEndTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
          )}

          {mode === 'add' && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.75 }}>반복</Typography>
              <ToggleButtonGroup exclusive size="small" value={repeat} onChange={(_, v) => { if (v !== null) setRepeat(v) }}>
                {REPEAT_LABEL.map(([value, label]) => (
                  <ToggleButton key={value} value={value} sx={{ textTransform: 'none', px: 1.5 }}>{label}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              {repeat !== 'none' && (
                <TextField label="반복 종료일 (비우면 6개월)" size="small" fullWidth type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ mt: 1.5 }} />
              )}
            </Box>
          )}
          {mode === 'edit' && isSeries && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
              반복 일정입니다 — 저장·삭제 시 범위(이 일정만 / 이후 / 전체)를 선택합니다. 날짜 변경은 '이 일정만'에서만 반영돼요.
            </Typography>
          )}

          <TextField label="장소 (선택)" size="small" fullWidth value={loc} onChange={e => setLoc(e.target.value)} placeholder="예: 본관 3층 회의실" />

          {error && <Typography color="error" variant="body2">{error}</Typography>}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
            {mode === 'edit' && (
              <Button color="error" onClick={remove} disabled={busy} sx={{ mr: 'auto' }}>삭제</Button>
            )}
            <Button onClick={onClose} disabled={busy} sx={{ color: 'text.secondary' }}>취소</Button>
            <Button type="submit" variant="contained" disabled={busy}>{busy ? '처리 중...' : mode === 'add' ? '추가' : '수정'}</Button>
          </Box>
        </Box>
    </Dialog>

    {/* 반복 시리즈 범위 선택 — 저장·삭제 시 이 일정만 / 이후 / 전체 */}
    <Dialog open={!!scopeAsk} onClose={() => !busy && setScopeAsk(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 340 } } } }}>
      <DialogTitle>{scopeAsk === 'delete' ? '반복 일정 삭제' : '반복 일정 수정'}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: 'text.secondary' }}>어느 범위에 적용할까요?</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 0.75, flexDirection: 'column', alignItems: 'stretch' }}>
        <Button fullWidth variant="outlined" disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('one') : doSave('one'))}>이 일정만</Button>
        <Button fullWidth variant="outlined" disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('following') : doSave('following'))}>이 일정 및 이후</Button>
        <Button fullWidth variant="outlined" color={scopeAsk === 'delete' ? 'error' : 'primary'} disabled={busy} onClick={() => (scopeAsk === 'delete' ? doDelete('all') : doSave('all'))}>모든 일정</Button>
        <Button fullWidth disabled={busy} onClick={() => setScopeAsk(null)} sx={{ color: 'text.secondary', mt: 0.5 }}>취소</Button>
      </DialogActions>
    </Dialog>
    </>
  )
}
