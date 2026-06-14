import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import CloseIcon from '@mui/icons-material/Close'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { createSchedule, updateSchedule } from '@/api/sheets'
import { useRole } from '@/auth/role'
import type { ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER } from './stageMeta'

const STAGE_LABELS = STAGE_ORDER.map((c) => STAGE[c].label) // 사전규격·구매공고·…·장비설치

interface Props {
  open: boolean
  onClose: () => void
  /** 수정 대상 — 있으면 수정 모드(자동 로드), 없으면 신규 등록 */
  editing?: ScheduleItem | null
  /** 저장/수정 성공 시: (관리번호, 수정여부) */
  onSaved: (code: string, isEdit: boolean) => void
}

// 장비 도입 등록/수정 모달 — 상세 Drawer(포털) 위에 뜨도록 body로 포털. 오류는 모달 내(.merror) 표시.
export default function ScheduleWrite({ open, onClose, editing, onSaved }: Props) {
  const { user, authKey } = useRole()
  const isEdit = !!editing
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [mgr, setMgr] = useState('')
  const [status, setStatus] = useState('')
  const [start, setStart] = useState('')
  const [stages, setStages] = useState<Record<string, string>>({})
  const [cat, setCat] = useState('')
  const [method, setMethod] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSaving(false)
    const e = editing
    setCode(e?.code || '')
    setName(e?.name || '')
    setMgr(e?.mgr || '')
    setStatus(e?.status || '')
    setStart(e?.start || '')
    setStages({ ...(e?.stages || {}) })
    setCat(e?.cat || '')
    setMethod(e?.method || '')
    setPrice(e?.price ? String(e.price) : '')
  }, [open, editing])

  if (!open) return null

  const setStage = (label: string, v: string) => setStages((s) => ({ ...s, [label]: v }))

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (saving) return
    setError(null)
    if (!user || !authKey) return setError('관리자 로그인이 필요합니다')
    if (!code.trim() && !name.trim()) return setError('관리번호 또는 장비명을 입력해주세요')
    setSaving(true)
    const payload = {
      key: authKey, author: user,
      code: code.trim(), name: name.trim(), mgr: mgr.trim(), status: status.trim(),
      start, stages, cat: cat.trim(), method: method.trim(), price: price.trim(),
    }
    try {
      if (editing) {
        await updateSchedule({ origCode: editing.code, ...payload })
        setSaving(false)
        onSaved(code.trim() || editing.code, true)
      } else {
        const newCode = await createSchedule(payload)
        setSaving(false)
        onSaved(newCode || code.trim(), false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? '수정 실패' : '저장 실패')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <form className="modal-card" onSubmit={submit}>
        <div className="modal-title">
          <LocalShippingIcon /> {isEdit ? '장비 도입 수정' : '장비 추가'}
          <button type="button" className="modal-x" onClick={onClose} disabled={saving} aria-label="닫기">
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
        <div className="mform">
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">관리번호</span>
              <input className="minput" value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: PR-001" />
            </label>
            <label className="mfield">
              <span className="mlabel">진행상태</span>
              <input className="minput" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="예: 도입예정" />
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">장비명</span>
            <input className="minput" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">담당자</span>
              <input className="minput" value={mgr} onChange={(e) => setMgr(e.target.value)} />
            </label>
            <label className="mfield">
              <span className="mlabel">시작년월</span>
              <input className="minput" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
          </div>

          <div className="mfield">
            <span className="mlabel">단계별 소요기간 (개월, 0.5 단위)</span>
            <div className="mrow" style={{ flexWrap: 'wrap', gap: 8 }}>
              {STAGE_LABELS.map((label) => (
                <label key={label} className="mfield" style={{ minWidth: 96, flex: '1 1 96px' }}>
                  <span className="mlabel" style={{ fontSize: 12 }}>{label}</span>
                  <input
                    className="minput"
                    type="number"
                    step="0.5"
                    min="0"
                    value={stages[label] ?? ''}
                    onChange={(e) => setStage(label, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="mrow">
            <label className="mfield">
              <span className="mlabel">구분</span>
              <input className="minput" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="예: 외자/내자" />
            </label>
            <label className="mfield">
              <span className="mlabel">도입방법</span>
              <input className="minput" value={method} onChange={(e) => setMethod(e.target.value)} />
            </label>
          </div>
          <label className="mfield">
            <span className="mlabel">도입금액 (원)</span>
            <input className="minput" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>

          {error && <div className="merror">{error}</div>}
          <div className="mactions">
            <button type="button" className="mbtn" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="mbtn mbtn-primary" disabled={saving}>
              {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  )
}
