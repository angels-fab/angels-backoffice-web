import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GroupsIcon from '@mui/icons-material/Groups'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import type { SvgIconComponent } from '@mui/icons-material'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'

/**
 * 새 기능 안내 팝업(What's New) — 로그인(팀원+) 후 계정당 1회.
 * 목적: 새 기능은 화면에 조용히 들어와 팀원이 모르고 지나침 → 무엇이 생겼고 어떻게 쓰는지 안내.
 * (2026-07-20 회차: 행사 사전 참석 표시 + 업무현황 첨부파일 — 팀 공유 기능이라 배너 문구도 교체)
 * 동작(사용자 확정): '다시 보지 않기' 체크 + 확인했어요 = 영구 확인(`whatsnew.seen` = 버전 문자열,
 * 서버 저장 — 기기 무관). 체크 없이 확인/닫기 = 이번 세션만 닫힘 → 다음 접속(로그인·새 페이지 로드)마다 다시 뜸.
 * 새 기능 배포 시 VERSION을 올리고 FEATURES를 교체하면 영구 확인자에게도 다시 안내됨.
 * 게이트: loadedOk(설정 로드 성공) 전에는 판단 보류 — 로드 실패 세션은 안 띄움(반복 출현·저장 불가 방지).
 */
const VERSION = '2026-07-20-attend-attach'

const FEATURES: { Icon: SvgIconComponent; title: string; desc: string }[] = [
  {
    Icon: EventAvailableIcon,
    title: '행사 참석, 미리 표시하세요',
    desc: '학술·교육·전시의 진행중·예정 행사 카드 오른쪽 위에 참석 버튼이 생겼어요(PC는 카드에 마우스를 올리면 나타납니다). 한 번 누르면 "참석 예정/참석 중" 초록 배지가 켜지고 행사 상세의 참석자 명단에 내 이름이 올라가요. 다시 누르면 취소됩니다.',
  },
  {
    Icon: AttachFileIcon,
    title: '업무에 파일을 첨부하세요',
    desc: '업무현황에서 새 업무를 만들거나 카드를 더블클릭(수정)하면 클립 아이콘·[파일 첨부] 버튼으로 파일을 올릴 수 있어요(파일당 최대 10MB). 파일을 카드 위로 끌어다 놓아도 됩니다. 첨부는 업무카드 아래 전용 구역에 표시되고, 누르면 바로 내려받아요.',
  },
]

export default function WhatsNewDialog() {
  const dispatch = useAppDispatch()
  const { loggedIn, isMember } = useRole()
  const loadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const seen = useAppSelector((s) => s.userSettings.settings['whatsnew.seen'])
  // 세션 내 재출현 방지 — 닫으면 이번 세션엔 다시 안 뜸(체크 안 했으면 다음 접속 때 다시 뜸)
  const [dismissed, setDismissed] = useState(false)
  // '다시 보지 않기' 체크 — 체크 + 확인했어요일 때만 영구 확인 저장
  const [noMore, setNoMore] = useState(false)

  const open = loggedIn && isMember && loadedOk && !dismissed && seen !== VERSION
  const confirm = () => {
    setDismissed(true)
    if (noMore) dispatch(putSetting({ key: 'whatsnew.seen', value: VERSION }))
  }

  return (
    <Dialog open={open} onClose={() => setDismissed(true)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        새로워진 포털 — 새 기능 안내
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {/* 핵심 안내 문구 — 이번 회차는 팀이 함께 쓰는 기능임을 먼저 */}
        <Box
          sx={(th) => ({
            display: 'flex', alignItems: 'center', gap: 1.25,
            p: '10px 14px', mb: 2, borderRadius: `${radius.button}px`,
            bgcolor: alpha(th.palette.primary.main, 0.12),
            border: `1px solid ${alpha(th.palette.primary.main, 0.35)}`,
          })}
        >
          <GroupsIcon sx={{ color: 'primary.main', fontSize: iconSize.header, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.emphasis.weight }}>
            이번에는 <Box component="span" sx={{ color: 'primary.main' }}>팀이 함께 쓰는 기능</Box> 두 가지가 생겼어요.
            내가 표시한 참석과 올린 첨부는 팀원 모두에게 보입니다.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {FEATURES.map(({ Icon, title, desc }) => (
            <Box key={title} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={(th) => ({
                  width: 34, height: 34, flexShrink: 0, borderRadius: `${radius.button}px`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: alpha(th.palette.primary.main, 0.13), color: 'primary.main',
                })}
              >
                <Icon sx={{ fontSize: iconSize.action }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {/* 체크 + 확인 = 영구(다시 안 뜸) / 체크 없이 확인·닫기 = 다음 접속 때 다시 안내 */}
        <FormControlLabel
          sx={{ mr: 'auto', '& .MuiFormControlLabel-label': { fontSize: typescale.body.size, color: 'text.secondary' } }}
          control={<Checkbox size="small" checked={noMore} onChange={(e) => setNoMore(e.target.checked)} />}
          label="다시 보지 않기"
        />
        <Button variant="contained" onClick={confirm}>확인했어요</Button>
      </DialogActions>
    </Dialog>
  )
}
