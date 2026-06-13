import type { StatusKind } from '@/components/ds'
import type { WorkItem } from '@/types'

/**
 * 업무 상태(데이터 충실형) — 시트 실제 플래그 기준.
 * 진행중(share) / Remind(!share&&remind) / 지난(!share&&!remind) 은 전체를 분할.
 * 센터장 Check(chief)는 직교 플래그(위 분류와 겹칠 수 있음).
 */
export type WStatus = 'inProgress' | 'remind' | 'past'

export const W_STATUS: Record<WStatus, { label: string; status: StatusKind }> = {
  inProgress: { label: '진행중', status: 'success' },
  remind: { label: 'Remind', status: 'warning' },
  past: { label: '지난', status: 'neutral' },
}

export function classify(t: WorkItem): WStatus {
  if (t.share) return 'inProgress'
  if (t.remind) return 'remind'
  return 'past'
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
