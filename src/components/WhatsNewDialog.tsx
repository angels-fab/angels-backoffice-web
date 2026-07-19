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
import TouchAppIcon from '@mui/icons-material/TouchApp'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import DownloadIcon from '@mui/icons-material/Download'
import CheckIcon from '@mui/icons-material/Check'
import { iconSize, radius, typescale, domain } from '@/theme/tokens'
import { AttachmentIcon } from '@/pages/Notice/attachmentUI'
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
 */
const VERSION = '2026-07-20-attend-attach-v2'

// ── 미니 데모: 행사 카드 상단 크롭(실물 재현 — eventCard.tsx 참석 버튼·칩 스타일 그대로) ──

/** 행사 포스터 카드 상단 크롭 1장 — 상태 pill + 참석 버튼(전: 테두리 / 후: 초록 배지) */
function EventCrop({ state }: { state: 'before' | 'after' }) {
  const after = state === 'after'
  return (
    <Box sx={{ position: 'relative', height: 86, borderRadius: `${radius.card}px`, overflow: 'hidden', background: domain.events.grad.blue, border: 1, borderColor: 'divider' }}>
      {/* 좌상단 상태 pill(예정=앰버 점) · 우상단 참석 버튼 — 실제 카드와 동일 문법 */}
      <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
        <Box sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: 10, fontWeight: 700, px: '8px', height: 20, borderRadius: `${radius.pill}px`, bgcolor: 'rgba(0,0,0,.5)', color: 'common.white', flexShrink: 0, '& .dot': { width: 7, height: 7, borderRadius: radius.circle, bgcolor: th.palette.accent.amber } })}>
          <Box component="span" className="dot" />예정 D-12
        </Box>
        <Box
          component="span"
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: '3px', height: 20, px: '8px',
            borderRadius: `${radius.pill}px`, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            ...(after
              ? { bgcolor: '#16a34a', color: 'common.white', border: '1px solid #16a34a' }
              : { bgcolor: 'rgba(0,0,0,.42)', color: '#c9f4dc', border: '1px solid rgba(52,211,153,.7)' }),
          }}
        >
          {after && <CheckIcon sx={{ fontSize: 12 }} />}참석 예정
        </Box>
      </Box>
      {/* 전 상태: 버튼을 가리키는 탭 손가락 */}
      {!after && (
        <TouchAppIcon sx={{ position: 'absolute', top: 26, right: 14, fontSize: iconSize.header, color: 'common.white', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))' }} />
      )}
      {/* 하단 제목 자리(실카드의 제목 오버레이 축약) */}
      <Box sx={{ position: 'absolute', left: 10, right: 10, bottom: 8, fontSize: 10, fontWeight: 700, color: 'common.white', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        ISPSA 2026 국제심포지엄
      </Box>
    </Box>
  )
}

function EventAttendDemo() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center' }}>
      <Box>
        <EventCrop state="before" />
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 0.5 }}>카드 위 참석 버튼 누르기</Typography>
      </Box>
      <ArrowForwardIcon sx={{ fontSize: iconSize.header, color: 'text.disabled', mb: 2.5 }} />
      <Box>
        <EventCrop state="after" />
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.disabled', mt: 0.5 }}>참석 표시 완료 — 명단에 등록</Typography>
      </Box>
    </Box>
  )
}

// ── 미니 데모: 업무카드 + 첨부 트레이(실물 재현 — TaskAccordion 톤·WorkAttachments 칩 스타일 그대로) ──

const TONE = '114 199 141' // workTone.green(진행중)

function WorkAttachDemo() {
  const c = (a: number) => `rgb(${TONE} / ${a})`
  return (
    <Box sx={{ border: `1px solid ${c(0.24)}`, bgcolor: c(0.055), borderRadius: `${radius.card}px`, overflow: 'hidden' }}>
      {/* 제목줄(축약) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, bgcolor: c(0.09), borderBottom: `1px solid ${c(0.14)}` }}>
        <Box component="span" sx={(th) => ({ fontSize: 10, fontWeight: 600, px: '7px', py: '2px', borderRadius: `${radius.chip}px`, color: th.palette.accent.blue, bgcolor: alpha(th.palette.accent.blue, 0.16), border: `1px solid ${alpha(th.palette.accent.blue, 0.35)}` })}>회의</Box>
        <Box component="span" sx={{ fontSize: typescale.small.size, fontWeight: typescale.emphasis.weight, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>클린룸 공조 설계 검토회의</Box>
      </Box>
      {/* 본문(축약) */}
      <Box sx={{ px: 1.25, py: 0.75, fontSize: typescale.caption.size, color: 'text.secondary' }}>• 공조 조닝 변경안 도면 검토</Box>
      {/* 첨부 트레이 — 새로 생긴 구역(파랑 링으로 강조) */}
      <Box sx={(th) => ({ borderTop: `1px solid ${c(0.14)}`, bgcolor: alpha(th.palette.common.black, 0.16), px: 1.25, pt: 0.75, pb: 1, boxShadow: `inset 0 0 0 2px ${alpha(th.palette.primary.main, 0.55)}` })}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <AttachFileIcon sx={{ fontSize: iconSize.caption, color: 'text.disabled' }} />
          <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, letterSpacing: '0.04em', color: 'text.disabled' }}>첨부파일</Box>
          <Box component="span" sx={{ fontSize: typescale.caption.size, fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>1</Box>
        </Box>
        <Box sx={(th) => ({ display: 'inline-flex', alignItems: 'center', gap: 0.75, pl: 0.9, pr: 1, py: '4px', borderRadius: `${radius.chip}px`, border: `1px solid ${th.palette.divider}`, bgcolor: 'background.paper', maxWidth: '100%' })}>
          <AttachmentIcon name="설계검토안.pdf" size={16} />
          <Box component="span" sx={{ fontSize: typescale.caption.size, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>공조설계_검토안.pdf</Box>
          <Box component="span" sx={{ fontSize: 10, color: 'text.disabled', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>2.4 MB</Box>
          <DownloadIcon sx={{ fontSize: iconSize.caption, color: 'primary.main', flexShrink: 0 }} />
        </Box>
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
            <Box component="span" sx={{ color: 'primary.main' }}>팀이 함께 쓰는 기능</Box> 두 가지가 생겼어요 —
            내가 표시한 참석과 올린 첨부는 팀원 모두에게 보입니다.
          </Typography>
        </Box>

        {/* ① 행사 사전 참석 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EventAvailableIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>행사 참석, 미리 표시하세요</Typography>
        </Box>
        <EventAttendDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, mb: 2.5 }}>
          학술·교육·전시의 진행중·예정 행사에서 버튼 한 번이면 끝 — 다시 누르면 취소돼요.
        </Typography>

        {/* ② 업무 첨부파일 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AttachFileIcon sx={{ color: 'primary.main', fontSize: iconSize.action }} />
          <Typography variant="body2" sx={{ fontWeight: typescale.cardTitle.weight }}>업무에 파일을 첨부하세요</Typography>
        </Box>
        <WorkAttachDemo />
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
          새 업무 작성·카드 더블클릭(수정)에서 올려요 — 파일을 카드에 끌어다 놓아도 됩니다(파일당 10MB).
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
