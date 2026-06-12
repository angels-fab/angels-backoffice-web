import type { EqRawItem } from '@/types'
import { eqStateColor } from './EqItem'

// 도입 장비 카드 — 장비운영관리 시트에서 상태가 '도입예정'/'도입중'인 장비
export default function EqCard({ eq }: { eq: EqRawItem }) {
  const typeColor = eq.type === '외자' ? '#F0B429' : '#58A6FF'
  return (
    <div className="eq-card">
      <div className="eq-card-top">
        <span className="eq-card-num">{eq.num}</span>
        <span className="eq-card-code">{eq.code || '-'}</span>
        <span className="eq-card-state">
          <span className="eq-state-dot" style={{ background: eqStateColor(eq.state) }} />
          {(eq.state || '').trim() || '-'}
        </span>
      </div>
      <div className="eq-card-name">{eq.name}</div>
      <div className="eq-card-badges">
        {eq.cat && <span className="eq-badge">{eq.cat}</span>}
        {eq.use && <span className="eq-badge">{eq.use}</span>}
        {eq.type && (
          <span
            className="eq-badge"
            style={{ background: typeColor + '22', color: typeColor, borderColor: typeColor + '44' }}
          >
            {eq.type}
          </span>
        )}
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
      </div>
    </div>
  )
}
