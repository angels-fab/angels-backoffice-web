// 도입 타임라인 간트차트 — 월 단위 그리드, 각 월 안에 반달(전반/후반) 2칸
import type { TlMonth } from '@/types'

export const TL_VISIBLE_MONTHS = 36 // 표시 최대 월 수 — 실제 구간은 시트에 일정이 있는 범위를 따라감 (eqSlice에서 앞뒤 빈 달 제거)

export const TL_STAGE_COLOR: Record<string, string> = {
  사: '#F85149', // 사전규격
  공: '#F0B429', // 구매공고
  평: '#3FB950', // 기술평가
  협: '#39D0D8', // 기술협상
  제: '#58A6FF', // 장비제작
  설: '#BC8CFF', // 장비설치
}
export const TL_STAGE_NAME: Record<string, string> = {
  사: '사전규격', 공: '구매공고', 평: '기술평가', 협: '기술협상', 제: '장비제작', 설: '장비설치',
}

// 월별 너비 비율: 한 자리 월=2, 두 자리 월=3 (숫자 하나만큼 더 넓게)
function monthWidthUnits(monthStr: string): number {
  const n = (monthStr || '').replace('월', '').trim()
  return n.length >= 2 ? 3 : 2
}

function ganttGridTemplate(months: TlMonth[]): string {
  return months
    .slice(0, TL_VISIBLE_MONTHS)
    .map(m => monthWidthUnits(m.month) + 'fr')
    .join(' ')
}

// 월 헤더 바 (연도행 + 월행 2단 구조)
export function GanttHeader({ months: allMonths }: { months: TlMonth[] }) {
  const months = allMonths.slice(0, TL_VISIBLE_MONTHS)
  if (!months.length) return null

  // 연도별 그룹핑 (연속된 같은 연도 묶음)
  const yearGroups: { year: string; units: number; count: number }[] = []
  months.forEach(m => {
    const last = yearGroups[yearGroups.length - 1]
    if (last && last.year === m.year) {
      last.units += monthWidthUnits(m.month)
      last.count++
    } else {
      yearGroups.push({ year: m.year, units: monthWidthUnits(m.month), count: 1 })
    }
  })

  return (
    <div className="gantt-head-wrap">
      <div
        className="gantt-yearrow"
        style={{ gridTemplateColumns: yearGroups.map(g => g.units + 'fr').join(' ') }}
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
export function GanttBar({ tl, months: allMonths }: { tl: string[]; months: TlMonth[] }) {
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
      <div className="gantt-bar" style={{ gridTemplateColumns: template }}>
        {cols.map(c => (
          <div key={c.mi} className="gantt-month">
            <div
              className="gantt-cell"
              style={c.s1 ? { background: TL_STAGE_COLOR[c.s1] || undefined } : undefined}
              title={c.s1 ? `${c.m.year || ''} ${c.m.month || ''} 전반: ${TL_STAGE_NAME[c.s1] || c.s1}` : undefined}
            />
            <div
              className="gantt-cell"
              style={c.s2 ? { background: TL_STAGE_COLOR[c.s2] || undefined } : undefined}
              title={c.s2 ? `${c.m.year || ''} ${c.m.month || ''} 후반: ${TL_STAGE_NAME[c.s2] || c.s2}` : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
