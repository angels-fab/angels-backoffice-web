import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { AppCard, focusRingSx } from '@/components/ds'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'

/**
 * 홈 카드 공용 규격 (2026-08-05 신설).
 *
 * 왜 만들었나: 카드마다 제목 크기·행 높이·글자 크기·여백이 제각각이라 화면이 어지러웠다
 * (사용자: "글자도 너무 작고 한눈에 안 들어옴 · 기준이 다 다르네?"). 홈의 모든 목록 카드가
 * 이 두 컴포넌트만 쓰게 해서 규격을 한곳에 묶는다 — 여기 값을 바꾸면 홈 전체가 같이 움직인다.
 *
 * 규격
 *  - 카드 제목 18(sectionTitle) / 행 제목 14(emphasis) / 메타 13(body)
 *  - 행 높이 = py 1.25(10px) + 14px 줄높이 ≒ 39px, 구분선은 행 사이에만
 *  - 카드 안쪽 여백 20px 고정, 제목줄과 목록 사이 12px
 *
 * 행 제목이 14 인 이유(2026-08-05 실측 후 조정): 처음엔 16(cardTitle)이었는데, 카드 제목 18 과
 * 2px 차이라 목록이 제목만큼 커 보였다(사용자: "너무 큰 것도 있다"). 무엇보다 **공지사항·업무현황
 * 페이지의 같은 목록이 전부 14** 라 홈만 혼자 컸다. cardTitle 은 '카드 제목' 단이라 목록 행이
 * 쓸 자리가 아니다 — 행 제목의 정본은 emphasis(14/600)다.
 */

export function HomeCard({ title, count, actionLabel, onAction, children }: {
  title: string
  count?: string
  actionLabel?: string
  onAction?: () => void
  children: ReactNode
}) {
  return (
    <AppCard
      padding={20}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // 제목이 카드 밖으로 나가지 않게 — 목록 항목도 이 상자 안에서만 줄임표 처리된다
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Typography sx={{ fontSize: typescale.sectionTitle.size, fontWeight: typescale.sectionTitle.weight }}>
          {title}
        </Typography>
        {count && (
          <Typography sx={{ fontSize: typescale.body.size, color: 'text.disabled' }}>{count}</Typography>
        )}
        {actionLabel && onAction && (
          <ButtonBase
            onClick={onAction}
            sx={{
              ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: 0.25,
              fontSize: typescale.body.size, color: 'text.secondary',
              px: 0.5, py: 0.25, borderRadius: `${radius.chip}px`,
              '&:hover': { color: 'primary.main' },
              ...(focusRingSx as object),
            }}
          >
            {actionLabel}
            <ChevronRightIcon sx={{ fontSize: iconSize.body }} />
          </ButtonBase>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </AppCard>
  )
}

/**
 * 홈 카드 안의 목록 한 줄 — 왼쪽 표시(시간·날짜·칩) · 제목 · 오른쪽 보조.
 * 제목은 한 줄 줄임표. onClick 이 있으면 행 전체가 눌린다.
 */
export function HomeRow({ lead, title, trail, onClick }: {
  lead?: ReactNode
  title: string
  trail?: ReactNode
  onClick?: () => void
}) {
  return (
    <Box
      {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } } : {})}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        py: 1.25, px: 0.5, mx: -0.5,
        borderTop: 1, borderColor: 'divider',
        '&:first-of-type': { borderTop: 0 },
        borderRadius: `${radius.chip}px`,
        ...(onClick ? { cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, ...(focusRingSx as object) } : {}),
      }}
    >
      {lead}
      <Typography
        sx={{
          flex: 1, minWidth: 0,
          fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight, lineHeight: 1.35,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>
      {trail}
    </Box>
  )
}

/** 행 왼쪽·오른쪽의 보조 글자 — 시간·날짜·부서 등 모두 같은 크기로 */
export function HomeMeta({ children, mono, color }: { children: ReactNode; mono?: boolean; color?: string }) {
  return (
    <Typography
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: typescale.body.size,
        color: color || 'text.disabled',
        ...(mono ? { fontFamily: 'monospace', fontWeight: weight.bold } : {}),
      }}
    >
      {children}
    </Typography>
  )
}
