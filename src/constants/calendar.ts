import type { CalCat } from '@/types'

export const CAL_CATS: CalCat[] = [
  { id: 'all', label: '전체', cls: 'f-all', color: '#F0B429' },
  { id: 'meeting', label: '회의/미팅', cls: 'f-meeting', color: '#58A6FF' },
  { id: 'edu', label: '교육/세미나', cls: 'f-edu', color: '#3FB950' },
  { id: 'recruit', label: '채용', cls: 'f-recruit', color: '#BC8CFF' },
  { id: 'trip', label: '출장', cls: 'f-trip', color: '#F0B429' },
  { id: 'etc', label: '기타', cls: 'f-etc', color: '#39D0D8' },
]

export const CAL_CAT_MAP: Record<string, CalCat> = Object.fromEntries(
  CAL_CATS.map(c => [c.id, c]),
)

// 일정 데이터는 구글캘린더(gist.angels@gmail.com)에서 실시간으로 불러옴 — calSlice.ts 참고
