import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { alpha, type Theme } from '@mui/material/styles'
import { AppCard } from '@/components/ds'
import { iconSize, motion, radius, typescale } from '@/theme/tokens'
import type { MilestoneRow } from '@/api/milestones'
import { CATEGORIES, TOTAL_QUARTERS, deriveStatus, qFull, qIndex, type DerivedStatus } from './model'

/**
 * 스윔레인 간트(지도 뷰) — 9개 대분류 레인 × 14분기.
 * 기본은 레인당 요약 막대(상태 구성비) 1줄, 레인 클릭으로 업무별 막대 펼침.
 * 앰버 '오늘' 세로선이 지나온 시간(어두운 면)과 남은 시간을 가른다.
 * 퍼지(추정 분기) 막대는 점선 테두리 + 옅은 채움으로 구분.
 */

const LABEL_W = 200

const statusColor = (t: Theme, s: DerivedStatus): string => {
  switch (s) {
    case '완료': return t.palette.accent.blue
    case '진행중': return t.palette.accent.green
    case '보류': return t.palette.accent.amber
    case '지연': return t.palette.accent.red
    default: return alpha(t.palette.text.secondary, 0.4)
  }
}

const LEGEND: DerivedStatus[] = ['완료', '진행중', '보류', '지연', '예정']

export interface GanttBoardProps {
  items: MilestoneRow[]
  curIdx: number
  onOpen: (row: MilestoneRow) => void
}

