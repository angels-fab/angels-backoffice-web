import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { ComboField, SelectField, DateField, TimeRangeField, LinkButton, AttachButton } from './inlineFields'
import { dashToBullet, circledNumber } from './workMeta'

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
  value, onChange, onChangeEvent, placeholder, multiline, minRows, ariaLabel, sx, onKeyDown, inputRef,
}: {
  value: string
  onChange?: (v: string) => void
  /** 원본 이벤트가 필요할 때(커서 제어 등) — 있으면 onChange 대신 사용 */
  onChangeEvent?: (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void
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
      onChange={onChangeEvent ?? ((e) => onChange?.(e.target.value))}
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

  // 본문 textarea 커서 제어(자동 글머리·동그라미 변환 후 위치 복원)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const caretRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (caretRef.current != null && bodyRef.current) {
      const pos = caretRef.current
      bodyRef.current.selectionStart = bodyRef.current.selectionEnd = pos
      caretRef.current = null
    }
  }, [body])

  // 입력 변환 — '- ' → '• '(길이 보존) + 줄 시작 'ㅇN ' → 동그라미 숫자(하위 들여쓰기). 커서도 함께 보정.
  const onBodyChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const ta = e.target
    const raw = ta.value
    const cursor = ta.selectionStart ?? raw.length
    const text1 = dashToBullet(raw) // 길이 보존 → 커서 영향 없음
    let cur = cursor
    let out = text1
    // 커서가 있는 줄에서 'ㅇ(1~2자리)+공백' → 들여쓴 동그라미 숫자(상위 bullet의 하위 항목)
    const ls = text1.lastIndexOf('\n', cur - 1) + 1
    const leRel = text1.indexOf('\n', cur)
    const le = leRel < 0 ? text1.length : leRel
    const line = text1.slice(ls, le)
    const m = line.match(/^([ \t]*)[ㅇᄋ](\d{1,2}) /)
    if (m) {
      const ch = circledNumber(parseInt(m[2], 10))
      if (ch) {
        const indent = m[1].length >= 2 ? m[1] : '  ' // 하위 글머리: 최소 2칸 들여쓰기
        const replacement = indent + ch + ' '
        const newLine = replacement + line.slice(m[0].length)
        out = text1.slice(0, ls) + newLine + text1.slice(le)
        const matchAbsEnd = ls + m[0].length
        cur = cur >= matchAbsEnd ? cur + (replacement.length - m[0].length) : ls + replacement.length
      }
    }
    if (out !== raw) caretRef.current = cur
    setBody(out)
  }

  // Enter → 윗줄이 bullet(• )일 때만 새 줄에도 '• ' 자동. 빈 글머리 줄에서 Enter는 글머리 제거.
  const onBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || (e.nativeEvent as { isComposing?: boolean }).isComposing) return
    const ta = e.currentTarget as HTMLTextAreaElement
    const val = ta.value
    const s = ta.selectionStart ?? val.length
    const eend = ta.selectionEnd ?? s
    const lineStart = val.lastIndexOf('\n', s - 1) + 1
    const curLine = val.slice(lineStart, s)
    // 빈 글머리 줄 → 글머리 제거(리스트 빠져나가기)
    if (/^[ \t]*•[ \t]*$/.test(curLine)) {
      e.preventDefault()
      caretRef.current = lineStart
      setBody(val.slice(0, lineStart) + val.slice(eend))
      return
    }
    // 내용 있는 bullet 줄 → 같은 들여쓰기로 '• ' 이어쓰기
    const bm = curLine.match(/^([ \t]*)•[ \t]/)
    if (bm) {
      e.preventDefault()
      const insert = '\n' + bm[1] + '• '
      caretRef.current = s + insert.length
      setBody(val.slice(0, s) + insert + val.slice(eend))
      return
    }
    // 그 외(평문·동그라미 줄) → 자동 글머리 없이 일반 줄바꿈(기본 동작)
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
            onChangeEvent={onBodyChange}
            onKeyDown={onBodyKeyDown}
            inputRef={bodyRef}
            placeholder="업무 내용 — '- '는 글머리(•), 'ㅇ1 '는 동그라미 숫자(①). Enter로 글머리 이어쓰기"
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
