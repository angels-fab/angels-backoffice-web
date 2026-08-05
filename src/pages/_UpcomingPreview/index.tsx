import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import { PageContainer } from '@/components/ds'
import { radius, typescale } from '@/theme/tokens'
import type { CalEvent } from '@/types'
import UpcomingSection from '@/pages/Home/dash/UpcomingSection'

/**
 * '다가오는 일정' 카드 시안 화면 (2026-08-05, 검토용).
 *
 * 홈은 로그인해야 데이터가 뜨는데 개발 서버에는 세션이 없어 카드를 볼 수 없다.
 * 그래서 **calSlice 가 만들어 주는 것과 똑같은 모양의** 예시 일정을 넣어 그대로 그려 본다.
 * 확정되면 이 화면은 지우고 카드만 홈에 붙이면 된다 — 카드 쪽 코드는 손대지 않는다.
 */

/** 시안 기준 시각 — 실제 시계 대신 고정값을 써서 화면이 매번 같게 나오게 한다 */
const NOW = new Date('2026-08-05T10:36:00')

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const day = (n: number) => iso(new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + n))

/** calSlice.expandRawEvent 가 내놓는 것과 같은 형태(날짜별로 펼쳐진 칸) */
function ev(date: string, title: string, cat: CalEvent['cat'], time: string, id: string): CalEvent {
  const allDay = time === '종일'
  const start = allDay ? `${date}T00:00` : `${date}T${time.slice(0, 5)}`
  const end = allDay ? `${date}T23:59` : `${date}T${(time.split('-')[1] || time).slice(0, 5)}`
  return { date, title, cat, time, loc: '', id, start, end, allDay, recurring: false, seriesId: '', createdBy: '' }
}

const SAMPLE: CalEvent[] = [
  // 오늘 — 종일 연차가 하루를 덮고 있어도 12:00 회의가 '다음 일정'으로 잡혀야 한다
  ev(day(0), '[연차] 박세리', 'leave', '종일', 'e1'),
  ev(day(0), '[회의] AI반도체연구원 추진단(신현진, 박주봉)', 'meeting', '12:00-13:00', 'e2'),
  ev(day(0), '[업무] FAB 실시설계 도면 검토', 'work', '16:00-17:30', 'e3'),
  // 내일 이후
  ev(day(1), '[회의] 조달청 실시설계 적정성 검토', 'meeting', '10:00-11:30', 'e4'),
  ev(day(2), '[교육] 반도체 공정 안전교육', 'edu', '14:00-16:00', 'e5'),
  ev(day(2), '[업무] 장비 반입 사전점검', 'work', '09:00-10:00', 'e6'),
  // 여러 날 출장(같은 id 가 날짜마다 반복 — 실제 데이터와 같은 방식)
  ev(day(4), '[국내출장] 대전 장비업체 방문', 'trip_dom', '종일', 'e7'),
  ev(day(5), '[국내출장] 대전 장비업체 방문', 'trip_dom', '종일', 'e7'),
  ev(day(8), '[회의] FAB 구축 월간 점검회의', 'meeting', '15:00-16:00', 'e8'),
  ev(day(9), '[연차] 조성범', 'leave', '종일', 'e9'),
]

export default function UpcomingPreview() {
  // 아래 모바일 액자는 같은 주소를 iframe 으로 다시 띄운 것 — 그 안에서는 카드만 그린다.
  // iframe 은 자기 폭(390)으로 미디어 쿼리를 따지므로 진짜 모바일 배치가 그대로 나온다.
  const inFrame = typeof window !== 'undefined' && window.self !== window.top
  if (inFrame) {
    return (
      <ScopedCssBaseline>
        <Box sx={{ p: 1.5 }}>
          <UpcomingSection events={SAMPLE} now={NOW} />
        </Box>
      </ScopedCssBaseline>
    )
  }

  return (
    <ScopedCssBaseline>
      <PageContainer>
        <Typography sx={{ fontSize: typescale.pageTitle.size, fontWeight: typescale.pageTitle.weight, mt: 3, mb: 0.5 }}>
          다가오는 일정 — 카드 시안
        </Typography>
        <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary', mb: 3 }}>
          예시 일정으로 그린 검토용 화면입니다. 홈에 붙이면 실제 캘린더 데이터로 그려집니다.
          기준 시각 2026-08-05 10:36 · 날짜를 누르면 오른쪽이 그 날짜로 바뀝니다.
        </Typography>

        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mb: 1 }}>A안 — 2칸, 좌우 배치</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          <Box sx={{ gridColumn: { xs: 'span 1', md: 'span 2' }, minWidth: 0 }}>
            <UpcomingSection events={SAMPLE} now={NOW} />
          </Box>
        </Box>

        {/* 옆에 다른 카드가 함께 서는 모습까지 봐야 1칸이 맞는지 판단이 된다 — 자리채움 카드를 같이 세운다 */}
        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mt: 4, mb: 1 }}>B안 — 1칸, 위아래 배치(모바일과 같은 구성)</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <UpcomingSection events={SAMPLE} now={NOW} variant="stack" />
          </Box>
          <Box sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, display: 'grid', placeItems: 'center', color: 'text.disabled', fontSize: typescale.small.size, minHeight: 180 }}>
            (다른 카드 자리)
          </Box>
          <Box sx={{ minWidth: 0, border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, display: 'grid', placeItems: 'center', color: 'text.disabled', fontSize: typescale.small.size, minHeight: 180 }}>
            (다른 카드 자리)
          </Box>
        </Box>

        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mt: 4, mb: 1 }}>모바일 390px</Typography>
        <Box
          component="iframe"
          src="#/upcoming-preview"
          title="모바일 390px 미리보기"
          sx={{ width: 390, height: 470, border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.default', mb: 6 }}
        />
      </PageContainer>
    </ScopedCssBaseline>
  )
}
