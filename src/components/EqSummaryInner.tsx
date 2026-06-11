import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import PreviewLoading from './PreviewLoading'

// '장비 현황' 요약 카드 내부 — 홈(eq-summary)과 장비현황 KPI 상단에서 공용
export default function EqSummaryInner({ showSeeAll }: { showSeeAll: boolean }) {
  const ready = useAppSelector(s => s.eq.ready)
  const c = useAppSelector(selectEqCounts)

  const head = (
    <div className="eqs-head">
      <span className="eqs-title">장비 현황</span>
      {showSeeAll && <span className="see-all">전체보기 ›</span>}
    </div>
  )

  if (!ready) {
    return (
      <>
        {head}
        <PreviewLoading />
      </>
    )
  }

  const segs = [
    { k: '도입예정', t: c.typesBy['도입예정'], u: c.units['도입예정'], color: '#4d9fff' },
    { k: '도입중', t: c.typesBy['도입중'], u: c.units['도입중'], color: '#39d0d8' },
    { k: '가동중', t: c.typesBy['가동중'], u: c.units['가동중'], color: '#34d36b' },
    { k: '비가동', t: c.typesBy['비가동'], u: c.units['비가동'], color: '#f87171' },
  ]
  const maxN = Math.max(1, ...segs.map(s => s.t))
  const MAXH = 22

  return (
    <>
      {head}
      <div className="eqs-row">
        <div className="eqs-big">
          <div className="big-types">
            {c.types}
            <span className="u">종</span>
          </div>
          <div className="big-units">
            {c.total}
            <span className="u2">대</span>
          </div>
        </div>
        <div className="eqs-cols">
          {segs.map(s => (
            <div className="eqs-col" key={s.k}>
              <div className="eqs-col-graph">
                <div
                  className="eqg-bar"
                  style={{
                    height: `${s.t > 0 ? Math.max(6, Math.round((s.t / maxN) * MAXH)) : 2}px`,
                    background: s.color,
                  }}
                />
              </div>
              <div className="eqs-stat-lbl" style={{ color: s.color }}>
                {s.k}
              </div>
              <div className="eqs-stat-num">
                {s.t}
                <span className="u">종</span>
              </div>
              <div className="eqs-stat-unit">
                {s.u}
                <span className="u2">대</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
