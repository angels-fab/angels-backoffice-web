import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import PushPinIcon from '@mui/icons-material/PushPin'
import { alpha } from '@mui/material/styles'
import { AppCard, StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskTitle, mgrColor } from './workMeta'

export interface TaskCardProps {
  t: WorkItem
  onPick: (t: WorkItem) => void
  /** 선택 여부 — 선택된 카드만 앰버 테두리 */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
}

/**
 * Remind 카드 — 채움은 앰버 톤(항상), 테두리는 선택 시에만 앰버.
 * 압정 · 상태 · 구분 · 담당자 색칩 · 날짜. 클릭 시 선택 + 상세 Drawer.
 */
export default function TaskCard({ t, onPick, selected = false, onSelect }: TaskCardProps) {
  const st = W_STATUS[classify(t)]
  return (
    <AppCard
      interactive
      onClick={() => { onSelect?.(); onPick(t) }}
      padding={16}
      sx={(th) => ({
        bgcolor: alpha(th.palette.accent.amber, 0.1),
        borderColor: selected ? th.palette.accent.amber : th.palette.divider,
        '&:hover': { borderColor: th.palette.accent.amber, bgcolor: alpha(th.palette.accent.amber, selected ? 0.16 : 0.14) },
      })}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, height: '100%' }}>
        {/* 최상단: 압정 · 상태 · 구분 · 담당자 색칩 · 날짜 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <PushPinIcon sx={{ fontSize: 16, color: 'warning.main', flexShrink: 0 }} />
          <StatusChip status={st.status} label={st.label} />
          {t.cat && <StatusChip status="neutral" label={t.cat} />}
          <Box component="span" sx={{ ml: 'auto', fontSize: 12, fontWeight: 700, borderRadius: '8px', px: 1, py: 0.3, bgcolor: mgrColor(t.mgr), color: '#fff', whiteSpace: 'nowrap' }}>
            {t.mgr || '미지정'}
          </Box>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(t.start)}</Typography>
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
