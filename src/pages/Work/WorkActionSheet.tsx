import { useEffect, useState } from 'react'
import Drawer from '@mui/material/Drawer'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import EditIcon from '@mui/icons-material/Edit'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { WorkItem } from '@/types'
import type { DropZone } from './dropZones'
import { taskTitle } from './workMeta'

/**
 * 모바일 업무 카드 액션 시트(바텀시트) — 터치 롱프레스로 열린다.
 * PC 드래그 3종(순서·KPI 상태변경·휴지통 삭제)을 터치에서 한 입구로 통합.
 * 상태 변경은 하위 시트(목표 상태 선택), 순서 변경은 진행중 뷰에서만(흔들림 모드 진입).
 * 실제 동작은 부모의 기존 핸들러를 호출한다(handleStatusDrop/requestDelete/handleCardDoubleClick).
 */
interface Props {
  task: WorkItem | null
  /** 실제 상태 변화가 생기는 대상 존만(부모가 계산) — 비었으면 '상태 변경' 자체를 숨김 */
  zones: DropZone[]
  /** 순서 변경 노출 여부 — 진행중 뷰에서만 true */
  canReorder: boolean
  onClose: () => void
  onStatus: (zone: DropZone) => void
  onReorder: () => void
  onEdit: () => void
  onDelete: () => void
}

const ZONE_LABEL: { zone: DropZone; label: string }[] = [
  { zone: 'inProgress', label: '진행중으로' },
  { zone: 'hold', label: '보류로' },
  { zone: 'done', label: '완료로' },
  { zone: 'remind', label: 'Remind로' },
]

export default function WorkActionSheet({ task, zones, canReorder, onClose, onStatus, onReorder, onEdit, onDelete }: Props) {
  const [mode, setMode] = useState<'menu' | 'status'>('menu')

  // 열릴 때마다 메뉴 모드로 초기화
  useEffect(() => {
    if (task) setMode('menu')
  }, [task])

  const open = !!task
  const statusOptions = ZONE_LABEL.filter((z) => zones.includes(z.zone))

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // 포커스 트랩·자동/복원 포커스 비활성 — iOS에서 닫을 때 포커스 복원으로 화면이 최상단으로 튀는 문제 방지
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            pb: 'calc(10px + env(safe-area-inset-bottom, 0px))',
          },
        },
      }}
    >
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.25, mb: 0.5 }} />

      {task && (
        <>
          <Box sx={{ px: 2.5, pt: 1, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            {mode === 'status' && (
              <IconButton size="small" onClick={() => setMode('menu')} aria-label="뒤로" sx={{ ml: -0.5, color: 'text.secondary' }}>
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
            <Typography variant="caption" sx={{ color: 'text.disabled', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mode === 'status' ? '상태 변경' : taskTitle(task)}
            </Typography>
          </Box>

          {mode === 'menu' ? (
            <List dense sx={{ pt: 0.5 }}>
              {statusOptions.length > 0 && (
                <ListItemButton onClick={() => setMode('status')} sx={{ py: 1.1 }}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><SwapHorizIcon /></ListItemIcon>
                  <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary="상태 변경" />
                  <ChevronRightIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                </ListItemButton>
              )}
              {canReorder && (
                <ListItemButton onClick={onReorder} sx={{ py: 1.1 }}>
                  <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><SwapVertIcon /></ListItemIcon>
                  <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary="순서 변경" secondary="끌어서 순서 바꾸기" />
                </ListItemButton>
              )}
              <ListItemButton onClick={onEdit} sx={{ py: 1.1 }}>
                <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}><EditIcon /></ListItemIcon>
                <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary="수정" />
              </ListItemButton>
              <ListItemButton onClick={onDelete} sx={{ py: 1.1 }}>
                <ListItemIcon sx={{ minWidth: 40, color: '#F85149' }}><DeleteOutlineIcon /></ListItemIcon>
                <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5, color: '#F85149' } } }} primary="삭제" />
              </ListItemButton>
            </List>
          ) : (
            <List dense sx={{ pt: 0.5 }}>
              {statusOptions.map((z) => (
                <ListItemButton key={z.zone} onClick={() => onStatus(z.zone)} sx={{ py: 1.1 }}>
                  <ListItemText slotProps={{ primary: { sx: { fontSize: 14.5 } } }} primary={z.label} sx={{ pl: 1 }} />
                </ListItemButton>
              ))}
            </List>
          )}
        </>
      )}
    </Drawer>
  )
}
