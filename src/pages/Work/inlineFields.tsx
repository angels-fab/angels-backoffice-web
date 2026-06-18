import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import Popover from '@mui/material/Popover'
import Autocomplete from '@mui/material/Autocomplete'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'

/**
 * 인라인 새 업무 폼에서 공용으로 쓰는 입력 위젯 모음.
 * - ComboField: 히스토리 기반 드롭다운 + 자유입력(자동완성)
 * - DateField: 네이티브 date 피커(아이콘 클릭으로 열기) + 빈값일 때 한글 라벨 표시('연도-월-일' 대체)
 * - TimeRangeField: 시작/종료 시각을 wheel picker로 선택 → "HH:MM ~ HH:MM"
 * - LinkButton / AttachButton: 제목줄 우측 아이콘(관련링크 팝업 / 첨부 준비중)
 */

// 모든 입력의 미니멀 보더 룩 (NewTaskCard의 Field와 동일 톤)
export const fieldBase = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid',
  borderColor: th.palette.divider,
  borderRadius: '8px',
  px: 1,
  minHeight: 30,
  fontSize: 13,
  color: th.palette.text.primary,
  transition: 'border-color .12s',
  '&:hover': { borderColor: alpha(th.palette.text.secondary, 0.55) },
})

const popoverPaperSx = {
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: '12px',
  mt: 0.5,
}

// ───────────────────────────── ComboField (드롭다운 + 자동완성) ─────────────────────────────

