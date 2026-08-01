// 구분(카테고리)별 색상표(WORK_CAT_PALETTE)와 workCatStyle 은 2026-08-02 삭제.
// 사용처가 0이었고, 채움색(accent)을 그대로 글자색으로 쓰고 있어 토큰 규칙에도 어긋났다
// (글자에는 accentText 를 쓴다). 현재 구분 칩은 workMeta 의 톤 체계가 그린다.

// 업무구분 우선순위 (대소문자·공백·,·/ 차이는 무시하고 매칭)
const WORK_CAT_ORDER = [
  '설계적정성검토',
  '국가장비심의위원회',
  '장심위',
  '장비',
  '인사',
  '예산',
  '행정',
  '대응',
  '교육,세미나',
  'MoU',
]

export function normCat(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s,/]/g, '')
}

export function workCatRank(cat: string): number {
  const i = WORK_CAT_ORDER.findIndex(o => normCat(o) === normCat(cat))
  return i < 0 ? 999 : i
}
