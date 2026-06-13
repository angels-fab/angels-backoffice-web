import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppDrawer, StatusChip } from '@/components/ds'
import type { EqGroup } from '@/types'
import { EQ_STATE, eqStateKey } from './eqMeta'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 76, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 0, whiteSpace: 'pre-wrap' }}>{value || '-'}</Typography>
    </Box>
  )
}

const k = (v: number) => Math.round(v / 1000).toLocaleString()

export interface EqDetailDrawerProps {
  group: EqGroup | null
  onClose: () => void
}

/** 장비 상세 Drawer — 장비명·관리번호·종류·상태·도입금액·담당자·설치위치·비고. */
export default function EqDetailDrawer({ group, onClose }: EqDetailDrawerProps) {
  const meta = group ? EQ_STATE[eqStateKey(group.state)] : null
  return (
    <AppDrawer
      open={!!group}
      onClose={onClose}
      title={group?.name ?? ''}
      subtitle={group ? `${group.cat || '장비'}${group.count > 1 ? ` · ${group.count}대` : ''}` : ''}
      width={480}
    >
      {group && meta && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={meta.status} label={meta.label} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="관리번호" value={group.codes.filter(Boolean).join(', ')} />
            <MetaRow label="장비종류" value={group.type} />
            <MetaRow label="도입금액" value={group.price ? `${k(group.price)} 천원` : '-'} />
            <MetaRow label="담당자" value={group.mgr} />
            <MetaRow label="설치위치" value={group.installLoc} />
            <MetaRow label="비고" value={group.note} />
          </Box>
        </Box>
      )}
    </AppDrawer>
  )
}
