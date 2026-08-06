// 개선요청 '메모표시' 공용 유틸 — 개선위치 ↔ 라우트 경로 매핑 + 페이지별 활성 메모 필터.
// PageHeader(현재 경로 메모 칩·패널)와 SideNav(경로별 메모 건수 배지)가 공유한다.
import type { ImprovementItem } from '@/types'

/**
 * 개선위치(시트 값) → 앱 라우트 경로.
 * 장비는 탭이 둘이라 경로도 둘이다(도입=/equipment · 운영=/equipment-ops). 쪽지는 쓴 탭에 뜨고,
 * 사이드바 배지는 메뉴가 '장비관리' 하나뿐이라 memoCountByPath 에서 합산한다.
 * '기타' 또는 알 수 없는 값은 연결 페이지가 없으므로 제외한다.
 */
export const MEMO_LOCATION_PATH: Record<string, string> = {
  '홈': '/',
  '공지사항': '/notice',
  '업무일정': '/calendar',
  '업무현황': '/work',
  '장비도입관리': '/equipment',
  '장비운영관리': '/equipment-ops',
  '장비관리': '/equipment',
  '마일스톤': '/milestone',
  '학술·교육·전시': '/events',
  '포털개선요청': '/improve',
  '구축 로드맵': '/', // 전용 페이지 폐지 — 홈으로 이관되어 홈 경로에 메모 표시
  '바로가기': '/links',
  '설정': '/settings',
  // '포털'(포털 전체)은 특정 페이지가 없어 매핑하지 않음 → 메모 대상 없음(핀 비활성)
}

/** 개선위치 → 경로(없으면 null = 연결할 페이지 없음, 예: '기타'·미지정) */
export function locationToPath(loc: string): string | null {
  return MEMO_LOCATION_PATH[(loc || '').trim()] ?? null
}

/** 메모로 띄울 수 있는 위치인지(연결 페이지 존재 여부) */
export function hasMemoTarget(loc: string): boolean {
  return locationToPath(loc) !== null
}

/**
 * 리치텍스트 본문 → 게시판 제목으로 쓸 첫 줄(2026-08-05).
 *
 * 메모 입력에서 '한 줄 요약'(제목) 칸을 없앴다 — 쪽지에 칸이 둘이라 번거롭다는 지적.
 * 게시판은 제목 열이 있어야 목록이 읽히므로, 여기서 내용 첫 줄을 잘라 제목으로 삼는다.
 * 태그를 벗기고 첫 비어 있지 않은 줄만 취한 뒤 60자로 자른다(제목 칸 maxLength 와 같은 값).
 */
export function firstLine(html: string): string {
  const text = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  const line = text.split('\n').map((s) => s.trim()).find(Boolean) || ''
  return line.slice(0, 60) || '(제목 없음)'
}

/**
 * 내가 볼 메모만 추린다 — **작성자 본인 또는 포털 관리자**(사용자 확정 2026-08-05).
 *
 * 메모는 '내가 남긴 개선 요청을 그 화면에서 다시 마주치는' 장치다. 남의 메모까지 뜨면
 * 화면이 남의 할 일로 덮이고, 정작 내가 남긴 것이 묻힌다. 관리자는 전체를 봐야 처리할 수 있으므로 예외.
 * 칩·패널(PageImprovementMemo)과 사이드바·모바일 배지가 모두 이 함수를 거쳐 기준이 갈리지 않게 한다.
 */
export function visibleMemos(items: ImprovementItem[], user: string | null, isAdmin: boolean): ImprovementItem[] {
  if (isAdmin) return items
  if (!user) return []
  return items.filter((t) => (t.author || '').trim() === user)
}

/** 활성 메모 = 메모표시 체크 + 연결 페이지가 있는 항목 */
export function isMemoActive(t: ImprovementItem): boolean {
  return t.memo === true && hasMemoTarget(t.loc)
}

/** 현재 경로(pathname)가 대상 경로에 해당하는지 — '/notice/12' 같은 하위 경로도 매칭 */
export function matchesPath(pathname: string, target: string): boolean {
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

/**
 * 현재 경로 → 개선위치 (상단바 메모 버튼이 자동 지정할 값).
 * 위 MEMO_LOCATION_PATH의 역방향인데, 여러 위치가 한 경로를 공유하므로(장비도입/운영/관리 → /equipment)
 * 경로당 대표값 하나를 여기서 명시한다. 하위 경로가 먼저 걸리도록 '/'는 맨 뒤에 둔다.
 */
const PATH_LOCATION: { path: string; loc: string }[] = [
  { path: '/notice', loc: '공지사항' },
  { path: '/calendar', loc: '업무일정' },
  { path: '/work', loc: '업무현황' },
  // 장비운영 탭은 별도 라우트다. 이 줄이 없어서 그 탭에서 남긴 쪽지·그림이 '기타'로 저장돼
  // 어느 화면에도 뜨지 않고 사라졌다(2026-08-05 전수검사에서 확인).
  { path: '/equipment-ops', loc: '장비운영관리' },
  { path: '/equipment', loc: '장비도입관리' },
  { path: '/milestone', loc: '마일스톤' },
  { path: '/events', loc: '학술·교육·전시' },
  { path: '/improve', loc: '포털개선요청' },
  { path: '/links', loc: '바로가기' },
  { path: '/settings', loc: '설정' },
  { path: '/', loc: '홈' },
]

/** 현재 경로의 개선위치(없으면 null = 연결할 위치 없음 → '기타'로 접수, 쪽지는 안 뜸) */
export function pathToLocation(pathname: string): string | null {
  for (const e of PATH_LOCATION) if (matchesPath(pathname, e.path)) return e.loc
  return null
}

/** 경로별 활성 메모 건수 — 장비 운영 탭은 /equipment로 합산 (SideNav 메뉴가 '장비관리' 하나라서) */
export function memoCountByPath(items: ImprovementItem[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const t of items) {
    if (t.memo !== true) continue
    let p = locationToPath(t.loc)
    if (!p) continue
    if (p === '/equipment-ops') p = '/equipment'
    m[p] = (m[p] || 0) + 1
  }
  return m
}
