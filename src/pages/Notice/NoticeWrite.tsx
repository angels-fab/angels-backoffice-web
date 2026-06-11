import { useState } from 'react'
import type { FormEvent } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import EditNoteIcon from '@mui/icons-material/EditNote'
import { addNotice } from '@/api/sheets'

const CATS = ['긴급', '공지', '일반', '행사']

interface Props {
  open: boolean
  onClose: () => void
  /** 저장 성공 시 새 글의 연번을 넘김 */
  onSaved: (num: number) => void
}

// 공지 새 글쓰기 모달 — 저장 시 구글시트 '공지사항' 시트에 행 추가
export default function NoticeWrite({ open, onClose, onSaved }: Props) {
  const [cat, setCat] = useState('공지')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dept, setDept] = useState('')
  const [deptMgr, setDeptMgr] = useState('')
  const [author, setAuthor] = useState('')
  const [target, setTarget] = useState('')
  const [end, setEnd] = useState('')
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!body.trim()) return setError('내용을 입력해주세요')
    if (!key.trim()) return setError('작성 비밀번호를 입력해주세요')
    setSaving(true)
    try {
      const num = await addNotice({
        key: key.trim(), cat, title: title.trim(), body,
        dept: dept.trim(), deptMgr: deptMgr.trim(), author: author.trim(),
        target: target.trim(), end,
      })
      setSaving(false)
      setTitle(''); setBody(''); setTarget(''); setEnd('')
      onSaved(num)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
      setSaving(false)
    }
  }

  return (
    // 배경에서 mousedown이 시작된 경우에만 닫기 (textarea 드래그가 배경에서 끝나도 안 닫히게)
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-title">
          <EditNoteIcon /> 공지사항 새 글쓰기
          <button type="button" className="modal-x" onClick={onClose} disabled={saving} aria-label="닫기">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="mform">
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">분류</span>
              <select className="minput" value={cat} onChange={e => setCat(e.target.value)}>
                {CATS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="mfield">
              <span className="mlabel">게시자</span>
              <input className="minput" value={author} onChange={e => setAuthor(e.target.value)} placeholder="이름" />
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">제목 *</span>
            <input className="minput" value={title} onChange={e => setTitle(e.target.value)} placeholder="공지 제목" />
          </label>
          <label className="mfield">
            <span className="mlabel">내용 *</span>
            <textarea
              className="minput mtextarea"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="내용을 입력하세요 (줄바꿈이 그대로 표시됩니다)"
            />
          </label>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">부서</span>
              <input className="minput" value={dept} onChange={e => setDept(e.target.value)} />
            </label>
            <label className="mfield">
              <span className="mlabel">부서 담당자</span>
              <input className="minput" value={deptMgr} onChange={e => setDeptMgr(e.target.value)} />
            </label>
          </div>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">해당자 (선택)</span>
              <input className="minput" value={target} onChange={e => setTarget(e.target.value)} placeholder="예: 전 직원" />
            </label>
            <label className="mfield">
              <span className="mlabel">게시 종료일 (선택)</span>
              <input className="minput" type="date" value={end} onChange={e => setEnd(e.target.value)} />
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">작성 비밀번호 *</span>
            <input
              className="minput"
              type="password"
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="팀 공용 비밀번호"
              autoComplete="off"
            />
          </label>
          {error && <div className="merror">{error}</div>}
          <div className="mactions">
            <button type="button" className="mbtn" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="mbtn mbtn-primary" disabled={saving}>
              {saving ? '저장 중...' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
