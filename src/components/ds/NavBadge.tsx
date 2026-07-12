import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

export interface NavBadgeProps {
  count: number
  /** new=새 글(빨강) · memo=개선 메모(앰버, 어두운 글자) */
  kind?: 'new' | 'memo'
  sx?: SxProps<Theme>
}

/**
 * NavBadge — 내비 알림 배지 표준 (P2-3, D7 확정: 아이폰식 위첨자 개편).
 *
 * 색상+숫자만(아이콘·라벨 없음), 15px, 0건 숨김, 99+ 상한. 색은 토큰만
 * (기존 3변형: #f04438 하드코딩 2곳·크기 3종·위치 2종 → 이 컴포넌트 1스펙으로 수렴).
 * 위치(메뉴명 우상단·아이콘 우상단)는 소비처가 sx로 지정한다.
 *
 * @example 메뉴명 뒤 위첨자 (SideNav·드로어)
 * <NavBadge count={n} kind="new" />
 * @example 아이콘 우상단 (하단탭)
 * <NavBadge count={n} kind="new" sx={{ position: 'absolute', top: -6, right: -10 }} />
 */
export default function NavBadge({ count, kind = 'new', sx }: NavBadgeProps) {
  if (count <= 0) return null
  return (
    <Box
      component="span"
      aria-label={kind === 'new' ? `새 글 ${count}건` : `개선 메모 ${count}건`}
      sx={[
        (t: Theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 15,
          height: 15,
          px: '4px',
          borderRadius: '999px',
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          bgcolor: kind === 'new' ? t.palette.accent.red : t.palette.accent.amber,
          // 앰버 위 글자는 어둡게(가독) — 빨강 위는 흰색
          color: kind === 'new' ? '#fff' : '#1b1c22',
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {count > 99 ? '99+' : count}
    </Box>
  )
}
