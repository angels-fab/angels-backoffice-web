import MemoryIcon from '@mui/icons-material/Memory'
import PaymentsIcon from '@mui/icons-material/Payments'
import AssignmentIcon from '@mui/icons-material/Assignment'
import TodayIcon from '@mui/icons-material/Today'
import CampaignIcon from '@mui/icons-material/Campaign'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { CardGrid, KpiCard } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import { todaySeoul } from '@/utils/date'
import { upcomingEventCount, workStatusCounts } from './derive'

/**
 * KPI Overview — 대시보드 최상단. 숫자 + 보조지표(가동률·지연·7일내 등).
 */
export default function KpiOverview() {
  const eq = useAppSelector(selectEqCounts)
  const eqRaw = useAppSelector((s) => s.eq.raw)
  const workItems = useAppSelector((s) => s.work.items)
  const calEvents = useAppSelector((s) => s.cal.events)
  const notices = useAppSelector((s) => s.notice.items)

  const today = todaySeoul()
  const todayCnt = calEvents.filter((e) => e.date === today).length
  const weekCnt = upcomingEventCount(calEvents, 7)
  const newNotice = notices.filter((n) => n.isNew).length
  const wc = workStatusCounts(workItems)
  // 구축단계 지표: 운영/가동률 대신 '도입 예산'·'도입 예정'(운영중은 수년간 0이라 무의미)
  const budgetUk = eqRaw.reduce((sum, e) => sum + (Number(e.price) || 0), 0) / 1e8 // 억원
  const budgetVal = budgetUk >= 100 ? Math.round(budgetUk) : Math.round(budgetUk * 10) / 10
  const avgUk = eq.total ? budgetUk / eq.total : 0

  return (
    <CardGrid columns={6}>
      <KpiCard value={eq.types} unit="종" label="전체 장비" sub={`${eq.total}대 보유`} icon={<MemoryIcon />} accentColor="blue" />
      <KpiCard value={budgetVal} unit="억" label="도입 예산" sub={`평균 ${avgUk.toFixed(1)}억/대`} icon={<PaymentsIcon />} accentColor="green" />
      <KpiCard value={wc.inProgress} unit="건" label="진행중 업무" sub={`완료 ${wc.done}건`} icon={<AssignmentIcon />} accentColor="teal" />
      <KpiCard value={todayCnt} unit="건" label="오늘 일정" sub={`7일내 ${weekCnt}건`} icon={<TodayIcon />} accentColor="purple" />
      <KpiCard value={newNotice} unit="건" label="신규 공지" sub={`총 ${notices.length}건`} icon={<CampaignIcon />} accentColor="red" />
      <KpiCard value={eq.units['도입예정']} unit="대" label="도입 예정" sub={`${eq.typesBy['도입예정']}종`} icon={<LocalShippingIcon />} accentColor="amber" />
    </CardGrid>
  )
}
