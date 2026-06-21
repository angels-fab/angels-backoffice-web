import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import PushPinIcon from '@mui/icons-material/PushPin'
import { alpha } from '@mui/material/styles'
import { AppCard, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { normCat } from '@/utils/workCat'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskTitle, mgrColor } from './workMeta'

// 업무구분 → 칩 색(캡처 기준): 설계적정성=초록·예산=빨강·인사=노랑·행정=파랑·장비=회색·교육세미나=보라
const CAT_KIND: { key: string; kind: StatusKind }[] = [
  { key: '설계적정성', kind: 'success' },
  { key: '예산', kind: 'error' },
  { key: '인사', kind: 'warning' },
  { key: '행정', kind: 'info' },
  { key: '장비', kind: 'neutral' },
  { key: '교육세미나', kind: 'purple' },
]
function catKind(cat?: string): StatusKind {
  const n = normCat(cat || '')
  const m = CAT_KIND.find((c) => n.startsWith(normCat(c.key)))
  return m ? m.kind : 'neutral'
}

export interface TaskCardProps {
  t: WorkItem
  onPick: (t: WorkItem) => void
  /** 선택 여부 — 선택된 카드만 앰버 테두리 */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
  /** 컴팩트(한 줄): 압정+제목+담당자만. Remind 인라인 펼침용(상태칩·구분칩·날짜 생략). */
  compact?: boolean
}

/**
 * Remind 카드 — 채움은 앰버 톤(항상), 테두리는 선택 시에만 앰버.
 * 압정 · 상태 · 구분 · 담당자 색칩 · 날짜. 클릭 시 선택 + 상세 Drawer.
 */
export default function TaskCard({ t, onPick, selected = false, onSelect, compact = false }: TaskCardProps) {
  const st = W_STATUS[classify(t)]
  if (compact) {
    return (
      <AppCard
        interactive
        onClick={() => onPick(t)}
        padding={6}
        sx={(th) => ({
          bgcolor: 'transparent',
          borderColor: 'transparent',
          '&:hover': { bgcolor: alpha(th.palette.accent.amber, 0.12) },
        })}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <PushPinIcon sx={{ fontSize: 15, color: 'warning.main', flexShrink: 0 }} />
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{taskTitle(t)}</Typography>
          <Box sx={{ flexShrink: 0 }}><StatusChip status={catKind(t.cat)} label={t.cat || '미분류'} /></Box>
        </Box>
      </AppCard>
    )
  }
  return (
    <AppCard
      interactive
      onClick={() => { onSelect?.(); onPick(t) }}
      padding={16}
      sx={(th) => ({
        bgcolor: alpha(th.palette.accent.amber, selected ? 0.22 : 0.1),
        borderColor: selected ? th.palette.accent.green : th.palette.divider,
        boxShadow: selected ? `inset 0 0 0 1px ${th.palette.accent.green}` : 'none',
        '&:hover': { borderColor: th.palette.accent.green, bgcolor: alpha(th.palette.accent.amber, 0.14) },
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
