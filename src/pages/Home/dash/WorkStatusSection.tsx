import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import { AppCard, EmptyState, LoadingState, StatusChip, focusRingSx } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { taskTitle } from '@/pages/Work/workMeta'
import { fmtDate } from '@/utils/date'
import { radius, typescale, weight } from '@/theme/tokens'

/** 처음에 보여줄 줄 수 — 나머지는 '더 보기'로 편다(홈이 길어지지 않게) */
const HEAD = 5

/**
 * 홈 '진행 중 업무' — 숫자가 아니라 **목록**.
 *
 * 종전에는 상태별 집계 타일 4개(진행중·완료·보류·취소)와 비율 막대였는데,
 * 완료는 누적이라 매일 같고 취소는 데이터에 상태 자체가 없어 늘 0이었다. 남는 정보는 '진행중 N건'
 * 하나인데 그마저 위쪽 KPI 타일과 겹쳤다(2026-08-05 사용자: "많은데 필요한 정보는 별로 없다").
 * 그래서 지금 무엇이 돌아가는지를 제목으로 보여주는 쪽으로 바꿨다 — 홈에서 바로 읽히고,
 * 누르면 그 업무로 간다.
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

  if (!ready) return <AppCard><LoadingState size="md" /></AppCard>
  if (rows.length === 0) return <AppCard><EmptyState size="sm" title="진행 중인 업무가 없습니다" /></AppCard>

  return (
    <AppCard>
      {shown.map((t) => (
        <ButtonBase
          key={t.num}
          onClick={() => navigate(`/work?focus=${t.id}`)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, width: '100%',
            py: 1, px: 0.5, borderRadius: `${radius.chip}px`, textAlign: 'left',
            borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
            '&:hover': { bgcolor: 'action.hover' },
            ...(focusRingSx as object),
          }}
        >
          {t.cat && <StatusChip status="neutral" label={t.cat} />}
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: typescale.emphasis.size, fontWeight: weight.semibold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {taskTitle(t)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
            {[t.dept, fmtDate(t.start)].filter(Boolean).join(' · ')}
          </Typography>
        </ButtonBase>
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
    </AppCard>
  )
}
