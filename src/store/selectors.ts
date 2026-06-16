import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'
import type { EqCounts, EqStateKey } from '@/types'

const STATE_KEYS: EqStateKey[] = ['도입예정', '도입중', '운영중', '비가동', '미분류']

function baseOf(nm: string): string {
  const m = String(nm || '').trim().match(/^([^(]+)\s*\(/)
  return m ? m[1].trim() : String(nm || '').trim()
}

/** 상태별 개수 집계 (KPI·홈 미리보기 공용 / 원본 raw 기준, 종 수 = 장비명 그룹 수) */
export const selectEqCounts = createSelector(
  (s: RootState) => s.eq.raw,
  (raw): EqCounts => {
    const units = { 도입예정: 0, 도입중: 0, 운영중: 0, 비가동: 0, 미분류: 0 } as Record<EqStateKey, number>
    const baseBy: Record<EqStateKey, Set<string>> = {
      도입예정: new Set(), 도입중: new Set(), 운영중: new Set(), 비가동: new Set(), 미분류: new Set(),
    }
    const allBase = new Set<string>()
    raw.forEach(e => {
      const base = baseOf(e.name)
      if (base) allBase.add(base)
      const s = (e.state || '').trim()
      let key: EqStateKey
      if (s === '도입예정' || s === '도입중' || s === '운영중' || s === '비가동') key = s
      else key = '미분류' // 4값 외(오타·빈값·레거시 '가동중' 등)
      units[key]++
      if (base) baseBy[key].add(base)
    })
    const typesBy = { 도입예정: 0, 도입중: 0, 운영중: 0, 비가동: 0, 미분류: 0 } as Record<EqStateKey, number>
    STATE_KEYS.forEach(k => (typesBy[k] = baseBy[k].size))
    return { total: raw.length, types: allBase.size, units, typesBy }
  },
)

/** 진행중 업무 (상태='진행중') */
export const selectCurrentWork = createSelector(
  (s: RootState) => s.work.items,
  items => items.filter(t => (t.status || '').trim() === '진행중'),
)
