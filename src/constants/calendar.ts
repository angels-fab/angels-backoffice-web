import type { CalCat } from '@/types'
import { accent, neutralFill } from '@/theme/tokens'

// 일정 카테고리 색 — 디자인 시스템 accent 토큰으로 통일(대시보드·캘린더 일치).
// 카테고리→StatusKind 매핑은 src/pages/Calendar/catMeta.ts 와 동일 기준.
export const CAL_CATS: CalCat[] = [
  { id: 'all', label: '전체', cls: 'f-all', color: neutralFill },
  { id: 'meeting', label: '회의/미팅', cls: 'f-meeting', color: accent.blue },
  { id: 'work', label: '업무', cls: 'f-etc', color: accent.teal },
  { id: 'edu', label: '교육/세미나', cls: 'f-edu', color: accent.green },
  { id: 'recruit', label: '채용', cls: 'f-recruit', color: accent.purple },
  { id: 'trip_dom', label: '국내출장', cls: 'f-trip', color: accent.amber },
  { id: 'trip_intl', label: '국외출장', cls: 'f-trip', color: accent.amber },
  // 연차 — catMeta.ts와 동일 색/라벨(홈 대시보드·캘린더 일치). 로즈핑크.
  // accent.rose 는 이 값을 정본화한 것(tokens.ts 주석: "domain.calendar.leave 와 같은 값")
  { id: 'leave', label: '연차', cls: 'f-leave', color: accent.rose },
  // '기타'에 남아 있던 #7D8899 는 대비 미달로 폐기된 옛 textMuted 값이었다
  { id: 'etc', label: '기타', cls: 'f-etc', color: neutralFill },
]

export const CAL_CAT_MAP: Record<string, CalCat> = Object.fromEntries(
  CAL_CATS.map(c => [c.id, c]),
)

// 일정 데이터는 구글캘린더(gist.angels@gmail.com)에서 실시간으로 불러옴 — calSlice.ts 참고
