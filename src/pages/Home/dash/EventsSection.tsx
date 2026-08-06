import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState, StatusChip } from '@/components/ds'
import type { StatusKind } from '@/components/ds/StatusChip'
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
 * 행사 종류 → 칩 색. kind 는 자유 문자열(국제학회·국내학회·컨퍼런스·교육·교육세미나·워크숍·전시회…)이라
 * 정확히 일치가 아니라 낱말이 들어 있는지로 가른다. 새 종류가 생겨도 중립 회색으로 무난히 떨어진다.
 */
function kindStatus(kind: string): StatusKind {
  const k = kind || ''
  if (k.includes('학회') || k.includes('컨퍼런스') || k.includes('심포지엄')) return 'info'
  if (k.includes('교육') || k.includes('세미나') || k.includes('워크숍') || k.includes('아카데미')) return 'success'
  if (k.includes('전시') || k.includes('산업전')) return 'warning'
  if (k.includes('채용')) return 'purple'
  return 'neutral'
}

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
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* 행 앞에는 종류 칩 — 교육·학회·전시가 한눈에 갈리게(사용자 지시 2026-08-06) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <StatusChip status={kindStatus(head.kind)} label={head.kind} />
              <Typography
                sx={{
                  flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight,
                }}
              >
                {shortName(head.title)}
              </Typography>
            </Box>
            <Typography sx={{ mt: 0.5, fontSize: typescale.body.size, color: 'text.secondary' }}>
              {fmtEventDate(head.start, head.end)} · {head.venue}
            </Typography>

            {/* 나머지는 종류 칩 + 이름 + D-n 만 */}
            {mine.slice(1).map((e) => (
              <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, pt: 1.25, borderTop: 1, borderColor: 'divider', minWidth: 0 }}>
                <StatusChip status={kindStatus(e.kind)} label={e.kind} />
                <Typography sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: typescale.emphasis.size, fontWeight: typescale.emphasis.weight, color: 'text.secondary' }}>
                  {shortName(e.title)}
                </Typography>
                <Typography sx={{ flexShrink: 0, fontSize: typescale.small.size, fontWeight: weight.medium, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                  {eventStatus(e.start, e.end).label}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* 가장 가까운 행사의 남은 일수 — 자리·크기는 종전대로 본문 우측에 크게(사용자 지시) */}
          <Typography
            sx={{
              flexShrink: 0, fontSize: typescale.display.size, fontWeight: typescale.display.weight,
              lineHeight: 1.1, color: 'primary.main', fontVariantNumeric: 'tabular-nums',
            }}
          >
            {eventStatus(head.start, head.end).label}
          </Typography>
        </Box>
      )}
    </HomeCard>
  )
}
