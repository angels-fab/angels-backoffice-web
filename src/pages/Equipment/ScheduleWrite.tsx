import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { createSchedule, updateSchedule } from '@/api/eq'
import { useRole } from '@/auth/role'
import type { ScheduleItem } from '@/types'
import { STAGE, STAGE_ORDER } from './stageMeta'

const STAGE_LABELS = STAGE_ORDER.map((c) => STAGE[c].label) // 사전규격·구매공고·…·장비설치

interface Props {
  open: boolean
  onClose: () => void
  /** 수정 대상 — 있으면 수정 모드(자동 로드), 없으면 신규 등록 */
  editing?: ScheduleItem | null
  /** 배치(도입일정 그룹) 전체 관리번호 — 여러 대면 공통필드를 전부에 적용(대표 1행만 바뀌던 버그 방지) */
  batchCodes?: string[]
  /** 저장/수정 성공 시: (관리번호, 수정여부, 경고=부분실패 안내) */
  onSaved: (code: string, isEdit: boolean, warning?: string) => void
}

// 장비 도입 등록/수정 모달 — 상세 Drawer(포털) 위에 뜨도록 body로 포털. 오류는 모달 내(.merror) 표시.
export default function ScheduleWrite({ open, onClose, editing, batchCodes, onSaved }: Props) {
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
        // 배치 전체(여러 대)면 공통필드를 각 code에 적용. 대표는 폼의 관리번호(변경 가능),
        // 나머지는 각자 관리번호 유지. 부분실패는 allSettled로 분리해 안내(성공분은 이미 저장됨).
        const others = (batchCodes || []).filter((c) => c && c !== editing.code)
        const saves = [
          updateSchedule({ origCode: editing.code, ...payload }),
          ...others.map((c) => updateSchedule({ ...payload, origCode: c, code: c })),
        ]
        const results = await Promise.allSettled(saves)
        const failed = results.filter((r) => r.status === 'rejected').length
        setSaving(false)
        if (failed === saves.length) {
          // 전부 실패 — 모달 유지하고 에러 표시(아무것도 저장 안 됨)
          const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
          setError(first?.reason instanceof Error ? first.reason.message : '수정 실패')
          return
        }
        // 성공(전부 or 부분) — 재조회로 반영. 부분실패면 경고 전달.
        onSaved(code.trim() || editing.code, true, failed > 0 ? `${saves.length}건 중 ${failed}건 저장 실패 — 나머지는 저장됨` : undefined)
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
          <LocalShippingIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography component="span" sx={{ fontSize: 16, fontWeight: 600 }}>{isEdit ? '장비 도입 수정' : '장비 추가'}</Typography>
          <IconButton onClick={onClose} disabled={saving} aria-label="닫기" size="small" sx={{ ml: 'auto', color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="관리번호" size="small" fullWidth value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: PR-001" />
          <TextField label="진행상태" size="small" fullWidth value={status} onChange={(e) => setStatus(e.target.value)} placeholder="예: 도입예정" />
        </Box>
        <TextField label="장비명" size="small" fullWidth value={name} onChange={(e) => setName(e.target.value)} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="담당자" size="small" fullWidth value={mgr} onChange={(e) => setMgr(e.target.value)} />
          <TextField label="시작년월" size="small" fullWidth type="date" value={start} onChange={(e) => setStart(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>단계별 소요기간 (개월, 0.5 단위)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 1 }}>
            {STAGE_LABELS.map((label) => (
              <TextField
                key={label} label={label} size="small" type="number"
                value={stages[label] ?? ''}
                onChange={(e) => setStage(label, e.target.value)}
                slotProps={{ htmlInput: { step: 0.5, min: 0 }, inputLabel: { shrink: true } }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <TextField label="구분" size="small" fullWidth value={cat} onChange={(e) => setCat(e.target.value)} placeholder="예: 외자/내자" />
          <TextField label="도입방법" size="small" fullWidth value={method} onChange={(e) => setMethod(e.target.value)} />
        </Box>
        <TextField label="도입금액 (원)" size="small" fullWidth type="number" value={price} onChange={(e) => setPrice(e.target.value)} slotProps={{ htmlInput: { min: 0 } }} />

        {error && <Typography color="error" variant="body2">{error}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
          <Button onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? '저장 중...' : isEdit ? '수정' : '등록'}</Button>
        </Box>
      </Box>
    </Dialog>
  )
}
