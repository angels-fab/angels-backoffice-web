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

function Drow({ label, value, amber }: { label: string; value?: string; amber?: boolean }) {
  if (!value) return null
  return (
    <div className="eq-drow">
      <span className="eq-dlbl">{label}</span>
      <span className="eq-dval" style={amber ? { color: 'var(--amber)' } : undefined}>
        {value}
      </span>
    </div>
  )
}

function EqDetail({ eq }: { eq: EqGroup }) {
  if (eq.hasVariant) {
    // 세부 항목들을 하위 카드로 표시
    return (
      <div className="eq-detail">
        <div className="eq-variant-list">
          {eq.variants.map(v => {
            const vColor = v.type === '외자' ? '#F0B429' : '#58A6FF'
            return (
              <div className="eq-variant" key={v.code || v.name}>
                <div className="eq-variant-head">
                  <span className="eq-variant-name">{v.name}</span>
                  <span
                    className="eq-type-badge"
                    style={{ background: vColor + '22', color: vColor, border: `1px solid ${vColor}44` }}
                  >
                    {v.type}
                  </span>
                </div>
                <div className="eq-detail-grid">
                  <Drow label="관리번호" value={v.code} />
                  <Drow label="용도" value={v.use} />
                  <Drow label="입찰방법" value={v.bid} />
                  <Drow label="도입금액" value={v.price ? v.price.toLocaleString() + '원' : ''} amber />
                  <Drow label="담당자" value={v.mgr} />
                  <Drow label="비고" value={v.note} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // 일반 장비 상세 (표 컬럼과 정렬)
  const catUse = [eq.cat, eq.use].filter(Boolean).join(' · ')
  const fundType = [eq.fund, eq.type].filter(Boolean).join(' / ')
  return (
    <div className="eq-detail">
      <div className="eq-detail-aligned">
        <div className="eq-dcol-left">
          <div className="eq-dcell">
            <span className="eq-dlbl2">분류·용도</span>
            <span className="eq-dval2">{catUse || '-'}</span>
          </div>
          <div className="eq-dcell">
            <span className="eq-dlbl2">조달구분</span>
            <span className="eq-dval2">{fundType || '-'}</span>
          </div>
        </div>
        <div className="eq-dcol-right">
          <div className="eq-dcell">
            <span className="eq-dlbl2">입찰방법</span>
            <span className="eq-dval2">{eq.bid || '-'}</span>
          </div>
          <div className="eq-dcell">
            <span className="eq-dlbl2">도입금액</span>
            <span className="eq-dval2" style={{ color: 'var(--amber)' }}>
              {eq.price
                ? eq.price.toLocaleString() + '원' + (eq.count > 1 ? ` (${eq.count}대)` : '')
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  eq: EqGroup
  index: number
  isOpen: boolean
  months: TlMonth[]
  onToggle: () => void
}

export default function EqItem({ eq, index, isOpen, months, onToggle }: Props) {
  const codeShort = eq.codes.length > 1 ? eq.codes[0] + '~' : eq.codes[0] || '-'

  return (
    <div className="eq-item">
      <div className="eq-row" onClick={onToggle}>
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
        <span className="eq-mgr">{eq.mgr}</span>
        <div className="eq-tl-cell">
          <GanttBar tl={eq.timeline} months={months} />
        </div>
      </div>
      {isOpen && <EqDetail eq={eq} />}
    </div>
  )
}
