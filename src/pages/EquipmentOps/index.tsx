import MonitorIcon from '@mui/icons-material/Monitor'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import { selectEqCounts } from '@/store/selectors'
import TitleLoad from '@/components/TitleLoad'
import EqSummaryInner from '@/components/EqSummaryInner'
import EqKpi from '@/pages/Equipment/EqKpi'
import equipImg from '@/assets/equip-img.png'
import stateCalendarImg from '@/assets/stateimg-calendar.png'
import stateTargetImg from '@/assets/stateimg-target.png'
import statePlayImg from '@/assets/stateimg-play.png'
import stateWarningImg from '@/assets/stateimg-warning.png'

const fitImg: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' }

// 장비운영관리 — 상태 현황 (전체/도입예정/도입중/가동중/비가동)
export default function EquipmentOps() {
  const dispatch = useAppDispatch()
  const { loading, error, updatedAt } = useAppSelector(s => s.eq)
  const c = useAppSelector(selectEqCounts)

  const smalls = [
    { label: '도입예정', val: c.typesBy['도입예정'], color: 'var(--text2)', bg: '#1a1d23', border: undefined as string | undefined, img: stateCalendarImg },
    { label: '도입중', val: c.typesBy['도입중'], color: '#4d9fff', bg: '#0d1f33', border: '#1f4068', img: stateTargetImg },
    { label: '가동중', val: c.typesBy['가동중'], color: '#34d36b', bg: '#0e2417', border: '#1d4a2e', img: statePlayImg },
    { label: '비가동', val: c.typesBy['비가동'], color: '#f87171', bg: '#2a1314', border: '#5a2526', img: stateWarningImg },
  ]

  return (
    <div className="page active" id="page-장비운영관리">
      <div className="page-header">
        <div
          className="page-title"
          onClick={() => dispatch(loadEqData())}
          style={{ cursor: 'pointer' }}
          title="클릭하면 새로고침"
        >
          <MonitorIcon /> 장비운영관리
        </div>
        <TitleLoad loading={loading} text={error ? '연결 실패' : updatedAt} />
      </div>

      <div style={{ width: '100%' }}>
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
        </div>

        {/* 예산 카드 (장비도입관리에서 이동) */}
        <div style={{ marginTop: 38 }}>
          <EqKpi />
        </div>
      </div>
    </div>
  )
}
