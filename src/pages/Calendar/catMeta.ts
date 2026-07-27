import type { Theme } from '@mui/material/styles'
import { accent, darkPalette, domain } from '@/theme/tokens'
import type { CalCatId } from '@/types'

export type RealCat = Exclude<CalCatId, 'all'>

/**
 * 일정 카테고리 → 통일 색 체계(STEP5 item3).
 * 캘린더 이벤트·범례·필터바·팝오버가 이 한 곳에서 색을 가져간다.
 * 라벨은 CAL_CATS와 동일. 색은 디자인 시스템 토큰(accent) 사용.
 */
/**
 * color = 채움(fill) 전용 — 칩 배경 틴트·좌측 색띠·범례 점.
 * tone  = 그 색의 "글자용 짝" 키. 글자·아이콘은 반드시 catTextColor(theme, tone)로 뽑을 것.
 *         color를 그대로 글자에 쓰면 라이트에서 자기 틴트 위 1.8~2.4:1로 사라진다(2026-07-27 전수조사).
 */
export type CatTone = 'blue' | 'teal' | 'green' | 'purple' | 'amber' | 'rose' | 'neutral'

export const CAT_META: Record<RealCat, { label: string; color: string; tone: CatTone }> = {
  meeting: { label: '회의/미팅', color: accent.blue, tone: 'blue' },
  work: { label: '업무', color: accent.teal, tone: 'teal' },
  edu: { label: '교육/세미나', color: accent.green, tone: 'green' },
  recruit: { label: '채용', color: accent.purple, tone: 'purple' },
  trip_dom: { label: '국내출장', color: accent.amber, tone: 'amber' },
  trip_intl: { label: '국외출장', color: accent.amber, tone: 'amber' },
  // 연차/반차/휴가 — 차분한 로즈핑크. 정본은 tokens.domain.calendar.leave (P1-2 승격).
  leave: { label: '연차', color: domain.calendar.leave, tone: 'rose' },
  // color는 채움 틴트로만 쓰이는 중립 회색(두 테마 모두 무난). 글자·아이콘은 tone:'neutral' → text.primary.
  etc: { label: '기타', color: darkPalette.textMuted, tone: 'neutral' },
}

/** 종류색의 글자/아이콘용 값 — 현재 테마에서 4.5:1(아이콘은 3:1)을 만족한다 */
export const catTextColor = (th: Theme, tone: CatTone): string =>
  tone === 'neutral' ? th.palette.text.primary : th.palette.accentText[tone]

/** 색(fill hex)만 들고 있는 호출부용 — hex → tone 역인덱스 */
export const toneOfColor = (color: string): CatTone =>
  (Object.values(CAT_META).find((m) => m.color === color)?.tone ?? 'neutral')

// 채용(recruit)은 별도 필터 미노출 — [채용] 일정은 classify에서 기타로 통합됨. (CAT_META엔 타입 안전상 유지)
export const CAT_ORDER: RealCat[] = ['meeting', 'work', 'edu', 'trip_dom', 'trip_intl', 'leave', 'etc']
