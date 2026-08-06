import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState } from '@/components/ds'
import { EventCatChip, EventStatusChip } from '@/pages/Events/eventCard'
import { useRole } from '@/auth/role'
import { fetchAttendees, type AttendeeRow } from '@/api/events'
// 학술·교육·전시 메뉴가 사이드바·페이지 헤더에서 쓰는 그 아이콘(nav.tsx 단일 출처) — 다른 것 고르지 말 것
import CoPresentIcon from '@mui/icons-material/CoPresent'
import { FAB_EVENTS, eventStatus } from '@/constants/events'
import { iconSize, typescale } from '@/theme/tokens'
import { HomeCard, ROW_H } from './HomeCard'

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
export default function EventsSection() {
  const navigate = useNavigate()
  const { user } = useRole()
  const [att, setAtt] = useState<AttendeeRow[] | null>(null)

  useEffect(() => {
    let alive = true
    void fetchAttendees()
      .then((rows) => { if (alive) setAtt(rows) })
      .catch(() => { if (alive) setAtt([]) })
    return () => { alive = false }
  }, [])

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
      icon={<CoPresentIcon sx={{ fontSize: iconSize.header, color: 'text.primary' }} />}
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
          {/*
           * 한 행 = 분류 칩(학술·교육·전시) · 상태 칩(D-n·진행중) · 행사명 한 줄.
           * 칩은 **행사 카드의 그 부품을 그대로** 쓴다(2026-08-06 사용자 확정 — 홈이 따로 그리면
           * 색·분류가 어긋난다. 종전에 kind 원문(교육세미나·워크숍)으로 칩을 만들었다 지적받은 그 문제).
           * 날짜·장소 줄 없음 — 상태 칩이 '언제'를 말하고, 상세는 행사 페이지에서 본다.
           */}
          {mine.map((e, i) => (
            <Box
              key={e.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 1,
                minHeight: ROW_H, boxSizing: 'border-box',
                borderTop: i === 0 ? 0 : 1, borderColor: 'divider', minWidth: 0,
              }}
            >
              <EventCatChip kind={e.kind} />
              <EventStatusChip start={e.start} end={e.end} />
              <Typography
                sx={{
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight,
                }}
              >
                {shortName(e.title)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </HomeCard>
  )
}
