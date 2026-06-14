import { accent } from '@/theme/tokens'
import type { StatusKind } from '@/components/ds'
import type { TlMonth } from '@/types'

/**
 * 장비 도입 단계(구매 절차) — 시트 timeline 반월 단위 코드.
 * 색은 디자인 시스템 accent 토큰으로 통일(간트 막대·StatusChip·파이프라인 일치).
 */
export const STAGE_ORDER = ['사', '공', '평', '협', '제', '설'] as const
export type StageCode = (typeof STAGE_ORDER)[number]

export const STAGE: Record<StageCode, { label: string; status: StatusKind; color: string }> = {
  사: { label: '사전규격', status: 'error', color: accent.red },
  공: { label: '구매공고', status: 'warning', color: accent.amber },
  평: { label: '기술평가', status: 'success', color: accent.green },
  협: { label: '기술협상', status: 'teal', color: accent.teal },
  제: { label: '장비제작', status: 'info', color: accent.blue },
  설: { label: '장비설치', status: 'purple', color: accent.purple },
}

export type Phase = 'done' | 'progress' | 'upcoming' | 'none'

export interface StageInfo {
  phase: Phase
  /** 현재(또는 최종) 단계 코드 */
  code: StageCode | null
  /** 도입 예정월 'YYYY.M' (timeline 마지막 단계 시점) */
  dueMonth: string
  /** 진행률 0~1 (단계 순서 기준) */
  progress: number
  /** 총 소요기간(개월, 반월→개월 올림) */
  durationMonths: number
}

/** 오늘이 months 축에서 몇 번째 반월인지(전반0/후반1). 범위 이전 -1, 이후 length*2. */
export function todayHalfIndex(months: TlMonth[]): number {
  if (!months.length) return -1
  const now = new Date()
  const y = now.getFullYear()
  const mo = now.getMonth() + 1
  const mi = months.findIndex((m) => parseInt(m.year, 10) === y && parseInt(m.month, 10) === mo)
  if (mi >= 0) return mi * 2 + (now.getDate() <= 15 ? 0 : 1)
  const fy = parseInt(months[0].year, 10)
  const fmo = parseInt(months[0].month, 10)
  if (y < fy || (y === fy && mo < fmo)) return -1
  return months.length * 2
}

const codeOf = (s?: string): StageCode | null => {
  const c = (s || '').trim()
  return (STAGE_ORDER as readonly string[]).includes(c) ? (c as StageCode) : null
}

/** 그룹 timeline → 현재 단계·도입예정·진행률 */
export function groupStage(timeline: string[], months: TlMonth[], todayHalf: number): StageInfo {
  const filled: number[] = []
  for (let i = 0; i < timeline.length; i++) if ((timeline[i] || '').trim()) filled.push(i)
  if (!filled.length) return { phase: 'none', code: null, dueMonth: '', progress: 0, durationMonths: 0 }

  const first = filled[0]
  const last = filled[filled.length - 1]
  const dueM = months[Math.floor(last / 2)]
  const dueMonth = dueM ? `${(dueM.year || '').replace('년', '')}.${(dueM.month || '').replace('월', '')}` : ''
  const durationMonths = Math.ceil((last - first + 1) / 2)

  let phase: Phase
  let code: StageCode | null
  if (todayHalf > last) {
    phase = 'done'
    code = codeOf(timeline[last])
  } else if (todayHalf < first) {
    phase = 'upcoming'
    code = codeOf(timeline[first])
  } else {
    phase = 'progress'
    let idx = Math.min(todayHalf, last)
    while (idx >= first && !codeOf(timeline[idx])) idx--
    code = codeOf(timeline[idx]) ?? codeOf(timeline[last])
  }
  const order = code ? STAGE_ORDER.indexOf(code) : -1
  const progress = phase === 'done' ? 1 : phase === 'upcoming' ? 0 : order >= 0 ? (order + 1) / STAGE_ORDER.length : 0
  return { phase, code, dueMonth, progress, durationMonths }
}

/** Phase별 표시 라벨/상태 (요약 칩) */
export function phaseChip(info: StageInfo): { label: string; status: StatusKind } {
  if (info.phase === 'done') return { label: '설치완료', status: 'success' }
  if (info.phase === 'upcoming') return { label: '착수 전', status: 'neutral' }
  if (info.phase === 'none') return { label: '미정', status: 'neutral' }
  return info.code ? { label: STAGE[info.code].label, status: STAGE[info.code].status } : { label: '진행중', status: 'info' }
}
