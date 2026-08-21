import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import { EmptyState, LoadingState, focusRingSx } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { taskTitle } from '@/pages/Work/workMeta'
import { fmtDate } from '@/utils/date'
// 업무현황 화면이 '진행중 업무'에 쓰는 그 아이콘(Work/index.tsx:88 · 칸반 '진행중' 열과 동일).
// 사이드바의 메뉴 아이콘(Assessment)이 아니라 **상태 아이콘**이어야 한다(사용자 지시 2026-08-06).
import TimelapseIcon from '@mui/icons-material/Timelapse'
import { iconSize, radius, typescale } from '@/theme/tokens'
import { HomeCard, HomeRow } from './HomeCard'

/** 처음에 보여줄 줄 수 — 나머지는 '더 보기'로 편다 */
const HEAD = 3

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

  return (
    <HomeCard
      icon={<TimelapseIcon sx={{ fontSize: iconSize.header, color: 'text.primary' }} />}
      title="진행 중 업무"
      stat={{ value: rows.length, unit: '건' }}
      actionLabel="업무현황"
      onAction={() => navigate('/work')}
    >
      {!ready ? (
        <LoadingState skeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState size="sm" title="진행 중인 업무가 없습니다" />
      ) : (
        <Box>
          {/* 제목만 — 구분 칩·부서·날짜는 뺐다(사용자 지시 2026-08-05) */}
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
      )}
    </HomeCard>
  )
}
