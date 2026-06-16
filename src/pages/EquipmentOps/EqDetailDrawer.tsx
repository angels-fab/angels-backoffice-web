import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import EditIcon from '@mui/icons-material/Edit'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { AppDrawer, StatusChip } from '@/components/ds'
import { updateEquipment, fetchEqHistory, type EqHistoryItem } from '@/api/sheets'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'

// 수정 가능 필드(11) — 읽기 전용: 관리번호/장비명/장비종류/도입금액/재원
type FieldKey = 'mgr' | 'maker' | 'model' | 'assetNo' | 'nfec' | 'installLoc' | 'installDate' | 'vendor' | 'mgr2' | 'contact' | 'note'
// 비고는 시트에 열이 없어 저장 불가 → 읽기 전용으로 둠(편집 목록에서 제외)
const EDIT_KEYS: FieldKey[] = ['mgr', 'maker', 'model', 'assetNo', 'nfec', 'installLoc', 'installDate', 'vendor', 'mgr2', 'contact']
const LABELS: Record<FieldKey, string> = {
  mgr: '담당자', maker: '제조사', model: '모델명', assetNo: '자산번호', nfec: 'NFEC번호',
  installLoc: '설치장소', installDate: '설치일자', vendor: '업체명', mgr2: '엔지니어', contact: '연락처', note: '비고',
}
const blankForm = (): Record<FieldKey, string> =>
  ({ mgr: '', maker: '', model: '', assetNo: '', nfec: '', installLoc: '', installDate: '', vendor: '', mgr2: '', contact: '', note: '' })

// STEP21 상태 변경 (사유는 시트에 열이 없어 미사용 — 추후 열 추가 시 복구)
const STATE_ORDER = ['도입예정', '도입중', '가동중', '비가동'] as const

function MetaRow({ label, value }: { label: string; value?: string }) {
  const v = (value ?? '').trim()
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: v ? 'text.primary' : 'text.disabled' }}>{v || '미등록'}</Typography>
    </Box>
  )
}
function EditRow({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled', pt: 1 }}>{label}</Typography>
      <TextField value={value} onChange={(e) => onChange(e.target.value)} size="small" fullWidth multiline={multiline} minRows={multiline ? 2 : undefined} sx={{ flex: 1 }} />
    </Box>
  )
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>{children}</Box>
    </Box>
  )
}
const k = (v: number) => Math.round(v / 1000).toLocaleString()
// STEP22 — 이력 상태 문자열 표시: 빈값은 '-', 표준 4키만 라벨(설치중/운영중 등), 비표준값은 원문 그대로.
const stateLabel = (s: string) => { const t = (s || '').trim(); if (!t) return '-'; return t in EQ_STATE ? EQ_STATE[t as EqStateKey].label : t }

export interface EqDetailDrawerProps {
  group: EqGroup | null
  onClose: () => void
  /** 관리자면 수정 버튼 노출 */
  isAdmin?: boolean
  user?: string | null
  authKey?: string | null
  /** 저장 성공 → 부모가 재fetch + picked 갱신 */
  onSaved?: (name: string) => void
  showSnack?: (msg: string, severity?: 'success' | 'error') => void
}

