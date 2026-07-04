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
import { updateEquipment, fetchEqHistory } from '@/api/eq'
import type { EqHistoryItem } from '@/api/sheets'
import type { EqGroup, EqStateKey } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'
import { codeRange, missingLabels, isRegRequired } from '@/pages/Equipment/batchUtil'

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

// 상태 변경 선택지 (STEP23: 선택 → 확인 Dialog에서 사유 입력 후 적용, 사유는 운영이력에 함께 기록)
const STATE_ORDER = ['도입예정', '도입중', '운영중', '비가동'] as const

function MetaRow({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  const v = (value ?? '').trim()
  // 필수 등록정보 미등록은 황색 강조(warn), 그 외 빈값은 회색
  const emptyColor = warn ? 'warning.main' : 'text.disabled'
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: v ? 'text.primary' : emptyColor }}>{v || '미등록'}</Typography>
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
// STEP22 — 이력 상태 문자열 표시: 빈값은 '-', 정식 키는 라벨(시트값과 동일), 그 외(레거시 '가동중' 등)는 원문 그대로.
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
  const [pendingState, setPendingState] = useState<string | null>(null) // STEP23 상태 변경 확인 대기(선택된 새 상태)
  const [reason, setReason] = useState('') // STEP23 변경 사유(선택)
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
    setPendingState(null)
    setReason('')
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

  // STEP23 — 드롭다운에서 상태 선택: 같은 상태(raw 비교)면 무시, 아니면 확인 Dialog 오픈(즉시 저장 안 함)
  const pickState = (s: string) => {
    setStateAnchor(null)
    if (!group || s === rawState) return // 동일 상태 → 변경 없음(STEP22 raw 비교 유지)
    setReason('')
    setPendingState(s)
  }
  // STEP23 — 확인 Dialog [적용]: state + reason(trim, optional) 전송. 성공 시 이력 즉시 재조회.
  const applyStateChange = async () => {
    if (!group || !pendingState || savingState) return
    if (!repCode) { showSnack?.('관리번호가 없어 변경할 수 없습니다.', 'error'); return }
    if (!user || !authKey) { showSnack?.('관리자 로그인이 필요합니다.', 'error'); return }
    const next = pendingState
    setSavingState(true)
    try {
      await updateEquipment({ author: user, key: authKey, code: repCode, state: next, reason: reason.trim() || undefined })
      setSavingState(false)
      setPendingState(null)
      setReason('')
      showSnack?.(`장비 상태를 '${EQ_STATE[next as keyof typeof EQ_STATE]?.label ?? next}'(으)로 변경했습니다.`, 'success')
      onSaved?.(group.name)
      setRefreshTick((t) => t + 1) // 이력 즉시 재조회(단일 가드 effect 경유, stale 방지)
    } catch (err) {
      setSavingState(false)
      showSnack?.(err instanceof Error ? err.message : '상태 변경 실패', 'error')
    }
  }

  const REG = new Set<FieldKey>(['maker', 'model', 'installLoc', 'nfec']) // 필수 등록정보
  const regRequired = group ? isRegRequired(group.state) : false // 도입예정은 미요구 → 황색 강조/누락 집계 제외
  const fieldRow = (g: EqGroup, key: FieldKey) =>
    editing
      ? <EditRow key={key} label={LABELS[key]} value={form[key]} onChange={set(key)} multiline={key === 'note'} />
      : <MetaRow key={key} label={LABELS[key]} value={String(g[key] ?? '')} warn={REG.has(key) && regRequired} />

  return (
    <>
      <AppDrawer
        open={!!group}
        onClose={onClose}
        title={group?.name ?? ''}
        subtitle={group ? `${group.count}대 · ${codeRange(group)} · ${group.cat || '장비'} · ${group.type || '-'}` : ''}
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

            {/* 등록정보 상태 안내 — 도입예정=중립(미요구) / 누락=황색 / 완료=녹색 */}
            {(() => {
              if (!regRequired) {
                return (
                  <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.elevated' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.25 }}>도입예정 단계</Typography>
                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>제조사·모델명·설치장소·NFEC 등은 도입 진행 시 등록합니다.</Typography>
                  </Box>
                )
              }
              const miss = missingLabels(group)
              const ok = miss.length === 0
              return (
                <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: ok ? 'success.main' : 'warning.main', bgcolor: (t) => (ok ? t.palette.success.main : t.palette.warning.main) + '1f' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: ok ? 'success.main' : 'warning.main', mb: ok ? 0 : 0.25 }}>
                    {ok ? '등록정보 확인 완료' : `확인 필요 · 필수정보 ${miss.length}개 누락`}
                  </Typography>
                  {!ok && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{miss.join(' · ')}</Typography>}
                </Box>
              )
            })()}

            <Section title="기본 정보">
              {fieldRow(group, 'mgr')}
              <MetaRow label="장비종류" value={group.type} />
              {group.variantNames.length > 0 && <MetaRow label="세부 구성" value={group.variantNames.join(', ')} />}
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
                history.slice(0, 20).map((h, i) => {
                  // 작성자/사유 — 있는 값만 ' · '로 연결(둘 다 없으면 표시 안 함)
                  const sub = [h.author, h.reason].map((x) => (x || '').trim()).filter(Boolean).join(' · ')
                  return (
                    <Box key={i} sx={{ display: 'flex', gap: 1.5 }}>
                      <Typography variant="caption" sx={{ width: 96, flexShrink: 0, color: 'text.disabled', fontFamily: 'monospace', pt: 0.25 }}>{h.when || '-'}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                          <Box component="span" sx={{ color: 'text.disabled' }}>{stateLabel(h.prev)}</Box>
                          {' → '}
                          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{stateLabel(h.next)}</Box>
                        </Typography>
                        {sub && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{sub}</Typography>
                        )}
                      </Box>
                    </Box>
                  )
                })
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

      {/* STEP23: 상태 변경 확인 + 사유 입력 Dialog (선택 즉시 저장하지 않음) */}
      <Dialog open={!!pendingState} onClose={() => { if (!savingState) { setPendingState(null); setReason('') } }} slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: { xs: 280, sm: 380 } } } }}>
        <DialogTitle>장비 상태를 변경하시겠습니까?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled' }}>장비명</Typography>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{group?.name || '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled' }}>관리번호</Typography>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontFamily: 'monospace', wordBreak: 'break-all' }}>{codes || '-'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled' }}>상태</Typography>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                <Box component="span" sx={{ color: 'text.disabled' }}>{rawState || '미지정'}</Box>
                {' → '}
                <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{pendingState}</Box>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 0.5 }}>
              <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled', pt: 1 }}>사유</Typography>
              <TextField value={reason} onChange={(e) => setReason(e.target.value)} size="small" fullWidth multiline minRows={2} placeholder="선택 입력" disabled={savingState} sx={{ flex: 1 }} />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setPendingState(null); setReason('') }} disabled={savingState} sx={{ color: 'text.secondary' }}>취소</Button>
          <Button variant="contained" onClick={applyStateChange} disabled={savingState}>{savingState ? '적용 중…' : '적용'}</Button>
        </DialogActions>
      </Dialog>

      {/* STEP23: 상태 변경 드롭다운 — 선택 시 즉시 저장 없이 확인 Dialog(사유 입력) 오픈 */}
      <Menu
        anchorEl={group ? stateAnchor : null}
        open={!!group && !!stateAnchor}
        onClose={() => setStateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', minWidth: 140 } } }}
      >
        {STATE_ORDER.map((s) => (
          <MenuItem key={s} selected={!!group && s === rawState} onClick={() => pickState(s)} sx={{ fontSize: 14 }}>
            {EQ_STATE[s].label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
