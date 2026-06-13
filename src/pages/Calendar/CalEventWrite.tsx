import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import EventIcon from '@mui/icons-material/Event'
import { addCalEvent, deleteCalEvent, updateCalEvent } from '@/api/sheets'
import type { CalScope } from '@/api/sheets'
import type { CalEvent } from '@/types'

interface Props {
  open: boolean
  mode: 'add' | 'edit'
  /** edit 모드의 대상 일정 */
  event: CalEvent | null
  /** add 모드에서 미리 채울 날짜 (선택한 날) */
  initialDate: string
  onClose: () => void
  /** 추가/수정/삭제 성공 → 부모가 새로고침 (서버 안내 메시지 전달) */
  onSaved: (msg: string) => void
}

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

// 캘린더 일정 추가/수정/삭제 모달 — 모든 쓰기는 담당자 비밀번호 인증
export default function CalEventWrite({ open, mode, event, initialDate, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [date, setDate] = useState('') // 시작일 (종일·시간 공통)
  const [endDate, setEndDate] = useState('') // 종일 다중일 종료(선택)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [loc, setLoc] = useState('')
  const [author, setAuthor] = useState('')
  const [key, setKey] = useState('')
  const [scope, setScope] = useState<CalScope>('single') // 반복 일정 적용 범위
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 열릴 때마다 폼 초기화 (add: 선택일 / edit: 대상 일정 값)
  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setKey('')
    setScope('single')
    if (mode === 'edit' && event) {
      setTitle(event.title)
      setAllDay(event.allDay)
      setDate(dateOnly(event.start))
      setLoc(event.loc && event.loc !== '-' ? event.loc : '')
      if (event.allDay) {
        const inc = inclusiveEndDate(event.end)
        setEndDate(inc && inc !== dateOnly(event.start) ? inc : '')
      } else {
        setStartTime(timeOnly(event.start) || '09:00')
        setEndTime(timeOnly(event.end) || '10:00')
        setEndDate('')
      }
    } else {
      setTitle('')
      setAllDay(false)
      setDate(initialDate || '')
      setEndDate('')
      setStartTime('09:00')
      setEndTime('10:00')
      setLoc('')
      setAuthor('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, event])

  if (!open) return null

  const recurring = !!(event && event.recurring)
  // 반복 일정 전체 시리즈는 제목·장소만 반영 → 시간/날짜 입력 잠금
  const lockTime = mode === 'edit' && recurring && scope === 'series'

  const buildInput = () => {
    const base = { author: author.trim(), key: key.trim(), title: title.trim(), loc: loc.trim(), allDay }
    if (allDay) return { ...base, startDate: date, endDate: endDate || undefined }
    return { ...base, start: `${date}T${startTime}`, end: `${date}T${endTime}` }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!date) return setError('날짜를 선택해주세요')
    if (!allDay && !lockTime && endTime <= startTime) return setError('종료 시간이 시작보다 빨라요')
    if (!author.trim()) return setError('이름을 입력해주세요')
    if (!key.trim()) return setError('비밀번호를 입력해주세요')
    setError(null)
    setBusy(true)
    try {
      const res =
        mode === 'add'
          ? await addCalEvent(buildInput())
          : await updateCalEvent({ ...buildInput(), id: event!.id, scope })
      setBusy(false)
      onSaved(res.note || (mode === 'add' ? '일정을 추가했어요' : '일정을 수정했어요'))
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리 실패')
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || !event) return
    if (!author.trim()) return setError('이름을 입력해주세요')
    if (!key.trim()) return setError('비밀번호를 입력해주세요')
    const what = recurring && scope === 'series' ? '전체 시리즈를' : '이 일정을'
    if (!window.confirm(`${what} 삭제할까요? 되돌릴 수 없습니다.`)) return
    setError(null)
    setBusy(true)
    try {
      const res = await deleteCalEvent({ id: event.id, scope, author: author.trim(), key: key.trim() })
      setBusy(false)
      onSaved(res.note || '일정을 삭제했어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패')
      setBusy(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-title">
          <EventIcon /> {mode === 'add' ? '일정 추가' : '일정 수정'}
          <button type="button" className="modal-x" onClick={onClose} disabled={busy} aria-label="닫기">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="mform">
          <label className="mfield">
            <span className="mlabel">제목 *</span>
            <input className="minput" value={title} onChange={e => setTitle(e.target.value)} placeholder="일정 제목" />
          </label>

          {mode === 'edit' && recurring && (
            <div className="mfield">
              <span className="mlabel">반복 일정 — 적용 범위</span>
              <div className="mchip-row">
                <button
                  type="button"
                  className={`mchip${scope === 'single' ? ' active' : ''}`}
                  onClick={() => setScope('single')}
                >
                  이 일정만
                </button>
                <button
                  type="button"
                  className={`mchip${scope === 'series' ? ' active' : ''}`}
                  onClick={() => setScope('series')}
                >
                  전체 시리즈
                </button>
              </div>
              {scope === 'series' && (
                <span className="mhint">전체 시리즈는 제목·장소만 반영돼요 (시간 변경은 "이 일정만" 또는 캘린더 앱에서).</span>
              )}
            </div>
          )}

          <div className="mfield">
            <span className="mlabel">기간</span>
            <label className="mcheck">
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} disabled={lockTime} />
              종일
            </label>
          </div>

          {allDay ? (
            <div className="mrow">
              <label className="mfield">
                <span className="mlabel">시작일 *</span>
                <input className="minput" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={lockTime} />
              </label>
              <label className="mfield">
                <span className="mlabel">종료일 (선택)</span>
                <input className="minput" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={lockTime} />
              </label>
            </div>
          ) : (
            <>
              <label className="mfield">
                <span className="mlabel">날짜 *</span>
                <input className="minput" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={lockTime} />
              </label>
              <div className="mrow">
                <label className="mfield">
                  <span className="mlabel">시작 시간</span>
                  <input className="minput" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={lockTime} />
                </label>
                <label className="mfield">
                  <span className="mlabel">종료 시간</span>
                  <input className="minput" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={lockTime} />
                </label>
              </div>
            </>
          )}

          <label className="mfield">
            <span className="mlabel">장소 (선택)</span>
            <input className="minput" value={loc} onChange={e => setLoc(e.target.value)} placeholder="예: 본관 3층 회의실" />
          </label>

          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">이름 *</span>
              <input className="minput" value={author} onChange={e => setAuthor(e.target.value)} placeholder="담당자 명단과 동일하게" />
            </label>
            <label className="mfield">
              <span className="mlabel">본인 비밀번호 *</span>
              <input
                className="minput"
                type="password"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder="본인 비밀번호"
                autoComplete="off"
              />
            </label>
          </div>

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
    </div>
  )
}
