import type { Theme } from '@mui/material/styles'
import { radius, typescale } from '@/theme/tokens'

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
 * ★ 정렬 규칙 (2026-07-13 확정, 2026-08-01 재확인) — 셀의 `align` prop 으로만 준다.
 *   긴 본문성 텍스트(제목·내용·행사명) = left / 짧은 값·칩·코드·날짜 = center / 숫자·금액 = right.
 *
 * 구 dataTableHeadSx(`'& th': { textAlign: 'center' }`)는 2026-08-01 삭제했다.
 * 표·행 레벨의 `& th` 선택자는 특이도 (0-1-1)이라 셀 sx (0-1-0)를 항상 이겨서,
 * 개별 헤더에 적어둔 정렬이 화면에 반영되지 않고 조용히 죽었다(공지 작성일 헤더가 실제로 그랬다).
 * 그 탓에 제목·비고 헤더는 `!important` 로 버티고 있었다. 표·행 레벨 textAlign 은 다시 쓰지 말 것.
 */

/** 표 <Table>에 얹는 sx — 행 hover. 나머지(구분선·글자·여백)는 theme MuiTableCell 담당. */
export const dataTableSx = {
  // MUI 기본 action.hover(라이트 rgba(0,0,0,.04)→#F5F5F5)는 대비 1.09에 중성 회색이라
  // 파랑기미 표면들 사이에서 혼자 튀었다. 레거시 .eq-ledger·ListRow와 같은 --row-hover로 통일.
  '& tbody .MuiTableRow-hover:hover': { backgroundColor: 'var(--row-hover)' },
} as const

/**
 * 모바일(≤shell 768) 표 → 세로 카드 변환.
 *
 * 레거시 .rtable(index.css)과 같은 결과를 sx로 구현한 것 — className 을 새로 늘리지 않기 위해서다
 * (레거시 CSS 의존을 걷어내는 중이고, className 은 design-lint 위반 항목이기도 하다).
 * 대표 셀(카드 제목이 될 열)은 <DataCell title> 로 쓰면 data-title="1" 이 붙어 맨 위로 온다.
 */
export const mobileTableCardSx = (th: Theme) => ({
  [th.breakpoints.down('shell')]: {
    display: 'block',
    minWidth: 0,
    '& thead': { display: 'none' },
    '& tbody': { display: 'block' },
    '& tbody tr': {
      display: 'flex', flexDirection: 'column', gap: '5px',
      bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
      borderRadius: `${radius.card}px`, p: '11px 14px', mb: '10px',
    },
    '& tbody td': {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '14px',
      border: 0, p: '2px 0', textAlign: 'left', whiteSpace: 'normal',
    },
    '& tbody td[data-title="1"]': {
      order: -1, justifyContent: 'flex-start', gap: '6px',
      fontSize: typescale.emphasis.size, fontWeight: typescale.cardTitle.weight,
      p: '0 0 6px 0', mb: '3px', borderBottom: '1px solid', borderColor: 'divider',
    },
  },
})
