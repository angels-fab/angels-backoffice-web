/**
 * 필터 칩 선택 규칙 — 게시판 3곳(업무현황·공지사항·포털개선요청)의 **단일 정본**.
 *
 * 규칙: 빈 집합 = 전체(칩이 전부 켜진 모습).
 * - 일반 클릭 = 그 항목만 단독 선택. 이미 그것만 선택돼 있으면 해제해서 전체로 되돌린다.
 * - Shift(additive) = 기존 선택을 유지한 채 추가/제거.
 *
 * 예전엔 공지사항만 Shift 없이 "클릭할수록 누적"되는 별도 규칙(isolateToggle)을 써서,
 * 같은 칩을 같은 방식으로 눌러도 게시판마다 결과가 달랐다(사용자 지적 2026-07-26).
 */
export function nextFilterSelection<T>(prev: Set<T>, value: T, additive: boolean): Set<T> {
  if (!additive) {
    if (prev.size === 1 && prev.has(value)) return new Set<T>()
    return new Set<T>([value])
  }
  const next = new Set(prev)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** 배열로 선택을 들고 있는 호출부(공지)용 얇은 래퍼 — 규칙은 위와 동일 */
export function nextFilterList(prev: string[], value: string, additive: boolean): string[] {
  return [...nextFilterSelection(new Set(prev), value, additive)]
}
