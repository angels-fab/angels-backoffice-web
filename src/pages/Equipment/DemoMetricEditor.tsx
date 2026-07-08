import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import {
  createMetricDef, updateMetricDef, setMetricDefActive, fetchMetricDefHistory, fetchValueHistory, METRIC_ACTION_LABEL,
  type DemoMetricDef, type MetricDirection, type MetricDefHistory, type ValueHistory,
} from '@/api/demo'

const DIR_LABEL: Record<MetricDirection, string> = { higher: '높을수록 우수', lower: '낮을수록 우수', none: '비교 안 함' }
const field = (th: Theme) => ({ bgcolor: alpha(th.palette.text.primary, 0.05), border: `1px solid ${th.palette.divider}`, borderRadius: '6px', px: 1, py: '5px', fontSize: 12.5, color: 'text.primary' })
const fmtTs = (iso: string) => { try { return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return iso.slice(0, 16) } }

function DirSelect({ value, onChange }: { value: MetricDirection; onChange: (v: MetricDirection) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as MetricDirection)} variant="standard" disableUnderline
      sx={(th) => ({ ...field(th), minWidth: 118, '& .MuiSelect-select': { p: 0, pr: '20px !important' } })}
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}>
      {(['higher', 'lower', 'none'] as MetricDirection[]).map((d) => <MenuItem key={d} value={d} sx={{ fontSize: 12.5 }}>{DIR_LABEL[d]}</MenuItem>)}
    </Select>
  )
}

/**
 * 지표 관리(팀원+) — 장비종류별 표준 지표 추가/수정/비활성. 모든 변경은 이력에 자동 기록.
 * 라벨과 별개의 안정 key를 써서 라벨을 바꿔도 기존 값(비교)이 어긋나지 않는다.
 */
