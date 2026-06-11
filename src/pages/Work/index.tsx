import { useMemo, useState } from 'react'
import AssessmentIcon from '@mui/icons-material/Assessment'
import AttachFileIcon from '@mui/icons-material/AttachFile'
import ScheduleIcon from '@mui/icons-material/Schedule'
import FolderCopyIcon from '@mui/icons-material/FolderCopy'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import PushPinIcon from '@mui/icons-material/PushPin'
import SearchIcon from '@mui/icons-material/Search'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { loadWorkData } from '@/store/slices/workSlice'
import { dateSortValue, parseStartDate } from '@/utils/date'
import { normCat, workCatRank } from '@/utils/workCat'
import type { WorkItem } from '@/types'
import TitleLoad from '@/components/TitleLoad'
import WorkRow from './WorkRow'

type WorkTab = 'cur' | 'past' | 'remind' | 'chief'

const ATT_ICON = <AttachFileIcon sx={{ fontSize: 13 }} />

// 1순위: 구분 우선순위로 묶기 → 2순위: 같은 구분 내 시작일자 최근순
function cmp(a: WorkItem, b: WorkItem): number {
  const ra = workCatRank(a.cat)
  const rb = workCatRank(b.cat)
  return ra !== rb ? ra - rb : dateSortValue(b.start) - dateSortValue(a.start)
}

function WorkBox({
  items,
  visible,
  emptyMsg,
  variant,
}: {
  items: WorkItem[]
  visible: boolean
  emptyMsg: string
  variant?: string
}) {
  if (!visible) return null
  return (
    <div className={`work-box${variant ? ' ' + variant : ''}`}>
      {items.length > 0 && (
        <div className="cur-head">
          <span className="cur-c-cat">업무 구분</span>
          <span className="cur-c-body">업무 내용</span>
          <span className="cur-c-mgr">담당자</span>
          <span className="cur-c-date">발의일자</span>
          <span className="cur-c-att" title="첨부 링크">{ATT_ICON}</span>
        </div>
      )}
      <ul className="task-list">
        {items.length ? items.map(t => <WorkRow key={t.id} t={t} />) : <li className="task-empty">{emptyMsg}</li>}
      </ul>
    </div>
  )
}

