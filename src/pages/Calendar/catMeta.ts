import type { StatusKind } from '@/components/ds'
import { accent } from '@/theme/tokens'
import type { CalCatId } from '@/types'

export type RealCat = Exclude<CalCatId, 'all'>

/**
 * 일정 카테고리 → 통일 색 체계(STEP5 item3).
 * StatusChip 상태(테마 accent)에 매핑해 캘린더 이벤트·범례·요약·드로어 색을 일치시킨다.
 * 라벨은 CAL_CATS와 동일. 색은 디자인 시스템 토큰(accent) 사용.
 */
export const CAT_META: Record<RealCat, { label: string; status: StatusKind; color: string }> = {
  meeting: { label: '회의/미팅', status: 'info', color: accent.blue },
  work: { label: '업무', status: 'teal', color: accent.teal },
  edu: { label: '교육/세미나', status: 'success', color: accent.green },
  recruit: { label: '채용', status: 'purple', color: accent.purple },
  trip_dom: { label: '국내출장', status: 'warning', color: accent.amber },
  trip_intl: { label: '국외출장', status: 'warning', color: accent.amber },
  // 연차/반차/휴가 — 기존 색과 구분되는 차분한 로즈핑크(테마 accent에 없어 catMeta 공용 구조에 추가). status는 미사용 SummaryPanel용 placeholder.
  leave: { label: '연차', status: 'purple', color: '#D87CA6' },
  etc: { label: '기타', status: 'neutral', color: '#7D8899' },
}

// 채용(recruit)은 별도 필터 미노출 — [채용] 일정은 classify에서 기타로 통합됨. (CAT_META엔 타입 안전상 유지)
export const CAT_ORDER: RealCat[] = ['meeting', 'work', 'edu', 'trip_dom', 'trip_intl', 'leave', 'etc']
