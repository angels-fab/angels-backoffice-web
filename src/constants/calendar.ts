import type { CalCat } from '@/types'

// 정돈된 차분한 팔레트 (흰 글자가 잘 읽히도록 살짝 깊은 톤)
export const CAL_CATS: CalCat[] = [
  { id: 'all', label: '전체', cls: 'f-all', color: '#4b5563' },
  { id: 'meeting', label: '회의/미팅', cls: 'f-meeting', color: '#3b78e7' },
  { id: 'edu', label: '교육/세미나', cls: 'f-edu', color: '#2f9e44' },
  { id: 'recruit', label: '채용', cls: 'f-recruit', color: '#7c5cd6' },
  { id: 'trip', label: '출장', cls: 'f-trip', color: '#c77d2a' },
  { id: 'etc', label: '기타', cls: 'f-etc', color: '#0e9aa0' },
]

export const CAL_CAT_MAP: Record<string, CalCat> = Object.fromEntries(
  CAL_CATS.map(c => [c.id, c]),
)

// 일정 데이터는 구글캘린더(gist.angels@gmail.com)에서 실시간으로 불러옴 — calSlice.ts 참고
