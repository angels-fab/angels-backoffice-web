import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
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
import { CAT_META, CAT_ORDER, type RealCat } from './catMeta'
import { typescale, iconSize, radius } from '@/theme/tokens'
import { FormField, DateField, TimeField } from '@/components/ds'

// 제목에서 '@참석자' 부분을 뗀 기본 제목([구분]·내용) — 참석자는 별도 피커가 관리
const baseTitle = (t: string): string => {
  const at = (t || '').indexOf('@')
  return (at >= 0 ? t.slice(0, at) : t).trim()
}
const memberColor = (name: string): string => MEMBERS.find((m) => m.name === name)?.color ?? 'var(--text3)'

// 종류 선택 시 제목 앞에 붙일 표준 태그 — calSlice.classify()가 그대로 인식하는 문구
// ([국내출장]/[국외출장]은 '출장' 매칭 + 국외 판별까지 한 번에 통과)
const STD_TAG: Record<RealCat, string> = {
  meeting: '회의', work: '업무', edu: '교육',
  trip_dom: '국내출장', trip_intl: '국외출장',
  recruit: '기타', leave: '연차', etc: '기타',
}

/** 기본 제목에서 선두 [구분] 태그 분리 + 종류 판별(calSlice.classify와 동일 규칙) — 수정 프리필용 */
function parseTitleTag(base: string): { cat: RealCat | null; tag: string | null; content: string } {
  const m = (base || '').match(/^\s*\[([^\]]+)\]\s*/)
  if (!m) return { cat: null, tag: null, content: (base || '').trim() }
  const tag = m[1]
  const content = base.slice(m[0].length).trim()
  let cat: RealCat | null = null
  if (/연차|반차|휴가|사가/.test(tag)) cat = 'leave'
  else if (/회의|미팅|보고|위원회/.test(tag)) cat = 'meeting'
  else if (/업무/.test(tag)) cat = 'work'
  else if (/교육|세미나|워크숍|강의/.test(tag)) cat = 'edu'
  else if (/출장|실사|방문/.test(tag)) cat = /국외|해외/.test(base) ? 'trip_intl' : 'trip_dom'
  else cat = 'etc'
  return { cat, tag, content }
}

// 종류 픽커에 노출할 순서 — CAT_ORDER에서 채용(recruit) 제외(필터 미노출과 동일 정책)
const PICK_CATS: RealCat[] = CAT_ORDER.filter((c) => c !== 'recruit')

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
  const [title, setTitle] = useState('') // 내용 제목 — [구분] 태그·@참석자 제외(둘 다 별도 피커가 관리)
  const [attendees, setAttendees] = useState<string[]>([]) // 참석자 이름들(제목 @뒤로 합쳐 저장)
  const [cat, setCat] = useState<RealCat | null>(null) // 일정 종류 — 선택 시 제목 앞 [태그]로 저장
  const [origTag, setOrigTag] = useState<string | null>(null) // 수정 시 원본 태그(종류 안 바꾸면 원문 보존)
  const [origCat, setOrigCat] = useState<RealCat | null>(null)
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
      const parsed = parseTitleTag(baseTitle(event.title))
      setTitle(parsed.content)
      setCat(parsed.cat)
      setOrigTag(parsed.tag)
      setOrigCat(parsed.cat)
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
      setCat(null)
      setOrigTag(null)
      setOrigCat(null)
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
    // [구분] + 내용 + '@참석자'(있을 때만) — 표시/파싱 규칙과 동일 포맷.
    // 수정에서 종류를 안 바꿨으면 원본 태그 문구 보존(예: '[출장] 국내(…)' 형식 유지), 바꿨으면 표준 태그.
    const tagText = cat ? (cat === origCat && origTag ? origTag : STD_TAG[cat]) : null
    const fullTitle = (tagText ? `[${tagText}] ` : '') + title.trim() + (attendees.length ? ` @${attendees.join(', ')}` : '')
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
            border: 1, borderColor: 'divider', borderRadius: `${radius.modal}px`, p: '22px 24px',
          },
        },
      }}
    >
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventIcon sx={{ color: 'text.secondary', fontSize: iconSize.header }} />
          <Typography component="span" variant="h4">{mode === 'add' ? '일정 추가' : '일정 수정'}</Typography>
          <IconButton onClick={onClose} disabled={busy} aria-label="닫기" size="small" sx={{ ml: 'auto', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: iconSize.action }} /></IconButton>
        </Box>

        <FormField label="제목" required value={title} onChange={setTitle} placeholder="일정 제목 (종류·참석자는 아래에서 선택)" />

        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: typescale.emphasis.weight, display: 'block', mb: 0.75 }}>일정 종류</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {PICK_CATS.map((c) => {
              const on = cat === c
              const color = CAT_META[c].color
              return (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  onClick={() => setCat(on ? null : c)}
                  sx={{
                    px: 1.25, height: 28, borderRadius: `${radius.pill}px`, cursor: 'pointer',
                    fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, fontFamily: 'inherit', lineHeight: 1,
                    border: '1.5px solid', transition: 'all .12s',
                    borderColor: on ? color : 'divider',
                    bgcolor: on ? color : 'transparent',
                    color: on ? 'common.white' : 'text.secondary',
                  }}
                >
                  {CAT_META[c].label}
                </Box>
              )
            })}
          </Box>
          {!cat && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 0.5 }}>
              선택하지 않으면 제목 문구로 자동 분류돼요
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: typescale.emphasis.weight, display: 'block', mb: 0.75 }}>참석자</Typography>
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
                      px: 1.25, height: 28, borderRadius: `${radius.pill}px`, cursor: 'pointer',
                      fontSize: typescale.body.size, fontWeight: typescale.cardTitle.weight, fontFamily: 'inherit', lineHeight: 1,
                      border: '1.5px solid', transition: 'all .12s',
                      borderColor: on ? c : 'divider',
                      bgcolor: on ? c : 'transparent',
                      color: on ? 'common.white' : 'text.secondary',
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
            <DateField label="시작일" required value={date} onChange={setDate} />
            {repeat === 'none' && (
              <DateField label="종료일 (선택)" value={endDate} onChange={setEndDate} />
            )}
          </Box>

          {!allDay && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TimeField label="시작 시간" value={startTime} onChange={setStartTime} />
              <TimeField label="종료 시간" value={endTime} onChange={setEndTime} />
            </Box>
          )}

          {mode === 'add' && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: typescale.emphasis.weight, display: 'block', mb: 0.75 }}>반복</Typography>
              <ToggleButtonGroup exclusive size="small" value={repeat} onChange={(_, v) => { if (v !== null) setRepeat(v) }}>
                {REPEAT_LABEL.map(([value, label]) => (
                  <ToggleButton key={value} value={value} sx={{ textTransform: 'none', px: 1.5 }}>{label}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              {repeat !== 'none' && (
                <DateField label="반복 종료일 (비우면 6개월)" value={repeatUntil} onChange={setRepeatUntil} sx={{ mt: 1.5 }} />
              )}
            </Box>
          )}
          {mode === 'edit' && isSeries && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block' }}>
              반복 일정입니다 — 저장·삭제 시 범위(이 일정만 / 이후 / 전체)를 선택합니다. 날짜 변경은 '이 일정만'에서만 반영돼요.
            </Typography>
          )}

          <FormField label="장소 (선택)" value={loc} onChange={setLoc} placeholder="예: 본관 3층 회의실" />

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
