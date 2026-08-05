import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState } from '@/components/ds'
import { useRole } from '@/auth/role'
import { fetchAttendees, type AttendeeRow } from '@/api/events'
import { FAB_EVENTS, eventStatus, fmtEventDate } from '@/constants/events'
import { typescale, weight } from '@/theme/tokens'
import { HomeCard } from './HomeCard'

/**
 * 홈 '참석 예정 행사' (2026-08-06 신설, 사용자 지시).
 *
 * **개인화 카드** — 행사 목록 전체가 아니라 *내가 참석 신청한* 행사만 센다.
 * 행사 화면(Events)에서 참석 스위치를 켠 것이 여기 남은 일수로 올라온다.
 * 남은 일수 계산은 행사 화면과 같은 함수(eventStatus)를 쓴다 — 두 화면의 D-day 가 갈리지 않게.
 *
 * 참석자는 행사 화면에서만 쓰던 값이라 전역 상태가 없다. 카드 하나를 위해 슬라이스를 새로 만들지 않고
 * 여기서 한 번 불러온다(행사 참석은 자주 바뀌지 않는다).
 */
export default function EventsSection({ attendees: givenAtt, user: givenUser }: { attendees?: AttendeeRow[]; user?: string } = {}) {
  const navigate = useNavigate()
  const { user: sessionUser } = useRole()
  const user = givenUser ?? sessionUser
  const [att, setAtt] = useState<AttendeeRow[] | null>(givenAtt ?? null)

  useEffect(() => {
    if (givenAtt) return
    let alive = true
    void fetchAttendees()
      .then((rows) => { if (alive) setAtt(rows) })
      .catch(() => { if (alive) setAtt([]) })
    return () => { alive = false }
  }, [givenAtt])

  /** 내가 신청한 · 아직 안 끝난 행사 — 가까운 순 */
  const mine = useMemo(() => {
    if (!att || !user) return []
    const ids = new Set(att.filter((a) => a.name === user).map((a) => a.eventId))
    return FAB_EVENTS
      .filter((e) => ids.has(e.id) && eventStatus(e.start, e.end).tone !== 'gray')
      .sort((a, b) => a.start.localeCompare(b.start))
  }, [att, user])

  const head = mine[0]
  const st = head ? eventStatus(head.start, head.end) : null

  return (
    <HomeCard title="참석 예정 행사" count={att ? `${mine.length}건` : undefined} actionLabel="행사" onAction={() => navigate('/events')}>
      {!att ? (
        <LoadingState size="md" />
      ) : !head ? (
        <EmptyState size="sm" title="신청한 행사가 없습니다" />
      ) : (
        <Box>
          {/* 가장 가까운 것 하나만 크게 — 남은 일수가 이 카드의 답이다 */}
          <Typography
            sx={{
              fontSize: typescale.display.size, fontWeight: typescale.display.weight, lineHeight: 1.15,
              color: st?.tone === 'green' ? 'success.main' : 'primary.main',
            }}
          >
            {st?.label}
          </Typography>
          <Typography
            sx={{
              mt: 0.75, fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight, lineHeight: 1.35,
              display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
            }}
          >
            {head.title}
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: typescale.small.size, color: 'text.secondary' }}>
            {fmtEventDate(head.start, head.end)} · {head.venue}
          </Typography>

          {/* 나머지는 이름만 — 날짜까지 다 적으면 다시 읽을 것이 많아진다 */}
          {mine.slice(1).map((e) => (
            <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider', minWidth: 0 }}>
              <Typography sx={{ flexShrink: 0, fontSize: typescale.small.size, fontWeight: weight.bold, color: 'text.disabled' }}>
                {eventStatus(e.start, e.end).label}
              </Typography>
              <Typography sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: typescale.small.size, color: 'text.secondary' }}>
                {e.title}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </HomeCard>
  )
}
