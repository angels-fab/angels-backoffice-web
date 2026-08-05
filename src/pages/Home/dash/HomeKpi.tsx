import { useNavigate } from 'react-router-dom'
import Typography from '@mui/material/Typography'
import { AppCard } from '@/components/ds'
import { useUnseenItems, MENU_LABEL } from '@/layouts/useNavBadges'
import { typescale, weight } from '@/theme/tokens'

/**
 * 홈 '안 본 새 글' 타일 (2026-08-05).
 *
 * 처음에는 요약 숫자 3개(안 본 새 글·오늘 일정·진행 중 업무)를 나란히 뒀는데, 사용자 지시로
 * 오늘 일정과 진행 중 업무는 각자 카드가 건수를 직접 들고 가게 됐다. 남은 건 어느 카드에도
 * 속하지 않는 이 하나뿐이라 타일 한 장만 그린다.
 *
 * 모집단은 상단바 알림 센터와 같다(useUnseenItems — 7일 내 글 중 내가 안 본 것).
 * 숫자가 갈리지 않게 반드시 같은 훅을 쓴다.
 */
export default function HomeKpi() {
  const navigate = useNavigate()
  const unseen = useUnseenItems()

  // 출처 분해 — 0인 출처는 빼고 '공지 1 · 업무 2' 형태로
  const bySource = unseen.reduce<Record<string, number>>((m, it) => ({ ...m, [it.menu]: (m[it.menu] || 0) + 1 }), {})
  const sub = Object.entries(bySource)
    .map(([k, n]) => `${MENU_LABEL[k as keyof typeof MENU_LABEL]} ${n}`)
    .join(' · ')
  const hot = unseen.length > 0

  return (
    <AppCard
      padding={20}
      {...(hot ? { onClick: () => navigate(unseen[0].to), ariaLabel: `안 본 새 글 ${unseen.length}건 보기` } : {})}
      sx={{ height: '100%', ...(hot ? { borderColor: 'primary.main' } : {}) }}
    >
      <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>안 본 새 글</Typography>
      <Typography
        sx={{
          fontSize: typescale.display.size,
          fontWeight: typescale.display.weight,
          lineHeight: 1.2,
          mt: '2px',
          color: hot ? 'primary.main' : 'text.primary',
        }}
      >
        {unseen.length}
      </Typography>
      <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', fontWeight: weight.medium }}>
        {sub || '모두 확인함'}
      </Typography>
    </AppCard>
  )
}