/** 장비 상세 Drawer — 조회 + 관리자 수정(Update). 추가/삭제 없음. */
export default function EqDetailDrawer({ group, onClose, isAdmin, user, authKey, onSaved, showSnack }: EqDetailDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<FieldKey, string>>(blankForm)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ key: FieldKey; label: string; before: string; after: string }[] | null>(null)
  const [stateAnchor, setStateAnchor] = useState<HTMLElement | null>(null) // STEP21 상태 변경 드롭다운
  const [savingState, setSavingState] = useState(false)
  const [history, setHistory] = useState<EqHistoryItem[]>([]) // STEP22 운영이력(읽기 전용)
  const [histLoading, setHistLoading] = useState(false)
  const [histError, setHistError] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0) // STEP22 이력 재조회 트리거
  const repCode = group ? group.codes.filter(Boolean)[0] || '' : ''

  // 다른 장비 열거나 닫으면 수정 상태 초기화
  useEffect(() => {
    setEditing(false)
    setConfirm(null)
    setSaving(false)
    setStateAnchor(null)
  }, [group])

  // STEP22 — 드로어 열림/장비 변경/상태변경 시 대표 관리번호 기준 운영이력 로드(조회 전용, 단일 가드 경로). 닫히면 비움.
  useEffect(() => {
    if (!group || !repCode) { setHistory([]); setHistError(false); setHistLoading(false); return }
    let alive = true
    setHistLoading(true)
    setHistError(false)
    fetchEqHistory(repCode)
      .then((items) => { if (alive) { setHistory(items); setHistError(false) } })
      .catch(() => { if (alive) { setHistory([]); setHistError(true) } })
      .finally(() => { if (alive) setHistLoading(false) })
    return () => { alive = false }
  }, [group, repCode, refreshTick])

  const meta = group ? EQ_STATE[eqStateKey(group.state)] : null
  const codes = group ? group.codes.filter(Boolean).join(', ') : ''
  const rawState = (group?.state ?? '').trim() // STEP22 리뷰 — 메뉴 no-op/selected는 raw 상태값으로 비교(eqStateKey '비가동' 폴백 회피)
  const set = (key: FieldKey) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const startEdit = () => {
    if (!group) return
    const f = blankForm()
    EDIT_KEYS.forEach((key) => { f[key] = String(group[key] ?? '') })
    setForm(f)
    setEditing(true)
  }
  const cancelEdit = () => { setEditing(false); setConfirm(null) }

  const onSaveClick = () => {
    if (!group) return
    if (!repCode) { showSnack?.('관리번호가 없어 수정할 수 없습니다.', 'error'); return }
    const changes = EDIT_KEYS
      .map((key) => ({ key, label: LABELS[key], before: String(group[key] ?? '').trim(), after: form[key].trim() }))
      .filter((c) => c.before !== c.after)
    if (!changes.length) { showSnack?.('변경 사항이 없습니다.', 'error'); return }
    setConfirm(changes)
  }

  const applySave = async () => {
    if (!group || saving || !confirm) return
    if (!user || !authKey) { showSnack?.('관리자 로그인이 필요합니다.', 'error'); return }
    setSaving(true)
    try {
      await updateEquipment({
        author: user, key: authKey, code: repCode,
        mgr: form.mgr, maker: form.maker, model: form.model, assetNo: form.assetNo, nfec: form.nfec,
        installLoc: form.installLoc, installDate: form.installDate, vendor: form.vendor, mgr2: form.mgr2,
        contact: form.contact,
      })
      setSaving(false)
      setConfirm(null)
      setEditing(false)
      showSnack?.('장비 정보를 저장했습니다.', 'success')
      onSaved?.(group.name)
    } catch (err) {
      setSaving(false)
      showSnack?.(err instanceof Error ? err.message : '저장 실패', 'error')
    }
  }

  // STEP21 — 상태 변경(드롭다운에서 선택 즉시 적용). 사유는 시트 열이 없어 미전송.
  const applyState = async (s: string) => {
    setStateAnchor(null)
    if (!group || savingState) return
    if (s === rawState) return // 동일 상태(raw 비교) → 변경 없음. 비표준 상태면 어떤 키도 일치 안 해 정규화 가능
    if (!repCode) { showSnack?.('관리번호가 없어 변경할 수 없습니다.', 'error'); return }
    if (!user || !authKey) { showSnack?.('관리자 로그인이 필요합니다.', 'error'); return }
    setSavingState(true)
    try {
      await updateEquipment({ author: user, key: authKey, code: repCode, state: s })
      setSavingState(false)
      showSnack?.(`장비 상태를 '${EQ_STATE[s as keyof typeof EQ_STATE]?.label ?? s}'(으)로 변경했습니다.`, 'success')
      onSaved?.(group.name)
      setRefreshTick((t) => t + 1) // STEP22 — 이력 즉시 재조회(단일 가드 effect 경유, stale 방지)
    } catch (err) {
      setSavingState(false)
      showSnack?.(err instanceof Error ? err.message : '상태 변경 실패', 'error')
    }
  }

  const fieldRow = (g: EqGroup, key: FieldKey) =>
    editing
      ? <EditRow key={key} label={LABELS[key]} value={form[key]} onChange={set(key)} multiline={key === 'note'} />
      : <MetaRow key={key} label={LABELS[key]} value={String(g[key] ?? '')} />

  return (
    <>
      <AppDrawer
        open={!!group}
        onClose={onClose}
        title={group?.name ?? ''}
        subtitle={group ? `${group.cat || '장비'}${group.count > 1 ? ` · ${group.count}대` : ''}` : ''}
        width={520}
        footer={
          group && isAdmin ? (
            editing ? (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={cancelEdit} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
                <Button variant="contained" onClick={onSaveClick} disabled={saving}>저장</Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" startIcon={<EditIcon />} onClick={startEdit}>수정</Button>
              </Box>
            )
          ) : undefined
        }
      >
        {group && meta && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* 상단: 상태·분류 칩 + 관리번호 (읽기 전용) */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <StatusChip status={meta.status} label={meta.label} />
              {group.cat && <StatusChip status="neutral" label={group.cat} />}
              {isAdmin && !editing && (
                <Button size="small" variant="outlined" endIcon={<ArrowDropDownIcon />} disabled={savingState} onClick={(e) => setStateAnchor(e.currentTarget)} sx={{ py: 0.1, minWidth: 0, fontSize: 12, lineHeight: 1.6, '& .MuiButton-endIcon': { ml: 0.25 } }}>상태 변경</Button>
              )}
              <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled', fontFamily: 'monospace', wordBreak: 'break-all' }}>{codes || '관리번호 미등록'}</Typography>
            </Box>

            <Section title="기본 정보">
              {fieldRow(group, 'mgr')}
              <MetaRow label="장비종류" value={group.type} />
              {fieldRow(group, 'maker')}
              {fieldRow(group, 'model')}
              {fieldRow(group, 'assetNo')}
              {fieldRow(group, 'nfec')}
            </Section>
            <Section title="설치 정보">
              {fieldRow(group, 'installLoc')}
              {fieldRow(group, 'installDate')}
            </Section>
            <Section title="업체 정보">
              {fieldRow(group, 'vendor')}
              {fieldRow(group, 'mgr2')}
              {fieldRow(group, 'contact')}
            </Section>
            <Section title="예산 정보">
              <MetaRow label="도입금액" value={group.price ? `${k(group.price)} 천원` : ''} />
              <MetaRow label="재원" value={group.fund} />
            </Section>
            <Section title="기타">
              <MetaRow label="비고" value={group.note} />
            </Section>
            {/* STEP22 — 운영 이력(읽기 전용, 최신 먼저) */}
            <Section title="운영 이력">
              {histLoading ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>불러오는 중…</Typography>
              ) : histError ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>운영 이력을 불러오지 못했습니다</Typography>
              ) : history.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>운영 이력이 없습니다</Typography>
              ) : (
                history.slice(0, 20).map((h, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                    <Typography variant="caption" sx={{ width: 96, flexShrink: 0, color: 'text.disabled', fontFamily: 'monospace', pt: 0.25 }}>{h.when || '-'}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                        <Box component="span" sx={{ color: 'text.disabled' }}>{stateLabel(h.prev)}</Box>
                        {' → '}
                        <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{stateLabel(h.next)}</Box>
                      </Typography>
                      {(h.author || h.reason) && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                          {h.author || '-'}{h.reason ? ` · ${h.reason}` : ''}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))
              )}
            </Section>

            {editing && group.count > 1 && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>※ 대표 1대(관리번호 {repCode}) 기준으로 저장됩니다.</Typography>
            )}
          </Box>
        )}
      </AppDrawer>

      {/* STEP20: 저장 전 변경사항 확인 모달 */}
      <Dialog open={!!confirm} onClose={() => !saving && setConfirm(null)} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 380 } } } }}>
        <DialogTitle>장비 정보를 저장하시겠습니까?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
            {confirm?.map((c) => (
              <Box key={c.key} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled' }}>{c.label}</Typography>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                  <Box component="span" sx={{ color: 'text.disabled' }}>{c.before || '미등록'}</Box>
                  {' → '}
                  <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{c.after || '미등록'}</Box>
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={saving} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" onClick={applySave} disabled={saving}>{saving ? '적용 중…' : '적용'}</Button>
        </DialogActions>
      </Dialog>

      {/* STEP21: 상태 변경 드롭다운(선택 즉시 적용). 사유는 시트 열이 없어 숨김. */}
      <Menu
        anchorEl={group ? stateAnchor : null}
        open={!!group && !!stateAnchor}
        onClose={() => setStateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 140 } } }}
      >
        {STATE_ORDER.map((s) => (
          <MenuItem key={s} selected={!!group && s === rawState} onClick={() => applyState(s)} sx={{ fontSize: 14 }}>
            {EQ_STATE[s].label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
