import { useAppSelector } from '@/store/hooks'
import { selectCurrentWork } from '@/store/selectors'
import { todaySeoul } from '@/utils/date'

function dayDiff(ds: string, todayMid: Date): number {
  return Math.round((new Date(String(ds) + 'T00:00:00').getTime() - todayMid.getTime()) / 86400000)
}

/** 네비게이션 배지 건수 (사이드바·하단 탭바 공용) */
export function useNavBadges() {
  const workReady = useAppSelector(s => s.work.ready)
  const currentWork = useAppSelector(selectCurrentWork)
  const noticeItems = useAppSelector(s => s.notice.items)
  const calEvents = useAppSelector(s => s.cal.events)

  const todayMid = new Date(todaySeoul() + 'T00:00:00')
  const cal = calEvents.filter(e => {
    const d = dayDiff(e.date, todayMid)
    return d >= 0 && d <= 7 // 일정: 오늘~앞으로 7일
  }).length
  const notice = noticeItems.filter(n => {
    const d = dayDiff(n.date, todayMid)
    return d <= 0 && d >= -7 // 공지: 최근 7일 내 등록
  }).length
  const work = workReady ? currentWork.length : 0

  return { cal, notice, work }
}
