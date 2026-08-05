import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { EmptyState, LoadingState, focusRingSx } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { taskTitle } from '@/pages/Work/workMeta'
import { fmtDate, isRecentNew } from '@/utils/date'
import AssessmentIcon from '@mui/icons-material/Assessment'
import { iconSize, radius, typescale, weight } from '@/theme/tokens'
import { HomeCard, HomeRow } from './HomeCard'

/** 처음에 보여줄 줄 수 — 나머지는 '더 보기'로 편다 */
const HEAD = 4

/**
 * 홈 '진행 중 업무' — **큰 숫자 + 제목 목록을 한 카드**로(사용자 지시 2026-08-05).
 *
 * 요약 숫자 타일과 제목 목록이 따로 있어 같은 것을 두 번 보게 했다. 왼쪽에 숫자 하나,
 * 오른쪽 남는 자리에 제목을 두어 "몇 건인지"와 "무엇인지"를 한 번에 읽는다.
 * 완료 누계·취소는 쓰지 않는다 — 완료는 매일 같고 취소는 데이터에 상태 자체가 없다.
 */
export default function WorkStatusSection() {
  const navigate = useNavigate()
  const ready = useAppSelector((s) => s.work.ready)
  const items = useAppSelector((s) => s.work.items)
  const [all, setAll] = useState(false)

  // 진행중 + Remind 로 뺀 것 제외 — 업무현황 페이지의 '진행중' 뷰와 같은 모집단
  const rows = items
    .filter((t) => (t.status || '').trim() === '진행중' && !t.remind)
    .sort((a, b) => fmtDate(b.start).localeCompare(fmtDate(a.start)))
  const shown = all ? rows : rows.slice(0, HEAD)
  const fresh = rows.filter((t) => isRecentNew(fmtDate(t.start))).length

  return (
    <HomeCard
      icon={<AssessmentIcon sx={{ fontSize: iconSize.header, color: 'accentText.teal' }} />}
      title="진행 중 업무"
      actionLabel="업무현황"
      onAction={() => navigate('/work')}
    >
      {!ready ? (
        <LoadingState size="md" />
      ) : rows.length === 0 ? (
        <EmptyState size="sm" title="진행 중인 업무가 없습니다" />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto 1fr' }, gap: { xs: 1.5, sm: 2 }, alignItems: 'start' }}>
          {/* 왼쪽 — 건수 하나만 크게 */}
          <Box sx={{ minWidth: 68 }}>
            <Typography sx={{ fontSize: typescale.displayLg.size, fontWeight: typescale.displayLg.weight, lineHeight: 1.1 }}>
              {rows.length}
            </Typography>
            <Typography sx={{ fontSize: typescale.small.size, color: 'text.disabled', fontWeight: weight.medium }}>
              {fresh > 0 ? `이번 주 +${fresh}` : '이번 주 신규 없음'}
            </Typography>
          </Box>

          {/* 오른쪽 — 무엇인지 */}
          <Box sx={{ minWidth: 0 }}>
            {/* 구분 칩·부서·날짜는 뺐다(사용자 지시 2026-08-05) — 홈에서는 무엇이 돌아가는지 제목만 본다 */}
            {shown.map((t) => (
              <HomeRow key={t.num} onClick={() => navigate(`/work?focus=${t.id}`)} title={taskTitle(t)} />
            ))}
            {rows.length > HEAD && (
              <Box sx={{ pt: 1 }}>
                <ButtonBase
                  onClick={() => setAll((v) => !v)}
                  sx={{ fontSize: typescale.body.size, color: 'primary.main', px: 0.5, py: 0.25, borderRadius: `${radius.chip}px`, ...(focusRingSx as object) }}
                >
                  {all ? '접기' : `${rows.length - HEAD}건 더 보기`}
                </ButtonBase>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </HomeCard>
  )
}
