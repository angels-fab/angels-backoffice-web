import type { StatusKind } from '@/components/ds'
import type { ImprovementItem } from '@/types'

/** 개선제안 상태 — 시트 '상태' 열 */
export type ImpStatus = '접수' | '검토중' | '완료' | '보류' | '불가'

/** 필터 탭/드롭다운 노출 순서 (전체 탭 없음) */
export const IMP_STATUSES: ImpStatus[] = ['접수', '검토중', '완료', '보류', '불가']

/** 신규 등록 시 기본 상태 */
export const IMP_STATUS_DEFAULT: ImpStatus = '접수'

/** 유형 기본 추천(자유 입력도 가능) */
export const IMP_TYPE_OPTIONS = ['UI', 'UX', '기능', '콘텐츠', '오탈자']

/** 옛 '접수중' → '접수' 별칭(시트 마이그레이션 없이 호환) */
export function normStatus(status: string): string {
  const s = (status || '').trim()
  return s === '접수중' ? '접수' : s
}

/** 상태 → 색(StatusChip kind). 접수=회색·검토중=초록·완료=파랑·보류=주황·불가=빨강 */
const KIND: Record<ImpStatus, StatusKind> = {
  접수: 'neutral',
  검토중: 'success',
  완료: 'info',
  보류: 'warning',
  불가: 'error',
}

export function impKind(status: string): StatusKind {
  return KIND[normStatus(status) as ImpStatus] ?? 'neutral'
}

/** 불가·보류는 사유 입력 필요(공용 '사유' 열) */
export function needsReason(status: string): boolean {
  const s = normStatus(status)
  return s === '불가' || s === '보류'
}

/** 비고칸 표시: 완료→완료일자(날짜만) / 불가·보류→사유 / 그 외→'' */
export function remarkOf(t: ImprovementItem): { kind: 'date' | 'reason' | 'none'; text: string } {
  const s = normStatus(t.status)
  if (s === '완료') return { kind: 'date', text: t.end || '' }
  if (s === '불가' || s === '보류') return { kind: 'reason', text: t.reason || '' }
  return { kind: 'none', text: '' }
}
