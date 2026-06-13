import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard, StatusChip } from '@/components/ds'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskTitle } from './workMeta'

export interface TaskCardProps {
  t: WorkItem
  /** 우측 하단 보조 텍스트(예: 발의 06/10, 마감 06/20) */
  right?: string
  onPick: (t: WorkItem) => void
}

/** 업무 카드 — 긴급/이번주 마감 섹션용. 클릭 시 상세 Drawer. */
export default function TaskCard({ t, right, onPick }: TaskCardProps) {
  const st = W_STATUS[classify(t)]
  return (
    <AppCard interactive onClick={() => onPick(t)} padding={16}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <StatusChip status={st.status} label={st.label} />
          {t.chief && <StatusChip status="purple" label="센터장" />}
          {classify(t) !== 'remind' && t.remind && <StatusChip status="warning" label="Remind" />}
          {t.cat && <StatusChip status="neutral" label={t.cat} />}
        </Box>
        <Typography
          variant="subtitle1"
          sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {taskTitle(t)}
        </Typography>
        <Box sx={{ mt: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pt: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.mgr || '미지정'}</Typography>
          {right && <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{right}</Typography>}
        </Box>
      </Box>
    </AppCard>
  )
}
