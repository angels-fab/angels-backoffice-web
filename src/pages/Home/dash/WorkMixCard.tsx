import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import { HomeCard } from './HomeCard'

/** 막대·범례 색 — 토큰만 쓴다. 상위 4종 + 나머지는 '기타'(중립 회색)로 묶는다. */
const COLORS = [accent.blue, accent.green, accent.amber, accent.purple]
const ETC = 'text.disabled' // 테마 경로 — 라이트·다크 모두에서 중립으로 읽힌다
const TOP = 4

/**
 * 홈 '업무 구성' — 진행 중 업무가 **어느 분야에 몰려 있는지** 한 줄로.
 *
 * 제목을 하나씩 읽지 않아도 성격이 보이게 하는 카드다(2026-08-05 간소화).
 * 상태별 집계(진행중/완료/보류)는 쓰지 않는다 — 완료는 누계라 매일 같고 취소는 값 자체가 없다.
 * 대신 구분(cat)으로 나눈다. 이건 업무가 들어올 때마다 실제로 달라진다.
 */
export default function WorkMixCard() {
  const items = useAppSelector((s) => s.work.items)
  const rows = items.filter((t) => (t.status || '').trim() === '진행중' && !t.remind)

  const counted = rows.reduce<Record<string, number>>((m, t) => {
    const k = (t.cat || '').trim() || '미분류'
    return { ...m, [k]: (m[k] || 0) + 1 }
  }, {})
  const sorted = Object.entries(counted).sort((a, b) => b[1] - a[1])
  const head = sorted.slice(0, TOP).map(([label, n], i) => ({ label, n, color: COLORS[i] }))
  const etcCount = sorted.slice(TOP).reduce((a, [, n]) => a + n, 0)
  const parts = etcCount > 0 ? [...head, { label: '기타', n: etcCount, color: ETC }] : head
  const total = rows.length

  return (
    <HomeCard title="업무 구성" count={`${total}건`}>
      {total === 0 ? (
        <EmptyState size="sm" title="진행 중인 업무가 없습니다" />
      ) : (
        <>
          <Box sx={{ display: 'flex', height: 10, borderRadius: `${radius.pill}px`, overflow: 'hidden', mb: 1.25 }}>
            {parts.map((p) => (
              <Box key={p.label} sx={{ width: `${(p.n / total) * 100}%`, bgcolor: p.color }} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            {parts.map((p) => (
              <Box key={p.label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: p.color, flexShrink: 0 }} />
                <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
                  {p.label} <Box component="span" sx={{ color: 'text.primary', fontWeight: weight.bold }}>{p.n}</Box>
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </HomeCard>
  )
}
