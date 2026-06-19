import type { StatusKind } from '@/components/ds'
import type { ImprovementItem } from '@/types'

/** 개선제안 상태 — 시트 '상태' 열 */
export type ImpStatus = '접수중' | '검토중' | '개선완료' | '반려' | '보류'

/** 필터 탭/드롭다운 노출 순서 (전체 탭 없음) */
export const IMP_STATUSES: ImpStatus[] = ['접수중', '검토중', '개선완료', '반려', '보류']

/** 신규 등록 시 기본 상태 */
export const IMP_STATUS_DEFAULT: ImpStatus = '접수중'

/** 상태 → 색(StatusChip kind). 접수중=초록·검토중=회색·개선완료=파랑·보류=주황·반려=빨강 */
const KIND: Record<ImpStatus, StatusKind> = {
  접수중: 'success',
  검토중: 'neutral',
  개선완료: 'info',
  반려: 'error',
  보류: 'warning',
}

export function impKind(status: string): StatusKind {
  return KIND[(status || '').trim() as ImpStatus] ?? 'neutral'
}

/** 반려·보류는 사유 입력 필요(공용 '사유' 열) */
export function needsReason(status: string): boolean {
  const s = (status || '').trim()
  return s === '반려' || s === '보류'
}

/** 비고칸 표시: 개선완료→완료일자 / 반려·보류→사유 / 그 외→'' */
export function remarkOf(t: ImprovementItem): { kind: 'date' | 'reason' | 'none'; text: string } {
  const s = (t.status || '').trim()
  if (s === '개선완료') return { kind: 'date', text: t.end || '' }
  if (s === '반려' || s === '보류') return { kind: 'reason', text: t.reason || '' }
  return { kind: 'none', text: '' }
}
