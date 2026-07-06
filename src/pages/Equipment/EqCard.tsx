import type { EqGroup } from '@/types'
import { eqStateColor } from './EqItem'

// 분류별 구분색 (장비운영관리 시트의 '분류' 열 값 기준) — 배경까지 확실히 구분되는 톤
const CAT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  공정: { bg: '#0d1f33', border: '#1f4068', color: '#5491DA' }, // 파랑
  분석: { bg: '#1d1433', border: '#3a2a66', color: '#A98AE0' }, // 보라
}
const DEFAULT_STYLE = { bg: '#1a1d23', border: '#30363d', color: '#8B949E' }
export const catStyle = (cat: string) => CAT_STYLE[(cat || '').trim()] || DEFAULT_STYLE
export const catColor = (cat: string) => catStyle(cat).color

// 도입 장비 카드 — 같은 장비명끼리 묶어 대수·합계 금액 표시
export default function EqCard({ eq }: { eq: EqGroup }) {
  const typeColor = eq.type === '외자' ? '#D6A23E' : '#5491DA'
  const fundColor = (eq.fund || '').includes('국비') ? '#46B7BE' : '#4DA167'
  const st = catStyle(eq.cat)
  const cColor = st.color
  const codeShort = eq.codes.length > 1 ? eq.codes[0] + '~' : eq.codes[0] || '-'

  return (
    <div className="eq-card" style={{ background: st.bg, borderColor: st.border }}>
      {/* 1줄: 장비명 + 관리번호 */}
      <div className="eq-card-top">
        <span className="eq-card-name">
          {eq.name}
          {eq.count > 1 && <span className="eq-card-count">{eq.count}대</span>}
        </span>
        <span className="eq-card-code">{codeShort}</span>
      </div>
      {/* 2줄: 칩 모음(분류·용도·구분·담당자) 좌 + 상태 우 */}
      <div className="eq-card-sub">
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
          {eq.fund && (
            <span
              className="eq-badge"
              style={{ background: fundColor + '22', color: fundColor, borderColor: fundColor + '44' }}
            >
              {eq.fund}
            </span>
          )}
        </span>
        <span className="eq-card-state">
          <span className="eq-state-dot" style={{ background: eqStateColor(eq.state) }} />
          {(eq.state || '').trim() || '-'}
        </span>
      </div>
      {/* 정보: 도입금액 → 입찰방법 → 담당자 (재원은 칩으로 이동) */}
      <div className="eq-card-rows">
        <div className="eq-crow">
          <span className="eq-crow-k">도입금액</span>
          <span className="eq-crow-v" style={{ color: 'var(--amber)' }}>
            {eq.price ? eq.price.toLocaleString() + '원' + (eq.count > 1 ? ` (${eq.count}대)` : '') : '-'}
          </span>
        </div>
        <div className="eq-crow">
          <span className="eq-crow-k">입찰방법</span>
          <span className="eq-crow-v">{eq.bid || '-'}</span>
        </div>
        <div className="eq-crow">
          <span className="eq-crow-k">담당자</span>
          <span className="eq-crow-v">{eq.mgr || '-'}</span>
        </div>
      </div>
    </div>
  )
}
