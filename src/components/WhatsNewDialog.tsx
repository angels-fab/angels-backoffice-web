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
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import SearchIcon from '@mui/icons-material/Search'
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined'
import PushPinIcon from '@mui/icons-material/PushPin'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import { StatusChip } from '@/components/ds'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'

/**
 * 새 기능 안내 팝업(What's New) — 로그인(구성원+) 후 계정당 1회.
 * 목적: 새 기능은 화면에 조용히 들어와 모르고 지나침 → 글 대신 실물 재현 미니 데모로 안내
 * (사용자 피드백 2026-07-20: 긴 설명 대신 화면캡처 같은 시각자료 — 캡처 대신 실제 UI 스타일을
 *  그대로 축소 재현해 다크테마·해상도 무관하게 항상 실물과 일치).
 * 동작(사용자 확정): '다시 보지 않기' 체크 + 확인 = 영구 확인(`whatsnew.seen` = 버전 문자열,
 * 서버 저장 — 기기 무관). 체크 없이 확인/닫기 = 이번 세션만 닫힘 → 다음 접속(로그인·새 페이지 로드)마다 다시 뜸.
 * 새 기능 배포 시 VERSION을 올리고 본문을 교체하면 영구 확인자에게도 다시 안내됨.
 * 게이트: loadedOk(설정 로드 성공) 전에는 판단 보류 — 로드 실패 세션은 안 띄움(반복 출현·저장 불가 방지).
 *
 * 이번 회차(2026-08-05, 사용자 선택): 알림 센터 · 통합검색 · 붙임쪽지 메모.
 * 같은 기간에 한 권한 개편(등급 이름·구성원 작성 권한)은 아직 모두 관리자라 체감되지 않아 뺐다 —
 * 실제로 등급을 내린 뒤 별도 회차로 안내하는 편이 정확하다(사용자 결정).
 */
const VERSION = '2026-08-05-notify-search-memo'

// ── 미니 데모 ①: 상단바 알림 센터(실물 재현 — 벨 + 빨강 배지 + 드롭다운 목록) ──

/** 알림 한 줄 — 출처 칩 색은 실물과 동일(공지=파랑·업무=초록·개선요청=앰버) */
const NOTI: { kind: 'info' | 'success' | 'warning'; from: string; title: string; when: string }[] = [
  { kind: 'info', from: '공지', title: '8월 안전교육 일정', when: '오늘' },
  { kind: 'success', from: '업무', title: '클린룸 배관 검수', when: '어제' },
  { kind: 'warning', from: '개선요청', title: '체크박스 위치', when: '2일 전' },
]

