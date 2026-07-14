import MuiSelect from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { mergeSx } from './sxMerge'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { typescale } from '@/theme/tokens'

/**
 * Select — 필터바용 공용 드롭다운 (MUI Select size small).
 *
 * 페이지에서 native `<select>`(index.css .eq-select 등)를 손코딩하던 것을 대체.
 * 앱의 다른 입력(MuiOutlinedInput 테마: radius 10·포커스 파란링)과 동일한 크롬을 자동 상속.
 *
 * @example
 * <Select value={fltStage} onChange={setFltStage} ariaLabel="단계"
 *   options={stageOpts.map((o) => ({ value: o, label: o === '전체' ? '전체 단계' : o }))} />
 */
export interface SelectOption {
  value: string
  label: ReactNode
}
export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  ariaLabel?: string
  /** 최소 폭(px) — 기본 110 */
  minWidth?: number
  sx?: SxProps<Theme>
}

export default function Select({ value, onChange, options, ariaLabel, minWidth = 110, sx }: SelectProps) {
  return (
    <MuiSelect
      size="small"
      value={value}
      onChange={(e) => onChange(String(e.target.value))}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={mergeSx(
        { minWidth, flexShrink: 0, '& .MuiSelect-select': { py: '6px', fontSize: typescale.body.size } },
        sx,
      )}
    >
      {options.map((o) => (
        <MenuItem key={o.value} value={o.value} sx={{ fontSize: typescale.body.size }}>{o.label}</MenuItem>
      ))}
    </MuiSelect>
  )
}
