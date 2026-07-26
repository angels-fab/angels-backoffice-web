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
    // 헤더 띠 — 라이트에서 elevated(#EDF1F6)는 카드(#FFF) 대비 1.11이라 띠가 안 보였다.
    // 레거시 .eq-ledger 표와 같은 값을 공유(--th-bg)해 두 구현의 헤더가 어긋나지 않게 한다.
    bgcolor: 'var(--th-bg)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'text.secondary',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    // 헤더 ↔ 본문 경계선. --border는 라이트에서 #E3E8EF로 헤더 띠(#DFE7F0)보다 **밝아서**
    // 선이 아니라 미세한 틈으로 보였다(대비 1.01). 헤더 전용 --th-line으로 분리 — 세 표 구현 공유.
    borderBottom: '1px solid var(--th-line)',
  },
} as const

/** 표 <Table>에 얹는 sx — 가로선(divider) + 본문 셀 12px + 행 hover. */
export const dataTableSx = {
  '& th, & td': { borderColor: 'divider' },
  '& tbody td': { fontSize: '0.75rem' },
  // MUI 기본 action.hover(라이트 rgba(0,0,0,.04)→#F5F5F5)는 대비 1.09에 중성 회색이라
  // 파랑기미 표면들 사이에서 혼자 튀었다. 레거시 .eq-ledger·ListRow와 같은 --row-hover로 통일.
  '& tbody .MuiTableRow-hover:hover': { backgroundColor: 'var(--row-hover)' },
} as const
