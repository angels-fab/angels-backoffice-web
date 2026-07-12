import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import TuneIcon from '@mui/icons-material/Tune'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import type { SvgIconComponent } from '@mui/icons-material'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'

/**
 * 새 기능 안내 팝업(What's New) — 로그인(팀원+) 후 계정당 1회.
 * 목적: 개인화 기능은 화면에 조용히 들어와 팀원이 모르거나 "바꾸면 팀에 영향 갈까" 불안해함 →
 * 무엇이 생겼고 전부 '나에게만' 적용된다는 것을 명시.
 * 확인 여부는 user_settings `whatsnew.seen` = 버전 문자열(서버 저장 — 기기 넘나들어도 1회).
 * 새 기능 배포 시 VERSION을 올리고 FEATURES를 교체하면 전원에게 다시 1회 안내됨.
 * 게이트: loadedOk(설정 로드 성공) 전에는 판단 보류 — 로드 실패 세션은 안 띄움(반복 출현·저장 불가 방지).
 */
const VERSION = '2026-07-12-personalize'

const FEATURES: { Icon: SvgIconComponent; title: string; desc: string }[] = [
  { Icon: NotificationsActiveIcon, title: '내 기준 새 글 배지', desc: '메뉴의 새 글 숫자가 "내가 안 본 글"만 셉니다. 페이지에 들어가면 자동으로 읽음 처리돼요.' },
  { Icon: FilterAltIcon, title: '업무현황 필터 기억', desc: '구분·담당자 필터를 걸어두면 나갔다 와도, 다른 기기에서도 그대로 유지됩니다.' },
  { Icon: SwapVertIcon, title: '업무 카드 순서 = 내 화면에만', desc: '카드를 드래그해 순서를 바꿔도 팀원 화면 순서는 바뀌지 않습니다. 각자 자기 순서로 봐요.' },
  { Icon: TuneIcon, title: '홈 화면 내 마음대로', desc: '홈 "운영 대시보드" 제목 옆 조절 아이콘으로 섹션 순서를 바꾸거나 숨길 수 있습니다.' },
  { Icon: StarRoundedIcon, title: '관심 업무 별(★)', desc: '업무 카드의 별을 켜면 홈 "관심 업무"에 고정됩니다. 내 화면에만 보여요.' },
]

export default function WhatsNewDialog() {
  const dispatch = useAppDispatch()
  const { loggedIn, isMember } = useRole()
  const loadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const seen = useAppSelector((s) => s.userSettings.settings['whatsnew.seen'])
  // 세션 내 재출현 방지 — 닫으면 저장 성공 여부와 무관하게 이번 세션엔 다시 안 뜸
  const [dismissed, setDismissed] = useState(false)

  const open = loggedIn && isMember && loadedOk && !dismissed && seen !== VERSION
  const close = () => {
    setDismissed(true)
    dispatch(putSetting({ key: 'whatsnew.seen', value: VERSION }))
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 22 }} />
        새로워진 포털 — 개인화 기능 안내
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {/* 핵심 안심 문구 — 팀 영향 없음을 가장 먼저 */}
        <Box
          sx={(th) => ({
            display: 'flex', alignItems: 'center', gap: 1.25,
            p: '10px 14px', mb: 2, borderRadius: '10px',
            bgcolor: alpha(th.palette.accent.green, 0.12),
            border: `1px solid ${alpha(th.palette.accent.green, 0.35)}`,
          })}
        >
          <ShieldOutlinedIcon sx={(th) => ({ color: th.palette.accent.green, fontSize: 20, flexShrink: 0 })} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            아래 기능은 전부 <Box component="span" sx={(th) => ({ color: th.palette.accent.green })}>내 계정에만 적용</Box>됩니다.
            마음껏 바꿔도 팀원 화면과 팀 데이터(업무·일정·공지)에는 영향이 없어요.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {FEATURES.map(({ Icon, title, desc }) => (
            <Box key={title} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                sx={(th) => ({
                  width: 34, height: 34, flexShrink: 0, borderRadius: '9px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: alpha(th.palette.primary.main, 0.13), color: 'primary.main',
                })}
              >
                <Icon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{desc}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="contained" onClick={close}>확인했어요</Button>
      </DialogActions>
    </Dialog>
  )
}
