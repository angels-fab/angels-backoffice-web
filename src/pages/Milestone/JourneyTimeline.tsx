import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { alpha, type Theme } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { AppCard } from '@/components/ds'
import { ROADMAP_STEPS } from '@/constants/roadmap'
import { iconSize, radius, typescale } from '@/theme/tokens'
import type { MilestoneRow } from '@/api/milestones'
import { TOTAL_QUARTERS, deriveStatus, qAt, type DerivedStatus } from './model'

/**
 * 구축 여정 타임라인 — 14분기 축 위에 분기별 완료목표 업무량(상태색 스택)과
 * '현재' 위치를 표시. 왼쪽 프롤로그는 홈 로드맵의 설계 단계(이미 지나온 길).
 * 분기 클릭 = 해당 분기 완료목표로 목록 필터(토글).
 */

const BAR_UNIT = 7 // 업무 1건당 스택 높이(px)
const BAR_AREA = 84 // 스택 최대 영역(px)

/** 스택 순서(아래→위): 완료가 바닥에 쌓여 "차오르는" 감각을 만든다 */
const STACK_ORDER: DerivedStatus[] = ['완료', '진행중', '보류', '지연', '예정']

const statusColor = (t: Theme, s: DerivedStatus): string => {
  switch (s) {
    case '완료': return t.palette.accent.blue
    case '진행중': return t.palette.accent.green
    case '보류': return t.palette.accent.amber
    case '지연': return t.palette.accent.red
    default: return alpha(t.palette.text.secondary, 0.35)
  }
}

export interface JourneyTimelineProps {
  items: MilestoneRow[]
  curIdx: number
  /** 선택된 완료목표 분기('2027Q1') — 목록 필터와 연동 */
  selectedQ: string | null
  onSelectQuarter: (q: string | null) => void
}

export default function JourneyTimeline({ items, curIdx, selectedQ, onSelectQuarter }: JourneyTimelineProps) {
  // 분기별 완료목표 업무의 상태 카운트
  const cols = Array.from({ length: TOTAL_QUARTERS }, (_, idx) => {
    const q = qAt(idx)
    const rows = items.filter((r) => r.endQ === q)
    const counts = new Map<DerivedStatus, number>()
    rows.forEach((r) => {
      const s = deriveStatus(r, curIdx)
      counts.set(s, (counts.get(s) || 0) + 1)
    })
    return { idx, q, total: rows.length, counts }
  })

  // 연도 밴드(2026=2분기 · 2027~2029=4분기)
  const years = [
    { year: '2026', span: 2 },
    { year: '2027', span: 4 },
    { year: '2028', span: 4 },
    { year: '2029', span: 4 },
  ]

  const prologue = ROADMAP_STEPS.filter((s) => s.status !== 'plan')

  return (
    <AppCard>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2, minWidth: 640 }}>
          {/* 프롤로그 — 이미 지나온 설계 여정(홈 로드맵과 연결) */}
          <Box
            sx={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 1,
              pr: 2,
              borderRight: '1px dashed',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {prologue.map((s) => (
                <Tooltip key={s.label} title={`${s.label} · ${s.period}`} arrow>
                  <Box
                    sx={{
                      display: 'flex',
                      fontSize: iconSize.body,
                      color: (t) => (s.status === 'done' ? t.palette.accent.blue : t.palette.accent.green),
                    }}
                  >
                    {s.status === 'done' ? <CheckCircleIcon fontSize="inherit" /> : <MyLocationIcon fontSize="inherit" />}
                  </Box>
                </Tooltip>
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}>
              설계 단계
            </Typography>
          </Box>

          {/* 본선 — 14분기 */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
              {cols.map((c) => {
                const isCur = c.idx === curIdx
                const isPast = c.idx < curIdx
                const isLast = c.idx === TOTAL_QUARTERS - 1
                const selected = selectedQ === c.q
                return (
                  <Tooltip
                    key={c.q}
                    arrow
                    title={`${c.q.replace('Q', '.')}Q 완료목표 ${c.total}건 — 클릭해 목록 필터`}
                  >
                    <Box
                      onClick={() => onSelectQuarter(selected ? null : c.q)}
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        height: BAR_AREA + 34,
                        cursor: 'pointer',
                        borderRadius: `${radius.chip}px`,
                        bgcolor: (t) =>
                          selected
                            ? alpha(t.palette.primary.main, 0.12)
                            : isCur
                              ? alpha(t.palette.accent.amber, 0.07)
                              : 'transparent',
                        opacity: isPast ? 0.55 : 1,
                        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
                      }}
                    >
                      {/* 현재 위치 핀 */}
                      {isCur && (
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            px: 0.75,
                            borderRadius: `${radius.chip}px`,
                            bgcolor: 'accent.amber',
                            color: 'background.default',
                            fontWeight: typescale.emphasis.weight,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          현재
                        </Typography>
                      )}
                      {/* 종점 — 개소 */}
                      {isLast && (
                        <Box sx={{ position: 'absolute', top: 0, display: 'flex', fontSize: iconSize.header, color: 'accent.purple' }}>
                          <RocketLaunchIcon fontSize="inherit" />
                        </Box>
                      )}
                      {/* 상태 스택 바 */}
                      <Box sx={{ width: '58%', display: 'flex', flexDirection: 'column-reverse', overflow: 'hidden' }}>
                        {STACK_ORDER.map((s) => {
                          const n = c.counts.get(s) || 0
                          if (!n) return null
                          return (
                            <Box
                              key={s}
                              sx={{
                                height: Math.min(n * BAR_UNIT, BAR_AREA),
                                bgcolor: (t) => statusColor(t, s),
                              }}
                            />
                          )
                        })}
                        {c.total === 0 && (
                          <Box sx={{ height: 2, bgcolor: 'divider', borderRadius: `${radius.chip}px` }} />
                        )}
                      </Box>
                      {/* 분기 라벨 */}
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 0.5,
                          color: isCur ? 'accent.amber' : 'text.disabled',
                          fontWeight: isCur ? typescale.emphasis.weight : typescale.caption.weight,
                        }}
                      >
                        {c.q.split('Q')[1]}Q
                      </Typography>
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
            {/* 연도 밴드 */}
            <Box sx={{ display: 'flex', mt: 0.5, borderTop: 1, borderColor: 'divider', pt: 0.5 }}>
              {years.map((y, i) => (
                <Box
                  key={y.year}
                  sx={{
                    flex: y.span,
                    display: 'flex',
                    justifyContent: 'space-between',
                    pl: i === 0 ? 0.5 : 1,
                    pr: 0.5,
                    borderLeft: i > 0 ? 1 : 0,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {y.year}
                  </Typography>
                  {y.year === '2029' && (
                    <Typography variant="caption" sx={{ color: 'accent.purple', fontWeight: typescale.emphasis.weight }}>
                      개소
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </AppCard>
  )
}
