// 도입 타임라인 간트차트 — 월 단위 그리드, 각 월 안에 반달(전반/후반) 2칸
import type { PointerEvent as ReactPointerEvent } from 'react'
import Box from '@mui/material/Box'
import type { TlMonth } from '@/types'
import { typescale, weight } from '@/theme/tokens'
import { STAGE, STAGE_ORDER } from './stageMeta'

export const TL_VISIBLE_MONTHS = 36 // 표시 최대 월 수 — 실제 구간은 시트에 일정이 있는 범위를 따라감 (eqSlice에서 앞뒤 빈 달 제거)

// 단계 색·이름은 stageMeta(디자인 시스템 accent 토큰)에서 통일해 가져온다
export const TL_STAGE_COLOR: Record<string, string> = Object.fromEntries(STAGE_ORDER.map((c) => [c, STAGE[c].color]))
export const TL_STAGE_NAME: Record<string, string> = Object.fromEntries(STAGE_ORDER.map((c) => [c, STAGE[c].label]))

// 월 경계 세로선 — 첫 칸은 선 없음, 연도가 바뀌는 칸은 진한 선(레거시 .gantt-grid-col/.gantt-mcell 캐스케이드 동일)
const monthBorderLeft = (isFirst: boolean, isYearStart: boolean) =>
  isYearStart ? '1px solid var(--veil-line-strong)' : isFirst ? 'none' : '1px solid var(--veil-line)'

// 리사이즈 손잡이 히트영역 — 칸 안쪽 우측 7px, hover 시 2px 세로선 노출
const resizeHandleSx = {
  position: 'absolute' as const,
  top: 0,
  right: 0,
  width: '7px',
  height: '100%',
  cursor: 'ew-resize',
  zIndex: 2,
  touchAction: 'none',
  '&::after': {
    content: '""',
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '2px',
    height: '100%',
    background: 'var(--veil-handle)',
    opacity: 0,
    transition: 'opacity .1s',
  },
  '&:hover::after': { opacity: 1 },
}

// 모든 월을 동일 비율(1fr)로 — 콘텐츠 폭에 맞춰 균등 배분(가로 스크롤 없이 전체 표시).
function ganttGridTemplate(months: TlMonth[]): string {
  const n = Math.min(months.length, TL_VISIBLE_MONTHS)
  return `repeat(${n}, minmax(0, 1fr))`
}

