import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import CloseIcon from '@mui/icons-material/Close'
import EventIcon from '@mui/icons-material/Event'
import { addCalEvent, updateCalEvent, deleteCalEvent, fetchCalSeries } from '@/api/calendar'
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

  const recurring = !!(event && event.recurring)

  // 열릴 때마다 폼 초기화 (add: 선택일 / edit: 대상 일정 값 — 반복 일정은 시리즈 원본을 불러 프리필)
  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
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
      if (event.recurring) {
        // 시리즈 원본의 반복 설정·기준 날짜로 교체(인스턴스 날짜가 아니라 시리즈 시작 기준)
        void fetchCalSeries(event.id).then((s) => {
          if (!s) return
          setRepeat((s.repeat as Repeat) || 'none')
          setRepeatUntil(s.repeatUntil || '')
          setDate(dateOnly(s.start))
          if (!event.allDay) {
            setStartTime(timeOnly(s.start) || '09:00')
            setEndTime(timeOnly(s.end) || '10:00')
          }
          setEndDate('')
        })
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

  const submit = async (e: FormEvent) => {
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
    setBusy(true)
    try {
      const res =
        mode === 'add'
          ? await addCalEvent(buildInput())
          : await updateCalEvent({ ...buildInput(), id: event!.id })
      setBusy(false)
      onSaved(res.note || (mode === 'add' ? '일정을 추가했어요' : recurring ? '반복 일정 전체에 반영했어요' : '일정을 수정했어요'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || !event) return
    if (!isAdmin || !user) return setError('관리자 로그인이 필요합니다')
    const what = recurring ? '반복 일정 전체를' : '이 일정을'
    if (!window.confirm(`${what} 삭제할까요? 되돌릴 수 없습니다.`)) return
    setError(null)
    setBusy(true)
    try {
      const res = await deleteCalEvent({ id: event.id })
      setBusy(false)
      onSaved(res.note || '일정을 삭제했어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
      setBusy(false)
    }
  }

  return (
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
      <form onSubmit={submit}>
        <div className="modal-title">
          <EventIcon /> {mode === 'add' ? '일정 추가' : '일정 수정'}
          <button type="button" className="modal-x" onClick={onClose} disabled={busy} aria-label="닫기">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="mform">
          <label className="mfield">
            <span className="mlabel">제목 *</span>
            <input className="minput" value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 제목 (참석자는 아래에서 선택)" />
          </label>

          <div className="mfield">
            <span className="mlabel">참석자</span>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.25 }}>
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
          </div>

          <div className="mfield">
            <span className="mlabel">기간</span>
            <label className="mcheck">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
              종일
            </label>
          </div>

          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">시작일 *</span>
              <input className="minput" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            {repeat === 'none' && (
              <label className="mfield">
                <span className="mlabel">종료일 (선택)</span>
                <input className="minput" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </label>
            )}
          </div>

          {!allDay && (
            <div className="mrow">
              <label className="mfield">
                <span className="mlabel">시작 시간</span>
                <input className="minput" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </label>
              <label className="mfield">
                <span className="mlabel">종료 시간</span>
                <input className="minput" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </label>
            </div>
          )}

          <div className="mfield">
            <span className="mlabel">반복</span>
            <div className="mchip-row">
              {REPEAT_LABEL.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`mchip${repeat === value ? ' active' : ''}`}
                  onClick={() => setRepeat(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {repeat !== 'none' && (
              <>
                <label className="mfield" style={{ marginTop: 8 }}>
                  <span className="mlabel">반복 종료일 (비우면 6개월)</span>
                  <input className="minput" type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
                </label>
                {mode === 'edit' && recurring && (
                  <span className="mhint">반복 일정의 수정·삭제는 시리즈 전체에 반영돼요.</span>
                )}
              </>
            )}
          </div>

          <label className="mfield">
            <span className="mlabel">장소 (선택)</span>
            <input className="minput" value={loc} onChange={e => setLoc(e.target.value)} placeholder="예: 본관 3층 회의실" />
          </label>

          {error && <div className="merror">{error}</div>}

          <div className="mactions">
            {mode === 'edit' && (
              <button
                type="button"
                className="mbtn"
                onClick={remove}
                disabled={busy}
                style={{ marginRight: 'auto', color: '#F85149', borderColor: '#F8514955' }}
              >
                삭제
              </button>
            )}
            <button type="button" className="mbtn" onClick={onClose} disabled={busy}>
              취소
            </button>
            <button type="submit" className="mbtn mbtn-primary" disabled={busy}>
              {busy ? '처리 중...' : mode === 'add' ? '추가' : '수정'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
