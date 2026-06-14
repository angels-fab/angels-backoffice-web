import MemoryIcon from '@mui/icons-material/Memory'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import AssignmentIcon from '@mui/icons-material/Assignment'
import TodayIcon from '@mui/icons-material/Today'
import CampaignIcon from '@mui/icons-material/Campaign'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { CardGrid, KpiCard } from '@/components/ds'
import { useAppSelector } from '@/store/hooks'
import { selectEqCounts } from '@/store/selectors'
import { fmtDate, todaySeoul } from '@/utils/date'
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
  const thisMonth = today.slice(0, 7)
  const todayCnt = calEvents.filter((e) => e.date === today).length
  const weekCnt = upcomingEventCount(calEvents, 7)
  const newNotice = notices.filter((n) => n.isNew).length
  const monthIntake = eqRaw.filter((e) => fmtDate(e.installDate).startsWith(thisMonth)).length
  const wc = workStatusCounts(workItems)
  const opRate = eq.total ? Math.round((eq.units['가동중'] / eq.total) * 100) : 0

  return (
    <CardGrid columns={6}>
      <KpiCard value={eq.types} unit="종" label="전체 장비" sub={`${eq.total}대 보유`} icon={<MemoryIcon />} accentColor="blue" />
      <KpiCard value={eq.units['가동중']} unit="대" label="운영 중" sub={`가동률 ${opRate}%`} icon={<PrecisionManufacturingIcon />} accentColor="green" />
      <KpiCard value={wc.inProgress} unit="건" label="진행중 업무" sub={`완료 ${wc.done}건`} icon={<AssignmentIcon />} accentColor="teal" />
      <KpiCard value={todayCnt} unit="건" label="오늘 일정" sub={`7일내 ${weekCnt}건`} icon={<TodayIcon />} accentColor="purple" />
      <KpiCard value={newNotice} unit="건" label="신규 공지" sub={`총 ${notices.length}건`} icon={<CampaignIcon />} accentColor="red" />
      <KpiCard value={monthIntake} unit="대" label="이번달 도입" sub={`예정 ${eq.units['도입예정']}대`} icon={<LocalShippingIcon />} accentColor="amber" />
    </CardGrid>
  )
}
