import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import type { SxProps, Theme } from '@mui/material/styles'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** 폭(px 또는 CSS 값). 기본 240. */
  width?: number | string
  /** 자동 포커스 */
  autoFocus?: boolean
  sx?: SxProps<Theme>
}

/**
 * SearchBar — 통일된 검색 입력. 좌측 검색 아이콘, 입력 시 우측 지우기 버튼.
 *
 * @example
 * <SearchBar value={q} onChange={setQ} placeholder="장비명 검색" />
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = '검색',
  width = 240,
  autoFocus,
  sx,
}: SearchBarProps) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      size="small"
      autoFocus={autoFocus}
      sx={{ width, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="지우기" onClick={() => onChange('')}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
}
