import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CampaignIcon from '@mui/icons-material/Campaign'
import EditNoteIcon from '@mui/icons-material/EditNote'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PushPinIcon from '@mui/icons-material/PushPin'
import SearchIcon from '@mui/icons-material/Search'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { bumpNoticeViews, loadNoticeData } from '@/store/slices/noticeSlice'
import { todaySeoul } from '@/utils/date'
import type { Notice as NoticeItem } from '@/types'
import TitleLoad from '@/components/TitleLoad'
import NoticeWrite from './NoticeWrite'

const NOTICE_CAT_STYLE: Record<string, CSSProperties> = {
  긴급: { background: 'rgba(248,81,73,.14)', color: '#f87171', borderColor: 'rgba(248,81,73,.32)' },
  공지: { background: 'rgba(88,166,255,.12)', color: '#58A6FF', borderColor: 'rgba(88,166,255,.3)' },
  일반: { background: 'rgba(139,148,158,.14)', color: 'var(--text2)', borderColor: 'var(--border)' },
  행사: { background: 'rgba(63,185,80,.14)', color: '#3FB950', borderColor: 'rgba(63,185,80,.3)' },
}
const noticeCatStyle = (cat: string) => NOTICE_CAT_STYLE[cat] || NOTICE_CAT_STYLE['공지']

/** 관련자료(H열)에서 첫 URL 추출 — 있으면 첨부 아이콘 표시 */
const refUrl = (n: NoticeItem) => String(n.ref || '').match(/https?:\/\/[^\s]+/)?.[0] ?? null
/** 종료일자 → '6/26' 형태 (제목 뒤 (~6/26) 표기용) */
const endShort = (n: NoticeItem) => {
  const m = String(n.end || '').match(/\d{4}-(\d{2})-(\d{2})/)
  return m ? `${Number(m[1])}/${Number(m[2])}` : null
}

// 본문을 안전하게 표시 (시트 텍스트의 줄바꿈 → <p>, URL 자동 링크)
// 이미 HTML 태그(<p> 등)가 들어있으면 그대로 신뢰 (관리자 작성 시트)
function noticeBodyHTML(body: string): string {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|img|a|h[1-6])\b/i.test(s)
  if (looksHTML) return s
  let t = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  t = t.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener" style="color:var(--blue)">$1</a>',
  )
  return t
    .split(/\r?\n/)
    .map(line => (line.trim() ? `<p>${line}</p>` : ''))
    .join('')
}

