import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Drawer from '@mui/material/Drawer'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { AppCard, FormField, SelectField, StatusChip } from '@/components/ds'
import { MILESTONE_STATUSES, type MilestoneRow, type MilestoneStatus } from '@/api/milestones'
import { iconSize, layout, radius, typescale } from '@/theme/tokens'
import { STATUS_KIND, TOTAL_QUARTERS, categoryShort, deriveStatus, isImminent, qAt, qFull, qIndex, qShort } from './model'

/**
 * 업무 편집 패널 (v3) — 드로어 폐지 후의 단일 편집 표면.
 * 데스크톱 '전체 업무' 탭에서는 우측 고정 카드로, 관제판·모바일에서는 하단 시트로
 * 같은 본문(MilestonePanelBody)을 쓴다. "해야 할 일 순서"(상태→담당자→기간)로 배치하고
 * 긴 설명·산출물은 접어둔다. [저장 후 다음]으로 62건을 순서대로 정리할 수 있다.
 */

const QUARTER_OPTIONS = Array.from({ length: TOTAL_QUARTERS }, (_, i) => ({ value: qAt(i), label: qFull(qAt(i)) }))

const fmtStamp = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
}

export interface PanelBodyProps {
  row: MilestoneRow
  curIdx: number
  canEdit: boolean
  onChangeStatus: (row: MilestoneRow, status: MilestoneStatus) => void
  onSaveOwner: (row: MilestoneRow, owner: string) => void
  onSaveQuarters: (row: MilestoneRow, startQ: string, endQ: string) => void
  /** [저장 후 다음] — 미저장 담당자·기간을 저장한 뒤 다음 항목 선택 */
  onNext?: () => void
  /** 목록 내 위치(n/전체) — 있으면 푸터에 표시 */
  position?: { idx: number; total: number }
}