function NotifyDemo() {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
      {/* 상단바 조각 — 벨과 미확인 배지 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', px: 1.25, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <NotificationsNoneIcon sx={{ fontSize: iconSize.header, color: 'text.secondary' }} />
          <Box
            sx={{
              position: 'absolute', top: -4, right: -6, minWidth: 15, height: 15, px: '3px',
              borderRadius: `${radius.pill}px`, bgcolor: 'error.main', color: 'common.white',
              fontSize: typescale.micro.size, fontWeight: weight.bold, lineHeight: 1,
              display: 'grid', placeItems: 'center',
            }}
          >
            3
          </Box>
        </Box>
      </Box>
      {/* 드롭다운 — 안 본 새 글이 출처 칩과 함께 한 줄씩 */}
      <Box>
        {NOTI.map((n, i) => (
          <Box
            key={n.title}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderTop: i === 0 ? 0 : 1, borderColor: 'divider' }}
          >
            <StatusChip status={n.kind} label={n.from} />
            <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: typescale.micro.size, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {n.title}
            </Box>
            <Box component="span" sx={{ fontSize: typescale.micro.size, color: 'text.disabled', flexShrink: 0 }}>{n.when}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── 미니 데모 ②: 통합검색(실물 재현 — 상단바 진입점 + 결과 줄) ──

/** 단축키 키캡 — 상단바 진입점의 Ctrl / K 표기 그대로 */
function Key({ children }: { children: string }) {
  return (
    <Box
      component="span"
      sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.chip}px`, px: '5px', fontSize: typescale.micro.size, color: 'text.secondary', lineHeight: 1.6 }}
    >
      {children}
    </Box>
  )
}

function SearchDemo() {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
      {/* 상단바 진입점 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
        <SearchIcon sx={{ fontSize: iconSize.body, color: 'text.secondary' }} />
        <Box component="span" sx={{ flex: 1, fontSize: typescale.micro.size, color: 'text.primary' }}>배관</Box>
        <Key>Ctrl</Key>
        <Key>K</Key>
      </Box>
      {/* 결과 — 어느 메뉴의 무엇인지 함께 */}
      {[['업무', '클린룸 배관 검수', '업무현황'], ['일정', '배관 공사 입회', '업무일정'], ['공지', '배관 작업 안전수칙', '공지사항']].map(([kind, title, to], i) => (
        <Box key={title} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.7, borderTop: i === 0 ? 0 : 1, borderColor: 'divider' }}>
          <Box component="span" sx={{ fontSize: typescale.micro.size, color: 'text.disabled', width: 26, flexShrink: 0 }}>{kind}</Box>
          <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: typescale.micro.size, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Box>
          <Box component="span" sx={{ fontSize: typescale.micro.size, color: 'text.disabled', flexShrink: 0 }}>{to}</Box>
        </Box>
      ))}
    </Box>
  )
}

// ── 미니 데모 ③: 붙임쪽지 메모(실물 재현 — 접힌 압정 → 펼친 쪽지) ──

function MemoDemo() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 1.25, alignItems: 'center' }}>
      {/* 접힘 — 화면 위에 압정 하나 */}
      <Box sx={{ textAlign: 'center' }}>
        <Box
          sx={(th) => ({
            display: 'grid', placeItems: 'center', width: 34, height: 34, mx: 'auto',
            border: `1px solid ${alpha(th.palette.accent.amber, 0.5)}`, borderRadius: `${radius.card}px`,
            bgcolor: 'background.paper', color: th.palette.accent.amber,
          })}
        >
          <PushPinIcon sx={{ fontSize: iconSize.header }} />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 0.5 }}>평소</Typography>
      </Box>
      <ArrowForwardIcon sx={{ fontSize: iconSize.header, color: 'text.disabled', mb: 2 }} />
      {/* 펼침 — 제목·상태와 답글 */}
      <Box>
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.paper', overflow: 'hidden' }}>
          <Box
            sx={(th) => ({
              display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.6,
              borderBottom: 1, borderColor: 'divider',
              background: `linear-gradient(100deg, ${alpha(th.palette.accent.amber, 0.13)}, transparent 70%)`,
            })}
          >
            <PushPinIcon sx={(th) => ({ fontSize: iconSize.body, color: th.palette.accent.amber })} />
            <Box component="span" sx={(th) => ({ fontSize: typescale.micro.size, fontWeight: weight.bold, color: th.palette.accentText.amber })}>요청 #39</Box>
            <StatusChip status="neutral" label="접수" />
          </Box>
          <Box sx={{ px: 1, py: 0.75 }}>
            <Box sx={{ fontSize: typescale.micro.size, fontWeight: weight.bold, color: 'text.primary' }}>체크박스 위치</Box>
            <Box sx={{ fontSize: typescale.micro.size, color: 'text.secondary', mt: '2px' }}>표 왼쪽 끝으로 옮겨주세요</Box>
          </Box>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 0.5 }}>누르면 펼쳐짐 · 끌어서 자리 옮김</Typography>
      </Box>
    </Box>
  )
}

export default function WhatsNewDialog() {
  const dispatch = useAppDispatch()
  const { loggedIn, isMember } = useRole()
  const loadedOk = useAppSelector((s) => s.userSettings.loadedOk)
  const seen = useAppSelector((s) => s.userSettings.settings['whatsnew.seen'])
  // 세션 내 재출현 방지 — 닫으면 이번 세션엔 다시 안 뜸(체크 안 했으면 다음 접속 때 다시 뜸)
  const [dismissed, setDismissed] = useState(false)
  // '다시 보지 않기' 체크 — 체크 + 확인일 때만 영구 확인 저장
  const [noMore, setNoMore] = useState(false)

  const open = loggedIn && isMember && loadedOk && !dismissed && seen !== VERSION
  const confirm = () => {
    setDismissed(true)
    if (noMore) dispatch(putSetting({ key: 'whatsnew.seen', value: VERSION }))
  }

  return (
    <Dialog open={open} onClose={() => setDismissed(true)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: typescale.pageTitle.size }} />
        새 기능 안내
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {/* 핵심 안내 문구 — 조용히 들어와 모르고 지나쳤을 것들임을 먼저 */}
        <Box
          sx={(th) => ({
            display: 'flex', alignItems: 'center', gap: 1.25,
            p: '10px 14px', mb: 2, borderRadius: `${radius.button}px`,
            bgcolor: alpha(th.palette.primary.main, 0.12),
            border: `1px solid ${alpha(th.palette.primary.main, 0.35)}`,
          })}
        >
          <TouchAppIcon sx={{ color: 'primary.main', fontSize: iconSize.header, flexShrink: 0 }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.emphasis.weight }}>
            <Box component="span" sx={{ color: 'primary.main' }}>새로 추가된 기능</Box> 셋입니다. 이미 적용되어 있어 바로 쓸 수 있습니다.
          </Typography>
        </Box>

        {/* ① 알림 센터 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <NotificationsNoneIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>알림 센터</Typography>
        </Box>
        <NotifyDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
          상단바 종 모양을 누르면 안 본 새 글이 한눈에 나옵니다. 누르면 그 글로 바로 가고, '모두 읽음'으로 한 번에 정리할 수 있습니다.
        </Typography>

        {/* ② 통합검색 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <SearchIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>통합검색</Typography>
        </Box>
        <SearchDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
          공지·업무·일정·장비를 한 번에 찾습니다. 상단바 검색을 누르거나 <b>Ctrl</b>+<b>K</b>를 누르세요.
        </Typography>

        {/* ③ 붙임쪽지 메모 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <StickyNote2OutlinedIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>화면에 붙이는 메모</Typography>
        </Box>
        <MemoDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          불편한 점을 발견한 그 화면에서 상단바 <b>메모</b>로 남기면, 다음에 그 화면을 열 때 쪽지로 다시 보입니다.
          게시판(포털개선요청)에도 함께 접수되고, 내가 남긴 메모는 나에게만 보입니다.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        {/* 체크 + 확인 = 영구(다시 안 뜸) / 체크 없이 확인·닫기 = 다음 접속 때 다시 안내 */}
        <FormControlLabel
          sx={{ mr: 'auto', '& .MuiFormControlLabel-label': { fontSize: typescale.body.size, color: 'text.secondary' } }}
          control={<Checkbox size="small" checked={noMore} onChange={(e) => setNoMore(e.target.checked)} />}
          label="다시 보지 않기"
        />
        <Button variant="contained" onClick={confirm}>확인</Button>
      </DialogActions>
    </Dialog>
  )
}
