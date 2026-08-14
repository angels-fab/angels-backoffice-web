import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import PushPinIcon from '@mui/icons-material/PushPin'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { inlineFieldSx } from '@/components/ds/fields'
import { ComboField } from '@/pages/Work/inlineFields'
import type { Notice } from '@/types'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import NoticeBodyEditor from './NoticeBodyEditor'
import {
  CatDrop, LinkField, TargetPicker, AttachmentArea, useNoticeComposeForm,
  PinPeriodPopover, pinShort,
  type NoticeFormValues,
} from './NoticeCompose'
import { useState } from 'react'

const fieldSx = (th: Theme) => ({ ...inlineFieldSx(th), py: 0.4 })

/**
 * 모바일 공지 작성/수정 — **전체화면 시트**(요청메모 91 후속, 사용자가 A안 선택 2026-08-14).
 *
 * 종전엔 PC 표의 행(tr) 폼을 표 한 겹에 싸서 카드 목록 사이에 끼워 넣었다 — 셀 단위로 쪼개진
 * 좁은 입력칸이 "조잡하다"는 지적. 항목이 8개에 서식 편집기·첨부까지 있는 몰입형 작업이라
 * 좁은 화면에서는 전용 화면을 주는 게 맞다. 상태·업로드·저장 규칙은 PC 폼과 **같은 훅**
 * (useNoticeComposeForm)을 써서 두 화면이 어긋날 수 없다. PC 폼은 무수정.
 */
export default function NoticeComposeSheet({ open, mode, notice, saving, deptOptions, deptMgrOptions, onSave, onCancel }: {
  open: boolean
  mode: 'new' | 'edit'
  notice?: Notice
  saving: boolean
  deptOptions: string[]
  deptMgrOptions: string[]
  onSave: (v: NoticeFormValues) => void
  onCancel: () => void
}) {
  const f = useNoticeComposeForm({ mode, notice, onSave, onCancel })
  const busy = saving || f.uploading
  // 압정 기한 미니팝업(85번 B안) — 켜는 순간 열림, 끄면 기한도 함께 해제 (PC 폼과 같은 규칙)
  const [pinAnchor, setPinAnchor] = useState<HTMLElement | null>(null)
  return (
    <Dialog
      open={open}
      fullScreen
      // 닫기 = 취소와 같은 길(이번 세션에 올린 첨부 정리 포함) — X 버튼과 뒤로가기 제스처 공통
      onClose={() => { if (!busy) f.cancel() }}
      slotProps={{ paper: { sx: { bgcolor: 'background.default' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <IconButton aria-label="닫기" onClick={f.cancel} disabled={busy} size="small" sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: iconSize.header }} />
        </IconButton>
        <Box component="span" sx={{ flex: 1, fontSize: typescale.cardTitle.size, fontWeight: weight.bold }}>
          {mode === 'edit' ? '공지 수정' : '새 공지'}
        </Box>
        <Button variant="contained" size="small" onClick={f.save} disabled={busy || !f.title.trim()}>
          {saving ? <CircularProgress size={16} thickness={5} color="inherit" /> : mode === 'edit' ? '저장' : '등록'}
        </Button>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <CatDrop value={f.cat} onChange={f.setCat} />
          <Tooltip title={f.pinned ? '중요(상단강조) 해제' : '중요(상단강조)'}>
            <IconButton
              aria-label="중요(상단강조)"
              aria-pressed={f.pinned}
              onClick={(e) => {
                if (f.pinned) { f.setPinned(false); f.setEnd('') }
                else { f.setPinned(true); setPinAnchor(e.currentTarget) }
              }}
              size="small"
              sx={(th) => ({
                color: f.pinned ? th.palette.accentText.amber : 'text.disabled',
                bgcolor: f.pinned ? alpha(th.palette.accent.amber, 0.14) : 'transparent',
                borderRadius: `${radius.chip}px`,
              })}
            >
              <PushPinIcon sx={{ fontSize: iconSize.action }} />
            </IconButton>
          </Tooltip>
          {/* 기한 캡션 — 누르면 미니팝업 재열기(기한만 바꿀 때 압정을 껐다 켤 필요 없게) */}
          {f.pinned && f.end && (
            <Box
              role="button" tabIndex={0} aria-label="고정 기한 변경"
              onClick={(e) => setPinAnchor(e.currentTarget as HTMLElement)}
              sx={(th) => ({ fontSize: typescale.caption.size, color: th.palette.accentText.amber, cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' })}
            >
              ~{pinShort(f.end)}
            </Box>
          )}
          <PinPeriodPopover anchor={pinAnchor} onClose={() => setPinAnchor(null)} end={f.end} setEnd={f.setEnd} />
        </Box>

        <InputBase
          autoFocus={mode === 'new'}
          value={f.title}
          onChange={(e) => f.setTitle(e.target.value)}
          placeholder="제목"
          inputProps={{ 'aria-label': '공지 제목' }}
          sx={(th) => ({ ...fieldSx(th), width: '100%', py: '8px', px: '10px', fontWeight: weight.semibold })}
        />

        {/* 내용이 이 화면의 본체 — 남는 세로를 전부 준다 */}
        <Box sx={(th) => ({ ...fieldSx(th), width: '100%', py: '8px', px: '10px', flex: 1, minHeight: 160, display: 'flex', flexDirection: 'column', '& > *': { flex: 1 } })}>
          <NoticeBodyEditor value={f.body} onChange={f.setBody} placeholder="내용 (굵게·목록 등 서식 지원)" />
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ComboField value={f.dept} onChange={f.setDept} options={deptOptions} placeholder="부서" ariaLabel="부서" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <ComboField value={f.deptMgr} onChange={f.setDeptMgr} options={deptMgrOptions} placeholder="담당자" ariaLabel="부서담당자" />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
          <TargetPicker f={f} />
        </Box>

        {/* URL 추가 = 파일 첨부 옆·같은 점선 알약(사용자 지시 2026-08-15) */}
        <AttachmentArea f={f} extra={<LinkField variant="pill" value={f.refLink} onChange={f.setRefLink} />} />
      </Box>
    </Dialog>
  )
}
