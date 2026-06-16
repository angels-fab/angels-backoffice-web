import type { StatusKind } from '@/components/ds'
import type { EqStateKey } from '@/types'

/**
 * 장비 상태 메타 — 시트 값을 그대로 표시(라벨 매핑 없음). 정식 4값: 도입예정/도입중/운영중/비가동.
 * 그 외(오타·빈값·레거시 '가동중' 등)는 '미분류'로 처리. 색은 StatusChip(status)이 테마에서 매핑.
 */
export const EQ_STATE: Record<EqStateKey, { label: string; status: StatusKind }> = {
  도입예정: { label: '도입예정', status: 'info' },
  도입중: { label: '도입중', status: 'teal' },
  운영중: { label: '운영중', status: 'success' },
  비가동: { label: '비가동', status: 'error' },
  미분류: { label: '미분류', status: 'neutral' },
}

/** 시트 state 문자열 → 정식 키. 4값(도입예정/도입중/운영중/비가동) 외에는 '미분류'. (selectEqCounts와 동일 규칙) */
export function eqStateKey(state?: string): EqStateKey {
  const s = (state || '').trim()
  if (s === '도입예정' || s === '도입중' || s === '운영중' || s === '비가동') return s
  return '미분류'
}
