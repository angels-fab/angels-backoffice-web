// 개선요청 '메모표시' 공용 유틸 — 개선위치 ↔ 라우트 경로 매핑 + 페이지별 활성 메모 필터.
// PageHeader(현재 경로 메모 칩·패널)와 SideNav(경로별 메모 건수 배지)가 공유한다.
import type { ImprovementItem } from '@/types'

/**
 * 개선위치(시트 값) → 앱 라우트 경로.
 * 장비도입관리·장비운영관리·장비관리는 모두 통합 '장비관리' 페이지(/equipment)로 합산한다
 * (메모 항목에는 실제 개선위치를 그대로 표시).
 * '기타' 또는 알 수 없는 값은 연결 페이지가 없으므로 제외한다.
 */
export const MEMO_LOCATION_PATH: Record<string, string> = {
  '홈': '/',
  '공지사항': '/notice',
  '업무일정': '/calendar',
  '업무현황': '/work',
  '장비도입관리': '/equipment',
  '장비운영관리': '/equipment',
  '장비관리': '/equipment',
  '학술·교육·전시': '/events',
  '구축 로드맵': '/roadmap',
  '바로가기': '/links',
  '설정': '/settings',
}

/** 개선위치 → 경로(없으면 null = 연결할 페이지 없음, 예: '기타'·미지정) */
export function locationToPath(loc: string): string | null {
  return MEMO_LOCATION_PATH[(loc || '').trim()] ?? null
}

/** 메모로 띄울 수 있는 위치인지(연결 페이지 존재 여부) */
export function hasMemoTarget(loc: string): boolean {
  return locationToPath(loc) !== null
}

/** 활성 메모 = 메모표시 체크 + 연결 페이지가 있는 항목 */
export function isMemoActive(t: ImprovementItem): boolean {
  return t.memo === true && hasMemoTarget(t.loc)
}

/** 현재 경로(pathname)가 대상 경로에 해당하는지 — '/notice/12' 같은 하위 경로도 매칭 */
function matchesPath(pathname: string, target: string): boolean {
  if (target === '/') return pathname === '/'
  return pathname === target || pathname.startsWith(target + '/')
}

/** 현재 경로에 표시할 활성 메모 목록 (PageHeader 칩·패널용) */
export function memosForPath(items: ImprovementItem[], pathname: string): ImprovementItem[] {
  return items.filter((t) => {
    const p = locationToPath(t.loc)
    return t.memo === true && p !== null && matchesPath(pathname, p)
  })
}

/** 경로별 활성 메모 건수 — 장비도입/장비운영은 /equipment로 합산 (SideNav 배지용) */
export function memoCountByPath(items: ImprovementItem[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const t of items) {
    if (t.memo !== true) continue
    const p = locationToPath(t.loc)
    if (!p) continue
    m[p] = (m[p] || 0) + 1
  }
  return m
}
