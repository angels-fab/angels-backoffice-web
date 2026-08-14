import TextField from '@mui/material/TextField'
import { mergeSx } from './sxMerge'
import { control, typescale } from '@/theme/tokens'
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
      // 옆에 서는 액션 버튼과 같은 높이(control.height) — 둘이 짝으로 읽히려면 위아래 변이 맞아야 한다
      // maxWidth·minWidth 가 없으면 받은 width(예: 200)가 좁은 화면에서 그대로 버텨,
      // 옆에 선 액션 버튼을 툴바 밖으로 밀어낸다(개선요청 81 — 375px 이하에서 실측)
      sx={mergeSx({ width, maxWidth: '100%', minWidth: 0, '& .MuiOutlinedInput-root': { height: control.height } }, sx)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: typescale.sectionTitle.size, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="지우기" onClick={() => onChange('')}>
                <CloseIcon sx={{ fontSize: typescale.cardTitle.size }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
}