export default function Work() {
  const dispatch = useAppDispatch()
  const { items, loading, error, updatedAt } = useAppSelector(s => s.work)
  const [tab, setTab] = useState<WorkTab>('cur')
  const [cat, setCat] = useState('전체')
  const [mgr, setMgr] = useState('전체')
  const [query, setQuery] = useState('')

  // 구분 필터 + 담당자 + 검색어 적용
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchCat = (t: WorkItem) => cat === '전체' || normCat(t.cat) === normCat(cat)
    const matchMgr = (t: WorkItem) => mgr === '전체' || (t.mgr || '') === mgr
    const matchQ = (t: WorkItem) =>
      !q || `${t.task} ${t.mgr} ${t.cat} ${t.dept} ${t.num}`.toLowerCase().includes(q)
    const flt = (arr: WorkItem[]) => arr.filter(matchCat).filter(matchMgr).filter(matchQ)
    return {
      cur: flt(items.filter(t => t.share)).sort(cmp),
      past: flt(items.filter(t => !t.share && !t.remind)).sort(cmp),
      remind: flt(items.filter(t => !t.share && t.remind)).sort(cmp),
      chief: flt(items.filter(t => t.chief)).sort(cmp), // L열 체크 — 진행중/지난 무관하게 모두
    }
  }, [items, cat, mgr, query])

  // 이번주 신규 건수 (필터 적용된 목록 기준)
  const weekCount = (arr: WorkItem[]) => {
    const today0 = new Date()
    today0.setHours(0, 0, 0, 0)
    const week0 = new Date(today0)
    week0.setDate(week0.getDate() - 7)
    return arr.filter(t => {
      const d = parseStartDate(t.start)
      if (!d) return false
      d.setHours(0, 0, 0, 0)
      return d >= week0 && d <= today0
    }).length
  }

  // 구분 필터: 데이터에 존재하는 구분을 우선순위 순으로
  const presentCats = useMemo(() => {
    const set = [...new Set(items.map(t => t.cat).filter(Boolean))]
    return ['전체', ...set.sort((a, b) => workCatRank(a) - workCatRank(b))]
  }, [items])

  // 담당자 필터 — 진행중/지난: 발의일자 최근 6개월 업무의 담당자만 / Remind·센터장: 전체
  const presentMgrs = useMemo(() => {
    let pool: WorkItem[]
    if (tab === 'cur') pool = items.filter(t => t.share)
    else if (tab === 'past') pool = items.filter(t => !t.share && !t.remind)
    else if (tab === 'chief') pool = items.filter(t => t.chief)
    else pool = items.filter(t => !t.share && t.remind)
    if (tab !== 'remind' && tab !== 'chief') {
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - 6)
      cutoff.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      pool = pool.filter(t => {
        const d = parseStartDate(t.start)
        return d !== null && d >= cutoff && d <= today
      })
    }
    const mgrs = [...new Set(pool.map(t => t.mgr).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'ko'),
    )
    return ['전체', ...mgrs]
  }, [items, tab])

  const switchTab = (which: WorkTab) => {
    setTab(which)
    setMgr('전체') // 탭마다 담당자 목록이 달라지므로 선택 초기화
  }

  return (
    <div className="page active" id="page-업무현황">
      <div className="page-header">
        <div
          className="page-title"
          onClick={() => dispatch(loadWorkData())}
          style={{ cursor: 'pointer' }}
          title="클릭하면 새로고침"
        >
          <AssessmentIcon /> 업무현황
        </div>
        <TitleLoad loading={loading} text={error ? '불러오기 실패' : updatedAt} />
      </div>

      {/* KPI 카드 (탭 역할): 진행중 / 지난 / Remind */}
      <div className="wkpi-row">
        <button className={`wkpi-card${tab === 'cur' ? ' active' : ''}`} onClick={() => switchTab('cur')}>
          <span className="wkpi-main">
            <span className="wkpi-body">
              <span className="wkpi-label">진행중 업무</span>
              <span className="wkpi-numline">
                <span className="wkpi-num">{filtered.cur.length}</span>
                <span className="wkpi-sub blue">이번주 +{weekCount(filtered.cur)}건</span>
              </span>
            </span>
            <span className="wkpi-icon ic-blue"><ScheduleIcon fontSize="inherit" htmlColor="#58a6ff" /></span>
          </span>
        </button>
        <button className={`wkpi-card${tab === 'past' ? ' active' : ''}`} onClick={() => switchTab('past')}>
          <span className="wkpi-main">
            <span className="wkpi-body">
              <span className="wkpi-label">지난 업무</span>
              <span className="wkpi-numline">
                <span className="wkpi-num">{filtered.past.length}</span>
                <span className="wkpi-sub green">이번주 +{weekCount(filtered.past)}건</span>
              </span>
            </span>
            <span className="wkpi-icon ic-green"><FolderCopyIcon fontSize="inherit" htmlColor="#3fb950" /></span>
          </span>
        </button>
        <button className={`wkpi-card${tab === 'remind' ? ' active' : ''}`} onClick={() => switchTab('remind')}>
          <span className="wkpi-main">
            <span className="wkpi-body">
              <span className="wkpi-label">Remind</span>
              <span className="wkpi-numline">
                <span className="wkpi-num">{filtered.remind.length}</span>
              </span>
            </span>
            <span className="wkpi-icon ic-amber"><NotificationsActiveIcon fontSize="inherit" htmlColor="#f0b429" /></span>
          </span>
        </button>
        <button className={`wkpi-card${tab === 'chief' ? ' active' : ''}`} onClick={() => switchTab('chief')}>
          <span className="wkpi-main">
            <span className="wkpi-body">
              <span className="wkpi-label">센터장 Check</span>
              <span className="wkpi-numline">
                <span className="wkpi-num">{filtered.chief.length}</span>
              </span>
            </span>
            <span className="wkpi-icon ic-purple"><PushPinIcon fontSize="inherit" htmlColor="#bc8cff" /></span>
          </span>
        </button>
      </div>

      {/* 담당자 필터 */}
      <div className="wflt-row">
        <span className="wflt-label">담당자</span>
        <div className="wflt-cats">
          {presentMgrs.map(m => (
            <button key={m} className={`wflt-btn${mgr === m ? ' active' : ''}`} onClick={() => setMgr(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 구분 필터 + 검색 */}
      <div className="wflt-row" style={{ marginTop: -4 }}>
        <span className="wflt-label">구분</span>
        <div className="wflt-cats">
          {presentCats.map(c => (
            <button key={c} className={`wflt-btn${cat === c ? ' active' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <span className="search-wrap" style={{ marginLeft: 'auto' }}>
          <SearchIcon />
          <input
            type="text"
            placeholder="업무명, 담당자 등 검색..."
            className="wflt-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </span>
      </div>

      <WorkBox items={filtered.cur} visible={tab === 'cur'} emptyMsg="진행중 업무가 없습니다" />
      <WorkBox items={filtered.past} visible={tab === 'past'} emptyMsg="지난 업무가 없습니다" />
      <WorkBox items={filtered.remind} visible={tab === 'remind'} emptyMsg="Remind 업무가 없습니다" variant="work-box-remind" />
      <WorkBox items={filtered.chief} visible={tab === 'chief'} emptyMsg="센터장 Check 업무가 없습니다" variant="work-box-chief" />
    </div>
  )
}
