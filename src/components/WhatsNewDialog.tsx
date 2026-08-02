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
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import { darkPalette, domain, iconSize, lightPalette, radius, typescale, weight } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { putSetting } from '@/store/slices/userSettingsSlice'

/**
 * 새 기능 안내 팝업(What's New) — 로그인(팀원+) 후 계정당 1회.
 * 목적: 새 기능은 화면에 조용히 들어와 팀원이 모르고 지나침 → 글 대신 실물 재현 미니 데모로 안내
 * (사용자 피드백 2026-07-20: 긴 설명 대신 화면캡처 같은 시각자료 — 캡처 대신 실제 UI 스타일을
 *  그대로 축소 재현해 다크테마·해상도 무관하게 항상 실물과 일치).
 * 동작(사용자 확정): '다시 보지 않기' 체크 + 확인했어요 = 영구 확인(`whatsnew.seen` = 버전 문자열,
 * 서버 저장 — 기기 무관). 체크 없이 확인/닫기 = 이번 세션만 닫힘 → 다음 접속(로그인·새 페이지 로드)마다 다시 뜸.
 * 새 기능 배포 시 VERSION을 올리고 본문을 교체하면 영구 확인자에게도 다시 안내됨.
 * 게이트: loadedOk(설정 로드 성공) 전에는 판단 보류 — 로드 실패 세션은 안 띄움(반복 출현·저장 불가 방지).
 *
 * 이번 회차(2026-08-03): 7/20 이후 쌓인 것 중 **팀원이 실제로 쓸 기능**만 셋 골랐다.
 * 같은 기간 작업의 대부분은 토큰·죽은 코드·대비 교정 같은 바닥 공사여서 화면 변화가 없다 —
 * 공지할 것이 아니므로 넣지 않는다(사용자 결정).
 */
const VERSION = '2026-08-03-theme-kanban-leave'

// ── 미니 데모 ①: 테마 토글(실물 재현 — TopBar.tsx ThemeSwitch 치수·색 그대로) ──

/** 상단바 해/달 스위치 1개 — dark=false면 해(라이트), true면 달(다크) */
function ThemeSwitchMini({ dark }: { dark: boolean }) {
  return (
    <Box sx={{ position: 'relative', width: 58, height: 32, flexShrink: 0 }}>
      {/* 트랙 44x18 — 실물과 같은 치수 */}
      <Box sx={{ position: 'absolute', left: 7, top: 7, width: 44, height: 18, borderRadius: `${radius.pill}px`, bgcolor: dark ? '#5A6B80' : '#aab4be' /* design-lint-ok(hex): TopBar ThemeSwitch 실물 값 재현 — 데모가 실물과 어긋나면 안내가 거짓이 된다 */ }} />
      {/* 알 28 — 라이트는 밝은 알 + 진한 해, 다크는 남색 알 + 흰 달 */}
      <Box
        sx={{
          position: 'absolute', top: 2, left: dark ? 25 : 5, width: 28, height: 28,
          borderRadius: radius.circle, display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: dark ? '#0B1C3A' : '#FDFEFF', // design-lint-ok(hex): 위와 같은 실물 재현
          boxShadow: dark ? '0 1px 2px rgba(0,0,0,.45)' : '0 1px 2px rgba(20,37,66,.28)', // design-lint-ok(shadow): 실물 스위치 알의 마이크로 입체 재현
        }}
      >
        {dark ? (
          <Box component="svg" viewBox="0 0 20 20" sx={{ width: 18, height: 18 }}>
            <path /* design-lint-ok(hex): TopBar ThemeSwitch 달 아이콘 실물 재현 */ fill="#fff" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z" />
          </Box>
        ) : (
          <Box component="svg" viewBox="0 0 20 20" sx={{ width: 18, height: 18 }}>
            <path /* design-lint-ok(hex): TopBar ThemeSwitch 해 아이콘 실물 재현 */ fill="#B26A00" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z" />
          </Box>
        )}
      </Box>
    </Box>
  )
}

/**
 * 테마별 화면 맛보기 한 조각.
 * ★ theme.palette 를 못 쓴다 — 한 화면에 두 테마를 **나란히** 놓아야 하는데 palette 는 현재 테마
 *   하나만 준다. 대신 팔레트 토큰을 직접 import 해서 쓴다(하드코딩 금지, 토큰이 바뀌면 따라온다).
 */
function ThemeSwatch({ dark }: { dark: boolean }) {
  const p = dark ? darkPalette : lightPalette
  return (
    <Box sx={{ bgcolor: p.background, border: `1px solid ${p.border}`, borderRadius: `${radius.card}px`, p: 1, height: 64, boxSizing: 'border-box' }}>
      <Box sx={{ bgcolor: p.paper, border: `1px solid ${p.border}`, borderRadius: `${radius.chip}px`, px: 1, py: 0.75 }}>
        <Box sx={{ fontSize: typescale.micro.size, fontWeight: weight.bold, color: p.text, mb: '3px' }}>클린룸 공조 설계 검토</Box>
        <Box sx={{ fontSize: typescale.micro.size, color: p.textSecondary }}>담당 조성범 · 08.05</Box>
      </Box>
    </Box>
  )
}

