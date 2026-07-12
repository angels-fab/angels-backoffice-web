import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'
import { iconSize } from '@/theme/tokens'

/**
 * 관심 업무 별 토글(개인화 D-2) — user_settings `work.pins`(num 배열)에 계정별 저장.
 * 켜면 홈 '관심 업무' 섹션에 그 업무가 고정 표시된다. 업무 데이터(팀 공유)는 건드리지 않음.
 * ※ 아이콘은 별(Star) — Remind 카드의 압정(PushPin 앰버)과 혼동을 피하기 위해 압정 금지.
 * 설정 로드 성공(loadedOk) + 로그인일 때만 노출(자동 아님·사용자 클릭 저장이지만, 서버 상태를
 * 모르는 채 pins 키를 덮지 않도록 필터와 동일 기준으로 게이트).
 */
export default function WorkPinButton({ num }: { num: string }) {
  const dispatch = useAppDispatch()
  const loadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const userName = useAppSelector((s) => s.userSettings.userName)
  const pins = useAppSelector((s) => s.userSettings.settings['work.pins'])
  if (!loadedOk || !userName) return null
  const list = Array.isArray(pins) ? pins.map(String) : []
  const pinned = list.includes(num)
  return (
    <Tooltip title={pinned ? '관심 업무 해제' : '관심 업무로 고정(나에게만)'}>
      <IconButton
        size="small"
        aria-label={pinned ? '관심 업무 해제' : '관심 업무로 고정'}
        onClick={(e) => {
          e.stopPropagation()
          dispatch(putSetting({ key: 'work.pins', value: pinned ? list.filter((n) => n !== num) : [...list, num] }))
        }}
        sx={(th) => ({ p: 0.5, color: pinned ? th.palette.accent.amber : 'text.disabled', '&:hover': { color: th.palette.accent.amber } })}
      >
        {pinned ? <StarRoundedIcon sx={{ fontSize: iconSize.action }} /> : <StarBorderRoundedIcon sx={{ fontSize: iconSize.action }} />}
      </IconButton>
    </Tooltip>
  )
}
