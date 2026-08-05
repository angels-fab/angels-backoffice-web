import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
/** 한 주에 그릴 막대 최대 개수 — 넘치면 그 주는 점으로만 표시(카드 높이를 지키려고) */
const MAX_BARS = 2
/** 한 칸에 찍을 점 최대 개수 */
const MAX_DOTS = 3

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 홈 '오늘 일정' 카드 아래에 붙는 **간소화 달력**(사용자 지시 2026-08-05).
 *
 * 목적은 일정을 읽는 게 아니라 **언제 몰려 있는지 모양으로 보는 것**이다. 그래서 제목을 쓰지 않고
 * 하루짜리는 점, 여러 날 걸친 것은 선으로만 그린다. 색은 캘린더 카테고리 색을 그대로 써서
 * 캘린더 화면과 같은 의미로 읽힌다.
 *
 * 데이터는 calSlice 가 이미 날짜별로 펼쳐 둔 것(expandRawEvent)을 쓴다 — 여러 날 일정은
 * 날짜마다 같은 id 로 들어 있으므로, 같은 주 안에서 id 가 연속하면 그 구간을 선 하나로 잇는다.
 */
export default function MiniMonth() {
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()
  const base = new Date(today + 'T00:00:00')
  const year = base.getFullYear()
  const month = base.getMonth()

  // 달력 격자 — 그 달 1일이 속한 주의 일요일부터 6주
  const first = new Date(year, month, 1)
  const gridStart = new Date(year, month, 1 - first.getDay())
  const weeks: Date[][] = []
  for (let w = 0; w < 6; w++) {
    const row: Date[] = []
    for (let d = 0; d < 7; d++) row.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + d))
    weeks.push(row)
  }
  // 마지막 주가 통째로 다음 달이면 버린다(빈 줄 방지)
  while (weeks.length > 4 && weeks[weeks.length - 1].every((d) => d.getMonth() !== month)) weeks.pop()

  const colorOf = (cat: string) => CAL_CAT_MAP[cat as keyof typeof CAL_CAT_MAP]?.color || accent.blue

  return (
    <Box>
      {/* 요일 머리 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
        {DOW.map((d, i) => (
          <Typography
            key={d}
            sx={{ textAlign: 'center', fontSize: typescale.caption.size, color: i === 0 ? 'error.main' : 'text.disabled' }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {weeks.map((week, wi) => {
        const keys = week.map(iso)
        // 이 주에 걸친 일정을 id 별로 모아 연속 구간(막대)과 하루짜리(점)로 나눈다
        const byId = new Map<string, { cols: number[]; cat: string }>()
        keys.forEach((k, col) => {
          events.filter((e) => e.date === k).forEach((e) => {
            const cur = byId.get(e.id)
            if (cur) cur.cols.push(col)
            else byId.set(e.id, { cols: [col], cat: e.cat })
          })
        })
        const bars: { from: number; to: number; color: string }[] = []
        const dots: string[][] = Array.from({ length: 7 }, () => [])
        byId.forEach((v) => {
          const cols = [...new Set(v.cols)].sort((a, b) => a - b)
          if (cols.length > 1) bars.push({ from: cols[0], to: cols[cols.length - 1], color: colorOf(v.cat) })
          else dots[cols[0]].push(colorOf(v.cat))
        })

        return (
          <Box key={wi} sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((d) => {
                const inMonth = d.getMonth() === month
                const isToday = iso(d) === today
                return (
                  <Box key={iso(d)} sx={{ textAlign: 'center' }}>
                    <Box
                      component="span"
                      sx={{
                        display: 'inline-grid', placeItems: 'center', width: 20, height: 20,
                        fontSize: typescale.caption.size,
                        fontWeight: isToday ? weight.bold : weight.medium,
                        borderRadius: radius.circle,
                        color: isToday ? 'primary.contrastText' : inMonth ? 'text.primary' : 'text.disabled',
                        bgcolor: isToday ? 'primary.main' : 'transparent',
                      }}
                    >
                      {d.getDate()}
                    </Box>
                  </Box>
                )
              })}
            </Box>

            {/* 여러 날 일정 = 선 */}
            {bars.slice(0, MAX_BARS).map((b, i) => (
              <Box key={i} sx={{ position: 'relative', height: 3, mt: '2px' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${(b.from / 7) * 100}%`,
                    width: `${((b.to - b.from + 1) / 7) * 100}%`,
                    height: 3,
                    px: '3px',
                    boxSizing: 'border-box',
                  }}
                >
                  <Box sx={{ height: 3, borderRadius: `${radius.pill}px`, bgcolor: b.color }} />
                </Box>
              </Box>
            ))}

            {/* 하루짜리 = 점 */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mt: '3px', minHeight: 5 }}>
              {dots.map((cols, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'center', gap: '2px' }}>
                  {cols.slice(0, MAX_DOTS).map((c, j) => (
                    <Box key={j} sx={{ width: 4, height: 4, borderRadius: radius.circle, bgcolor: c }} />
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
