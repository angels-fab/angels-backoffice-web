import type { EqGroup } from '@/types'
import { eqStateColor } from './EqItem'

// 분류별 구분색 (장비운영관리 시트의 '분류' 열 값 기준) — 배경까지 확실히 구분되는 톤
const CAT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  공정: { bg: '#0d1f33', border: '#1f4068', color: '#58A6FF' }, // 파랑
  분석: { bg: '#1d1433', border: '#3a2a66', color: '#BC8CFF' }, // 보라
}
const DEFAULT_STYLE = { bg: '#1a1d23', border: '#30363d', color: '#8B949E' }
export const catStyle = (cat: string) => CAT_STYLE[(cat || '').trim()] || DEFAULT_STYLE
export const catColor = (cat: string) => catStyle(cat).color

// 도입 장비 카드 — 같은 장비명끼리 묶어 대수·합계 금액 표시
export default function EqCard({ eq }: { eq: EqGroup }) {
  const typeColor = eq.type === '외자' ? '#F0B429' : '#58A6FF'
  const st = catStyle(eq.cat)
  const cColor = st.color
  const codeShort = eq.codes.length > 1 ? eq.codes[0] + '~' : eq.codes[0] || '-'

  return (
    <div className="eq-card" style={{ background: st.bg, borderColor: st.border }}>
      <div className="eq-card-top">
        <span className="eq-card-code">{codeShort}</span>
        <span className="eq-card-state">
          <span className="eq-state-dot" style={{ background: eqStateColor(eq.state) }} />
          {(eq.state || '').trim() || '-'}
        </span>
      </div>
      {/* 장비명(좌) + 분류·용도·구분 칩(우) 한 줄 — 카드 높이 절약 */}
      <div className="eq-card-name-row">
        <span className="eq-card-name">
          {eq.name}
          {eq.count > 1 && <span className="eq-card-count">{eq.count}대</span>}
        </span>
        <span className="eq-card-badges">
          {eq.cat && (
            <span
              className="eq-badge"
              style={{ background: cColor + '22', color: cColor, borderColor: cColor + '44' }}
            >
              {eq.cat}
            </span>
          )}
          {eq.use && <span className="eq-badge">{eq.use}</span>}
          {eq.type && (
            <span
              className="eq-badge"
              style={{ background: typeColor + '22', color: typeColor, borderColor: typeColor + '44' }}
            >
              {eq.type}
            </span>
          )}
        </span>
      </div>
      <div className="eq-card-rows">
        <div className="eq-crow">
          <span className="eq-crow-k">입찰방법</span>
          <span className="eq-crow-v">{eq.bid || '-'}</span>
        </div>
        <div className="eq-crow">
          <span className="eq-crow-k">재원</span>
          <span className="eq-crow-v">{eq.fund || '-'}</span>
        </div>
        <div className="eq-crow">
          <span className="eq-crow-k">담당자</span>
          <span className="eq-crow-v">{eq.mgr || '-'}</span>
        </div>
        <div className="eq-crow">
          <span className="eq-crow-k">도입금액</span>
          <span className="eq-crow-v" style={{ color: 'var(--amber)' }}>
            {eq.price ? eq.price.toLocaleString() + '원' + (eq.count > 1 ? ` (${eq.count}대)` : '') : '-'}
          </span>
        </div>
      </div>
    </div>
  )
}
