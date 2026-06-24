import { useState } from 'react'
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
import { ComboField } from '@/pages/Work/inlineFields'
import { MEMBERS, given } from '@/pages/Calendar/members'

// 분류 항목(드롭다운) — 안전/보안/시설/교육/일반
export const NOTICE_CATS = ['안전', '보안', '시설', '교육', '일반']
// 해당자 후보 — 캘린더 팀원(센터 제외): 신현진/박주봉/박세리/조성범
const TARGET_MEMBERS = MEMBERS.filter((m) => m.id !== '센터')

export interface NoticeFormValues {
  cat: string
  title: string
  body: string
  ref: string
  dept: string
  deptMgr: string
  target: string
  pinned: boolean
}

const inputSx = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid', borderColor: th.palette.divider, borderRadius: '6px',
  px: 1, py: 0.4, fontSize: 12.5, color: 'text.primary',
  '&.Mui-focused': { borderColor: th.palette.primary.main },
  '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
})

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
      value={NOTICE_CATS.includes(value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      displayEmpty
      variant="standard"
      disableUnderline
      renderValue={(v) => (v ? <span>{v}</span> : <Box component="span" sx={{ color: 'text.disabled' }}>분류</Box>)}
      MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } } }}
      sx={(th) => ({
        ...inputSx(th), width: 88, maxWidth: '100%', height: 32,
        '& .MuiSelect-select': { p: 0, pl: '8px !important', pr: '22px !important', minHeight: '0 !important', display: 'flex', alignItems: 'center' },
        '& .MuiSelect-icon': { right: 2, color: 'text.secondary' },
      })}
    >
      {NOTICE_CATS.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>)}
    </Select>
  )
}

export interface NoticeComposeProps {
  mode: 'new' | 'edit'
  notice?: Notice
  author: string
  saving: boolean
  deptOptions: string[]
  deptMgrOptions: string[]
  onSave: (v: NoticeFormValues) => void
  onCancel: () => void
}

/** 공지 작성/수정 인라인 행 — 표 열(번호·분류·제목·작성자·작성일)에 맞춘 2행 구조. */
export default function NoticeCompose({ mode, notice, author, saving, deptOptions, deptMgrOptions, onSave, onCancel }: NoticeComposeProps) {
  const [cat, setCat] = useState(notice && NOTICE_CATS.includes(notice.cat) ? notice.cat : '일반')
  const [title, setTitle] = useState(notice?.title || '')
  const [body, setBody] = useState(notice?.body || '')
  const [refLink, setRefLink] = useState(notice?.ref || '')
  const [dept, setDept] = useState(notice?.dept || '')
  const [deptMgr, setDeptMgr] = useState(notice?.deptMgr || '')
  const [pinned, setPinned] = useState(notice?.pinned || false)
  const [targets, setTargets] = useState<string[]>(
    (notice?.target || '').split(',').map((s) => s.trim()).filter((t) => TARGET_MEMBERS.some((m) => m.name === t)),
  )
  const dateStr = mode === 'new' ? todaySeoul() : (notice?.date || '')
  const amber = (th: Theme) => alpha(th.palette.accent.amber, 0.07)
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const toggleTarget = (name: string) => setTargets((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]))
  const save = () => onSave({ cat, title: title.trim(), body: body.trim(), ref: refLink.trim(), dept: dept.trim(), deptMgr: deptMgr.trim(), target: targets.join(', '), pinned })

  return (
    <>
      <TableRow sx={{ '& td': { bgcolor: amber, py: 1, verticalAlign: 'middle' } }}>
        {/* 번호 칸 → 중요(상단강조) 압정 토글 */}
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
            {/* 부서 / 부서담당자 — 히스토리 기반 자동완성 */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              <Box sx={{ width: 180, maxWidth: '100%' }}>
                <ComboField value={dept} onChange={setDept} options={deptOptions} placeholder="부서 (선택)" ariaLabel="부서" />
              </Box>
              <Box sx={{ width: 180, maxWidth: '100%' }}>
                <ComboField value={deptMgr} onChange={setDeptMgr} options={deptMgrOptions} placeholder="부서담당자 (선택)" ariaLabel="부서담당자" />
              </Box>
            </Box>
            {/* 해당자 — 팀원 동그라미 칩(선택 시 컬러, 해제 시 흐림) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'text.disabled' }}>해당자</Box>
              {TARGET_MEMBERS.map((m) => {
                const on = targets.includes(m.name)
                return (
                  <Box
                    key={m.id}
                    role="checkbox" aria-checked={on} aria-label={`해당자 ${m.name}${on ? '' : ' (해제됨)'}`} tabIndex={0}
                    title={m.name}
                    onClick={() => toggleTarget(m.name)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTarget(m.name) } }}
                    style={{ backgroundColor: on ? m.color : 'transparent', color: on ? '#fff' : undefined, opacity: on ? 1 : 0.5, filter: on ? 'none' : 'grayscale(1)' }}
                    sx={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '-0.5px', cursor: 'pointer', flex: 'none',
                      border: on ? 'none' : '1px solid', borderColor: 'divider', color: 'text.disabled',
                      transition: 'opacity .15s, filter .15s',
                    }}
                  >
                    {given(m.name)}
                  </Box>
                )
              })}
            </Box>
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
