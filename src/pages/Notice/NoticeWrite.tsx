import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import EditNoteIcon from '@mui/icons-material/EditNote'
import { addNotice, fetchAuthors } from '@/api/sheets'
import { useRole } from '@/auth/role'

const CATS = ['긴급', '공지', '일반', '회의', '교육', '행사', '점검']

interface Props {
  open: boolean
  onClose: () => void
  /** 저장 성공 시 새 글의 연번을 넘김 */
  onSaved: (num: number) => void
}

// 공지 새 글쓰기 모달 — 게시자/비밀번호는 로그인한 관리자 정보를 자동 사용(재입력 없음).
export default function NoticeWrite({ open, onClose, onSaved }: Props) {
  const { user, authKey } = useRole()
  const [cat, setCat] = useState('공지')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dept, setDept] = useState('')
  const [deptMgr, setDeptMgr] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [targetText, setTargetText] = useState('')
  const [pinned, setPinned] = useState(false)
  const [end, setEnd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authors, setAuthors] = useState<string[] | null>(null)
  const [authorsFail, setAuthorsFail] = useState(false)

  // 모달 첫 오픈 시 담당자 명단(이름만) 로드 — 해당자 선택 버튼용
  useEffect(() => {
    if (!open || authors !== null || authorsFail) return
    fetchAuthors()
      .then(setAuthors)
      .catch(() => setAuthorsFail(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    if (!user || !authKey) return setError('관리자 로그인이 필요합니다')
    if (!title.trim()) return setError('제목을 입력해주세요')
    if (!body.trim()) return setError('내용을 입력해주세요')
    setSaving(true)
    try {
      const num = await addNotice({
        key: authKey, author: user, cat, title: title.trim(), body, pinned,
        dept: dept.trim(), deptMgr: deptMgr.trim(),
        target: authorsFail ? targetText.trim() : targets.join(', '), end,
      })
      setSaving(false)
      setTitle(''); setBody(''); setTargets([]); setTargetText(''); setEnd(''); setPinned(false)
      onSaved(num)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패')
      setSaving(false)
    }
  }

  return (
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
              <input className="minput" value={user || ''} readOnly disabled />
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
          <div className="mfield">
            <span className="mlabel">해당자 (선택) — 누르면 선택/해제</span>
            {authorsFail ? (
              <input
                className="minput"
                value={targetText}
                onChange={e => setTargetText(e.target.value)}
                placeholder="예: 박주봉, 조성범"
              />
            ) : authors === null ? (
              <span className="mhint">담당자 명단 불러오는 중...</span>
            ) : (
              <div className="mchip-row">
                {authors.map(a => (
                  <button
                    key={a}
                    type="button"
                    className={`mchip${targets.includes(a) ? ' active' : ''}`}
                    onClick={() => setTargets(t => (t.includes(a) ? t.filter(x => x !== a) : [...t, a]))}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">게시 종료일 (선택)</span>
              <input className="minput" type="date" value={end} onChange={e => setEnd(e.target.value)} />
            </label>
            <div className="mfield">
              <span className="mlabel">상단고정</span>
              <label className="mcheck">
                <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />
                게시판 맨 위에 고정
              </label>
            </div>
          </div>
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
