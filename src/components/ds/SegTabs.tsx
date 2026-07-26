import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'
import type { SxProps, Theme } from '@mui/material/styles'
import { mergeSx } from './sxMerge'
import { radius, shadow, typescale } from '@/theme/tokens'

/**
 * SegTabs — 뷰/모드 전환용 세그먼트 컨트롤(단일 표준).
 *
 * 페이지마다 제각각이던 탭(MUI Button contained·MUI Chip·손코딩 알약)을 하나로 통일한다.
 * 외형 = "background.elevated 컨테이너 + 활성 탭만 paper pill(파란 글씨·얕은 그림자)".
 * 다중선택 필터가 아니라 **택1 전환**에 쓴다(필터 칩은 FilterChip 사용).
 *
 * @example
 * <SegTabs items={[{value:'stage',label:'단계별'},{value:'list',label:'목록'}]} value={view} onChange={setView} />
 */
export interface SegTabItem<T extends string = string> {
  value: T
  /** 문자열이 기본. 칩 등 부가 표시가 필요하면 ReactNode 허용(예: '준비중' 칩) */
  label: React.ReactNode
}
export interface SegTabsProps<T extends string = string> {
  items: readonly SegTabItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  sx?: SxProps<Theme>
}

export default function SegTabs<T extends string>({ items, value, onChange, ariaLabel, sx }: SegTabsProps<T>) {
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={mergeSx(
        // 묶음 배경 — 'background.elevated'는 라이트에서 페이지와 대비 1.03이라 탭 그룹의 윤곽이 보이지 않았다.
        // 눌린 홈(recessed) 느낌의 옅은 채움 + 보더로 그룹 경계를 확실히 만든다(두 테마 공통).
        {
          display: 'inline-flex', gap: '3px', p: '3px', borderRadius: `${radius.button}px`,
          bgcolor: (t: Theme) => alpha(t.palette.text.primary, t.palette.mode === 'light' ? 0.06 : 0.08),
          border: '1px solid', borderColor: 'divider',
        },
        sx,
      )}
    >
      {items.map((t) => {
        const active = t.value === value
        return (
          <Box
            key={t.value}
            component="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            sx={{
              px: '16px', py: '6px', borderRadius: `${radius.chip}px`, fontSize: typescale.body.size,
              fontFamily: 'inherit', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
              fontWeight: active ? typescale.cardTitle.weight : typescale.emphasis.weight,
              color: active ? 'primary.main' : 'text.secondary',
              bgcolor: active ? 'background.paper' : 'transparent',
              // 활성 탭이 떠 보이게 — 검정 .35 고정은 라이트에서 탁하므로 테마별 그림자 토큰
              boxShadow: active ? shadow.sm : 'none',
              transition: 'all .12s',
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
            }}
          >
            {t.label}
          </Box>
        )
      })}
    </Box>
  )
}
