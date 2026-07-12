import Box from '@mui/material/Box'
import InputBase from '@mui/material/InputBase'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha, type SxProps, type Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { radius } from '@/theme/tokens'

/**
 * 폼 필드 표준 (P2-1, D4 확정: 단일 컴포넌트 + 2 variant).
 *
 * - variant="modal"  : 작성폼 다이얼로그용 — 테마 TextField(size small·radius 10·공통 포커스링) 그대로.
 * - variant="inline" : 표 안/카드형 인라인 편집용 — 미니멀 룩(옅은 채움+보더).
 *   기존 손코딩 2진영(radius 6/8·fontSize 12.5/13·포커스 green/primary 3갈래)을
 *   radius 10(control)·fontSize 13(body)·공통 파란 포커스링 1값으로 정규화한 승격판.
 *
 * 날짜/시간은 DateField/TimeField(네이티브 피커·다크 colorScheme) 하나로 통일 —
 * raw <input type=date>·숨긴 native+showPicker 등 4방식 손코딩 금지.
 */
export type FieldVariant = 'modal' | 'inline'

/** inline variant 공통 룩 — 페이지에서 이 밖의 필드 룩 손코딩 금지 */
export const inlineFieldSx = (th: Theme) => ({
  bgcolor: alpha(th.palette.text.primary, 0.05),
  border: '1px solid',
  borderColor: th.palette.divider,
  borderRadius: `${radius.input}px`,
  px: 1,
  minHeight: 30,
  fontSize: '0.8125rem', // body(13px) — variant 밖 컨텍스트라 rem 직접
  color: th.palette.text.primary,
  transition: 'border-color .12s, box-shadow .12s',
  '&:hover': { borderColor: alpha(th.palette.text.secondary, 0.55) },
  '&.Mui-focused': {
    borderColor: th.palette.primary.main,
    boxShadow: `0 0 0 3px ${alpha(th.palette.primary.main, 0.4)}`,
  },
  '& input::placeholder, & textarea::placeholder': { color: th.palette.text.disabled, opacity: 1 },
  // 네이티브 date/time 피커 아이콘을 다크로
  '& input': { colorScheme: 'dark' },
})

/** inline 라벨(외부 캡션) — modal은 TextField label prop 사용 */
function InlineLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
      {children}
    </Typography>
  )
}

export interface FormFieldProps {
  value: string
  onChange: (v: string) => void
  variant?: FieldVariant
  label?: string
  type?: 'text' | 'date' | 'time'
  placeholder?: string
  multiline?: boolean
  minRows?: number
  required?: boolean
  disabled?: boolean
  autoFocus?: boolean
  error?: boolean
  helperText?: string
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

/**
 * FormField — 텍스트·날짜·시간 입력 표준.
 *
 * @example 모달 폼
 * <FormField label="장소" value={loc} onChange={setLoc} />
 * @example 인라인 편집
 * <FormField variant="inline" placeholder="내용" value={v} onChange={setV} />
 */
export function FormField({
  value,
  onChange,
  variant = 'modal',
  label,
  type = 'text',
  placeholder,
  multiline,
  minRows,
  required,
  disabled,
  autoFocus,
  error,
  helperText,
  fullWidth = true,
  sx,
}: FormFieldProps) {
  if (variant === 'modal') {
    return (
      <TextField
        label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        multiline={multiline}
        minRows={minRows}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        error={error}
        helperText={helperText}
        fullWidth={fullWidth}
        slotProps={{
          // date/time은 값이 없어도 라벨이 겹치지 않게 항상 축소
          inputLabel: type !== 'text' ? { shrink: true } : undefined,
          htmlInput: { style: { colorScheme: 'dark' } },
        }}
        sx={sx}
      />
    )
  }
  return (
    <Box sx={{ width: fullWidth ? '100%' : undefined }}>
      {label && <InlineLabel>{label}</InlineLabel>}
      <InputBase
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        multiline={multiline}
        minRows={minRows}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        error={error}
        fullWidth={fullWidth}
        sx={[inlineFieldSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>}
      />
      {helperText && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: error ? 'error.main' : 'text.disabled' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  )
}

export interface SelectFieldProps {
  value: string
  onChange: (v: string) => void
  /** 문자열 배열 또는 {value,label} 배열 */
  options: Array<string | { value: string; label: string }>
  variant?: FieldVariant
  label?: string
  /** 빈 값일 때 표시(선택 안내) */
  placeholder?: string
  required?: boolean
  disabled?: boolean
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

/**
 * SelectField — 드롭다운 선택 표준 (기존 4방식 → 1).
 * 필터 토글은 StatusChip(selected), 2~4개 즉시 전환은 ToggleButtonGroup — 그 외 선택은 전부 이것.
 */
export function SelectField({
  value,
  onChange,
  options,
  variant = 'modal',
  label,
  placeholder,
  required,
  disabled,
  fullWidth = true,
  sx,
}: SelectFieldProps) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  const items = [
    ...(placeholder
      ? [
          <MenuItem key="__ph" value="" disabled>
            {placeholder}
          </MenuItem>,
        ]
      : []),
    ...opts.map((o) => (
      <MenuItem key={o.value} value={o.value}>
        {o.label}
      </MenuItem>
    )),
  ]
  const renderVal = (v: unknown) =>
    v === '' && placeholder ? (
      <Box component="span" sx={{ color: 'text.disabled' }}>{placeholder}</Box>
    ) : (
      opts.find((o) => o.value === v)?.label ?? String(v)
    )
  if (variant === 'modal') {
    return (
      <TextField
        select
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        fullWidth={fullWidth}
        // placeholder를 닫힌 컨트롤에도 표시(displayEmpty) — 라벨 겹침 방지로 shrink 동반 (리뷰 확정 수정)
        slotProps={
          placeholder
            ? { inputLabel: { shrink: true }, select: { displayEmpty: true, renderValue: renderVal } }
            : undefined
        }
        sx={sx}
      >
        {items}
      </TextField>
    )
  }
  return (
    <Box sx={{ width: fullWidth ? '100%' : undefined }}>
      {label && <InlineLabel>{label}</InlineLabel>}
      {/* 리뷰 확정 수정: ① Select에 sx를 넘기면 cloneElement가 InputBase의 sx를 클로버 →
          외부 sx는 InputBase 쪽에 배열 병합 ② variant standard = notched prop 누수 경고 차단 */}
      <Select
        variant="standard"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        displayEmpty={!!placeholder}
        required={required}
        disabled={disabled}
        fullWidth={fullWidth}
        input={<InputBase sx={[inlineFieldSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])] as SxProps<Theme>} />}
        renderValue={renderVal}
        MenuProps={{ slotProps: { paper: { sx: { mt: 0.5 } } } }}
      >
        {items}
      </Select>
    </Box>
  )
}

/** 날짜 입력 표준 — FormField type="date" 래퍼 */
export function DateField(props: Omit<FormFieldProps, 'type' | 'multiline' | 'minRows'>) {
  return <FormField {...props} type="date" />
}

/** 시간 입력 표준 — FormField type="time" 래퍼 */
export function TimeField(props: Omit<FormFieldProps, 'type' | 'multiline' | 'minRows'>) {
  return <FormField {...props} type="time" />
}
