import { useAppSelector } from '@/store/hooks'
import { isWorkNew, isImproveNew } from '@/utils/newPost'

/**
 * 네비게이션 배지 건수 (사이드바·하단 탭바 공용).
 * 새 글 판정은 utils/newPost 공용 함수를 사용 → 페이지 내부 N과 항상 일치.
 * - notice: 공지 새 글(게시일 7일 + 종료 제외) = 슬라이스가 계산한 n.isNew
 * - work: 새 업무(진행중 + 발의 7일, 완료·Remind 제외)
 * - improve: 새 글(접수·검토중·보류 + 7일)
 * ※ 업무일정(calendar)은 새 글 개념을 쓰지 않으므로 배지 없음.
 */
export function useNavBadges() {
  const workReady = useAppSelector(s => s.work.ready)
  const workItems = useAppSelector(s => s.work.items)
  const noticeItems = useAppSelector(s => s.notice.items)
  const improveItems = useAppSelector(s => s.improve.items)

  const notice = noticeItems.filter(n => n.isNew).length
  const work = workReady ? workItems.filter(isWorkNew).length : 0
  const improve = improveItems.filter(isImproveNew).length

  return { notice, work, improve }
}
