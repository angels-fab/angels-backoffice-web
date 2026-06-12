import type { EqGroup, TlMonth } from '@/types'
import { GanttBar } from './gantt'

// 장비 상태 색상 매핑
const EQ_STATE_COLOR: Record<string, string> = {
  도입예정: '#9CA3AF', 도입중: '#3B82F6', 가동중: '#22C55E',
  비가동: '#EF4444', 유지보수: '#EF4444', 고장: '#EF4444', '고장/이상': '#EF4444', 이상: '#EF4444',
}

export function eqStateColor(s: string): string {
  s = (s || '').trim()
  if (EQ_STATE_COLOR[s]) return EQ_STATE_COLOR[s]
  // 부분 일치 (예: '고장 수리중' 등)
  for (const k in EQ_STATE_COLOR) {
    if (s.includes(k)) return EQ_STATE_COLOR[k]
  }
  return '#9CA3AF'
}

interface Props {
  eq: EqGroup
  index: number
  months: TlMonth[]
}

// 도입 타임라인 행 (연번 | 관리번호 | 장비명 | 간트 막대)
export default function EqItem({ eq, index, months }: Props) {
  const codeShort = eq.codes.length > 1 ? eq.codes[0] + '~' : eq.codes[0] || '-'

  return (
    <div className="eq-item">
      <div className="eq-row">
        <span className="eq-seq">{index + 1}</span>
        <span className="eq-code">{codeShort}</span>
        <div className="eq-main">
          <span className="eq-name">
            {eq.name}
            {eq.count > 1 && (
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 4 }}>({eq.count}대)</span>
            )}
          </span>
        </div>
        <div className="eq-tl-cell">
          <GanttBar tl={eq.timeline} months={months} />
        </div>
      </div>
    </div>
  )
}
