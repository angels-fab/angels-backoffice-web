import { todaySeoul } from '@/utils/date'
import type { CalEvent, WorkItem } from '@/types'

export interface WorkCounts {
  inProgress: number
  done: number
  hold: number
  cancelled: number
  etc: number
  total: number
}

/**
 * 업무 상태 집계 — 시트 '상태' 열(진행중/완료/보류/취소) 기준. 빈값/기타는 미정(etc).
 */
export function workStatusCounts(items: WorkItem[]): WorkCounts {
  let inProgress = 0
  let done = 0
  let hold = 0
  let cancelled = 0
  let etc = 0
  for (const t of items) {
    const s = (t.status || '').trim()
    if (s === '진행중') inProgress++
    else if (s === '완료') done++
    else if (s === '보류') hold++
    else if (s === '취소') cancelled++
    else etc++
  }
  return { inProgress, done, hold, cancelled, etc, total: items.length }
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
