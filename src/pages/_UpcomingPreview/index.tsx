import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import { PageContainer } from '@/components/ds'
import { radius, typescale } from '@/theme/tokens'
import type { CalEvent } from '@/types'
import type { AttendeeRow } from '@/api/events'
import { FAB_EVENTS, eventStatus } from '@/constants/events'
import TodaySection from '@/pages/Home/dash/TodaySection'
import EventsSection from '@/pages/Home/dash/EventsSection'
import { EqIntroSection, EqOpsSection } from '@/pages/Home/dash/EqSections'
import RoadmapStrip from '@/pages/Home/RoadmapStrip'
import NoticeSection from '@/pages/Home/dash/NoticeSection'
import WorkStatusSection from '@/pages/Home/dash/WorkStatusSection'

/**
 * 홈 카드 시안 화면 (2026-08-06, 검토용).
 *
 * 홈은 로그인해야 데이터가 뜨는데 개발 서버에는 세션이 없어 카드를 볼 수 없다.
 * 그래서 **실제와 같은 모양의** 예시 데이터를 넣어 그대로 그려 본다.
 * 장비 두 카드는 예시 데이터를 만들 수 없어(집계가 스토어에서 나온다) 로그인 화면에서 확인해야 한다.
 * 확정되면 이 화면과 라우트를 지운다 — 카드 쪽 코드는 손대지 않는다.
 */

/** 시안 기준 시각 — 실제 시계 대신 고정값을 써서 화면이 매번 같게 나오게 한다 */
const NOW = new Date('2026-08-06T10:36:00')
/** 오늘 시간 일정이 다 끝난 뒤 */
const LATE = new Date('2026-08-06T18:00:00')

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
  ev(day(0), '[연차] 박세리', 'leave', '종일', 'e1'),
  ev(day(0), '[회의] AI반도체연구원 추진단(신현진, 박주봉)', 'meeting', '12:00-13:00', 'e2'),
  ev(day(0), '[업무] FAB 실시설계 도면 검토', 'work', '16:00-17:30', 'e3'),
  ev(day(1), '[회의] 조달청 실시설계 적정성 검토', 'meeting', '10:00-11:30', 'e4'),
]

/** 참석 신청 예시 — 아직 안 끝난 행사 둘을 '조성범'이 신청한 상태 */
const SAMPLE_ATT: AttendeeRow[] = FAB_EVENTS
  .filter((e) => eventStatus(e.start, e.end).tone !== 'gray')
  .slice(0, 2)
  .map((e, i) => ({ id: i + 1, eventId: e.id, name: '조성범', memberUid: null }))

function Frame({ label, children, cols = 3 }: { label: string; children: React.ReactNode; cols?: number }) {
  return (
    <>
      <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mt: 4, mb: 1 }}>{label}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${cols}, minmax(0, 1fr))` }, gap: 2 }}>
        {children}
      </Box>
    </>
  )
}

export default function UpcomingPreview() {
  // 아래 모바일 액자는 같은 주소를 iframe 으로 다시 띄운 것 — 그 안에서는 카드만 그린다.
  const inFrame = typeof window !== 'undefined' && window.self !== window.top
  if (inFrame) {
    return (
      <ScopedCssBaseline>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TodaySection events={SAMPLE} now={NOW} />
          <EventsSection attendees={SAMPLE_ATT} user="조성범" />
        </Box>
      </ScopedCssBaseline>
    )
  }

  return (
    <ScopedCssBaseline>
      <PageContainer>
        <Typography sx={{ fontSize: typescale.pageTitle.size, fontWeight: typescale.pageTitle.weight, mt: 3, mb: 0.5 }}>
          홈 카드 시안
        </Typography>
        <Typography sx={{ fontSize: typescale.body.size, color: 'text.secondary' }}>
          예시 데이터로 그린 검토용 화면입니다. 기준 시각 2026-08-06 10:36.
          장비 두 카드는 스토어 집계를 쓰므로 로그인한 실제 화면에서만 숫자가 채워집니다.
        </Typography>

        <Frame label="최상단 — 구축 로드맵 한 줄 판(항상 표시)" cols={1}>
          <RoadmapStrip />
        </Frame>

        {/* 공지·업무는 스토어에서 읽으므로 로그인 없이는 목록이 비어 있다.
            그래도 카드 머리(아이콘·제목·건수)와 카드 높이는 여기서 확인된다. */}
        <Frame label="홈 3열 그리드 — 1행">
          <TodaySection events={SAMPLE} now={NOW} />
          <NoticeSection />
          <WorkStatusSection />
        </Frame>

        <Frame label="홈 3열 그리드 — 2행">
          <EventsSection attendees={SAMPLE_ATT} user="조성범" />
          <EqIntroSection />
          <EqOpsSection />
        </Frame>

        <Frame label="오늘 시간 일정이 다 끝난 뒤 (18:00)" cols={3}>
          <TodaySection events={SAMPLE} now={LATE} />
        </Frame>

        <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', mt: 4, mb: 1 }}>모바일 390px</Typography>
        <Box
          component="iframe"
          src="#/upcoming-preview"
          title="모바일 390px 미리보기"
          sx={{ width: 390, height: 560, border: 1, borderColor: 'divider', borderRadius: `${radius.card}px`, bgcolor: 'background.default', mb: 6 }}
        />
      </PageContainer>
    </ScopedCssBaseline>
  )
}
