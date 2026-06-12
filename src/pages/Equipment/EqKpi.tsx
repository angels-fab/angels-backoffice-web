import { useAppSelector } from '@/store/hooks'
import budgetMoneyImg from '@/assets/budgetimg-money.png'
import budgetMapImg from '@/assets/budgetimg-map.png'
import budgetBankImg from '@/assets/budgetimg-bank.png'

const fitImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

// 장비도입관리 페이지 KPI: 도입 예산 현황 (상태 카드는 장비운영관리로 이동)
export default function EqKpi() {
  const raw = useAppSelector(s => s.eq.raw)

  // 예산 (천원 단위 = 원/1000)
  const won = raw.reduce((s, e) => s + (e.price || 0), 0)
  const localFund = raw.filter(e => (e.fund || '').includes('지방비')).reduce((s, e) => s + (e.price || 0), 0)
  const natFund = raw.filter(e => (e.fund || '').includes('국비')).reduce((s, e) => s + (e.price || 0), 0)
  const k = (v: number) => Math.round(v / 1000).toLocaleString()

  return (
    <div id="eq-kpi" style={{ width: '100%', marginBottom: 18 }}>
      <div className="kpi-wrap">
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
