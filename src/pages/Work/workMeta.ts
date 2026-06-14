import type { StatusKind } from '@/components/ds'
import type { WorkItem } from '@/types'

/**
 * 업무 상태 — 시트 '상태' 열 기준(진행중/완료/보류/취소). 빈값/기타는 '미정'.
 * Remind·검토 필요는 직교 플래그(상태와 겹칠 수 있음).
 */
export type WStatus = 'inProgress' | 'done' | 'hold' | 'cancelled' | 'etc'

export const W_STATUS: Record<WStatus, { label: string; status: StatusKind }> = {
  inProgress: { label: '진행중', status: 'success' },
  done: { label: '완료', status: 'neutral' },
  hold: { label: '보류', status: 'warning' },
  cancelled: { label: '취소', status: 'error' },
  etc: { label: '미정', status: 'neutral' },
}

/** 상태 필터에 노출할 정식 상태 (미정 제외) */
export const W_STATUS_TABS: WStatus[] = ['inProgress', 'done', 'hold', 'cancelled']

export function classify(t: WorkItem): WStatus {
  const s = (t.status || '').trim()
  if (s === '진행중') return 'inProgress'
  if (s === '완료') return 'done'
  if (s === '보류') return 'hold'
  if (s === '취소') return 'cancelled'
  return 'etc'
}

/** 등록/수정 폼의 상태 선택지 */
export const WORK_STATUS_OPTIONS = ['진행중', '완료', '보류', '취소']

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
