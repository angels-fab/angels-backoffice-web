import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import EqSummaryInner from '@/components/EqSummaryInner'
import equipImg from '@/assets/equip-img.png'
import stateCalendarImg from '@/assets/stateimg-calendar.png'
import stateTargetImg from '@/assets/stateimg-target.png'
import statePlayImg from '@/assets/stateimg-play.png'
import stateWarningImg from '@/assets/stateimg-warning.png'
import budgetMoneyImg from '@/assets/budgetimg-money.png'
import budgetMapImg from '@/assets/budgetimg-map.png'
import budgetBankImg from '@/assets/budgetimg-bank.png'

const fitImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

// 장비현황 페이지 KPI: 상태 현황 + 예산 현황
export default function EqKpi() {
  const raw = useAppSelector(s => s.eq.raw)
  const c = useAppSelector(selectEqCounts)

  // 예산 (천원 단위 = 원/1000)
  const won = raw.reduce((s, e) => s + (e.price || 0), 0)
  const localFund = raw.filter(e => (e.fund || '').includes('지방비')).reduce((s, e) => s + (e.price || 0), 0)
  const natFund = raw.filter(e => (e.fund || '').includes('국비')).reduce((s, e) => s + (e.price || 0), 0)
  const k = (v: number) => Math.round(v / 1000).toLocaleString()

  const smalls = [
    { label: '도입예정', val: c.typesBy['도입예정'], color: 'var(--text2)', bg: '#1a1d23', border: undefined as string | undefined, img: stateCalendarImg },
    { label: '도입중', val: c.typesBy['도입중'], color: '#4d9fff', bg: '#0d1f33', border: '#1f4068', img: stateTargetImg },
    { label: '가동중', val: c.typesBy['가동중'], color: '#34d36b', bg: '#0e2417', border: '#1d4a2e', img: statePlayImg },
    { label: '비가동', val: c.typesBy['비가동'], color: '#f87171', bg: '#2a1314', border: '#5a2526', img: stateWarningImg },
  ]

  return (
    <div id="eq-kpi" style={{ width: '100%', marginBottom: 18 }}>
      <div className="kpi-wrap">
        <div className="eq-summary eq-summary-page">
          <EqSummaryInner showSeeAll={false} />
        </div>

        <div className="kpi-top kpi-status">
          <div className="kpi-big">
            <div>
              <div className="kpi-big-label">전체 장비</div>
              <div className="kpi-big-num">
                {c.types}
                <span>종</span> <span style={{ fontSize: 28 }}>{c.total}</span>
                <span>대</span>
              </div>
            </div>
            <div className="kpi-big-sub">전체 등록 장비</div>
            <div className="kpi-big-icon">
              <img src={equipImg} style={fitImg} alt="" />
            </div>
          </div>
          <div className="kpi-small-grid">
            {smalls.map(s => (
              <div key={s.label} className="kpi-small" style={{ background: s.bg, borderColor: s.border }}>
                <div className="kpi-small-label" style={{ color: s.color }}>
                  {s.label}
                </div>
                <div className="kpi-small-row">
                  <span className="kpi-small-num">
                    {s.val}
                    <span>종</span>
                  </span>
                </div>
                <div className="kpi-small-icon">
                  <img src={s.img} style={fitImg} alt="" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="kpi-top kpi-budget" style={{ position: 'relative' }}>
          <div className="kpi-budget-unit" style={{ position: 'absolute', top: -22, right: 2 }}>
            (단위: 천원)
          </div>
          <div className="kpi-big" style={{ background: '#0d1f33', borderColor: '#1f4068' }}>
            <div>
              <div className="kpi-big-label">총 도입예산</div>
              <div className="kpi-big-num" style={{ fontSize: 36 }}>{k(won)}</div>
            </div>
            <div
              className="kpi-big-icon"
              style={{ width: 72, height: 72, bottom: 'auto', top: '50%', transform: 'translateY(-50%)' }}
            >
              <img src={budgetMoneyImg} style={fitImg} alt="" />
            </div>
          </div>
          <div className="kpi-budget-subgrid">
            <div className="kpi-bcard" style={{ background: '#1a1d23' }}>
              <div className="kpi-bcard-label" style={{ color: 'var(--text2)' }}>지방비 예산</div>
              <div className="kpi-bcard-num">{k(localFund)}</div>
              <div className="kpi-bcard-icon">
                <img src={budgetMapImg} alt="" />
              </div>
            </div>
            <div className="kpi-bcard" style={{ background: '#1a1d23' }}>
              <div className="kpi-bcard-label" style={{ color: 'var(--text2)' }}>
                국비 예산{' '}
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>(예상)</span>
              </div>
              <div className="kpi-bcard-num">{k(natFund)}</div>
              <div className="kpi-bcard-icon" style={{ height: '55%' }}>
                <img src={budgetBankImg} alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
