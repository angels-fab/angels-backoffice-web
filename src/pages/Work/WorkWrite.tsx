import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
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
      <form onSubmit={submit}>
      <div className="modal-title">
        <EditNoteIcon /> {isEdit ? '업무 수정' : '업무 등록'}
        <button type="button" className="modal-x" onClick={onClose} disabled={saving} aria-label="닫기">
          <CloseIcon sx={{ fontSize: 18 }} />
        </button>
      </div>
      <div className="mform">
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">구분</span>
              <input className="minput" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="예: 회의, 채용, 예산" />
            </label>
            <label className="mfield">
              <span className="mlabel">상태</span>
              <select
                className="minput"
                value={status}
                onChange={(e) => {
                  const v = e.target.value
                  setStatus(v)
                  if (v === '완료') setChief(false) // 완료 시 검토 필요 자동 해제
                }}
              >
                {WORK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">업무 *</span>
            <textarea
              className="minput mtextarea"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="업무 내용 (첫 줄이 제목으로 표시됩니다)"
            />
          </label>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">관련부서</span>
              <input className="minput" value={dept} onChange={(e) => setDept(e.target.value)} />
            </label>
            <label className="mfield">
              <span className="mlabel">담당자</span>
              <input className="minput" value={mgr} onChange={(e) => setMgr(e.target.value)} />
            </label>
          </div>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">발의일자</span>
              <input className="minput" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="mfield">
              <span className="mlabel">예정일</span>
              <input className="minput" type="date" value={plan} onChange={(e) => setPlan(e.target.value)} />
            </label>
          </div>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">시간</span>
              <input className="minput" value={time} onChange={(e) => setTime(e.target.value)} placeholder="예: 14:00" />
            </label>
            <label className="mfield">
              <span className="mlabel">장소</span>
              <input className="minput" value={loc} onChange={(e) => setLoc(e.target.value)} />
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">관련자료</span>
            <input className="minput" value={mat} onChange={(e) => setMat(e.target.value)} />
          </label>
          <label className="mfield">
            <span className="mlabel">링크</span>
            <input className="minput" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
          </label>
          <div className="mrow">
            <div className="mfield">
              <span className="mlabel">Remind</span>
              <label className="mcheck">
                <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
                긴급 업무로 표시
              </label>
            </div>
            <div className="mfield">
              <span className="mlabel">검토 필요</span>
              <label className="mcheck">
                <input type="checkbox" checked={chief} disabled={status === '완료'} onChange={(e) => setChief(e.target.checked)} />
                {status === '완료' ? '완료 시 자동 해제됨' : '검토 필요 표시'}
              </label>
            </div>
          </div>
          {error && <div className="merror">{error}</div>}
          <div className="mactions">
            <button type="button" className="mbtn" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="mbtn mbtn-primary" disabled={saving}>
              {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
