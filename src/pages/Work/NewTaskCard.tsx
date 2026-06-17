import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'

/** 인라인 새 업무 작성 폼 값 — 저장 시 index에서 createWork 페이로드로 변환 */
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

export interface NewTaskCardProps {
  /** 저장 진행 중 — 입력/버튼 비활성화 */
  saving: boolean
  onCancel: () => void
  onSave: (form: NewTaskForm) => void
  /** 입력값 존재 여부 변화 알림 — 뷰 전환 시 작성 중 내용 보호용 */
  onDirtyChange?: (dirty: boolean) => void
}

// 카드 안에서 쓰는 인라인 입력 — 미니멀 보더 + 포커스 시 초록 테두리
function Field({
  value, onChange, placeholder, type, multiline, minRows, ariaLabel, sx,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  multiline?: boolean
  minRows?: number
  ariaLabel: string
  sx?: SxProps<Theme>
}) {
  return (
    <InputBase
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      multiline={multiline}
      minRows={minRows}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={[
        (th) => ({
          bgcolor: alpha(th.palette.text.primary, 0.05),
          border: '1px solid', borderColor: th.palette.divider, borderRadius: '8px',
          px: 1, py: 0.4, fontSize: 13, color: 'text.primary',
          colorScheme: 'dark', // 네이티브 date 피커를 다크 테마에 맞춤(모달 .minput과 동일)
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
 * 인라인 새 업무 카드 — 업무 카드 템플릿 그대로(진행중 초록 톤), 표시될 자리에 빈칸을 두고 직접 입력.
 * 제목줄: 구분·제목·담당자·발의일자 + 저장(✓)/취소(✕). 본문: 부서/예정일/시간/장소 · 내용 · 링크 + 우측 Check 토글.
 */
export default function NewTaskCard({ saving, onCancel, onSave, onDirtyChange }: NewTaskCardProps) {
  const [cat, setCat] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [mgr, setMgr] = useState('')
  const [start, setStart] = useState('')
  const [plan, setPlan] = useState('')
  const [dept, setDept] = useState('')
  const [time, setTime] = useState('')
  const [loc, setLoc] = useState('')
  const [link, setLink] = useState('')
  const [chief, setChief] = useState(false)

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
        <Field value={cat} onChange={setCat} placeholder="구분" ariaLabel="구분" sx={{ width: 100, flexShrink: 0 }} />
        <Field value={title} onChange={setTitle} placeholder="업무 제목 입력…" ariaLabel="업무 제목" sx={{ flex: 1, minWidth: 140 }} />
        <Field value={mgr} onChange={setMgr} placeholder="담당자" ariaLabel="담당자" sx={{ width: 96, flexShrink: 0 }} />
        <Field value={start} onChange={setStart} type="date" ariaLabel="발의일자" sx={{ width: 148, flexShrink: 0 }} />
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
            <Field value={dept} onChange={setDept} placeholder="부서" ariaLabel="부서" />
            <Field value={plan} onChange={setPlan} type="date" ariaLabel="예정일" />
            <Field value={time} onChange={setTime} placeholder="시간" ariaLabel="시간" />
            <Field value={loc} onChange={setLoc} placeholder="장소" ariaLabel="장소" />
          </Box>
          <Field value={body} onChange={setBody} placeholder="업무 내용 — 줄바꿈으로 세부 항목 입력" ariaLabel="업무 내용" multiline minRows={3} sx={{ alignItems: 'flex-start' }} />
          <Field value={link} onChange={setLink} placeholder="관련 링크 (https://…)" ariaLabel="관련 링크" />
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
