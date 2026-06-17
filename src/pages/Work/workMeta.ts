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

// 담당자별 채움 칩 색 — 지정 담당자는 고정색, 그 외는 해시로 자동 배정(미지정=회색).
const MGR_FIXED: Record<string, string> = {
  박주봉: '#2f6db8', // 파랑
  조성범: '#2f8f4e', // 초록
  박세리: '#a8761a', // 주황
  신현진: '#6f5fb0', // 보라
}
// 고정색과 겹치지 않는 fallback 팔레트
const MGR_PALETTE = ['#b8557e', '#1d8f8f', '#c0572f', '#7a8a2a', '#5a6cc0', '#a04ab0']
export function mgrColor(name: string): string {
  const s = (name || '').trim()
  if (!s) return '#5f6b7e'
  if (MGR_FIXED[s]) return MGR_FIXED[s]
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return MGR_PALETTE[h % MGR_PALETTE.length]
}
