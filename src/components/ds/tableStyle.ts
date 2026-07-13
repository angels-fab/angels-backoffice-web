/**
 * 손코딩 데이터표 공용 스타일 — DataTable 컴포넌트와 "같은 겉모습"을 공유하기 위한 sx 조각.
 *
 * 공지사항·포털개선요청 표는 펼침 행·인라인 작성/수정 같은 커스텀 구조라 ds/DataTable 컴포넌트로
 * 통째 교체가 불가하다. 대신 이 스타일을 얹어 헤더·정렬·선·글자크기를 표준과 동일하게 맞춘다.
 * 규격 정본 = ds/DataTable.tsx 주석(사용자 최종 확정 2026-07-13):
 *   헤더 = background.elevated 채움 + 12px/600/text.secondary + 기본 가운데
 *          (긴 본문성 텍스트 열만 호출부에서 per-cell `textAlign:'left'`),
 *   본문 셀 = 12px · 내부선 = 가로선만(divider).
 */

/** 표 헤더 <TableRow>에 얹는 sx — 배경 채움·12px·가운데 기본. */
export const dataTableHeadSx = {
  '& th': {
    bgcolor: 'background.elevated',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'text.secondary',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  },
} as const

/** 표 <Table>에 얹는 sx — 가로선(divider) + 본문 셀 12px. */
export const dataTableSx = {
  '& th, & td': { borderColor: 'divider' },
  '& tbody td': { fontSize: '0.75rem' },
} as const
