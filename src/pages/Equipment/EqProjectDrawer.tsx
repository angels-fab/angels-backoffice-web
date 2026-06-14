import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppDrawer, StatusChip } from '@/components/ds'
import type { EqGroup, TlMonth } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip } from './stageMeta'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 80, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 0 }}>{value || '-'}</Typography>
    </Box>
  )
}

const k = (v: number) => Math.round(v / 1000).toLocaleString()

export interface EqProjectDrawerProps {
  group: EqGroup | null
  months: TlMonth[]
  todayHalf: number
  onClose: () => void
}

/** 장비 도입 상세 — 현재 단계·단계 진행·총소요기간·도입예정월·도입금액. */
export default function EqProjectDrawer({ group, months, todayHalf, onClose }: EqProjectDrawerProps) {
  const info = group ? groupStage(group.timeline, months, todayHalf) : null
  const chip = info ? phaseChip(info) : null
  const curOrder = info?.code ? STAGE_ORDER.indexOf(info.code) : -1

  return (
    <AppDrawer
      open={!!group}
      onClose={onClose}
      title={group?.name ?? ''}
      subtitle={group ? `${group.cat || '장비'}${group.count > 1 ? ` · ${group.count}대` : ''}` : ''}
      width={480}
    >
      {group && info && chip && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={chip.status} label={chip.label} />
          </Box>

          {/* 단계 진행 */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>도입 단계</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {STAGE_ORDER.map((sc, i) => {
                // 실제 도달 단계까지만 강조(완료여도 현재/최종 단계 인덱스 기준)
                const reached = curOrder >= 0 && i <= curOrder
                return <StatusChip key={sc} status={reached ? STAGE[sc].status : 'neutral'} label={STAGE[sc].label} />
              })}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="담당자" value={group.mgr} />
            <MetaRow label="도입 예정월" value={info.dueMonth} />
            <MetaRow label="총 소요기간" value={info.durationMonths ? `${info.durationMonths}개월` : '-'} />
            <MetaRow label="도입금액" value={group.price ? `${k(group.price)} 천원` : '-'} />
            <MetaRow label="관리번호" value={group.codes.filter(Boolean).join(', ')} />
          </Box>
        </Box>
      )}
    </AppDrawer>
  )
}
