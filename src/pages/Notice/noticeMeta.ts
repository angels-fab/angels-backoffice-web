import type { StatusKind } from '@/components/ds'
import { richBodyHTML } from '@/utils/richBody'

/** 공지 분류 → StatusKind (디자인 시스템 색 통일). 미정의 분류는 neutral. */
const NOTICE_CAT_STATUS: Record<string, StatusKind> = {
  긴급: 'error',
  안전: 'error',
  보안: 'purple',
  시설: 'success',
  공지: 'info',
  일반: 'neutral',
  회의: 'purple',
  교육: 'teal',
  행사: 'success',
  점검: 'warning',
}
export const noticeCatStatus = (cat: string): StatusKind => NOTICE_CAT_STATUS[cat] ?? 'neutral'

/** 본문 → 안전 HTML — 공용 richBodyHTML 재사용(기존 호출부 호환용 별칭) */
export const noticeBodyHTML = richBodyHTML
