/**
 * 손코딩 데이터표 공용 스타일 — 표 규격 중 "테마가 못 잡는 것"만 남긴 조각.
 *
 * ★ 셀 여백·글자 크기·헤더 룩(배경·굵기·색·경계선)·구분선 색은 전부
 *   theme.ts 의 MuiTableCell 오버라이드가 정본이다(2026-08-01 확정).
 *   여기에 다시 쓰지 말 것 — 두 곳에 있으면 한쪽만 고쳐져 또 갈라진다.
 *
 * 공지사항·포털개선요청 표는 펼침 행·인라인 작성/수정 같은 커스텀 구조라 ds/DataTable 로
 * 통째 교체가 불가해 MUI Table 을 직접 쓴다. 장비도입·장비운영·행사 3표는 아직
 * 레거시 .eq-ledger(index.css)를 쓰고 있어 마크업 이관 대상이다.
 */

/**
 * 표 헤더 <TableRow>에 얹는 sx — 짧은 값 열의 기본 가운데 정렬(2026-07-13 확정 규격).
 * 긴 본문성 텍스트 열(제목·내용)은 호출부에서 좌측으로 되돌린다.
 *
 * ★ 특이도 함정: 이 선언은 `.css-ROW th`(0-1-1)라서 셀 sx `.css-CELL`(0-1-0)을 항상 이긴다.
 *   그래서 개별 헤더의 textAlign 선언이 조용히 죽는다 — 공지 작성일 헤더가 실제로 그 상태였다
 *   (선언은 right/left 인데 화면은 가운데). 셀별로 다른 정렬이 필요하면 sx 가 아니라
 *   TableCell 의 align prop 을 쓰거나 !important 를 붙여야 한다.
 *   마크업 이관이 끝나면 이 선언을 없애고 align prop 하나로 통일한다.
 */
export const dataTableHeadSx = {
  '& th': { textAlign: 'center' },
} as const

/** 표 <Table>에 얹는 sx — 행 hover. 나머지(구분선·글자·여백)는 theme MuiTableCell 담당. */
export const dataTableSx = {
  // MUI 기본 action.hover(라이트 rgba(0,0,0,.04)→#F5F5F5)는 대비 1.09에 중성 회색이라
  // 파랑기미 표면들 사이에서 혼자 튀었다. 레거시 .eq-ledger·ListRow와 같은 --row-hover로 통일.
  '& tbody .MuiTableRow-hover:hover': { backgroundColor: 'var(--row-hover)' },
} as const
