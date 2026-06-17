import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskSubs, taskTitle, taskLink } from './workMeta'
import SubLine from './SubLine'

export interface TaskAccordionProps {
  t: WorkItem
  /** 상세 Drawer 열기(전체 보기·수정·삭제) */
  onPick: (t: WorkItem) => void
  /** 초기 펼침 여부 — 진행중=true(회의 뷰), 완료/Check=false */
  defaultExpanded?: boolean
  /** Check 강조 — 진행중 뷰에서 Check 업무일 때 보라 테두리 */
  highlight?: boolean
}

/**
 * 진행중 업무 아코디언 — 회의 뷰용. 기본 펼침(개별 접기 가능).
 * 펼치면 메타(부서/예정/장소/완료) + 업무 내용을 한눈에 보여준다.
 */
export default function TaskAccordion({ t, onPick, defaultExpanded = true, highlight = false }: TaskAccordionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const st = W_STATUS[classify(t)]
  const subs = taskSubs(t)
  const link = taskLink(t)
  // 장소/시간은 taskSubs 본문 끝줄이 담당 → 메타 중복 방지로 여기서 제외
  const metas: { label: string; value: string }[] = [
    { label: '부서', value: t.dept },
    { label: '예정', value: t.plan ? fmtDate(t.plan) : '' },
    { label: '완료', value: t.end ? fmtDate(t.end) : '' },
  ].filter((m) => (m.value || '').trim())

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, v) => setExpanded(v)}
      disableGutters
      sx={(theme) => ({
        bgcolor: 'background.elevated',
        border: highlight ? 2 : 1,
        borderColor: highlight ? theme.palette.accent.purple : theme.palette.divider,
        borderRadius: 1,
        boxShadow: 'none',
        '&:before': { display: 'none' },
      })}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{ '& .MuiAccordionSummary-content': { display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', my: 1, minWidth: 0 } }}
      >
        <StatusChip status={st.status} label={st.label} />
        {t.cat && <StatusChip status="neutral" label={t.cat} />}
        {t.chief && <StatusChip status="purple" label="Check" />}
        <Typography variant="body1" sx={{ flex: 1, minWidth: 120, fontWeight: 600, wordBreak: 'break-word' }}>{taskTitle(t)}</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t.mgr || '미지정'}</Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>{fmtDate(t.start)}</Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
            <IconButton size="small" aria-label="상세 보기" onClick={() => onPick(t)} sx={{ color: 'text.secondary' }}>
              <InfoOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
            {link && (
              <IconButton component="a" href={link} target="_blank" rel="noopener noreferrer" size="small" aria-label="관련 자료" sx={{ color: 'text.secondary' }}>
                <OpenInNewIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