export default function Notice() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { num } = useParams()
  const { items, ready, loading, error, updatedAt } = useAppSelector(s => s.notice)
  const [cat, setCat] = useState('전체')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [writeOpen, setWriteOpen] = useState(false)

  // 연번 딥링크(/notice/12)로 진입한 경우 해당 공지 펼치기
  useEffect(() => {
    if (!ready || !num) return
    const n = items.find(x => String(x.num) === String(num))
    if (n && openId !== n.id) {
      setOpenId(n.id)
      dispatch(bumpNoticeViews(n.id))
      // 딥링크 진입 시에도 펼친 항목이 화면에 보이도록
      setTimeout(() => {
        document
          .querySelector(`.ntc-item[data-id="${n.id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 60)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, num, items])

  // 데이터에 존재하는 분류 + 기본 분류 순서
  const cats = useMemo(() => {
    const present = [...new Set(items.map(n => n.cat).filter(Boolean))]
    const baseOrder = ['긴급', '공지', '일반', '행사']
    return ['전체', ...baseOrder.filter(c => present.includes(c)), ...present.filter(c => !baseOrder.includes(c))]
  }, [items])

  const filtered = useMemo(() => {
    let arr = cat === '전체' ? items : items.filter(n => n.cat === cat)
    const q = query.trim().toLowerCase()
    if (q) {
      arr = arr.filter(n =>
        `${n.title} ${n.dept} ${n.deptMgr} ${n.cat} ${n.body} ${n.target} ${n.num}`
          .toLowerCase()
          .includes(q),
      )
    }
    return arr
  }, [items, cat, query])

  // 종료일자(K)가 오늘보다 이전이면 만료 → 제목 회색
  const today = todaySeoul()
  const isExpired = (n: NoticeItem) => !!n.end && n.end < today

  // 아코디언 토글 — 한 번에 하나만 열림
  const toggle = (n: NoticeItem) => {
    if (openId === n.id) {
      setOpenId(null)
      navigate('/notice', { replace: true })
      return
    }
    setOpenId(n.id)
    dispatch(bumpNoticeViews(n.id))
    navigate(`/notice/${n.num}`, { replace: true })
    // 펼친 항목이 화면에 보이도록 부드럽게 스크롤
    setTimeout(() => {
      document
        .querySelector(`.ntc-item[data-id="${n.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
  }

  const refresh = () => {
    setCat('전체')
    setQuery('')
    setOpenId(null)
    dispatch(loadNoticeData())
  }

  // 새 글 저장 완료 → 목록 새로고침 후 방금 쓴 글을 펼쳐서 보여줌
  const handleSaved = (savedNum: number) => {
    setWriteOpen(false)
    setCat('전체')
    setQuery('')
    dispatch(loadNoticeData())
    if (savedNum > 0) navigate(`/notice/${savedNum}`, { replace: true })
  }

  return (
    <div className="page active" id="page-공지사항">
      <div className="page-header">
        <div className="page-title" onClick={refresh} style={{ cursor: 'pointer' }} title="클릭하면 새로고침">
          <CampaignIcon /> 공지사항
        </div>
        <TitleLoad loading={loading} text={error ? '불러오기 실패' : updatedAt} />
        <button className="write-btn" onClick={() => setWriteOpen(true)}>
          <EditNoteIcon sx={{ fontSize: 17 }} /> 새 글쓰기
        </button>
      </div>

      <NoticeWrite open={writeOpen} onClose={() => setWriteOpen(false)} onSaved={handleSaved} />

      {/* 툴바: 분류 필터(좌) + 검색창(우) */}
      <div className="notice-toolbar">
        <div className="notice-filter-bar">
          {cats.map(c => (
            <button
              key={c}
              className={`nflt-btn${cat === c ? ' active' : ''}`}
              onClick={() => {
                setCat(c)
                setOpenId(null) // 분류 바꾸면 펼침 닫기
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="search-wrap notice-search-wrap">
          <SearchIcon />
          <input
            type="text"
            className="wflt-search"
            placeholder="제목, 부서, 담당자 검색..."
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setOpenId(null)
            }}
          />
        </span>
      </div>

      <div className="notice-board notice-accordion">
        {/* 컬럼 헤더: 번호/구분/제목/게시자/작성일/첨부 */}
        <div className="ntc-colhead">
          <span>번호</span>
          <span>구분</span>
          <span className="ntc-ch-title">제목</span>
          <span className="ntc-ch-author">게시자</span>
          <span className="ntc-ch-date">작성일</span>
          <span><LinkIcon sx={{ fontSize: 16 }} /></span>
        </div>
        {!ready ? (
          <>
            <div className="ntc-skel" />
            <div className="ntc-skel" />
            <div className="ntc-skel" />
          </>
        ) : !filtered.length ? (
          <div className="ntc-empty">공지사항이 없습니다</div>
        ) : (
          filtered.map(n => {
            const open = openId === n.id
            const url = refUrl(n)
            return (
              <div
                key={n.id}
                className={`ntc-item${open ? ' open' : ''}${isExpired(n) ? ' expired' : ''}${n.pinned ? ' pinned' : ''}`}
                data-id={n.id}
              >
                <div className="ntc-summary" role="button" tabIndex={0} onClick={() => toggle(n)}>
                  <span className="ntc-num">
                    {n.pinned && <PushPinIcon className="ntc-pin" sx={{ fontSize: 12 }} />}
                    {n.num}
                  </span>
                  <span className="ntc-cat-cell">
                    <span className="ntc-cat-inner" style={noticeCatStyle(n.cat)}>{n.cat}</span>
                  </span>
                  <span className="ntc-title-text">
                    {n.dept && <span className="ntc-dept-tag">[{n.dept}]</span>}
                    {n.title}
                    {endShort(n) && <span className="ntc-end-tag">(~{endShort(n)})</span>}
                    {n.isNew && <span className="ntc-new">N</span>}
                  </span>
                  <span className="ntc-author">{n.author}</span>
                  <span className="ntc-date">{n.date}</span>
                  <span className="ntc-att">
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="첨부 링크 열기"
                        onClick={e => e.stopPropagation()}
                      >
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </a>
                    )}
                  </span>
                </div>
                {open && (
                  <div className="ntc-panel">
                    <div className="ntc-panel-inner">
                      <div className="ntc-body" dangerouslySetInnerHTML={{ __html: noticeBodyHTML(n.body) }} />
                      {(n.reply || n.target) && (
                        <div className="ntc-submeta">
                          {n.reply && (
                            <span className="ntc-submeta-item">
                              <span className="ntc-submeta-k">회신일자</span>
                              <span className="ntc-submeta-v">{n.reply}</span>
                            </span>
                          )}
                          {n.target && (
                            <span className="ntc-submeta-item">
                              <span className="ntc-submeta-k">해당자</span>
                              <span className="ntc-submeta-v">{n.target}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
