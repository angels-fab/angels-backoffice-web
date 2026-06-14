import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { AppDrawer, StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskSubs, taskTitle, taskLink } from './workMeta'

/** 내용 한 줄 → 기호/본문 분리(들여쓰기 보존) */
function SubLine({ line }: { line: string }) {
  const lead = line.match(/^[ \t]*/)?.[0] || ''
  const indentPx = lead.replace(/\t/g, '    ').length * 4
  const body = line.slice(lead.length)
  const m = body.match(/^([-–—•*▪◦·●○]|[①-⑳]|\d+[.)]|[가-힣][.)])\s*([\s\S]*)$/)
  return (
    <Box sx={{ display: 'flex', gap: 0.75, ml: `${indentPx}px`, py: 0.25 }}>
      {m ? (
        <>
          <Typography variant="body2" component="span" sx={{ flexShrink: 0, color: 'text.disabled' }}>{m[1]}</Typography>
          <Typography variant="body2" component="span">{m[2]}</Typography>
        </>
      ) : (
        <Typography variant="body2" component="span">{body}</Typography>
      )}
    </Box>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 64, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary' }}>{value || '-'}</Typography>
    </Box>
  )
}

export interface TaskDetailDrawerProps {
  task: WorkItem | null
  onClose: () => void
}

/** 업무 상세 Drawer — 제목·상태·담당자·발의/완료일·업무내용. */
export default function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  const st = task ? W_STATUS[classify(task)] : null
  const subs = task ? taskSubs(task) : []
  const link = task ? taskLink(task) : null

  return (
    <AppDrawer
      open={!!task}
      onClose={onClose}
      title={task ? taskTitle(task) : ''}
      subtitle={task ? `${task.cat || '업무'}${task.num ? ' · No.' + task.num : ''}` : ''}
      width={480}
      footer={
        link ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
              관련 자료 열기
            </Button>
          </Box>
        ) : undefined
      }
    >
      {task && st && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={st.status} label={st.label} />
            {task.remind && <StatusChip status="warning" label="Remind" />}
            {task.chief && <StatusChip status="purple" label="센터장 검토" />}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="담당자" value={task.mgr} />
            <MetaRow label="부서" value={task.dept} />
            <MetaRow label="발의일자" value={fmtDate(task.start)} />
            {task.plan && <MetaRow label="예정일" value={fmtDate(task.plan)} />}
            <MetaRow label="완료일자" value={fmtDate(task.end)} />
          </Box>

          {subs.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>업무 내용</Typography>
              <Box>
                {subs.map((l, i) => (
                  <SubLine key={i} line={l} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </AppDrawer>
  )
}
