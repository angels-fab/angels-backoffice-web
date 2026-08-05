import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { radius, typescale, weight } from '@/theme/tokens'
import { HomeCard } from './HomeCard'

/** 줄 수 상한 — 넘치면 나머지를 '기타'로 접는다(카드 높이를 지키려고) */
const MAX_ROWS = 6

/**
 * 홈 '업무 구성' — 진행 중 업무를 구분별 **점 개수**로.
 *
 * 처음에는 비율 스택 막대로 그렸는데 볼품이 없었다(사용자: 인포그래픽 디자인이 너무 구리다).
 * 원인은 그림 솜씨가 아니라 형태 선택이었다 — 전체가 9건이고 구분마다 1~2건이라
 * 비율로 그리면 조각이 다 비슷해져 "고르게 퍼져 있다"는 말밖에 못 한다.
 *
 * 그래서 비율이 아니라 **개수 자체**를 찍는다(unit chart). 9개짜리 정수는 점을 세는 게
 * 가장 빠르고, 눈금·축·범례가 필요 없다. 색은 한 가지만 쓴다 — 구분 이름이 이미 왼쪽에
 * 적혀 있어 색이 신원을 나를 필요가 없고, 5~6가지 색을 뿌리면 그게 다시 어지러워진다.
 * 위 주간 달력의 점과 같은 언어라 화면 안에서 따로 놀지 않는다.
 */
export default function WorkMixCard() {
  const items = useAppSelector((s) => s.work.items)
  const rows = items.filter((t) => (t.status || '').trim() === '진행중' && !t.remind)

  const counted = rows.reduce<Record<string, number>>((m, t) => {
    const k = (t.cat || '').trim() || '미분류'
    return { ...m, [k]: (m[k] || 0) + 1 }
  }, {})
  const sorted = Object.entries(counted).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  const head = sorted.slice(0, MAX_ROWS)
  const etc = sorted.slice(MAX_ROWS).reduce((a, [, n]) => a + n, 0)
  const list = etc > 0 ? [...head, ['기타', etc] as [string, number]] : head

  return (
    <HomeCard title="업무 구성" count={`${rows.length}건`}>
      {rows.length === 0 ? (
        <EmptyState size="sm" title="진행 중인 업무가 없습니다" />
      ) : (
        list.map(([label, n]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75 }}>
            <Typography
              sx={{
                width: 92, flexShrink: 0,
                fontSize: typescale.body.size, color: 'text.secondary',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {Array.from({ length: n }).map((_, i) => (
                <Box key={i} sx={{ width: 8, height: 8, borderRadius: radius.circle, bgcolor: 'primary.main', flexShrink: 0 }} />
              ))}
            </Box>
            <Typography
              sx={{ flexShrink: 0, fontSize: typescale.body.size, fontWeight: weight.bold, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}
            >
              {n}
            </Typography>
          </Box>
        ))
      )}
    </HomeCard>
  )
}
