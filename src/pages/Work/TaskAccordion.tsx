import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { taskSubs, taskTitle, taskLink, mgrColor } from './workMeta'
import SubLine from './SubLine'

export type CardTone = 'green' | 'amber' | 'gray'
const toneOf = (th: Theme, tone: CardTone) =>
  tone === 'amber' ? th.palette.accent.amber : tone === 'gray' ? th.palette.text.secondary : th.palette.accent.green

export interface TaskAccordionProps {
  t: WorkItem
  /** 카드 채움 색 (선택된 KPI 색) */
  tone: CardTone
  /** 선택 여부 — 선택된 카드만 초록 테두리 */
  selected?: boolean
  /** 클릭 시 이 카드를 선택 */
  onSelect?: () => void
}

/**
 * 업무 카드 — 아코디언 없이 항상 내용 표시(정적). 클릭하면 선택(초록 테두리).
 * 채움은 tone 색, 제목 줄(③ 띠) + 담당자 색칩 + 날짜칩. Check 업무는 본문 우측 표시.
 */
export default function TaskAccordion({ t, tone, selected = false, onSelect }: TaskAccordionProps) {
  const subs = taskSubs(t)
  const link = taskLink(t)
  const metas: { label: string; value: string }[] = [
    { label: '부서', value: t.dept },
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`업무: ${taskTitle(t)}`}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      sx={(th) => ({
        bgcolor: alpha(toneOf(th, tone), 0.1),
        border: 1,
        borderColor: selected ? th.palette.accent.green : th.palette.divider,
        boxShadow: selected ? `inset 0 0 0 1px ${th.palette.accent.green}` : 'none',
        borderRadius: 1,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color .15s',
        '&:hover': { borderColor: th.palette.accent.green },
        '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green, boxShadow: (t2: Theme) => `inset 0 0 0 1px ${t2.palette.accent.green}` },
      })}
    >
      {/* 제목 줄 (③ 띠 채움) */}
      <Box
        sx={(th) => ({
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          bgcolor: alpha(toneOf(th, tone), 0.18),
          borderBottom: 1, borderColor: alpha(toneOf(th, tone), 0.3),
        })}
      >
        {t.cat && <StatusChip status="neutral" label={t.cat} />}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        <Box component="span" sx={{ fontSize: 12.5, fontWeight: 700, borderRadius: '8px', px: 1.25, py: 0.4, bgcolor: mgrColor(t.mgr), color: '#fff', whiteSpace: 'nowrap' }}>
          {t.mgr || '미지정'}
        </Box>
        <Box component="span" sx={(th) => ({ fontSize: 12, borderRadius: '8px', px: 1, py: 0.4, color: 'text.secondary', bgcolor: alpha(th.palette.text.secondary, 0.14), border: 1, borderColor: alpha(th.palette.text.secondary, 0.3), fontFamily: 'monospace', whiteSpace: 'nowrap' })}>
          {fmtDate(t.start)}
        </Box>
      </Box>

      {/* 본문 */}
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {metas.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {metas.map((m) => (
                <Typography key={m.label} variant="caption" sx={{ color: 'text.secondary' }}>
                  {m.label} <Box component="span" sx={{ color: 'text.primary' }}>{m.value}</Box>
                </Typography>
              ))}
            </Box>
          )}
          {subs.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {subs.map((l, i) => (
                <SubLine key={i} line={l} />
              ))}
            </Box>
          ) : (
            metas.length === 0 && <Typography variant="body2" sx={{ color: 'text.disabled' }}>상세 내용 없음</Typography>
          )}
          {link && (
            <Box sx={{ mt: 0.25 }}>
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" onClick={(e) => e.stopPropagation()} sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </Box>
        {t.chief && (
          <Box
            sx={(th) => ({
              alignSelf: 'stretch', flexShrink: 0,
              display: 'flex', alignItems: 'center', px: 2,
              color: th.palette.accent.purple, fontWeight: 700, fontSize: 15,
              border: 1, borderColor: alpha(th.palette.accent.purple, 0.5), bgcolor: alpha(th.palette.accent.purple, 0.14),
              borderRadius: '10px',
            })}
          >
            Check
          </Box>
        )}
      </Box>
    </Box>
  )
}
