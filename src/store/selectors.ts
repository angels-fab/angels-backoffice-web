import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'
import type { EqCounts, EqStateKey } from '@/types'

const STATE_KEYS: EqStateKey[] = ['도입예정', '도입중', '가동중', '비가동']

function baseOf(nm: string): string {
  const m = String(nm || '').trim().match(/^([^(]+)\s*\(/)
  return m ? m[1].trim() : String(nm || '').trim()
}

/** 상태별 개수 집계 (KPI·홈 미리보기 공용 / 원본 raw 기준, 종 수 = 장비명 그룹 수) */
export const selectEqCounts = createSelector(
  (s: RootState) => s.eq.raw,
  (raw): EqCounts => {
    const units = { 도입예정: 0, 도입중: 0, 가동중: 0, 비가동: 0 } as Record<EqStateKey, number>
    const baseBy: Record<EqStateKey, Set<string>> = {
      도입예정: new Set(), 도입중: new Set(), 가동중: new Set(), 비가동: new Set(),
    }
    const allBase = new Set<string>()
    raw.forEach(e => {
      const base = baseOf(e.name)
      if (base) allBase.add(base)
      const s = (e.state || '').trim()
      let key: EqStateKey | null = null
      if (s === '도입예정') key = '도입예정'
      else if (s === '도입중') key = '도입중'
      else if (s === '가동중') key = '가동중'
      else if (s) key = '비가동' // 비가동/유지보수/고장/이상 등 나머지
      if (key) {
        units[key]++
        if (base) baseBy[key].add(base)
      }
    })
    const typesBy = { 도입예정: 0, 도입중: 0, 가동중: 0, 비가동: 0 } as Record<EqStateKey, number>
    STATE_KEYS.forEach(k => (typesBy[k] = baseBy[k].size))
    return { total: raw.length, types: allBase.size, units, typesBy }
  },
)

/** 진행중 업무 (상태='진행중') */
export const selectCurrentWork = createSelector(
  (s: RootState) => s.work.items,
  items => items.filter(t => (t.status || '').trim() === '진행중'),
)