export function MetricEditorDialog({ open, equipment, defs, author, onClose, onChanged, onError }: {
  open: boolean; equipment: string; defs: DemoMetricDef[]; author: string | null
  onClose: () => void; onChanged: () => void; onError: (msg: string) => void
}) {
  const eqDefs = defs.filter((d) => d.equipment === equipment).sort((a, b) => (a.active === b.active ? a.sort - b.sort : a.active ? -1 : 1))
  const [busy, setBusy] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [ef, setEf] = useState({ label: '', unit: '', direction: 'higher' as MetricDirection, sort: 0 })
  const [af, setAf] = useState({ label: '', unit: '', direction: 'higher' as MetricDirection })

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); onChanged() } catch (e) { onError(e instanceof Error ? e.message : '처리 실패') } finally { setBusy(false) } }
  const startEdit = (d: DemoMetricDef) => { setEditId(d.id); setEf({ label: d.label, unit: d.unit, direction: d.direction, sort: d.sort }) }
  const saveEdit = () => { if (editId == null || !ef.label.trim() || !author) return; void run(async () => { await updateMetricDef(editId, { label: ef.label.trim(), unit: ef.unit.trim(), direction: ef.direction, sort: Number(ef.sort) || 0 }, author); setEditId(null) }) }
  const toggle = (d: DemoMetricDef) => { if (!author) return; void run(() => setMetricDefActive(d.id, !d.active, author)) }
  const add = () => {
    if (!af.label.trim() || !author) return
    const key = `k_${crypto.randomUUID().slice(0, 8)}`
    const maxSort = eqDefs.reduce((m, d) => Math.max(m, d.sort), 0)
    void run(async () => { await createMetricDef({ equipment, key, label: af.label.trim(), unit: af.unit.trim(), direction: af.direction, sort: maxSort + 1 }, author); setAf({ label: '', unit: '', direction: 'higher' }) })
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>지표 관리 · {equipment}</DialogTitle>
      <DialogContent>
        <Box sx={{ fontSize: 11.5, color: 'text.secondary', mb: 1.5 }}>표준 지표는 이 장비의 모든 제조사 비교 기준입니다. 바꾸면 비교표가 함께 바뀌고, <b>변경 이력이 자동 기록</b>됩니다.</Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {eqDefs.map((d) => {
            const editing = editId === d.id
            return (
              <Box key={d.id} sx={(th) => ({ display: 'flex', alignItems: 'center', gap: 0.75, p: 0.75, borderRadius: '8px', border: `1px solid ${th.palette.divider}`, bgcolor: d.active ? 'background.paper' : alpha(th.palette.text.primary, 0.03), opacity: d.active ? 1 : 0.6 })}>
                {editing ? (
                  <>
                    <InputBase value={ef.label} onChange={(e) => setEf((s) => ({ ...s, label: e.target.value }))} placeholder="지표명" sx={(th) => ({ ...field(th), flex: 1 })} />
                    <InputBase value={ef.unit} onChange={(e) => setEf((s) => ({ ...s, unit: e.target.value }))} placeholder="단위" sx={(th) => ({ ...field(th), width: 74 })} />
                    <DirSelect value={ef.direction} onChange={(v) => setEf((s) => ({ ...s, direction: v }))} />
                    <Tooltip title="저장"><span><IconButton size="small" color="success" disabled={busy || !ef.label.trim()} onClick={saveEdit}><CheckIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
                    <Tooltip title="취소"><IconButton size="small" onClick={() => setEditId(null)} sx={{ color: 'text.secondary' }}><CloseIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                  </>
                ) : (
                  <>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ fontSize: 13, fontWeight: 600 }}>{d.label}{d.unit ? <Box component="span" sx={{ color: 'text.disabled', ml: 0.5, fontSize: 11 }}>{d.unit}</Box> : null}{!d.active && <Box component="span" sx={{ ml: 0.75, fontSize: 10.5, color: 'text.disabled' }}>(비활성)</Box>}</Box>
                      <Box sx={{ fontSize: 10.5, color: 'text.disabled' }}>{DIR_LABEL[d.direction]}</Box>
                    </Box>
                    <Tooltip title="수정"><span><IconButton size="small" disabled={busy} onClick={() => startEdit(d)} sx={{ color: 'text.secondary' }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
                    <Tooltip title={d.active ? '비활성(비교에서 숨김)' : '재활성'}><span><IconButton size="small" disabled={busy} onClick={() => toggle(d)} sx={{ color: 'text.secondary' }}>{d.active ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}</IconButton></span></Tooltip>
                  </>
                )}
              </Box>
            )
          })}
          {eqDefs.length === 0 && <Box sx={{ fontSize: 12, color: 'text.disabled', py: 1 }}>아직 지표가 없습니다. 아래에서 추가하세요.</Box>}
        </Box>

        {/* 지표 추가 */}
        <Box sx={(th) => ({ mt: 1.5, pt: 1.5, borderTop: `1px solid ${th.palette.divider}`, display: 'flex', alignItems: 'center', gap: 0.75 })}>
          <InputBase value={af.label} onChange={(e) => setAf((s) => ({ ...s, label: e.target.value }))} placeholder="새 지표명" sx={(th) => ({ ...field(th), flex: 1 })} />
          <InputBase value={af.unit} onChange={(e) => setAf((s) => ({ ...s, unit: e.target.value }))} placeholder="단위" sx={(th) => ({ ...field(th), width: 74 })} />
          <DirSelect value={af.direction} onChange={(v) => setAf((s) => ({ ...s, direction: v }))} />
          <Button size="small" variant="contained" startIcon={busy ? <CircularProgress size={13} thickness={5} color="inherit" /> : <AddIcon sx={{ fontSize: 16 }} />} disabled={busy || !af.label.trim()} onClick={add} sx={{ whiteSpace: 'nowrap' }}>추가</Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// 변경 상세(before→after) 요약
function diffText(h: MetricDefHistory): string {
  if (h.action === 'create') return '신설'
  if (h.action === 'deactivate') return '비교에서 숨김(비활성)'
  if (h.action === 'reactivate') return '다시 사용(재활성)'
  const b = h.before || {}, a = h.after || {}
  const parts: string[] = []
  const keys: [string, string][] = [['label', '지표명'], ['unit', '단위'], ['sort', '순서']]
  for (const [k, ko] of keys) if (String(b[k] ?? '') !== String(a[k] ?? '')) parts.push(`${ko} ${b[k] ?? '-'}→${a[k] ?? '-'}`)
  if (String(b.direction ?? '') !== String(a.direction ?? '')) parts.push(`방향 ${DIR_LABEL[b.direction as MetricDirection] ?? '-'}→${DIR_LABEL[a.direction as MetricDirection] ?? '-'}`)
  return parts.length ? parts.join(' · ') : '변경'
}

