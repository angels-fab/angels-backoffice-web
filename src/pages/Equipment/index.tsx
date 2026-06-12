import { useMemo, useState } from 'react'
import MonitorIcon from '@mui/icons-material/Monitor'
import SearchIcon from '@mui/icons-material/Search'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadEqData } from '@/store/slices/eqSlice'
import TitleLoad from '@/components/TitleLoad'
import EqKpi from './EqKpi'
import EqItem from './EqItem'
import { GanttHeader } from './gantt'

const TYPE_FILTERS = ['전체', '내자', '외자']
const MGR_FILTERS = ['전체', '박주봉', '조성범', '박세리']
const STATE_FILTERS = ['전체', '도입예정', '도입중', '가동중', '비가동']

const TL_LEGEND = [
  { label: '사전규격', bg: 'rgba(248,81,73,.15)', color: '#F85149', border: 'rgba(248,81,73,.35)' },
  { label: '구매공고', bg: 'rgba(240,180,41,.15)', color: '#F0B429', border: 'rgba(240,180,41,.35)' },
  { label: '기술평가', bg: 'rgba(63,185,80,.15)', color: '#3FB950', border: 'rgba(63,185,80,.35)' },
  { label: '기술협상', bg: 'rgba(57,208,216,.15)', color: '#39D0D8', border: 'rgba(57,208,216,.35)' },
  { label: '장비제작', bg: 'rgba(88,166,255,.15)', color: '#58A6FF', border: 'rgba(88,166,255,.35)' },
  { label: '장비설치', bg: 'rgba(188,140,255,.15)', color: '#BC8CFF', border: 'rgba(188,140,255,.35)' },
]

export default function Equipment() {
  const dispatch = useAppDispatch()
  const { groups, months, loading, error, updatedAt } = useAppSelector(s => s.eq)
  const [fltType, setFltType] = useState('전체')
  const [fltMgr, setFltMgr] = useState('전체')
  const [fltState, setFltState] = useState('전체')
  const [search, setSearch] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const filtered = useMemo(() => {
    let arr = groups
    if (fltType !== '전체') arr = arr.filter(e => e.type === fltType)
    if (fltMgr !== '전체') arr = arr.filter(e => (e.mgr || '').trim() === fltMgr)
    if (fltState !== '전체') {
      if (fltState === '비가동') {
        arr = arr.filter(e => {
          const s = (e.state || '').trim()
          return s !== '' && s !== '도입예정' && s !== '도입중' && s !== '가동중'
        })
      } else {
        arr = arr.filter(e => (e.state || '').trim() === fltState)
      }
    }
    const q = search.trim().toLowerCase()
    if (q) {
      arr = arr.filter(e => {
        const hay = [e.name, e.mgr, e.state, e.maker, e.model, e.installLoc, e.codes.join(' ')]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }
    return arr
  }, [groups, fltType, fltMgr, fltState, search])

  const setFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setOpenIdx(null)
  }

  const fltBtns = (list: string[], cur: string, set: (v: string) => void) =>
    list.map(f => (
      <button key={f} className={`eq-flt-btn${cur === f ? ' active' : ''}`} onClick={() => set(f)}>
        {f}
      </button>
    ))

  return (
    <div className="page active" id="page-장비현황">
      <div className="page-header">
        <div
          className="page-title"
          onClick={() => dispatch(loadEqData())}
          style={{ cursor: 'pointer' }}
          title="클릭하면 새로고침"
        >
          <MonitorIcon /> 장비현황
        </div>
        <TitleLoad loading={loading} text={error ? '연결 실패' : updatedAt} />
      </div>

      <EqKpi />

      {/* 필터 + 검색 + 범례 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 12, width: '100%' }}>
        <div className="eq-flt-row">
          <span className="eq-flt-label">구분</span>
          {fltBtns(TYPE_FILTERS, fltType, setFilter(setFltType))}
        </div>
        <div className="eq-flt-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="eq-flt-label">담당자</span>
            {fltBtns(MGR_FILTERS, fltMgr, setFilter(setFltMgr))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="search-wrap" style={{ marginBottom: 9 }}>
              <SearchIcon />
              <input
                type="text"
                placeholder="장비명, 담당자 등 검색..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setOpenIdx(null)
                }}
                style={{
                  width: 320, maxWidth: '100%', padding: '7px 12px 7px 30px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--ink2)', color: 'var(--text)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </span>
          </div>
        </div>
        <div className="eq-flt-row" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="eq-flt-label">상태</span>
            {fltBtns(STATE_FILTERS, fltState, setFilter(setFltState))}
          </div>
          <div className="tl-legend" style={{ width: 'auto' }}>
            {TL_LEGEND.map(l => (
              <span
                key={l.label}
                className="tl-leg-badge"
                style={{ background: l.bg, color: l.color, borderColor: l.border }}
              >
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 헤더 */}
      <div className="eq-list-header" style={{ width: '100%' }}>
        <span>연번</span>
        <span>관리번호</span>
        <span>장비명</span>
        <span>상태</span>
        <span>담당자</span>
        <span style={{ textAlign: 'center' }}>도입 타임라인</span>
      </div>
      {/* 연도·월 헤더 — 타임라인 칼럼 위에만 정렬 (#gantt-header-slot 그리드) */}
      <div id="gantt-header-slot">
        <GanttHeader months={months} />
      </div>

      {/* 목록 */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
        {filtered.length === 0 ? (
          <div className="task-empty">조건에 맞는 장비가 없습니다</div>
        ) : (
          filtered.map((eq, i) => (
            <EqItem
              key={eq.name}
              eq={eq}
              index={i}
              isOpen={openIdx === i}
              months={months}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))
        )}
      </div>
    </div>
  )
}