// 월 헤더 바 (연도행 + 월행 2단 구조)
export function GanttHeader({ months: allMonths }: { months: TlMonth[] }) {
  const months = allMonths.slice(0, TL_VISIBLE_MONTHS)
  if (!months.length) return null

  // 연도별 그룹핑 (연속된 같은 연도 묶음) — 너비는 월 수 × 고정 MONTH_WIDTH
  const yearGroups: { year: string; count: number }[] = []
  months.forEach(m => {
    const last = yearGroups[yearGroups.length - 1]
    if (last && last.year === m.year) last.count++
    else yearGroups.push({ year: m.year, count: 1 })
  })

  return (
    <Box sx={{ gridColumn: 4, display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box
        sx={{
          display: 'grid',
          width: '100%',
          borderBottom: '1px solid var(--border)',
          gridTemplateColumns: yearGroups.map(g => g.count + 'fr').join(' '),
        }}
      >
        {yearGroups.map((g, i) => (
          <Box
            key={i}
            sx={{
              textAlign: 'center',
              fontSize: 15,
              fontWeight: weight.bold,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              paddingBottom: '4px',
              boxSizing: 'border-box',
            }}
          >
            {(g.year || '').replace('년', '')}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'grid', width: '100%', paddingTop: '2px', gridTemplateColumns: ganttGridTemplate(months) }}>
        {months.map((m, i) => {
          const isYearStart = i === 0 || (months[i - 1] && months[i - 1].year !== m.year)
          return (
            <Box
              key={i}
              sx={{
                minWidth: 0,
                height: '18px',
                // 구 fontSize: 9 삭제 — 유일한 자식 span 이 body(13)로 덮어 화면에 나온 적이 없는 죽은 선언
                color: 'text.disabled',
                textAlign: 'center',
                position: 'relative',
                lineHeight: 1,
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: monthBorderLeft(i === 0, isYearStart),
                borderRight: i === months.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              <Box component="span" sx={{ fontSize: typescale.body.size, display: 'block', textAlign: 'center', width: '100%' }}>
                {(m.month || '').replace('월', '')}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// 각 장비 간트 막대
// previewPx: 드래그(이동) 중 실시간 미리보기용 가로 이동량(px). 색 막대 레이어만 이동(격자선 고정).
// onResizeStart: 단계 오른쪽 끝 핸들 — 단계 길이 조절. onStartResize: 첫 단계 왼쪽 시작점 핸들.
export function GanttBar({
  tl,
  months: allMonths,
  previewPx = 0,
  onResizeStart,
  onStartResize,
}: {
  tl: string[]
  months: TlMonth[]
  previewPx?: number
  onResizeStart?: (e: ReactPointerEvent, stageCode: string) => void
  onStartResize?: (e: ReactPointerEvent, stageCode: string) => void
}) {
  const months = allMonths.slice(0, TL_VISIBLE_MONTHS)
  const template = ganttGridTemplate(months)
  // 가장 이른 채워진 반월 index(첫 단계 시작 셀) — 여기에만 좌측 시작핸들
  let firstFilled = -1
  for (let i = 0; i < tl.length; i++) { if ((tl[i] || '').trim()) { firstFilled = i; break } }
  const cols = []
  for (let mi = 0; mi < months.length; mi++) {
    const m = months[mi]
    const isYearStart = mi === 0 || (months[mi - 1] && months[mi - 1].year !== m.year)
    const s1 = (tl[mi * 2] || '').trim()
    const s2 = (tl[mi * 2 + 1] || '').trim()
    cols.push({ mi, m, isYearStart, s1, s2 })
  }

  // 반월 칸 1개 렌더. 단계의 오른쪽 경계 칸엔 길이조절 핸들, 첫 단계 시작 칸엔 좌측 시작핸들.
  const renderHalf = (hi: number, m: TlMonth, half: string) => {
    const code = (tl[hi] || '').trim()
    const isEnd = !!code && (tl[hi + 1] || '').trim() !== code
    const isFirstStart = !!code && hi === firstFilled
    return (
      <Box
        sx={{
          minWidth: 0,
          height: '100%',
          boxSizing: 'border-box',
          position: 'relative',
          background: code ? TL_STAGE_COLOR[code] || undefined : undefined,
        }}
        title={code ? `${m.year || ''} ${m.month || ''} ${half}: ${TL_STAGE_NAME[code] || code}` : undefined}
      >
        {isFirstStart && onStartResize && (
          <Box
            component="span"
            title={`${TL_STAGE_NAME[code] || code} 시작일 조절 (드래그)`}
            sx={[resizeHandleSx, { right: 'auto', left: 0, '&::after': { right: 'auto', left: 0 } }]}
            onPointerDown={(e) => { e.stopPropagation(); onStartResize(e, code) }}
          />
        )}
        {isEnd && onResizeStart && (
          <Box
            component="span"
            title={`${TL_STAGE_NAME[code] || code} 기간 조절 (드래그)`}
            sx={resizeHandleSx}
            onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, code) }}
          />
        )}
      </Box>
    )
  }

  return (
    /* className='gantt-wrap' 은 index.tsx 의 closest('.gantt-wrap') 폭 측정용 — 스타일 아님, 지우지 말 것 */
    <Box className="gantt-wrap" sx={{ position: 'relative', width: '100%' }}>
      {/* 월별 세로 격자선 레이어 (막대 뒤에 깔림, 행 전체 높이) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '100%',
          display: 'grid',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
          gridTemplateColumns: template,
        }}
      >
        {cols.map((c, i) => (
          <Box
            key={c.mi}
            sx={{
              borderLeft: monthBorderLeft(i === 0, c.isYearStart),
              borderRight: i === cols.length - 1 ? '1px solid var(--border)' : undefined,
            }}
          />
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          width: '100%',
          height: '20px',
          borderRadius: '3px',
          overflow: 'hidden',
          border: '0.5px solid',
          borderColor: 'divider',
          position: 'relative',
          zIndex: 1,
          minWidth: 0,
          gridTemplateColumns: template,
          transform: previewPx ? `translateX(${previewPx}px)` : undefined,
          willChange: previewPx ? 'transform' : undefined,
        }}
      >
        {cols.map(c => (
          <Box key={c.mi} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100%', boxSizing: 'border-box', minWidth: 0 }}>
            {renderHalf(c.mi * 2, c.m, '전반')}
            {renderHalf(c.mi * 2 + 1, c.m, '후반')}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