export function ComboField({
  value, onChange, options, placeholder, ariaLabel, sx,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  ariaLabel: string
  sx?: SxProps<Theme>
}) {
  return (
    <Autocomplete
      freeSolo
      openOnFocus
      autoHighlight
      disableClearable
      options={options}
      value={value}
      inputValue={value}
      onInputChange={(_, v) => onChange(v)}
      sx={[...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      slotProps={{ paper: { sx: popoverPaperSx } }}
      renderInput={(params) => (
        <InputBase
          ref={params.slotProps.input.ref}
          inputProps={{ ...params.slotProps.htmlInput, 'aria-label': ariaLabel }}
          placeholder={placeholder}
          sx={(th) => ({
            ...fieldBase(th),
            display: 'flex',
            alignItems: 'center',
            py: 0.4,
            width: '100%',
            '&.Mui-focused': { borderColor: th.palette.accent.green },
            '& input::placeholder': { color: 'text.disabled', opacity: 1 },
          })}
        />
      )}
    />
  )
}

// ───────────────────────────── DateField (라벨 + 아이콘으로 피커 열기) ─────────────────────────────

export function DateField({
  value, onChange, label, ariaLabel, sx,
}: {
  value: string
  onChange: (v: string) => void
  /** 빈값일 때 표시할 한글 라벨 (예: '발의일자' · '예정일') */
  label: string
  ariaLabel: string
  sx?: SxProps<Theme>
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker() } catch { el.focus() }
    } else {
      el.focus()
    }
  }
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      sx={[
        (th) => ({
          ...fieldBase(th),
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <Box
        component="span"
        sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'text.primary' : 'text.disabled' }}
      >
        {value || label}
      </Box>
      <CalendarTodayIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
      {/* 실제 값/피커는 시각적으로 숨긴 네이티브 date 입력이 담당 */}
      <Box
        component="input"
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        tabIndex={-1}
        aria-hidden
        sx={{ position: 'absolute', left: 8, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, p: 0, m: 0, colorScheme: 'dark' }}
      />
    </Box>
  )
}

// ───────────────────────────── TimeRangeField (wheel picker) ─────────────────────────────

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const ITEM_H = 32 // wheel 한 칸 높이(px)

type HM = { h: string; m: string }

// "HH:MM ~ HH:MM" / "HH:MM" → { start, end }
function parseRange(time: string): { start: HM | null; end: HM | null } {
  const found = (time || '').match(/(\d{1,2}):(\d{2})/g) || []
  const toHM = (s: string): HM => {
    const [h, m] = s.split(':')
    return { h: h.padStart(2, '0'), m: m.padStart(2, '0') }
  }
  return {
    start: found[0] ? toHM(found[0]) : null,
    end: found[1] ? toHM(found[1]) : null,
  }
}

// 한 개의 휠 컬럼 — 스크롤 스냅으로 중앙 항목 선택
function Wheel({ items, value, onChange, ariaLabel }: { items: string[]; value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()
  // 마운트 시 현재 값으로 스크롤 위치 정렬
  useEffect(() => {
    const i = items.indexOf(value)
    if (ref.current && i >= 0) ref.current.scrollTop = i * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onScroll = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      let i = Math.round(el.scrollTop / ITEM_H)
      i = Math.max(0, Math.min(items.length - 1, i))
      if (Math.abs(el.scrollTop - i * ITEM_H) > 1) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })
      if (items[i] !== value) onChange(items[i])
    }, 90)
  }
  return (
    <Box
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      onScroll={onScroll}
      sx={{
        width: 44,
        height: ITEM_H * 5,
        overflowY: 'auto',
        scrollSnapType: 'y mandatory',
        py: `${ITEM_H * 2}px`,
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {items.map((it) => (
        <Box
          key={it}
          onClick={() => { ref.current?.scrollTo({ top: items.indexOf(it) * ITEM_H, behavior: 'smooth' }); onChange(it) }}
          sx={{
            height: ITEM_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scrollSnapAlign: 'center',
            cursor: 'pointer',
            fontSize: 16,
            fontVariantNumeric: 'tabular-nums',
            color: it === value ? 'text.primary' : 'text.disabled',
            fontWeight: it === value ? 700 : 400,
            transition: 'color .1s',
          }}
        >
          {it}
        </Box>
      ))}
    </Box>
  )
}

function WheelGroup({
  label, hm, onHour, onMinute,
}: {
  label: string
  hm: HM
  onHour: (h: string) => void
  onMinute: (m: string) => void
}) {
  return (
    <Box>
      <Box sx={{ textAlign: 'center', fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{label}</Box>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* 중앙 선택 밴드 */}
        <Box
          aria-hidden
          sx={(th) => ({
            position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)',
            height: ITEM_H, borderRadius: '8px', bgcolor: alpha(th.palette.accent.green, 0.14),
            border: 1, borderColor: alpha(th.palette.accent.green, 0.4), pointerEvents: 'none',
          })}
        />
        <Wheel items={HOURS} value={hm.h} onChange={onHour} ariaLabel={`${label} 시`} />
        <Box sx={{ fontWeight: 700, fontSize: 16, px: 0.25 }}>:</Box>
        <Wheel items={MINUTES} value={hm.m} onChange={onMinute} ariaLabel={`${label} 분`} />
      </Box>
    </Box>
  )
}

export function TimeRangeField({
  value, onChange, sx,
}: {
  value: string
  onChange: (v: string) => void
  sx?: SxProps<Theme>
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [start, setStart] = useState<HM>({ h: '09', m: '00' })
  const [end, setEnd] = useState<HM>({ h: '10', m: '00' })

  const openPopover = (e: React.MouseEvent<HTMLElement>) => {
    const p = parseRange(value)
    setStart(p.start ?? { h: '09', m: '00' })
    setEnd(p.end ?? { h: '10', m: '00' })
    setAnchor(e.currentTarget)
  }
  const apply = () => { onChange(`${start.h}:${start.m} ~ ${end.h}:${end.m}`); setAnchor(null) }
  const clear = () => { onChange(''); setAnchor(null) }

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        aria-label="시간(시작·종료) 선택"
        onClick={openPopover}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPopover(e as unknown as React.MouseEvent<HTMLElement>) } }}
        sx={[
          (th) => ({
            ...fieldBase(th),
            display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
            '&:focus-visible': { outline: 'none', borderColor: th.palette.accent.green },
          }),
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        <AccessTimeIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
        <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: value ? 'text.primary' : 'text.disabled' }}>
          {value || '시간'}
        </Box>
      </Box>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: popoverPaperSx } }}
      >
        <Box sx={{ p: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <WheelGroup label="시작시간" hm={start} onHour={(h) => setStart((s) => ({ ...s, h }))} onMinute={(m) => setStart((s) => ({ ...s, m }))} />
            <WheelGroup label="종료시간" hm={end} onHour={(h) => setEnd((s) => ({ ...s, h }))} onMinute={(m) => setEnd((s) => ({ ...s, m }))} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Button size="small" onClick={clear} sx={{ color: 'text.secondary' }}>지우기</Button>
            <Button size="small" variant="contained" color="success" onClick={apply}>확인</Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

// ───────────────────────────── LinkButton (관련링크 팝업) ─────────────────────────────

export function LinkButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const active = !!value.trim()
  return (
    <>
      <Tooltip title={active ? '관련 링크 편집' : '관련 링크 추가'}>
        <IconButton
          size="small"
          aria-label="관련 링크"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={(th) => ({ color: active ? th.palette.accent.green : 'text.secondary', p: 0.5 })}
        >
          <OpenInNewIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: popoverPaperSx } }}
      >
        <Box sx={{ p: 1.5, width: 320 }}>
          <Box sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>관련 링크</Box>
          <InputBase
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            inputProps={{ 'aria-label': '관련 링크 입력' }}
            sx={(th) => ({ ...fieldBase(th), py: 0.5, width: '100%', '&.Mui-focused': { borderColor: th.palette.accent.green } })}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Button size="small" onClick={() => onChange('')} sx={{ color: 'text.secondary' }}>지우기</Button>
            <Button size="small" variant="contained" color="success" onClick={() => setAnchor(null)}>확인</Button>
          </Box>
        </Box>
      </Popover>
    </>
  )
}

// ───────────────────────────── AttachButton (준비중 · 기능 없음) ─────────────────────────────

export function AttachButton() {
  return (
    <Tooltip title="첨부 (준비 중)">
      <span>
        <IconButton size="small" disabled aria-label="첨부 (준비 중)" sx={{ color: 'text.disabled', p: 0.5 }}>
          <AttachFileIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </span>
    </Tooltip>
  )
}
