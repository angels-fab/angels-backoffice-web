import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { ComboField, SelectField, DateField, TimeRangeField, LinkButton, AttachButton } from './inlineFields'
import { dashToBullet } from './workMeta'

/** 인라인 새 업무 작성 폼 값 — 저장 시 index에서 createWork/updateWork 페이로드로 변환 */
export interface NewTaskForm {
  cat: string
  title: string
  body: string
  mgr: string
  start: string
  plan: string
  dept: string
  time: string
  loc: string
  link: string
  chief: boolean
}

/** 드롭다운/자동완성 후보 */
export interface FieldOptions {
  cats: string[]
  mgrs: string[]
  depts: string[]
  locs: string[]
}

export interface NewTaskCardProps {
  /** 저장 진행 중 — 입력/버튼 비활성화 */
  saving: boolean
  /** 드롭다운/자동완성 후보 */
  options: FieldOptions
  /** 수정 모드 — 기존 값 채움(없으면 새 업무 빈 폼) */
  initial?: NewTaskForm
  onCancel: () => void
  onSave: (form: NewTaskForm) => void
  /** 입력값 존재 여부 변화 알림 — 뷰 전환 시 작성 중 내용 보호용 */
  onDirtyChange?: (dirty: boolean) => void
}

// 카드 안에서 쓰는 인라인 입력 — 미니멀 보더 + 포커스 시 초록 테두리 (제목/본문 전용)
function Field({
  value, onChange, placeholder, multiline, minRows, ariaLabel, sx, onKeyDown, inputRef,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  minRows?: number
  ariaLabel: string
  sx?: SxProps<Theme>
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
  inputRef?: React.Ref<HTMLTextAreaElement | HTMLInputElement>
}) {
  return (
    <InputBase
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      placeholder={placeholder}
      multiline={multiline}
      minRows={minRows}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={[
        (th) => ({
          bgcolor: alpha(th.palette.text.primary, 0.05),
          border: '1px solid', borderColor: th.palette.divider, borderRadius: '8px',
          px: 1, py: 0.4, fontSize: 13, color: 'text.primary',
          transition: 'border-color .12s',
          '&:hover': { borderColor: alpha(th.palette.text.secondary, 0.55) },
          '&.Mui-focused': { borderColor: th.palette.accent.green },
          '& input::placeholder, & textarea::placeholder': { color: 'text.disabled', opacity: 1 },
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  )
}

/**
 * 인라인 업무 작성/수정 카드 — 업무 카드 템플릿 그대로(초록 톤), 표시될 자리에 빈칸을 두고 직접 입력.
 * 제목줄: 구분(드롭다운)·제목·링크/첨부 아이콘·담당자(드롭다운)·발의일자 + 저장(✓)/취소(✕).
 * 본문: 부서(자동완성)/예정일/시간(wheel)/장소(자동완성) · 내용(Enter→글머리) + 우측 Check 토글.
 */
export default function NewTaskCard({ saving, options, initial, onCancel, onSave, onDirtyChange }: NewTaskCardProps) {
  const [cat, setCat] = useState(initial?.cat ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [mgr, setMgr] = useState(initial?.mgr ?? '')
  const [start, setStart] = useState(initial?.start ?? '')
  const [plan, setPlan] = useState(initial?.plan ?? '')
  const [dept, setDept] = useState(initial?.dept ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [loc, setLoc] = useState(initial?.loc ?? '')
  const [link, setLink] = useState(initial?.link ?? '')
  const [chief, setChief] = useState(initial?.chief ?? false)

  // 본문 textarea 커서 제어(Enter 자동 글머리 후 위치 복원)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const caretRef = useRef<number | null>(null)
  const applyBody = (v: string) => setBody(dashToBullet(v))
  useLayoutEffect(() => {
    if (caretRef.current != null && bodyRef.current) {
      const pos = caretRef.current
      bodyRef.current.selectionStart = bodyRef.current.selectionEnd = pos
      caretRef.current = null
    }
  }, [body])

  // Enter → 새 줄 자동 글머리(• ). 빈 글머리 줄에서 Enter는 글머리 제거(리스트 빠져나가기).
  const onBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || (e.nativeEvent as { isComposing?: boolean }).isComposing) return
    const ta = e.currentTarget as HTMLTextAreaElement
    const s = ta.selectionStart ?? body.length
    const eend = ta.selectionEnd ?? s
    const lineStart = body.lastIndexOf('\n', s - 1) + 1
    const curLine = body.slice(lineStart, s)
    e.preventDefault()
    if (/^[ \t]*•[ \t]*$/.test(curLine)) {
      const next = body.slice(0, lineStart) + body.slice(eend)
      caretRef.current = lineStart
      applyBody(next)
      return
    }
    const insert = '\n• '
    const next = body.slice(0, s) + insert + body.slice(eend)
    caretRef.current = s + insert.length
    applyBody(next)
  }

  // 입력값 존재 여부를 부모에 보고 — 뷰 전환 시 작성 중 내용 손실 방지(확인 안내)
  const dirty = !!(cat || title || body || mgr || start || plan || dept || time || loc || link || chief)
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  const save = () => {
    if (saving) return
    onSave({ cat, title, body, mgr, start, plan, dept, time, loc, link, chief })
  }

  return (
    <Box
      sx={(th) => ({
        bgcolor: alpha(th.palette.accent.green, 0.1),
        border: 1, borderColor: th.palette.accent.green,
        boxShadow: `inset 0 0 0 1px ${th.palette.accent.green}`,
        borderRadius: 1, overflow: 'hidden',
      })}
    >
      {/* 제목 줄 */}
      <Box
        sx={(th) => ({
          display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          px: 1.75, py: 1.25,
          bgcolor: alpha(th.palette.accent.green, 0.18),
          borderBottom: 1, borderColor: alpha(th.palette.accent.green, 0.3),
        })}
      >
        <SelectField value={cat} onChange={setCat} options={options.cats} placeholder="구분" ariaLabel="구분" sx={{ width: 110, flexShrink: 0 }} />
        <Field value={title} onChange={setTitle} placeholder="업무 제목 입력…" ariaLabel="업무 제목" sx={{ flex: 1, minWidth: 140 }} />
        {/* 제목 우측 — 관련링크(팝업) · 첨부(준비중) 아이콘 */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <LinkButton value={link} onChange={setLink} />
          <AttachButton />
        </Box>
        <ComboField value={mgr} onChange={setMgr} options={options.mgrs} placeholder="담당자" ariaLabel="담당자" sx={{ width: 110, flexShrink: 0 }} />
        <DateField value={start} onChange={setStart} label="발의일자" ariaLabel="발의일자" sx={{ width: 130, flexShrink: 0 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 0.25, flexShrink: 0 }}>
          <Tooltip title="저장">
            <span>
              <IconButton size="small" aria-label="저장" onClick={save} disabled={saving} sx={(th) => ({ color: th.palette.accent.green, p: 0.5 })}>
                <CheckIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="취소">
            <span>
              <IconButton size="small" aria-label="취소" onClick={onCancel} disabled={saving} sx={{ color: 'text.secondary', p: 0.5 }}>
                <CloseIcon sx={{ fontSize: 19 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {/* 본문 */}
      <Box sx={{ px: 1.75, py: 1.5, display: 'flex', alignItems: 'stretch', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1 }}>
            <ComboField value={dept} onChange={setDept} options={options.depts} placeholder="부서" ariaLabel="부서" />
            <DateField value={plan} onChange={setPlan} label="예정일" ariaLabel="예정일" />
            <TimeRangeField value={time} onChange={setTime} />
            <ComboField value={loc} onChange={setLoc} options={options.locs} placeholder="장소" ariaLabel="장소" />
          </Box>
          <Field
            value={body}
            onChange={applyBody}
            onKeyDown={onBodyKeyDown}
            inputRef={bodyRef}
            placeholder="업무 내용 — Enter로 줄을 바꾸면 글머리(•)가 자동 추가됩니다"
            ariaLabel="업무 내용"
            multiline
            minRows={3}
            sx={{ alignItems: 'flex-start' }}
          />
        </Box>
        {/* Check 토글 — 보라(활성)/회색(비활성), 업무 카드의 Check 칩과 동일 크기 */}
        <Box
          role="button"
          tabIndex={0}
          aria-pressed={chief}
          aria-label="검토 필요(Check) 토글"
          onClick={() => setChief((v) => !v)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChief((v) => !v) } }}
          sx={(th) => ({
            width: 84, height: 84, flexShrink: 0, alignSelf: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
            border: 1, borderRadius: '14px', cursor: 'pointer',
            transition: 'border-color .12s, background-color .12s',
            ...(chief
              ? { borderColor: alpha(th.palette.accent.purple, 0.55), bgcolor: alpha(th.palette.accent.purple, 0.16), color: th.palette.accent.purple }
              : { borderColor: th.palette.divider, bgcolor: 'transparent', color: 'text.secondary' }),
          })}
        >
          <CheckIcon sx={{ fontSize: 20 }} />
          <Box component="span" sx={{ fontWeight: 700, fontSize: 14 }}>Check</Box>
        </Box>
      </Box>
    </Box>
  )
}
