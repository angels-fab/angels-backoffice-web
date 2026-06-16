import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import PushPinIcon from '@mui/icons-material/PushPin'
import { AppCard, StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskTitle } from './workMeta'

export interface TaskCardProps {
  t: WorkItem
  onPick: (t: WorkItem) => void
}

/**
 * Remind 카드 — 최상단 행: 압정(고정 표시) · 업무상태 · 업무구분 · 담당자 · 날짜(년-월-일).
 * 클릭 시 상세 Drawer.
 */
export default function TaskCard({ t, onPick }: TaskCardProps) {
  const st = W_STATUS[classify(t)]
  return (
    <AppCard interactive onClick={() => onPick(t)} padding={16}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
        {/* 최상단: 압정 · 업무상태 · 업무구분 · 담당자 · 날짜 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <PushPinIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
          <StatusChip status={st.status} label={st.label} />
          {t.cat && <StatusChip status="neutral" label={t.cat} />}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.mgr || '미지정'}</Typography>
          <Typography variant="caption" sx={{ ml: 'auto', color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(t.start)}</Typography>
        </Box>
        <Typography
          variant="subtitle1"
          sx={{ lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {taskTitle(t)}
        </Typography>
      </Box>
    </AppCard>
  )
}
