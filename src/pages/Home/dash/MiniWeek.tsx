import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
/** 한 주에 그릴 막대 최대 개수 — 넘치면 점으로만(카드 높이를 지키려고) */
const MAX_BARS = 3
/** 한 칸에 찍을 점 최대 개수 */
const MAX_DOTS = 4

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * 홈 '오늘 일정' 카드 아래 **간소화 주간 달력**(사용자 확정 2026-08-05 — 월간에서 주간으로).
 *
 * 목적은 일정을 읽는 게 아니라 **이번 주 언제 몰려 있는지 모양으로 보는 것**이다.
 * 제목을 쓰지 않고 하루짜리는 점, 여러 날 걸친 것은 선으로만 그린다.
 * 색은 캘린더 카테고리 색 그대로 — 캘린더 화면과 같은 의미로 읽힌다.
 *
 * 데이터는 calSlice 가 날짜별로 펼쳐 둔 것(expandRawEvent)을 쓴다. 여러 날 일정은 날짜마다
 * 같은 id 로 들어 있으므로, 이번 주 안에서 id 가 여러 칸에 걸치면 그 구간을 선 하나로 잇는다.
 */
export default function MiniWeek() {
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()
  const base = new Date(today + 'T00:00:00')
  // 이번 주 = 오늘이 속한 주의 일요일부터 7일
  const sunday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
  const days = Array.from({ length: 7 }, (_, i) => new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i))
  const keys = days.map(iso)

  const colorOf = (cat: string) => CAL_CAT_MAP[cat as keyof typeof CAL_CAT_MAP]?.color || accent.blue

  // id 별로 이번 주 어느 칸에 걸리는지 모아 선(여러 칸)과 점(한 칸)으로 나눈다
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
    <Box>
      {/* 요일 */}
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

      {/* 날짜 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d) => {
          const isToday = iso(d) === today
          return (
            <Box key={iso(d)} sx={{ textAlign: 'center' }}>
              <Box
                component="span"
                sx={{
                  display: 'inline-grid', placeItems: 'center', width: 26, height: 26,
                  fontSize: typescale.body.size,
                  fontWeight: isToday ? weight.bold : weight.medium,
                  borderRadius: radius.circle,
                  color: isToday ? 'primary.contrastText' : 'text.primary',
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
        <Box key={i} sx={{ position: 'relative', height: 4, mt: '4px' }}>
          <Box sx={{ position: 'absolute', left: `${(b.from / 7) * 100}%`, width: `${((b.to - b.from + 1) / 7) * 100}%`, px: '4px', boxSizing: 'border-box' }}>
            <Box sx={{ height: 4, borderRadius: `${radius.pill}px`, bgcolor: b.color }} />
          </Box>
        </Box>
      ))}

      {/* 하루짜리 = 점 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mt: '6px', minHeight: 6 }}>
        {dots.map((cols, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'center', gap: '3px' }}>
            {cols.slice(0, MAX_DOTS).map((c, j) => (
              <Box key={j} sx={{ width: 5, height: 5, borderRadius: radius.circle, bgcolor: c }} />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
