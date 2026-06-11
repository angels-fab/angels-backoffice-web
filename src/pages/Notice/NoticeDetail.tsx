import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { addNoticeView, NOTICES, noticeViews } from '@/constants/notices'

export default function NoticeDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const noticeId = Number(id)
  const n = NOTICES.find(x => x.id === noticeId)

  useEffect(() => {
    if (n) addNoticeView(n.id)
    window.scrollTo(0, 0)
  }, [n])

  if (!n) return <Navigate to="/notice" replace />

  const idx = NOTICES.indexOf(n)
  const prev = NOTICES[idx - 1]
  const next = NOTICES[idx + 1]

  return (
    <div className="page active" id="page-공지사항">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/notice')}>
          <ArrowBackIcon sx={{ fontSize: 14 }} /> 목록으로
        </button>
      </div>
      <div className="post-wrap">
        <div className="post-head">
          <div className="post-category">
            <span className={`notice-badge nb-${n.cat}`}>{n.cat}</span>
          </div>
          <div className="post-title">{n.title}</div>
          <div className="post-info">
            <span>작성자: {n.author}</span>
            <span>작성일: {n.date}</span>
            <span>조회수: {noticeViews(n)}</span>
          </div>
        </div>
        <div className="post-body">{n.body}</div>
        <div className="post-nav">
          <span
            onClick={() => prev && navigate(`/notice/${prev.id}`)}
            style={{ opacity: prev ? 1 : 0.3 }}
          >
            <ChevronLeftIcon sx={{ fontSize: 16 }} /> {prev ? prev.title : '이전 글 없음'}
          </span>
          <span
            onClick={() => next && navigate(`/notice/${next.id}`)}
            style={{ opacity: next ? 1 : 0.3 }}
          >
            {next ? next.title : '다음 글 없음'} <ChevronRightIcon sx={{ fontSize: 16 }} />
          </span>
        </div>
      </div>
    </div>
  )
}
