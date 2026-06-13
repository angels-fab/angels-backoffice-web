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
  edu: { label: '교육/세미나', status: 'success', color: accent.green },
  recruit: { label: '채용', status: 'purple', color: accent.purple },
  trip: { label: '출장', status: 'warning', color: accent.amber },
  etc: { label: '기타', status: 'teal', color: accent.teal },
}

export const CAT_ORDER: RealCat[] = ['meeting', 'edu', 'recruit', 'trip', 'etc']