/** 지표 변경 이력 — 누가·언제·무엇을→무엇으로. 나중에 문제 생겼을 때 추적용. */
export function MetricHistoryDialog({ open, equipment, onClose }: { open: boolean; equipment: string; onClose: () => void }) {
  const [rows, setRows] = useState<MetricDefHistory[] | null>(null)
  useEffect(() => {
    if (!open) return
    setRows(null)
    fetchMetricDefHistory(equipment).then(setRows).catch(() => setRows([]))
  }, [open, equipment])
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>지표 변경 이력 · {equipment}</DialogTitle>
      <DialogContent>
        {rows === null ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12.5 }}>불러오는 중…</Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12.5 }}>변경 이력이 없습니다.</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pb: 1 }}>
            {rows.map((h) => {
              const label = (h.after?.label as string) || (h.before?.label as string) || h.metricKey
              return (
                <Box key={h.id} sx={(th) => ({ display: 'flex', gap: 1, p: 0.9, borderRadius: '8px', border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper' })}>
                  <Box component="span" sx={(th) => ({ flex: 'none', alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 700, px: '7px', py: '2px', borderRadius: '999px', bgcolor: alpha(th.palette.primary.main, 0.12), color: 'primary.main' })}>{METRIC_ACTION_LABEL[h.action] ?? h.action}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontSize: 12.5, fontWeight: 600 }}>{label}</Box>
                    <Box sx={{ fontSize: 11.5, color: 'text.secondary' }}>{diffText(h)}</Box>
                  </Box>
                  <Box sx={{ flex: 'none', textAlign: 'right', color: 'text.disabled', fontSize: 10.5 }}>
                    <Box>{h.changedBy || '-'}</Box><Box>{fmtTs(h.changedAt)}</Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** 지표 '값' 변경 이력(조작방지) — 제조사·회차별 값 before→after. defs로 라벨 표시. */
export function ValueHistoryDialog({ open, equipment, defs, onClose }: { open: boolean; equipment: string; defs: DemoMetricDef[]; onClose: () => void }) {
  const [rows, setRows] = useState<ValueHistory[] | null>(null)
  useEffect(() => { if (!open) return; setRows(null); fetchValueHistory(equipment).then(setRows).catch(() => setRows([])) }, [open, equipment])
  const labelOf = (key: string) => defs.find((d) => d.equipment === equipment && d.key === key)?.label || key
  const diffs = (h: ValueHistory) => {
    const b = h.before || {}, a = h.after || {}
    const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]))
    return keys.filter((k) => String(b[k] ?? '') !== String(a[k] ?? '')).map((k) => `${labelOf(k)} ${b[k] ?? '-'}→${a[k] ?? '-'}`)
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>지표값 변경 이력 · {equipment}</DialogTitle>
      <DialogContent>
        {rows === null ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12.5 }}>불러오는 중…</Box>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12.5 }}>값 변경 이력이 없습니다.</Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, pb: 1 }}>
            {rows.map((h) => {
              const ds = diffs(h)
              return (
                <Box key={h.id} sx={(th) => ({ display: 'flex', gap: 1, p: 0.9, borderRadius: '8px', border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper' })}>
                  <Box component="span" sx={(th) => ({ flex: 'none', alignSelf: 'flex-start', fontSize: 10.5, fontWeight: 700, px: '7px', py: '2px', borderRadius: '999px', bgcolor: alpha(th.palette.warning.main, 0.14), color: 'warning.main' })}>{h.maker} {h.round}차</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ fontSize: 12, color: 'text.primary' }}>{ds.length ? ds.join(' · ') : '변경'}</Box>
                  </Box>
                  <Box sx={{ flex: 'none', textAlign: 'right', color: 'text.disabled', fontSize: 10.5 }}>
                    <Box>{h.changedBy || '-'}</Box><Box>{fmtTs(h.changedAt)}</Box>
                  </Box>
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
