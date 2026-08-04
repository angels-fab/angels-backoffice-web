import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Popover from '@mui/material/Popover'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import { EmptyState, StatusChip, focusRingSx } from '@/components/ds'
import type { StatusKind } from '@/components/ds'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'
import { isWorkNew, isImproveNew } from '@/utils/newPost'
import { useUnseenItems, MENU_LABEL } from './useNavBadges'
import { iconSize, radius, typescale } from '@/theme/tokens'

/** 출처별 칩 색 — 사이드바 배지와 같은 의미 계열(공지=파랑·업무=초록·개선=앰버) */
const MENU_KIND: Record<string, StatusKind> = { notice: 'info', work: 'success', improve: 'warning' }

/** 'YYYY-MM-DD' → 오늘/어제/N일 전 (7일 규칙이라 그 안에서만 쓰인다) */
function relDay(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  if (isNaN(d.getTime())) return date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const n = Math.round((today.getTime() - d.getTime()) / 86400000)
  if (n <= 0) return '오늘'
  if (n === 1) return '어제'
  return `${n}일 전`
}

/**
 * 알림 센터 — 상단바 벨 + 안 본 새 글 목록.
 *
 * 알림은 **새로 만든 개념이 아니라** 사이드바 배지와 같은 모집단(7일 내 글 중 내가 안 본 것)을
 * 숫자 대신 목록으로 펼친 것이다(useUnseenItems). 항목을 누르면 해당 페이지로 이동하고,
 * 그 페이지의 useMarkSeen 이 기존 규칙대로 읽음 처리해 배지가 줄어든다.
 *
 * 노출은 로그인 사용자만 — 읽음 상태가 계정(user_settings)에 저장되므로 게스트는
 * 눌러도 목록이 그대로라 벨이 제 역할을 못 한다(사용자 결정).
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const items = useUnseenItems()

  // '모두 읽음' — 각 메뉴의 현재 새 글 전체를 seen 으로 저장(페이지 진입 시 처리와 같은 형태)
  const workReady = useAppSelector((s) => s.work.ready)
  const workItems = useAppSelector((s) => s.work.items)
  const noticeItems = useAppSelector((s) => s.notice.items)
  const improveItems = useAppSelector((s) => s.improve.items)
  const markAllRead = () => {
    dispatch(putSetting({ key: 'seen.notice', value: noticeItems.filter((n) => n.isNew).map((n) => String(n.num)) }))
    if (workReady) dispatch(putSetting({ key: 'seen.work', value: workItems.filter(isWorkNew).map((t) => String(t.num)) }))
    dispatch(putSetting({ key: 'seen.improve', value: improveItems.filter(isImproveNew).map((i) => String(i.num)) }))
    setAnchor(null)
  }

  const open = !!anchor
  const count = items.length

  return (
    <>
      <Tooltip title={count > 0 ? `안 읽은 알림 ${count}건` : '알림'}>
        <IconButton
          aria-label={count > 0 ? `알림 ${count}건 열기` : '알림 열기'}
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          {/* 0건이어도 벨은 남긴다 — 아이콘이 사라지면 옆 요소가 밀려 상단바가 흔들린다(사용자 결정) */}
          <Badge badgeContent={count} color="error" overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: typescale.micro.size, height: 16, minWidth: 16 } }}>
            <NotificationsNoneIcon sx={{ fontSize: iconSize.header }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.75, width: 320, maxWidth: '92vw', borderRadius: `${radius.card}px` } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
          <Typography sx={{ fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight }}>
            알림{count > 0 && <Box component="span" sx={{ ml: 0.5, color: 'text.disabled', fontWeight: typescale.small.weight }}>{count}</Box>}
          </Typography>
          {count > 0 && (
            <ButtonBase onClick={markAllRead} sx={{ px: 0.75, py: 0.25, borderRadius: `${radius.chip}px`, fontSize: typescale.caption.size, color: 'primary.main', ...(focusRingSx as object) }}>
              모두 읽음
            </ButtonBase>
          )}
        </Box>

        {count === 0 ? (
          <EmptyState size="sm" title="새 알림이 없습니다" />
        ) : (
          <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.map((it) => (
              <ButtonBase
                key={`${it.menu}-${it.num}`}
                onClick={() => { setAnchor(null); navigate(it.to) }}
                sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%',
                  px: 1.5, py: 1.1, textAlign: 'left',
                  borderBottom: 1, borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 0 },
                  '&:hover': { bgcolor: 'background.elevated' },
                  ...(focusRingSx as object),
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <StatusChip status={MENU_KIND[it.menu] || 'neutral'} label={MENU_LABEL[it.menu]} />
                    <Typography sx={{ ml: 'auto', fontSize: typescale.caption.size, color: 'text.disabled', flexShrink: 0 }}>
                      {relDay(it.date)}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: typescale.body.size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.title}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Box>
        )}
      </Popover>
    </>
  )
}
