import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import { EmptyState, LoadingState } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { CAL_CAT_MAP } from '@/constants/calendar'
import { hexA } from '@/utils/color'
import { todaySeoul } from '@/utils/date'
import { accent, radius, typescale, weight } from '@/theme/tokens'
import { catTextColor, toneOfColor } from '@/pages/Calendar/catMeta'
import type { CalEvent } from '@/types'
import { HomeCard, HomeRow, HomeMeta } from './HomeCard'
import MiniMonth from './MiniMonth'


/** 유형 배지 — 캘린더 카테고리 색 또는 행사 자체 색을 그대로 쓴다 */
function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <Box
      component="span"
      sx={{
        flexShrink: 0,
        fontSize: typescale.small.size,
        fontWeight: weight.semibold,
        px: 0.75,
        py: '2px',
        borderRadius: `${radius.chip}px`,
        // 글자는 채움색(accent)이 아니라 글자용 값 — 14% 틴트 면 위에서 accent 는 2.83:1 로 무너진다
        color: (th) => catTextColor(th, toneOfColor(color)),
        bgcolor: hexA(color, 0.14),
        border: `1px solid ${hexA(color, 0.32)}`,
      }}
    >
      {label}
    </Box>
  )
}

/** 캘린더 카테고리 배지 — 라벨·색을 카테고리 표에서 찾아 넘긴다 */
function CatBadge({ cat }: { cat: CalEvent['cat'] }) {
  const c = CAL_CAT_MAP[cat]
  return <TypeBadge label={c?.label || '기타'} color={c?.color || accent.blue} />
}

/** 오늘 목록에 보여줄 줄 수 — 넘치면 '캘린더'로. 읽을 거리를 줄이는 게 목적이다(2026-08-05 간소화) */
const ROWS = 3

/**
 * 홈 첫 카드 '오늘 일정' — 위는 오늘 내역, 구분선 아래는 간소화 달력(사용자 지시 2026-08-05).
 *
 * 포털에 들어와 가장 궁금한 것이 "오늘 일정이 뭐지?"라서 좌측 첫 자리에 둔다.
 * 위쪽은 오늘 것을 글로 읽고, 아래 달력은 읽는 게 아니라 **이번 달에 언제 몰려 있는지 모양으로** 본다
 * (하루짜리 점 · 여러 날 선 — MiniMonth).
 */
export default function ScheduleSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.cal.ready)
  const events = useAppSelector((s) => s.cal.events)
  const today = todaySeoul()

  // 오늘 — 종일 먼저, 그다음 시간순
  const todayList = events
    .filter((e) => e.date === today)
    .sort((a, b) => {
      const aAll = a.time === '종일'
      const bAll = b.time === '종일'
      if (aAll !== bAll) return aAll ? -1 : 1
      return a.time.localeCompare(b.time)
    })

  return (
    <HomeCard title="오늘 일정" count={`${todayList.length}건`} actionLabel="캘린더" onAction={() => navigate('/calendar')}>
      {!ready ? (
        <LoadingState size="md" />
      ) : todayList.length === 0 ? (
        <EmptyState size="sm" title="오늘 예정된 일정이 없습니다" />
      ) : (
        todayList.slice(0, ROWS).map((e, i) => (
          <HomeRow
            key={`${e.id}-${i}`}
            lead={<HomeMeta mono color="primary.main">{e.time === '종일' ? '종일' : e.time.slice(0, 5)}</HomeMeta>}
            title={e.title}
            trail={<CatBadge cat={e.cat} />}
          />
        ))
      )}

      {/* 구분선 아래 = 이번 달 한눈에. 점·선만으로 그린다(제목 없음) */}
      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <MiniMonth />
      </Box>
    </HomeCard>
  )
}
