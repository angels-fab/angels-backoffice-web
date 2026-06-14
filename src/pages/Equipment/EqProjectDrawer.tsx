import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { AppDrawer, StatusChip } from '@/components/ds'
import type { ScheduleItem, TlMonth } from '@/types'
import { STAGE, STAGE_ORDER, groupStage, phaseChip } from './stageMeta'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 80, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Box>
  )
}

const k = (v: number) => Math.round(v / 1000).toLocaleString()

export interface EqProjectDrawerProps {
  item: ScheduleItem | null
  months: TlMonth[]
  todayHalf: number
  onClose: () => void
  /** 관리자 모드 — 수정/삭제 액션 노출 */
  isAdmin?: boolean
  onEdit?: (item: ScheduleItem) => void
  onDelete?: (item: ScheduleItem) => void
}

/** 장비 도입 상세 — 현재 단계·단계 진행·총소요기간·도입예정월·도입금액. 관리자면 수정/삭제. */
export default function EqProjectDrawer({ item, months, todayHalf, onClose, isAdmin, onEdit, onDelete }: EqProjectDrawerProps) {
  const info = item ? groupStage(item.timeline, months, todayHalf) : null
  const chip = info ? phaseChip(info) : null
  const curOrder = info?.code ? STAGE_ORDER.indexOf(info.code) : -1

  return (
    <AppDrawer
      open={!!item}
      onClose={onClose}
      title={item?.name ?? ''}
      subtitle={item ? `${item.cat || '장비'}${item.code ? ` · ${item.code}` : ''}` : ''}
      width={480}
      footer={
        item && isAdmin ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Button color="error" variant="text" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete?.(item)}>
              삭제
            </Button>
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => onEdit?.(item)}>
              수정
            </Button>
          </Box>
        ) : undefined
      }
    >
      {item && info && chip && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={chip.status} label={chip.label} />
            {item.status && <StatusChip status="neutral" label={item.status} />}
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

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="담당자" value={item.mgr} />
            <MetaRow label="진행상태" value={item.status} />
            <MetaRow label="시작년월" value={item.start} />
            <MetaRow label="도입 예정월" value={info.dueMonth} />
            <MetaRow label="총 소요기간" value={info.durationMonths ? `${info.durationMonths}개월` : '-'} />
            <MetaRow label="구분" value={item.cat} />
            <MetaRow label="도입방법" value={item.method} />
            <MetaRow label="도입금액" value={item.price ? `${k(item.price)} 천원` : '-'} />
            <MetaRow label="관리번호" value={item.code} />
          </Box>
        </Box>
      )}
    </AppDrawer>
  )
}
