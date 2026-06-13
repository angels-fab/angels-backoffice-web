import { parseStartDate, todaySeoul } from '@/utils/date'
import type { CalEvent, WorkItem } from '@/types'

export interface WorkCounts {
  done: number
  inProgress: number
  upcoming: number
  delayed: number
  total: number
}

/**
 * 업무 상태 집계(파생). 시트에 상태 컬럼이 없어 다음 기준으로 분류한다.
 * 완료 + 진행중 + 예정 + 지연 = 전체(미완료는 전부 한 버킷에 귀속).
 * - 완료: 완료일자(end) 입력됨
 * - 진행중: 미완료 + 진행중 체크(share)
 * - 예정: 미완료 + 진행중 아님 + 시작일자 미래
 * - 지연: 그 외 미완료(시작일 과거이거나 미입력)
 */
export function workStatusCounts(items: WorkItem[], todayMid: number): WorkCounts {
  const startMs = (t: WorkItem) => {
    const d = parseStartDate(t.start)
    if (!d) return null
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  // 완료일자(end)가 '입력됨'이면 완료(명세 기준). 파싱 가능 여부가 아니라 값 존재로 판단.
  const isDone = (t: WorkItem) => !!String(t.end || '').trim()
  let done = 0
  let inProgress = 0
  let upcoming = 0
  let delayed = 0
  for (const t of items) {
    if (isDone(t)) done++
    else if (t.share) inProgress++
    else {
      const ms = startMs(t)
      if (ms != null && ms > todayMid) upcoming++
      else delayed++
    }
  }
  return { done, inProgress, upcoming, delayed, total: items.length }
}

/** 오늘(00:00 KST) 기준 밀리초 */
export function todayMidMs(): number {
  return new Date(todaySeoul() + 'T00:00:00').getTime()
}

/** 향후 N일(오늘 포함) 일정 건수 — id 기준 dedupe */
export function upcomingEventCount(events: CalEvent[], days = 7): number {
  const today = todayMidMs()
  const seen = new Set<string>()
  let n = 0
  for (const e of events) {
    const d = new Date(e.date + 'T00:00:00').getTime()
    const diff = Math.round((d - today) / 86400000)
    if (diff >= 0 && diff <= days && !seen.has(e.id)) {
      seen.add(e.id)
      n++
    }
  }
  return n
}