export default function GanttBoard({ items, curIdx, onOpen }: GanttBoardProps) {
  // 첫 레인은 기본 펼침 — "레인은 펼쳐진다"를 첫 화면에서 시연(UX 진단 반영)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [CATEGORIES[0].full]: true })
  const allExpanded = CATEGORIES.every((c) => expanded[c.full])
  const toggleAll = () => {
    const next = !allExpanded
    setExpanded(Object.fromEntries(CATEGORIES.map((c) => [c.full, next])))
  }

  // 오늘선 x 위치 — 현재 분기 칸의 중앙
  const todayFrac = (curIdx + 0.5) / TOTAL_QUARTERS
  const xAt = (frac: number) => `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${frac})`

  const years = [
    { year: '2026', frac: 0 },
    { year: '2027', frac: 2 / TOTAL_QUARTERS },
    { year: '2028', frac: 6 / TOTAL_QUARTERS },
    { year: '2029', frac: 10 / TOTAL_QUARTERS },
  ]

  return (
    <AppCard>
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: 760, position: 'relative' }}>
          {/* 헤더 — 연도 밴드 */}
          <Box sx={{ display: 'flex', pb: 0.75, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                분야 / 분기
              </Typography>
            </Box>
            <Box sx={{ flex: 1, position: 'relative', height: 18 }}>
              {years.map((y) => (
                <Typography
                  key={y.year}
                  variant="caption"
                  sx={{ position: 'absolute', left: `${y.frac * 100}%`, pl: 0.75, color: 'text.disabled' }}
                >
                  {y.year}
                </Typography>
              ))}
              <Typography
                variant="caption"
                sx={{ position: 'absolute', right: 0, color: 'accent.purple', fontWeight: typescale.emphasis.weight }}
              >
                개소
              </Typography>
            </Box>
          </Box>

          {/* 범례 + 전체 펼치기 — 기능 안내가 기능보다 먼저 보이도록 상단 배치 */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
            {LEGEND.map((s) => (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: `${radius.pill}px`, bgcolor: (t) => statusColor(t, s) }} />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {s}
                </Typography>
              </Box>
            ))}
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              · 점선 = 추정 기간 · 분야 클릭 = 업무별 막대 펼침
            </Typography>
            <Button
              size="small"
              onClick={toggleAll}
              startIcon={allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
              sx={{ ml: 'auto', color: 'text.secondary' }}
            >
              {allExpanded ? '전체 접기' : '전체 펼치기'}
            </Button>
          </Box>

          {/* 레인 영역 — 상단 여백은 '오늘' 라벨 자리 */}
          <Box sx={{ position: 'relative', pt: '22px' }}>
            {/* 지나온 시간(오늘선 왼쪽) — 면으로 어둡게 */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: LABEL_W,
                width: `calc((100% - ${LABEL_W}px) * ${todayFrac})`,
                bgcolor: (t) => alpha(t.palette.common.black, 0.16),
                pointerEvents: 'none',
              }}
            />
            {/* 연도 경계선 */}
            {years.slice(1).map((y) => (
              <Box
                key={y.year}
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: xAt(y.frac),
                  width: '1px',
                  bgcolor: 'divider',
                  pointerEvents: 'none',
                }}
              />
            ))}
            {/* 오늘선 */}
            <Box
              sx={{
                position: 'absolute',
                top: '18px',
                bottom: 0,
                left: xAt(todayFrac),
                width: '2px',
                bgcolor: 'accent.amber',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translate(-50%, -100%)',
                  px: 0.75,
                  borderRadius: `${radius.chip}px`,
                  bgcolor: 'accent.amber',
                  color: 'background.default',
                  fontWeight: typescale.emphasis.weight,
                  whiteSpace: 'nowrap',
                }}
              >
                오늘
              </Typography>
            </Box>

            {CATEGORIES.map((cat) => {
              const rows = items.filter((r) => r.category === cat.full)
              if (rows.length === 0) return null
              const done = rows.filter((r) => r.status === '완료').length
              const minStart = Math.min(...rows.map((r) => qIndex(r.startQ)))
              const maxEnd = Math.max(...rows.map((r) => qIndex(r.endQ)))
              const counts = new Map<DerivedStatus, number>()
              rows.forEach((r) => {
                const s = deriveStatus(r, curIdx)
                counts.set(s, (counts.get(s) || 0) + 1)
              })
              const open = !!expanded[cat.full]
              return (
                <Box key={cat.full} sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                  {/* 레인 헤더(요약 막대) */}
                  <Box
                    onClick={() => setExpanded((e) => ({ ...e, [cat.full]: !open }))}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'background.elevated' },
                    }}
                  >
                    <Box sx={{ width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.75, py: 0.75, minWidth: 0 }}>
                      <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }} aria-label={open ? '접기' : '펼치기'}>
                        <ExpandMoreIcon
                          sx={{ fontSize: iconSize.action, transform: open ? 'rotate(180deg)' : 'none', transition: `transform ${motion.base}` }}
                        />
                      </IconButton>
                      <Box sx={{ display: 'flex', fontSize: iconSize.body, color: 'text.secondary', flexShrink: 0 }}>{cat.icon}</Box>
                      <Typography
                        component="span"
                        sx={{
                          fontSize: typescale.body.size,
                          fontWeight: typescale.emphasis.weight,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {cat.short}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', flexShrink: 0 }}>
                        {done}/{rows.length}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, position: 'relative', height: 30 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          left: `${(minStart / TOTAL_QUARTERS) * 100}%`,
                          width: `${((maxEnd - minStart + 1) / TOTAL_QUARTERS) * 100}%`,
                          height: 16,
                          display: 'flex',
                          borderRadius: `${radius.pill}px`,
                          overflow: 'hidden',
                        }}
                      >
                        {LEGEND.map((s) => {
                          const n = counts.get(s) || 0
                          if (!n) return null
                          return <Box key={s} sx={{ flexGrow: n, flexBasis: 0, bgcolor: (t) => statusColor(t, s) }} />
                        })}
                      </Box>
                    </Box>
                  </Box>

                  {/* 업무별 막대(펼침) */}
                  {open &&
                    rows.map((r) => {
                      const s = deriveStatus(r, curIdx)
                      const si = qIndex(r.startQ)
                      const ei = qIndex(r.endQ)
                      return (
                        <Box
                          key={r.id}
                          onClick={() => onOpen(r)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            borderRadius: `${radius.chip}px`,
                            '&:hover': { bgcolor: 'background.elevated' },
                          }}
                        >
                          <Box sx={{ width: LABEL_W, flexShrink: 0, pl: 4.5, pr: 1, minWidth: 0 }}>
                            <Typography
                              variant="caption"
                              sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'text.secondary' }}
                            >
                              {r.title}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1, position: 'relative', height: 24 }}>
                            <Tooltip arrow title={`${r.startLabel} → ${r.endLabel}${r.fuzzy ? ' (추정 분기 매핑)' : ''} · ${qFull(r.startQ)}~${qFull(r.endQ)}`}>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  left: `${(si / TOTAL_QUARTERS) * 100}%`,
                                  width: `${((ei - si + 1) / TOTAL_QUARTERS) * 100}%`,
                                  height: 12,
                                  borderRadius: `${radius.chip}px`,
                                  bgcolor: (t) => alpha(statusColor(t, s), r.fuzzy ? 0.4 : 0.85),
                                  border: r.fuzzy ? '1px dashed' : 'none',
                                  borderColor: (t) => statusColor(t, s),
                                }}
                              />
                            </Tooltip>
                          </Box>
                        </Box>
                      )
                    })}
                </Box>
              )
            })}
          </Box>

        </Box>
      </Box>
    </AppCard>
  )
}