export function MilestonePanelBody({ row, curIdx, canEdit, onChangeStatus, onSaveOwner, onSaveQuarters, onNext, position }: PanelBodyProps) {
  const [ownerDraft, setOwnerDraft] = useState('')
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  useEffect(() => {
    setOwnerDraft(row.owner || '')
    setStartDraft(row.startQ)
    setEndDraft(row.endQ)
    setDetailsOpen(false)
  }, [row.id, row.owner, row.startQ, row.endQ])

  const derived = deriveStatus(row, curIdx)
  const imminent = isImminent(row, curIdx)
  const invalidQ = qIndex(startDraft) > qIndex(endDraft)
  const dirtyOwner = ownerDraft.trim() !== (row.owner || '')
  const dirtyQ = !invalidQ && (startDraft !== row.startQ || endDraft !== row.endQ)

  const handleNext = () => {
    if (canEdit) {
      if (dirtyOwner) onSaveOwner(row, ownerDraft.trim())
      if (dirtyQ) onSaveQuarters(row, startDraft, endDraft)
    }
    onNext?.()
  }

  const label = (text: string) => (
    <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mb: 0.5 }}>
      {text}
    </Typography>
  )

  return (
    <Box>
      {/* 제목 + 위치 캡션 */}
      <Typography sx={{ fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight, lineHeight: 1.4 }}>
        {row.title}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mb: 1.5 }}>
        {categoryShort(row.category)} · {qShort(row.startQ)} → {qShort(row.endQ)}{row.fuzzy ? '≈' : ''}
      </Typography>

      {/* 상태 — 4등분 버튼, 임박·지연은 자동 */}
      {label('상태')}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
        {MILESTONE_STATUSES.map((s) => (
          <StatusChip
            key={s}
            status={STATUS_KIND[s]}
            label={s}
            selected={row.status === s}
            onClick={canEdit && s !== row.status ? () => onChangeStatus(row, s) : undefined}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
        {derived === '지연' && <StatusChip status="error" label="지연" selected />}
        {imminent && <StatusChip status="warning" label="이번 분기 마감" />}
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          임박·지연은 완료목표 분기로 자동 표시{canEdit ? '' : ' · 편집은 관리자만'}
        </Typography>
      </Box>

      {/* 담당자 */}
      <Box sx={{ mt: 2 }}>
        {label('담당자')}
        {canEdit ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <FormField variant="inline" placeholder="담당자 이름" value={ownerDraft} onChange={setOwnerDraft} />
            <Button size="small" variant="outlined" disabled={!dirtyOwner} onClick={() => onSaveOwner(row, ownerDraft.trim())}>
              저장
            </Button>
          </Box>
        ) : (
          <Typography variant="body2">{row.owner || '미지정'}</Typography>
        )}
      </Box>

      {/* 기간 */}
      <Box sx={{ mt: 2 }}>
        {label('기간(착수 ~ 완료목표)')}
        {canEdit ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <SelectField
                variant="inline"
                ariaLabel="착수 분기"
                value={startDraft}
                onChange={setStartDraft}
                options={QUARTER_OPTIONS}
                fullWidth={false}
                sx={{ minWidth: 112 }}
              />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>~</Typography>
              <SelectField
                variant="inline"
                ariaLabel="완료목표 분기"
                value={endDraft}
                onChange={setEndDraft}
                options={QUARTER_OPTIONS}
                fullWidth={false}
                sx={{ minWidth: 112 }}
              />
              <Button
                size="small"
                variant="outlined"
                disabled={invalidQ || !dirtyQ}
                onClick={() => onSaveQuarters(row, startDraft, endDraft)}
              >
                저장
              </Button>
            </Box>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: invalidQ ? 'error.main' : 'text.disabled' }}>
              {invalidQ
                ? '착수가 완료목표보다 늦을 수 없습니다.'
                : row.fuzzy
                  ? `원문 "${row.endLabel}"을 추정으로 넣은 시기 — 저장하면 확정됩니다.`
                  : '저장하면 임박·지연 표시가 새 분기 기준으로 계산됩니다.'}
            </Typography>
          </>
        ) : (
          <Typography variant="body2">
            {qFull(row.startQ)} ~ {qFull(row.endQ)}
            {row.fuzzy && ' (추정)'}
          </Typography>
        )}
      </Box>

      {/* 긴 정보는 접어둠 — 패널이 한눈에 들어오게 */}
      <Box
        component="button"
        onClick={() => setDetailsOpen((v) => !v)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, width: '100%',
          mt: 2, py: 0.75, px: 0, border: 'none', borderTop: 1, borderColor: 'divider',
          bgcolor: 'transparent', cursor: 'pointer', color: 'primary.main',
          fontFamily: 'inherit', fontSize: typescale.small.size,
        }}
      >
        <ExpandMoreIcon
          sx={{ fontSize: iconSize.body, transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
        세부 내용·핵심 산출물 {detailsOpen ? '접기' : '보기'}
      </Box>
      <Collapse in={detailsOpen}>
        <Box sx={{ pt: 1 }}>
          {label('세부 실행내용')}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1.5 }}>{row.content || '—'}</Typography>
          {label('핵심 산출물')}
          <Typography variant="body2" sx={{ mb: 1.5 }}>{row.deliverable || '—'}</Typography>
          {label('협조')}
          <Typography variant="body2" sx={{ mb: 1.5 }}>{row.coop || '—'}</Typography>
          {label('원문 일정(엑셀)')}
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            착수 {row.startLabel || '—'} · 완료목표 {row.endLabel || '—'}
          </Typography>
          {row.completedAt && (
            <>
              {label('완료일')}
              <Typography variant="body2" sx={{ mb: 1.5 }}>{row.completedAt}</Typography>
            </>
          )}
        </Box>
      </Collapse>

      {/* 푸터 — 순서대로 정리하는 흐름 */}
      {onNext && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Button variant="contained" fullWidth endIcon={<ArrowForwardIcon />} onClick={handleNext}>
            {canEdit && (dirtyOwner || dirtyQ) ? '저장 후 다음' : '다음 항목'}
          </Button>
          {position && (
            <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
              {position.idx} / {position.total}
            </Typography>
          )}
        </Box>
      )}

      <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'text.disabled' }}>
        {row.updatedBy ? `마지막 변경 ${fmtStamp(row.updatedAt)} · ${row.updatedBy}` : '아직 갱신 이력 없음 (엑셀 이식 상태)'}
      </Typography>
    </Box>
  )
}

/** 데스크톱 우측 고정 패널 — 목록 스크롤에도 화면에 상주 */
export function DesktopDetailPanel(props: PanelBodyProps) {
  return (
    <Box sx={{ position: 'sticky', top: 64, maxHeight: 'calc(100vh - 88px)', overflowY: 'auto' }}>
      <AppCard>
        <MilestonePanelBody {...props} />
      </AppCard>
    </Box>
  )
}

/** 하단 시트 — 관제판·모바일에서 항목을 살짝 열어보는 용도(화면 이동 없음) */
export function DetailSheet({ open, onClose, ...body }: { open: boolean; onClose: () => void } & PanelBodyProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            height: '78%',
            borderTopLeftRadius: `${radius.modal}px`,
            borderTopRightRadius: `${radius.modal}px`,
            bgcolor: 'background.paper',
            p: `${layout.cardPadding}px`,
            overflowY: 'auto',
          },
        },
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: `${radius.pill}px`, bgcolor: 'divider', mx: 'auto', mb: 1.5 }} />
      <MilestonePanelBody {...body} />
    </Drawer>
  )
}
