import type { StatusKind } from '@/components/ds'
import type { EqStateKey } from '@/types'

/**
 * 장비 상태 메타 — selectEqCounts와 동일한 분류 기준.
 * 표시 라벨: 가동중=운영중, 도입중=설치중. 색은 StatusChip(status)이 테마에서 매핑.
 */
export const EQ_STATE: Record<EqStateKey, { label: string; status: StatusKind }> = {
  비가동: { label: '비가동', status: 'error' },
  도입중: { label: '설치중', status: 'teal' },
  도입예정: { label: '도입예정', status: 'info' },
  가동중: { label: '운영중', status: 'success' },
}

/** 시트 state 문자열 → 표준 키 (selectEqCounts와 동일 규칙) */
export function eqStateKey(state?: string): EqStateKey {
  const s = (state || '').trim()
  if (s === '도입예정') return '도입예정'
  if (s === '도입중') return '도입중'
  if (s === '가동중') return '가동중'
  return '비가동'
}
