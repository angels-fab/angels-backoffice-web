import { useState } from 'react'
import type { MouseEvent } from 'react'
import Box from '@mui/material/Box'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import InputBase from '@mui/material/InputBase'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import PushPinIcon from '@mui/icons-material/PushPin'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import type { Notice } from '@/types'
import { todaySeoul } from '@/utils/date'

// 포털개선요청 작성폼과 동일 패턴 — 표 안에서 팝업 없이 in-place 작성/수정.
const CATS = ['긴급', '공지', '일반', '회의', '교육', '행사', '점검']

export interface NoticeFormValues {
  cat: string
  title: string
  body: string
  ref: string
  dept: string
  pinned: boolean
}

const inputSx = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid', borderColor: th.palette.divider, borderRadius: '6px',
  px: 1, py: 0.4, fontSize: 12.5, color: 'text.primary',
  '&.Mui-focused': { borderColor: th.palette.primary.main },
  '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})

// 관련자료(첨부) — 박스 없는 아이콘 + 입력 팝업 (값 있으면 파랑)
function LinkField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = !!value.trim()
  return (
    <>
      <Tooltip title={active ? '관련자료(첨부) 편집' : '관련자료(첨부) 추가'}>
        <IconButton size="small" aria-label="관련자료" onClick={(e) => setAnchor(e.currentTarget)} sx={(th) => ({ color: active ? th.palette.accent.blue : 'text.disabled', p: 0.5 })}>
          <OpenInNewIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: '10px', mt: 0.5 } } }}>
        <Box sx={{ p: 1.5, width: 300 }}>
          <Box sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>관련자료 / 첨부 링크</Box>
          <InputBase autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" inputProps={{ 'aria-label': '관련자료 링크' }} sx={(th) => ({ ...inputSx(th), width: '100%', py: 0.5 })} />
        </Box>
      </Popover>
    </>
  )
}

function CatDrop({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="standard"
      disableUnderline
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      sx={(th) => ({
        ...inputSx(th), width: 88, maxWidth: '100%', height: 32,
        '& .MuiSelect-select': { p: 0, pl: '8px !important', pr: '22px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {CATS.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>)}
    </Select>
  )
}

export interface NoticeComposeProps {
  mode: 'new' | 'edit'
  notice?: Notice
  author: string
  saving: boolean
  onSave: (v: NoticeFormValues) => void
  onCancel: () => void
}

/** 공지 작성/수정 인라인 행 — 표 열(번호·분류·제목·작성자·작성일)에 맞춘 2행 구조. */
export default function NoticeCompose({ mode, notice, author, saving, onSave, onCancel }: NoticeComposeProps) {
  const [cat, setCat] = useState(notice?.cat || '공지')
  const [title, setTitle] = useState(notice?.title || '')
  const [body, setBody] = useState(notice?.body || '')
  const [refLink, setRefLink] = useState(notice?.ref || '')
  const [dept, setDept] = useState(notice?.dept || '')
  const [pinned, setPinned] = useState(notice?.pinned || false)
  const dateStr = mode === 'new' ? todaySeoul() : (notice?.date || '')
  const amber = (th: Theme) => alpha(th.palette.accent.amber, 0.07)
  const stop = (e: MouseEvent) => e.stopPropagation()
  const save = () => onSave({ cat, title: title.trim(), body: body.trim(), ref: refLink.trim(), dept: dept.trim(), pinned })

  return (
    <>
      <TableRow sx={{ '& td': { bgcolor: amber, py: 1, verticalAlign: 'middle' } }}>
        {/* 번호 칸 → 중요(상단강조) 토글 */}
        <TableCell sx={{ textAlign: 'center' }} onClick={stop}>
          <Tooltip title={pinned ? '중요(상단강조) 해제' : '중요(상단강조)'}>
            <Box
              role="checkbox" aria-checked={pinned} aria-label="중요(상단강조)" tabIndex={0}
              onClick={() => setPinned((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((v) => !v) } }}
              sx={(th) => ({
                width: 26, height: 26, mx: 'auto', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid',
                ...(pinned
                  ? { bgcolor: th.palette.accent.amber, borderColor: th.palette.accent.amber, color: '#fff' }
                  : { borderColor: th.palette.divider, color: 'text.disabled' }),
              })}
            >
              <PushPinIcon sx={{ fontSize: 15 }} />
            </Box>
          </Tooltip>
        </TableCell>
        <TableCell onClick={stop}><CatDrop value={cat} onChange={setCat} /></TableCell>
        <TableCell onClick={stop}>
          <InputBase
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            inputProps={{ 'aria-label': '제목' }}
            endAdornment={<LinkField value={refLink} onChange={setRefLink} />}
            sx={(th) => ({ ...inputSx(th), width: '100%', height: 32 })}
          />
        </TableCell>
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5 }}>{mode === 'new' ? author : (notice?.author || '-')}</TableCell>
        <TableCell sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{dateStr}</TableCell>
      </TableRow>
      <TableRow sx={{ '& td': { borderTop: 0, bgcolor: amber, py: 0.75, verticalAlign: 'top' } }}>
        <TableCell />
        <TableCell colSpan={3} onClick={stop}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <InputBase value={dept} onChange={(e) => setDept(e.target.value)} placeholder="부서 (선택)" inputProps={{ 'aria-label': '부서' }} sx={(th) => ({ ...inputSx(th), width: 220, maxWidth: '100%', height: 30 })} />
            <InputBase value={body} onChange={(e) => setBody(e.target.value)} placeholder="내용" multiline minRows={2} inputProps={{ 'aria-label': '내용' }} sx={(th) => ({ ...inputSx(th), width: '100%', minHeight: 44, py: '6px' })} />
          </Box>
        </TableCell>
        <TableCell onClick={stop} sx={{ textAlign: 'center', verticalAlign: 'top', pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
            <Tooltip title={mode === 'edit' ? '수정 저장' : '등록'}>
              <span><IconButton size="small" color="success" aria-label="저장" onClick={save} disabled={saving}><CheckIcon sx={{ fontSize: 19 }} /></IconButton></span>
            </Tooltip>
            <Tooltip title="취소">
              <span><IconButton size="small" color="error" aria-label="취소" onClick={onCancel} disabled={saving}><CloseIcon sx={{ fontSize: 19 }} /></IconButton></span>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
    </>
  )
}
