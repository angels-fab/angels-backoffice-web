import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { AppDrawer, FormField, StatusChip } from '@/components/ds'
import { MILESTONE_STATUSES, type MilestoneRow, type MilestoneStatus } from '@/api/milestones'
import { STATUS_KIND, categoryShort, deriveStatus, isImminent, qFull } from './model'

/**
 * 업무 상세 드로어 — 엑셀 전체 필드(내용·산출물·협조) + 상태·담당자 편집(관리자).
 * 저장 상태는 4종만 선택 가능, 임박·지연은 자동 계산임을 명시.
 */

const fmtStamp = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mb: 0.5 }}>
        {label}
      </Typography>
      {typeof children === 'string' ? (
        <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
          {children || '—'}
        </Typography>
      ) : (
        children
      )}
    </Box>
  )
}

export interface DetailDrawerProps {
  row: MilestoneRow | null
  curIdx: number
  canEdit: boolean
  onClose: () => void
  onChangeStatus: (row: MilestoneRow, status: MilestoneStatus) => void
  onSaveOwner: (row: MilestoneRow, owner: string) => void
}

export default function DetailDrawer({ row, curIdx, canEdit, onClose, onChangeStatus, onSaveOwner }: DetailDrawerProps) {
  const [ownerDraft, setOwnerDraft] = useState('')
  useEffect(() => {
    setOwnerDraft(row?.owner || '')
  }, [row?.id, row?.owner])

  if (!row) return null
  const derived = deriveStatus(row, curIdx)
  const imminent = isImminent(row, curIdx)

  return (
    <AppDrawer open onClose={onClose} title={row.title} subtitle={row.category}>
      {/* 상태 — 4종 선택(저장), 임박·지연은 자동 */}
      <Field label="상태">
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
          {MILESTONE_STATUSES.map((s) => (
            <StatusChip
              key={s}
              status={STATUS_KIND[s]}
              label={s}
              selected={row.status === s}
              onClick={canEdit && s !== row.status ? () => onChangeStatus(row, s) : undefined}
            />
          ))}
          {derived === '지연' && <StatusChip status="error" label="지연" selected />}
          {imminent && <StatusChip status="warning" label="이번 분기 마감" />}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.disabled' }}>
          임박·지연 표시는 완료목표 분기 기준으로 자동 계산됩니다{canEdit ? '' : ' · 상태 변경은 관리자만 가능합니다'}.
        </Typography>
      </Field>

      <Field label="기간(원문 → 정규화 분기)">
        <Typography variant="body2">
          착수 {row.startLabel || '—'} · 완료목표 {row.endLabel || '—'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {qFull(row.startQ)} ~ {qFull(row.endQ)}
          {row.fuzzy && ' · 추정 매핑(원문이 정확한 분기가 아님)'}
        </Typography>
      </Field>

      <Field label="세부 실행내용">{row.content}</Field>
      <Field label="핵심 산출물">{row.deliverable}</Field>
      <Field label="협조">{row.coop}</Field>
      <Field label="분야">{`${categoryShort(row.category)} (${row.category})`}</Field>

      <Field label="담당자">
        {canEdit ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormField
              variant="inline"
              placeholder="담당자 이름"
              value={ownerDraft}
              onChange={setOwnerDraft}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={ownerDraft.trim() === (row.owner || '')}
              onClick={() => onSaveOwner(row, ownerDraft.trim())}
            >
              저장
            </Button>
          </Box>
        ) : (
          row.owner || '미지정'
        )}
      </Field>

      {row.completedAt && <Field label="완료일">{row.completedAt}</Field>}

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {row.updatedBy ? `마지막 변경 ${fmtStamp(row.updatedAt)} · ${row.updatedBy}` : '아직 갱신 이력이 없습니다 (엑셀 이식 상태)'}
      </Typography>
    </AppDrawer>
  )
}
