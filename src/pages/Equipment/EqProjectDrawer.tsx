import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { AppDrawer, StatusChip } from '@/components/ds'
import { radius, typescale } from '@/theme/tokens'
import type { EqGroup } from '@/types'
import { STAGE, STAGE_ORDER, phaseChip, type StageInfo } from './stageMeta'
import { codeRange, isRegRequired } from './batchUtil'

function MetaRow({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 80, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: missing ? 'warning.main' : 'text.primary', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Box>
  )
}

const k = (v: number) => Math.round(v / 1000).toLocaleString()
const MISSING = '미등록'

export interface EqProjectDrawerProps {
  group: EqGroup | null
  info: StageInfo | null
  onClose: () => void
  /** 관리자 모드 — 수정/삭제 액션 노출 */
  isAdmin?: boolean
  onEdit?: (group: EqGroup) => void
  onDelete?: (group: EqGroup) => void
}

/** 장비 도입 상세(도입배치) — 수량·관리번호 범위·총금액·단계·예정월. 관리자면 수정(대표)/삭제(배치 전체). */
export default function EqProjectDrawer({ group, info, onClose, isAdmin, onEdit, onDelete }: EqProjectDrawerProps) {
  const chip = info ? phaseChip(info) : null
  const curOrder = info?.code ? STAGE_ORDER.indexOf(info.code) : -1
  // 지연: 완료 전인데 예정월(dueMonth 'YYYY.M')이 현재월보다 과거
  const late = (() => {
    if (!info || info.phase === 'done') return false
    const m = info.dueMonth.match(/^(\d{4})\.(\d{1,2})/)
    if (!m) return false
    const now = new Date()
    return +m[1] * 12 + +m[2] < now.getFullYear() * 12 + now.getMonth() + 1
  })()
  // 도입예정 등은 등록정보가 아직 미요구 — 누락/황색 표기 안 함(장비운영 누락규칙과 동일)
  const regRequired = isRegRequired(group?.state)
  const reg: { label: string; value: string }[] = group
    ? [
        { label: '제조사', value: group.maker },
        { label: '모델명', value: group.model },
        { label: '설치장소', value: group.installLoc },
        { label: 'NFEC', value: group.nfec },
      ]
    : []
  const missingCount = regRequired ? reg.filter((r) => !r.value).length : 0

  return (
    <AppDrawer
      open={!!group}
      onClose={onClose}
      title={group?.name ?? ''}
      subtitle={group ? `${group.count}대 · ${codeRange(group)} · ${group.cat || '장비'} · ${group.type || '-'}` : ''}
      width={480}
      footer={
        group && isAdmin ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Button color="error" variant="text" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete?.(group)}>
              삭제{group.count > 1 ? ` (${group.count}대)` : ''}
            </Button>
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => onEdit?.(group)}>
              수정
            </Button>
          </Box>
        ) : undefined
      }
    >
      {group && info && chip && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={chip.status} label={chip.label} />
            {group.type && <StatusChip status="neutral" label={group.type} />}
          </Box>

          {/* 다음 조치 안내 박스 */}
          <Box
            sx={{
              p: 1.5, borderRadius: `${radius.card}px`, border: 1,
              borderColor: late ? 'error.main' : 'warning.main',
              bgcolor: (t) => (late ? t.palette.error.main : t.palette.warning.main) + '1f',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight, color: late ? 'error.main' : 'warning.main', mb: 0.25 }}>
              {late ? '지연 · 일정 재조정 필요' : info.phase === 'upcoming' ? '다음 조치 · 도입 일정 확인' : info.phase === 'done' ? '도입 완료' : `진행 단계 · ${chip.label}`}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              담당자 {group.mgr || '미지정'}{info.dueMonth ? ` · ${info.dueMonth} 예정` : ''}
            </Typography>
          </Box>

          {/* 단계 진행 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>도입 단계</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {STAGE_ORDER.map((sc, i) => {
                const reached = curOrder >= 0 && i <= curOrder
                return <StatusChip key={sc} status={reached ? STAGE[sc].status : 'neutral'} label={STAGE[sc].label} />
              })}
            </Box>
          </Box>

          {/* 핵심 정보 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="담당자" value={group.mgr} />
            <MetaRow label="도입 수량" value={`${group.count}대`} />
            <MetaRow label="현재 단계" value={chip.label} />
            <MetaRow label="관리번호" value={group.codes.join(', ')} />
            {group.variantNames.length > 0 && <MetaRow label="세부 구성" value={group.variantNames.join(', ')} />}
            <MetaRow label="총 도입금액" value={group.price ? `${k(group.price)} 천원` : '-'} />
            <MetaRow label="예정 시점" value={info.dueMonth} />
            <MetaRow label="도입방법" value={group.bid} />
          </Box>

          {/* 등록 정보 — 필수 상태(도입중·운영중·비가동)에서만 미등록=황색/누락 표기. 도입예정은 일반 표기. */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              등록 정보{missingCount > 0 ? ` · 누락 ${missingCount}` : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {reg.map((r) => (
                <MetaRow key={r.label} label={r.label} value={r.value || MISSING} missing={regRequired && !r.value} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </AppDrawer>
  )
}
