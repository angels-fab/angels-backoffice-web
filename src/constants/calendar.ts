import type { CalCat } from '@/types'
import { accent } from '@/theme/tokens'

// 일정 카테고리 색 — 디자인 시스템 accent 토큰으로 통일(대시보드·캘린더 일치).
// 카테고리→StatusKind 매핑은 src/pages/Calendar/catMeta.ts 와 동일 기준.
export const CAL_CATS: CalCat[] = [
  { id: 'all', label: '전체', cls: 'f-all', color: '#4b5563' },
  { id: 'meeting', label: '회의/미팅', cls: 'f-meeting', color: accent.blue },
  { id: 'edu', label: '교육/세미나', cls: 'f-edu', color: accent.green },
  { id: 'recruit', label: '채용', cls: 'f-recruit', color: accent.purple },
  { id: 'trip', label: '출장', cls: 'f-trip', color: accent.amber },
  { id: 'etc', label: '기타', cls: 'f-etc', color: accent.teal },
]

export const CAL_CAT_MAP: Record<string, CalCat> = Object.fromEntries(
  CAL_CATS.map(c => [c.id, c]),
)

// 일정 데이터는 구글캘린더(gist.angels@gmail.com)에서 실시간으로 불러옴 — calSlice.ts 참고
