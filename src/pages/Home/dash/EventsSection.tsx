import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState } from '@/components/ds'
import { useRole } from '@/auth/role'
import { fetchAttendees, type AttendeeRow } from '@/api/events'
// 학술·교육·전시 메뉴가 사이드바·페이지 헤더에서 쓰는 그 아이콘(nav.tsx 단일 출처) — 다른 것 고르지 말 것
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { FAB_EVENTS, eventStatus, fmtEventDate } from '@/constants/events'
import { iconSize, typescale, weight } from '@/theme/tokens'
import { HomeCard } from './HomeCard'

/**
 * 행사명은 **첫 '-' 앞까지만**(사용자 지시 2026-08-06).
 * 정식 명칭이 'Smart Semiconductor Academy 2026 - 제7회 스마트 반도체 아카데미'처럼
 * 영문명 + 국문 부제로 되어 있어, 카드에서는 앞 이름만으로 충분하고 두 줄로 넘치지도 않는다.
 */
const shortName = (title: string) => title.split(/\s[-–—]\s/)[0].trim() || title

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

  return (
    <HomeCard
      icon={<CoPresentIcon sx={{ fontSize: iconSize.header, color: 'accentText.purple' }} />}
      title="예정 행사"
      stat={att ? { value: mine.length, unit: '건' } : undefined}
      actionLabel="행사"
      onAction={() => navigate('/events')}
    >
      {!att ? (
        <LoadingState size="md" />
      ) : !head ? (
        <EmptyState size="sm" title="신청한 행사가 없습니다" />
      ) : (
        <Box>
          {/* 행 규격은 '오늘 일정'과 동일 — D-day 가 시각 자리, 가장 가까운 것만 파랗게 */}
          {mine.map((e, i) => {
            const first = i === 0
            return (
              <Box key={e.id} sx={{ py: 1, borderTop: first ? 0 : 1, borderColor: 'divider', minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      flexShrink: 0, width: 42, fontSize: typescale.small.size, fontVariantNumeric: 'tabular-nums',
                      fontWeight: first ? weight.bold : weight.medium,
                      color: first ? 'primary.main' : 'text.disabled',
                    }}
                  >
                    {eventStatus(e.start, e.end).label}
                  </Typography>
                  <Typography
                    sx={{
                      flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontSize: typescale.emphasis.size,
                      fontWeight: first ? weight.bold : typescale.emphasis.weight,
                      color: first ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {shortName(e.title)}
                  </Typography>
                </Box>
                {/* 날짜·장소는 가장 가까운 것에만 — 전부 적으면 다시 읽을 것이 많아진다 */}
                {first && (
                  <Typography sx={{ mt: 0.25, ml: '50px', fontSize: typescale.body.size, color: 'text.secondary' }}>
                    {fmtEventDate(e.start, e.end)} · {e.venue}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      )}
    </HomeCard>
  )
}
