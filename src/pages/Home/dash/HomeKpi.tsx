import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { AppCard } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { useUnseenItems, MENU_LABEL } from '@/layouts/useNavBadges'
import { isRecentNew, todaySeoul, fmtDate } from '@/utils/date'
import { typescale, weight } from '@/theme/tokens'

/**
 * 홈 맨 위 요약 숫자 3개 (2026-08-05, Minimal 대시보드 참고).
 *
 * 사용자: "대시보드에서 업무·공지·일정을 일일이 읽지 않는다. 더 간소화가 필요."
 * → 글을 읽지 않고 **보기만 해도 되는 숫자**를 맨 위에 두고, 목록은 아래에서 세 줄로 줄였다.
 *
 * 고른 기준은 '매일 달라지는가' 하나다. 완료 누계·전체 장비·도입 예산처럼 몇 달째 같은 값은 뺐다
 * (그 셋은 종전 KPI 6타일에 있었고, 화면만 차지했다).
 * 스파크라인·추세 차트는 넣지 않았다 — 주당 유입이 2~3건이라 선이 거의 평평하다(사용자 확인).
 */
export default function HomeKpi() {
  const navigate = useNavigate()
  const unseen = useUnseenItems()
  const events = useAppSelector((s) => s.cal.events)
  const works = useAppSelector((s) => s.work.items)

  const today = todaySeoul()
  const todayMid = new Date(today + 'T00:00:00')
  const todayCount = events.filter((e) => e.date === today).length
  // 이번 주 = 오늘 이후 7일. 같은 일정이 여러 날에 걸치면 한 건으로 센다.
  const weekIds = new Set(
    events
      .filter((e) => {
        const d = Math.round((new Date(e.date + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
        return d >= 1 && d <= 7
      })
      .map((e) => e.id),
  )

  const inProgress = works.filter((t) => (t.status || '').trim() === '진행중' && !t.remind)
  const newWorks = inProgress.filter((t) => isRecentNew(fmtDate(t.start))).length

  // 안 본 새 글의 출처 분해 — 0인 출처는 빼고 '공지 1 · 업무 2' 형태로
  const bySource = unseen.reduce<Record<string, number>>((m, it) => ({ ...m, [it.menu]: (m[it.menu] || 0) + 1 }), {})
  const unseenSub = Object.entries(bySource)
    .map(([k, n]) => `${MENU_LABEL[k as keyof typeof MENU_LABEL]} ${n}`)
    .join(' · ')

  const tiles = [
    { label: '안 본 새 글', value: unseen.length, sub: unseenSub || '모두 확인함', hot: unseen.length > 0, to: unseen[0]?.to },
    { label: '오늘 일정', value: todayCount, sub: `이번 주 ${weekIds.size}건`, to: '/calendar' },
    { label: '진행 중 업무', value: inProgress.length, sub: newWorks > 0 ? `이번 주 +${newWorks}` : '이번 주 신규 없음', to: '/work' },
  ]

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
      {tiles.map((t) => (
        <AppCard
          key={t.label}
          padding={20}
          {...(t.to ? { onClick: () => navigate(t.to as string), ariaLabel: `${t.label} ${t.value}건 보기` } : {})}
          sx={t.hot ? { borderColor: 'primary.main' } : undefined}
        >
          <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>{t.label}</Typography>
          <Typography
            sx={{
              fontSize: typescale.display.size,
              fontWeight: typescale.display.weight,
              lineHeight: 1.2,
              mt: '2px',
              color: t.hot ? 'primary.main' : 'text.primary',
            }}
          >
            {t.value}
          </Typography>
          <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', fontWeight: weight.medium }}>
            {t.sub}
          </Typography>
        </AppCard>
      ))}
    </Box>
  )
}
