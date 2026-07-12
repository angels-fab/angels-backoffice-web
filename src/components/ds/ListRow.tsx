import Box from '@mui/material/Box'
import { mergeSx } from './sxMerge'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'
import type { ReactNode } from 'react'
import { row } from '@/theme/tokens'

export interface ListRowProps {
  /** 좌측 고정 요소 — 아이콘·StatusChip·dot 등. 안 줄어든다. */
  leading?: ReactNode
  /** 주 텍스트. 넘치면 말줄임. 문자열이면 자동으로 Typography로 감싼다. */
  title: ReactNode
  /**
   * 제목 바로 옆(같은 줄)에 붙는 보조 요소 — 담당자 칩 등.
   * 제목이 길어도 항상 보이며(안 줄어듦), 제목만 말줄임 처리된다.
   */
  titleTrailing?: ReactNode
  /** 제목 아래 보조 텍스트(부서·작성자·경로 등). 넘치면 말줄임. */
  subtitle?: ReactNode
  /** 우측 끝 요소 — 날짜·상태칩·액션 아이콘. 안 줄어든다. */
  trailing?: ReactNode
  /** 클릭 — 지정하면 hover·키보드(Enter/Space) 접근성이 자동 적용된다. */
  onClick?: () => void
  /** 클릭 가능한 행의 스크린리더 라벨 (role=button) */
  ariaLabel?: string
  /** 선택 강조(배경 유지) — 현재 열린 항목 등 */
  selected?: boolean
  /** 하단 구분선 — AppCard 안에 여러 행을 divider로 나열할 때 */
  divider?: boolean
  /** 촘촘한 높이 — 미리보기·조밀 목록 */
  dense?: boolean
  sx?: SxProps<Theme>
}

/** 문자열이면 말줄임 Typography로, 노드면 그대로 감싼다. */
function TitleText({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <Typography
        component="span"
        sx={{
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.4,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Typography>
    )
  }
  return <Box sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</Box>
}

/**
 * ListRow — 목록·표의 한 행 공통 프리미티브.
 *
 * `[leading] [ 제목 · (titleTrailing) / subtitle ] [trailing]` 가로 배치.
 * 간격·padding·hover·말줄임 규칙을 한곳으로 통일한다(페이지마다 손코딩 금지).
 *
 * 디자인 규칙:
 * - 색·간격은 토큰(`row`, theme)만 참조. hex/px 하드코딩 금지.
 * - 제목은 항상 말줄임 가능(min-width:0). titleTrailing/trailing은 안 줄어든다.
 * - 클릭 가능하면 hover(배경 elevated) + 키보드 접근성 자동.
 * - 왼쪽 컬러 보더(색 줄) 금지(프로젝트 규칙).
 *
 * @example 카드 안 divider 목록
 * <AppCard padding={0}>
 *   {items.map((n, i) => (
 *     <ListRow
 *       key={n.id}
 *       leading={<StatusChip status="info" label={n.cat} />}
 *       title={n.title}
 *       subtitle={n.dept}
 *       trailing={<Typography variant="caption">{n.date}</Typography>}
 *       divider={i < items.length - 1}
 *       onClick={() => open(n)}
 *     />
 *   ))}
 * </AppCard>
 *
 * @example 제목 옆에 담당자 칩(빈 공간 안 벌어짐)
 * <ListRow title={task.name} titleTrailing={<StatusChip status="neutral" label={task.mgr} />} />
 */
export default function ListRow({
  leading,
  title,
  titleTrailing,
  subtitle,
  trailing,
  onClick,
  ariaLabel,
  selected,
  divider,
  dense,
  sx,
}: ListRowProps) {
  const clickable = !!onClick
  return (
    <Box
      onClick={onClick}
      {...(clickable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': ariaLabel,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
      sx={mergeSx({
        display: 'flex',
        alignItems: 'center',
        gap: `${row.gap}px`,
        px: `${row.padX}px`,
        py: `${dense ? row.padYDense : row.padY}px`,
        transition: 'background-color .12s',
        ...(divider && { borderBottom: 1, borderColor: 'divider' }),
        ...(selected && { bgcolor: 'background.elevated' }),
        ...(clickable && {
          cursor: 'pointer',
          '&:hover': { bgcolor: 'background.elevated' },
          '&:focus-visible': { outline: 'none', bgcolor: 'background.elevated' },
        }),
      }, sx)}
    >
      {leading != null && <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{leading}</Box>}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {titleTrailing != null ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${row.titleGap}px`, minWidth: 0 }}>
            <TitleText>{title}</TitleText>
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{titleTrailing}</Box>
          </Box>
        ) : (
          <TitleText>{title}</TitleText>
        )}
        {subtitle != null &&
          (typeof subtitle === 'string' || typeof subtitle === 'number' ? (
            <Typography
              variant="caption"
              sx={{ color: 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {subtitle}
            </Typography>
          ) : (
            <Box sx={{ minWidth: 0 }}>{subtitle}</Box>
          ))}
      </Box>

      {trailing != null && (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: `${row.titleGap}px` }}>{trailing}</Box>
      )}
    </Box>
  )
}
