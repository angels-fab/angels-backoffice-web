import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { LoadingState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
// 도입 = 도입일정 등록 폼·로드맵 '장비 반입' 단계가 쓰는 트럭 / 운영 = 장비관리 메뉴·두 페이지 헤더가 쓰는 모니터.
// 새 아이콘을 고르지 말고 이미 그 뜻으로 쓰이는 것을 재사용한다(사용자 지시 2026-08-06).
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import MonitorIcon from '@mui/icons-material/Monitor'
import { iconSize, typescale, weight } from '@/theme/tokens'
import { HomeCard, ROW_H } from './HomeCard'

/**
 * 홈 '장비 도입' · '장비 운영' 두 카드 (2026-08-06 신설, 사용자 지시).
 *
 * 장비는 종전에 '현황' 접힘 줄 안에만 있어서, 펼치지 않으면 몇 대가 돌고 몇 대가 멈췄는지 몰랐다.
 * 도입(앞으로 들어올 것)과 운영(지금 돌고 있는 것)은 보는 목적이 달라 카드를 나눈다.
 *  - 도입 → /equipment (도입일정·간트)
 *  - 운영 → /equipment-ops (장비대장·운영상태)
 * 숫자는 장비 화면과 같은 집계(selectEqCounts)를 쓴다 — 두 화면의 대수가 갈리지 않게.
 */

/**
 * 상태 한 줄 — 이름 · 대수 · 종수.
 * 글자 규격은 다른 카드의 목록 행과 같게 맞춘다(이름 emphasis 14/600 · 높이 ROW_H) —
 * 종전에는 body 13 secondary 라 옆 카드 목록보다 흐리고 작아 잘 안 읽혔다(2026-08-06 사용자 지적).
 */
function Line({ label, units, types, first }: { label: string; units: number; types: number; first?: boolean }) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        minHeight: ROW_H, boxSizing: 'border-box', py: 1,
        ...(first ? {} : { borderTop: 1, borderColor: 'divider' }),
      }}
    >
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: typescale.emphasis.size, fontWeight: weight.bold, fontVariantNumeric: 'tabular-nums' }}>
        {units}
        <Box component="span" sx={{ ml: 0.25, fontSize: typescale.small.size, fontWeight: weight.medium, color: 'text.secondary' }}>대</Box>
      </Typography>
      <Typography sx={{ flexShrink: 0, minWidth: 34, textAlign: 'right', fontSize: typescale.body.size, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {types}종
      </Typography>
    </Box>
  )
}

export function EqIntroSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.eq.ready)
  const eq = useAppSelector(selectEqCounts)
  const u = eq.units

  return (
    <HomeCard
      icon={<LocalShippingIcon sx={{ fontSize: iconSize.header, color: 'text.primary' }} />}
      title="장비 도입"
      stat={ready ? { value: u['도입예정'] + u['도입중'], unit: '대', sub: `${eq.typesBy['도입예정'] + eq.typesBy['도입중']}종` } : undefined}
      actionLabel="도입일정"
      onAction={() => navigate('/equipment')}
    >
      {!ready ? (
        <LoadingState size="md" />
      ) : (
        <Box>
          <Line first label="도입중" units={u['도입중']} types={eq.typesBy['도입중']} />
          <Line label="도입예정" units={u['도입예정']} types={eq.typesBy['도입예정']} />
        </Box>
      )}
    </HomeCard>
  )
}

export function EqOpsSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.eq.ready)
  const eq = useAppSelector(selectEqCounts)
  const u = eq.units

  return (
    <HomeCard
      icon={<MonitorIcon sx={{ fontSize: iconSize.header, color: 'text.primary' }} />}
      title="장비 운영"
      stat={ready ? { value: u['운영중'], unit: '대', sub: `${eq.typesBy['운영중']}종 운영중` } : undefined}
      actionLabel="장비대장"
      onAction={() => navigate('/equipment-ops')}
    >
      {!ready ? (
        <LoadingState size="md" />
      ) : (
        <Box>
          <Line first label="비가동" units={u['비가동']} types={eq.typesBy['비가동']} />
          <Line label="전체" units={eq.total} types={eq.types} />
        </Box>
      )}
    </HomeCard>
  )
}
