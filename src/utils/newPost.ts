import type { WorkItem, ImprovementItem } from '@/types'
import { isRecentNew, fmtDate, todaySeoul } from './date'

/**
 * 포털 전체 '새 글/새 업무' 판정 공용 유틸.
 * 페이지 내부 N과 사이드바 숫자가 **반드시 같은 함수**를 쓰도록 한곳에서 관리한다.
 * 최근 7일(서울 기준) 날짜 판정은 date.ts `isRecentNew` 하나만 사용하고,
 * 상태/종료 같은 도메인 조건만 여기서 덧붙인다(중복 날짜 로직 금지).
 */

/**
 * 공지 새 글 — 게시일이 최근 7일 + 종료(종료일 지남) 제외.
 * 입력은 noticeSlice가 fmtDate로 정규화한 게시일·종료일(YYYY-MM-DD).
 */
export function isNoticeNew(date: string, end?: string): boolean {
  if (!isRecentNew(date)) return false
  if (end && end < todaySeoul()) return false // 종료된 공지는 최근이어도 제외
  return true
}

/**
 * 업무현황 새 업무 — 상태=진행중 + 발의일자가 최근 7일.
 * 제외: 완료·보류·취소 등 진행중이 아닌 상태 / Remind로 이동한 업무.
 * Check(chief)는 판단에 영향 없음(진행중+최근이면 Check여도 새 업무).
 */
export function isWorkNew(t: WorkItem): boolean {
  if ((t.status || '').trim() !== '진행중') return false
  if (t.remind) return false
  return isRecentNew(fmtDate(t.start))
}

/**
 * 포털개선요청 새 글 — 접수·검토중·보류 상태 + 제안일자가 최근 7일.
 * 제외: 완료·불가 / 등록 후 7일 경과. (옛 '접수중'은 접수로 정규화)
 */
export function isImproveNew(i: ImprovementItem): boolean {
  const s = (i.status || '').trim()
  const norm = s === '접수중' ? '접수' : s
  if (!['접수', '검토중', '보류'].includes(norm)) return false
  return isRecentNew(fmtDate(i.date))
}
