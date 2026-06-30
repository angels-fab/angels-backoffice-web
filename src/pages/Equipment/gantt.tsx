// 도입 타임라인 간트차트 — 월 단위 그리드, 각 월 안에 반달(전반/후반) 2칸
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { TlMonth } from '@/types'
import { STAGE, STAGE_ORDER } from './stageMeta'

export const TL_VISIBLE_MONTHS = 36 // 표시 최대 월 수 — 실제 구간은 시트에 일정이 있는 범위를 따라감 (eqSlice에서 앞뒤 빈 달 제거)

// 단계 색·이름은 stageMeta(디자인 시스템 accent 토큰)에서 통일해 가져온다
export const TL_STAGE_COLOR: Record<string, string> = Object.fromEntries(STAGE_ORDER.map((c) => [c, STAGE[c].color]))
export const TL_STAGE_NAME: Record<string, string> = Object.fromEntries(STAGE_ORDER.map((c) => [c, STAGE[c].label]))

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
    <div className="gantt-head-wrap">
      <div
        className="gantt-yearrow"
        style={{ gridTemplateColumns: yearGroups.map(g => g.count + 'fr').join(' ') }}
      >
        {yearGroups.map((g, i) => (
          <div key={i} className="gantt-ycell">
            {(g.year || '').replace('년', '')}
          </div>
        ))}
      </div>
      <div className="gantt-head" style={{ gridTemplateColumns: ganttGridTemplate(months) }}>
        {months.map((m, i) => {
          const isYearStart = i === 0 || (months[i - 1] && months[i - 1].year !== m.year)
          const isYearEnd = i === months.length - 1 || (months[i + 1] && months[i + 1].year !== m.year)
          return (
            <div
              key={i}
              className={`gantt-mcell${isYearStart ? ' year-start' : ''}${isYearEnd ? ' year-end' : ''}`}
            >
              <span className="gantt-mnum">{(m.month || '').replace('월', '')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// 각 장비 간트 막대
// previewPx: 드래그(이동) 중 실시간 미리보기용 가로 이동량(px). 색 막대 레이어만 이동(격자선 고정).
// onResizeStart: 단계 오른쪽 끝 핸들 mousedown(STEP16 리사이즈). 있으면 각 단계 끝에 핸들 표시.
export function GanttBar({
  tl,
  months: allMonths,
  previewPx = 0,
  onResizeStart,
}: {
  tl: string[]
  months: TlMonth[]
  previewPx?: number
  onResizeStart?: (e: ReactMouseEvent, stageCode: string) => void
}) {
  const months = allMonths.slice(0, TL_VISIBLE_MONTHS)
  const template = ganttGridTemplate(months)
  const cols = []
  for (let mi = 0; mi < months.length; mi++) {
    const m = months[mi]
    const isYearStart = mi === 0 || (months[mi - 1] && months[mi - 1].year !== m.year)
    const isYearEnd = mi === months.length - 1 || (months[mi + 1] && months[mi + 1].year !== m.year)
    const s1 = (tl[mi * 2] || '').trim()
    const s2 = (tl[mi * 2 + 1] || '').trim()
    cols.push({ mi, m, isYearStart, isYearEnd, s1, s2 })
  }

  // 반월 칸 1개 렌더. 단계의 오른쪽 경계 칸(다음 칸이 다른 코드/빈칸)이면 리사이즈 핸들을 셀 안쪽 우측에 붙인다.
  const renderHalf = (hi: number, m: TlMonth, half: string) => {
    const code = (tl[hi] || '').trim()
    const isEnd = !!code && (tl[hi + 1] || '').trim() !== code
    return (
      <div
        className="gantt-cell"
        style={code ? { background: TL_STAGE_COLOR[code] || undefined } : undefined}
        title={code ? `${m.year || ''} ${m.month || ''} ${half}: ${TL_STAGE_NAME[code] || code}` : undefined}
      >
        {isEnd && onResizeStart && (
          <span
            className="gantt-resize-h"
            title={`${TL_STAGE_NAME[code] || code} 기간 조절 (드래그)`}
            onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, code) }}
          />
        )}
      </div>
    )
  }

  return (
    <div className="gantt-wrap">
      {/* 월별 세로 격자선 레이어 (막대 뒤에 깔림, 행 전체 높이) */}
      <div className="gantt-grid" style={{ gridTemplateColumns: template }}>
        {cols.map(c => (
          <div
            key={c.mi}
            className={`gantt-grid-col${c.isYearStart ? ' year-start' : ''}${c.isYearEnd ? ' year-end' : ''}`}
          />
        ))}
      </div>
      <div
        className="gantt-bar"
        style={{
          gridTemplateColumns: template,
          transform: previewPx ? `translateX(${previewPx}px)` : undefined,
          willChange: previewPx ? 'transform' : undefined,
        }}
      >
        {cols.map(c => (
          <div key={c.mi} className="gantt-month">
            {renderHalf(c.mi * 2, c.m, '전반')}
            {renderHalf(c.mi * 2 + 1, c.m, '후반')}
          </div>
        ))}
      </div>
    </div>
  )
}
