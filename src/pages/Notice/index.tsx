import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CampaignIcon from '@mui/icons-material/Campaign'
import { NOTICES, NOTICE_CATS, noticeViews } from '@/constants/notices'
import TitleLoad from '@/components/TitleLoad'
import { nowStamp } from '@/utils/date'

export default function Notice() {
  const navigate = useNavigate()
  const [cat, setCat] = useState<string>('전체')
  const [stamp, setStamp] = useState<string | null>(null)

  const filtered = cat === '전체' ? NOTICES : NOTICES.filter(n => n.cat === cat)

  return (
    <div className="page active" id="page-공지사항">
      <div className="page-header">
        <div
          className="page-title"
          onClick={() => {
            setCat('전체')
            setStamp(nowStamp())
          }}
          style={{ cursor: 'pointer' }}
          title="클릭하면 새로고침"
        >
          <CampaignIcon /> 공지사항
        </div>
        <TitleLoad loading={false} text={stamp} />
      </div>

      <div className="notice-filter-bar">
        {NOTICE_CATS.map(c => (
          <button key={c} className={`nflt-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="notice-board">
        {filtered.map(n => (
          <div key={n.id} className="notice-row" onClick={() => navigate(`/notice/${n.id}`)}>
            <span className={`notice-badge nb-${n.cat}`}>{n.cat}</span>
            <span className="notice-title">
              {n.title}
              {n.isNew && <span className="notice-new" />}
            </span>
            <span className="notice-meta">
              <span>{n.author}</span>
              <span>{n.date}</span>
              <span>조회 {noticeViews(n)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
