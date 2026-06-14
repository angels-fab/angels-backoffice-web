import type { StatusKind } from '@/components/ds'
import type { WorkItem } from '@/types'

/**
 * 업무 상태 — 시트 '상태' 열(진행중/보류/완료) 기준. 빈값은 '미정'.
 * Remind·센터장 검토는 직교 플래그(상태와 겹칠 수 있음).
 */
export type WStatus = 'inProgress' | 'hold' | 'done' | 'etc'

export const W_STATUS: Record<WStatus, { label: string; status: StatusKind }> = {
  inProgress: { label: '진행중', status: 'success' },
  hold: { label: '보류', status: 'warning' },
  done: { label: '완료', status: 'neutral' },
  etc: { label: '미정', status: 'neutral' },
}

export function classify(t: WorkItem): WStatus {
  const s = (t.status || '').trim()
  if (s === '진행중') return 'inProgress'
  if (s === '보류') return 'hold'
  if (s === '완료') return 'done'
  return 'etc'
}

/** 업무 내용 첫 줄 = 제목 */
export function taskTitle(t: WorkItem): string {
  return String(t.task || '').split(/\r?\n/)[0] || '(제목 없음)'
}

/** 제목 이후 줄들 + 시간/장소(있으면) — 상세 본문용 */
export function taskSubs(t: WorkItem): string[] {
  const subs = String(t.task || '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim())
  if (t.time || t.loc) {
    const parts: string[] = []
    if (t.time) parts.push('시간: ' + t.time)
    if (t.loc) parts.push('장소: ' + t.loc)
    subs.push('- ' + parts.join(' | '))
  }
  return subs
}

/** 관련 링크 URL(있으면) */
export function taskLink(t: WorkItem): string | null {
  const m = String(t.link || '').match(/https?:\/\/[^\s]+/)
  return m ? m[0] : null
}