function ThemeDemo() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center' }}>
      <Box>
        <ThemeSwatch dark={false} />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.75 }}><ThemeSwitchMini dark={false} /></Box>
      </Box>
      <ArrowForwardIcon sx={{ fontSize: iconSize.header, color: 'text.disabled', mb: 3 }} />
      <Box>
        <ThemeSwatch dark />
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.75 }}><ThemeSwitchMini dark /></Box>
      </Box>
    </Box>
  )
}

// ── 미니 데모 ②: 업무현황 칸반 보드(실물 재현 — workTone 4색·카드 톤 문법 그대로) ──

const COLS: { label: string; tone: string; n: number }[] = [
  { label: '진행중', tone: domain.workTone.green, n: 2 },
  { label: '보류', tone: domain.workTone.amber, n: 1 },
  { label: '완료', tone: domain.workTone.blue, n: 1 },
  { label: 'Remind', tone: domain.workTone.purple, n: 1 },
]

function KanbanDemo() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
      {COLS.map((col) => {
        const c = (a: number) => `rgb(${col.tone} / ${a})`
        return (
          <Box key={col.label} sx={{ border: `1px solid ${c(0.24)}`, bgcolor: c(0.055), borderRadius: `${radius.chip}px`, overflow: 'hidden' }}>
            {/* 열 머리 — 상태 이름 + 건수 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, px: 0.75, py: '5px', bgcolor: c(0.14) }}>
              <Box component="span" sx={{ fontSize: typescale.micro.size, fontWeight: weight.bold, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.label}</Box>
              <Box component="span" sx={{ fontSize: typescale.micro.size, fontWeight: weight.bold, color: 'text.secondary' }}>{col.n}</Box>
            </Box>
            {/* 카드 자리 — 실제 카드의 제목줄만 축약 */}
            <Box sx={{ p: '5px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Array.from({ length: col.n }).map((_, i) => (
                <Box key={i} sx={{ height: 16, borderRadius: `${radius.card}px`, bgcolor: c(0.18), border: `1px solid ${c(0.28)}` }} />
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

// ── 미니 데모 ③: 지난 휴가 자동 숨김(실물 재현 — 달력 칸 + 연차 칩) ──

/** 달력 한 칸 — past=true면 지난 날(연차 칩이 사라진 뒤) */
function CalCell({ day, leave }: { day: number; leave?: boolean }) {
  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: `${radius.chip}px`, p: '5px', minHeight: 52, bgcolor: 'background.paper' }}>
      <Box sx={{ fontSize: typescale.micro.size, fontWeight: weight.bold, color: 'text.secondary', mb: '4px' }}>{day}</Box>
      {leave && (
        <Box sx={(th) => ({ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', px: '5px', py: '2px', borderRadius: `${radius.chip}px`, fontSize: typescale.micro.size, fontWeight: weight.semibold, color: 'common.white', bgcolor: th.palette.accent.rose, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })}>
          연차 신현진
        </Box>
      )}
    </Box>
  )
}

function LeaveHideDemo() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center' }}>
      <Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          <CalCell day={1} leave />
          <CalCell day={2} leave />
          <CalCell day={3} />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 0.5 }}>지난 연차가 달력에 계속 남음</Typography>
      </Box>
      <ArrowForwardIcon sx={{ fontSize: iconSize.header, color: 'text.disabled', mb: 2.5 }} />
      <Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          <CalCell day={1} />
          <CalCell day={2} />
          <CalCell day={3} />
        </Box>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 0.5 }}>끝난 다음 날 자동으로 사라짐</Typography>
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
        <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: typescale.pageTitle.size }} />
        새로워진 포털 — 그동안 달라진 것
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
            <Box component="span" sx={{ color: 'primary.main' }}>모르고 지나치셨을 기능</Box> 셋을 모았어요 —
            이미 화면에 들어와 있어 바로 쓰실 수 있습니다.
          </Typography>
        </Box>

        {/* ① 테마 전환 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Brightness4Icon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>화면을 밝게도, 어둡게도</Typography>
        </Box>
        <ThemeDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
          상단바 오른쪽 해/달 스위치를 누르면 바뀝니다 — 선택은 이 기기에 기억돼요.
        </Typography>

        {/* ② 칸반 보드 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ViewKanbanIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>업무를 보드로 한눈에</Typography>
        </Box>
        <KanbanDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
          업무현황 오른쪽 위 보기 전환에서 골라요 — 진행중·보류·완료·Remind가 한 화면에 섭니다.
        </Typography>

        {/* ③ 지난 휴가 자동 숨김 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EventBusyIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>지난 휴가는 알아서 비켜요</Typography>
        </Box>
        <LeaveHideDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          업무일정에서 끝난 연차·휴가는 다음 날부터 안 보입니다 — 지워진 게 아니라 가려진 거예요.
        </Typography>
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
