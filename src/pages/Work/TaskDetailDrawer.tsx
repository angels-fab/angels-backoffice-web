import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { AppDrawer, StatusChip } from '@/components/ds'
import { fmtDate } from '@/utils/date'
import type { WorkItem } from '@/types'
import { W_STATUS, classify, taskTitle, taskLink } from './workMeta'
import { workBodyLines } from './richContent'
import SubLine from './SubLine'

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Typography variant="body2" sx={{ width: 72, flexShrink: 0, color: 'text.disabled' }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: 'text.primary', flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{value || '-'}</Typography>
    </Box>
  )
}

export interface TaskDetailDrawerProps {
  task: WorkItem | null
  onClose: () => void
  /** 관리자 모드 — 수정/삭제 액션 노출 */
  isAdmin?: boolean
  onEdit?: (task: WorkItem) => void
  onDelete?: (task: WorkItem) => void
  /** 비모달 — 드로어가 떠 있어도 뒤 목록 카드를 바로 클릭 가능 */
  nonModal?: boolean
}

/** 업무 상세 Drawer — 전체 항목 표시. 관리자면 수정/삭제. */
export default function TaskDetailDrawer({ task, onClose, isAdmin, onEdit, onDelete, nonModal }: TaskDetailDrawerProps) {
  const st = task ? W_STATUS[classify(task)] : null
  const subs = task ? workBodyLines(task) : []
  const link = task ? taskLink(task) : null

  return (
    <AppDrawer
      open={!!task}
      onClose={onClose}
      title={task ? taskTitle(task) : ''}
      subtitle={task ? `${task.cat || '업무'}${task.num ? ' · No.' + task.num : ''}` : ''}
      width={480}
      nonModal={nonModal}
      footer={
        task && (link || isAdmin) ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Box>
              {isAdmin && (
                <Button color="error" variant="text" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete?.(task)}>
                  삭제
                </Button>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {link && (
                <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}>
                  관련 자료
                </Button>
              )}
              {isAdmin && (
                <Button variant="contained" startIcon={<EditIcon />} onClick={() => onEdit?.(task)}>
                  수정
                </Button>
              )}
            </Box>
          </Box>
        ) : undefined
      }
    >
      {task && st && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <StatusChip status={st.status} label={st.label} />
            {task.remind && <StatusChip status="warning" label="Remind" />}
            {task.chief && <StatusChip status="purple" label="Check" />}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetaRow label="구분" value={task.cat} />
            <MetaRow label="담당자" value={task.mgr} />
            <MetaRow label="관련부서" value={task.dept} />
            <MetaRow label="발의일자" value={fmtDate(task.start)} />
            {task.plan && <MetaRow label="예정일" value={fmtDate(task.plan)} />}
            {task.time && <MetaRow label="시간" value={task.time} />}
            {task.loc && <MetaRow label="장소" value={task.loc} />}
            {task.end && <MetaRow label="완료일자" value={fmtDate(task.end)} />}
            {task.mat && <MetaRow label="관련자료" value={task.mat} />}
            {task.link && <MetaRow label="링크" value={task.link} />}
          </Box>

          {subs.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>업무 내용</Typography>
              <Box>
                {subs.map((l, i) => (
                  <SubLine key={i} bodyLine={l} />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </AppDrawer>
  )
}
