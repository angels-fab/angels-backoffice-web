/**
 * 디자인 토큰 — 색·간격·반경의 단일 진실 공급원(Single Source of Truth).
 *
 * 페이지/컴포넌트에서 색을 하드코딩하지 않는다. 항상 이 토큰 또는
 * MUI 테마(theme.palette.*, theme.spacing)를 거쳐 참조한다.
 *
 * 색 팔레트 방향: "반도체 FAB 연구센터 운영 포털"에 맞는
 * 차분하고 전문적인 SaaS 다크 테마 (Linear / Vercel / Notion Dark / MUI Dashboard).
 * 상태색은 네온이 아니라 채도를 낮춘 SaaS 톤을 쓴다.
 *
 * 참고: 기존 페이지는 src/index.css의 CSS 변수를 쓰므로, 같은 값을 그쪽에도
 * 미러링한다(tokens.ts가 정본, index.css는 레거시 페이지용 거울 — 페이지 이관 시 제거).
 */

/** 다크 테마 표면(背) 색 — 명세 2단계(STEP 2) 기준 */
export const darkPalette = {
  /** 페이지 전체 배경 (Background) */
  background: '#0F1117',
  /** 사이드바 등 한 단계 표면 (Surface) */
  surface: '#131722',
  /** 카드/패널 (Card) */
  paper: '#161B22',
  /** hover 시 떠오르는 표면 (Hover Surface) */
  hover: '#1D2635',
  /** 카드/입력 테두리 (Border) */
  border: '#293244',
  /** 구분선 (Divider) — Border보다 옅음 */
  divider: '#232C3A',
  /** 본문 텍스트 (Primary) */
  text: '#FFFFFF',
  /** 보조 텍스트 (Secondary) */
  textSecondary: '#AAB4C3',
  /** 흐린 텍스트 (Muted) */
  textMuted: '#7D8899',
} as const

/** 라이트 테마(추후 지원) — 구조만 먼저 정의 */
export const lightPalette = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  paper: '#FFFFFF',
  hover: '#F0F3F7',
  border: '#E3E8EF',
  divider: '#EDF0F4',
  text: '#1A1D23',
  textSecondary: '#5A6472',
  textMuted: '#8A93A2',
} as const

/**
 * 의미 색(semantic) — 채도를 낮춘 SaaS 톤. 상태·강조에 사용.
 * 과도한 노랑/빨강/파랑(네온) 금지.
 */
export const accent = {
  blue: '#5491DA', // primary / info — 차분한 SaaS 블루
  green: '#4DA167', // success — 채도 낮춘 그린
  amber: '#D6A23E', // warning — 네온 옐로 대신 골드 톤
  red: '#E05B54', // error — 부드러운 레드
  purple: '#A98AE0', // 보조 강조
  teal: '#46B7BE', // 보조 강조
} as const

/**
 * 레이아웃 간격·폭 규칙(STEP 3) — 모든 페이지 공통.
 * px 단위. 페이지마다 다른 여백/폭을 쓰지 않는다.
 *
 * 간격 규칙
 *  - Page Top Padding ............ 32
 *  - Header → 첫 Section ......... 24
 *  - Section ↔ Section ........... 24
 *  - KPI ↔ KPI ................... 16
 *  - Card ↔ Card ................. 16
 *  - Card 내부 Padding ........... 24
 *  - Drawer 내부 Padding ......... 24
 * 폭 규칙
 *  - Dashboard / 목록 페이지 ..... 1400
 *  - 상세 페이지 ................. 1200
 */
export const layout = {
  /** 페이지 상단 padding */
  pageTop: 32,
  /** 페이지 하단 padding */
  pageBottom: 60,
  /** 페이지 좌우 padding (데스크톱) */
  pageX: 24,
  /** 페이지 좌우 padding (모바일) */
  pageXMobile: 16,
  /** PageHeader 아래(= Header → 첫 Section) 여백 */
  pageHeaderGap: 24,
  /** Filter 영역 아래 여백 */
  filterGap: 24,
  /** Section 간 간격 */
  sectionGap: 24,
  /** KPI 카드 간 간격 */
  kpiGap: 16,
  /** 일반 카드/그리드 간 간격 */
  cardGap: 16,
  /** Card 내부 padding */
  cardPadding: 24,
  /** Drawer 내부 padding */
  drawerPadding: 24,
  /** 콘텐츠 최대 폭 — Dashboard / 목록 페이지 */
  maxWidthWide: 1400,
  /** 콘텐츠 최대 폭 — 상세 페이지 */
  maxWidthDetail: 1200,
} as const

/**
 * 반응형 분기 기준(STEP 3).
 * Desktop 1400 기준 / Tablet 2열 / Mobile 1열.
 * MUI breakpoints: xs<600(mobile) · sm 600~899(tablet,2열) · md≥900(desktop).
 */
export const breakpoints = {
  mobileMax: 600,
  tabletMax: 900,
} as const

/**
 * 컴포넌트별 모서리 반경(명세 2단계 Radius 규칙).
 * Card 12 / Button 10 / Chip 8 / Input 10.
 */
export const radius = {
  card: 12,
  button: 10,
  chip: 8,
  input: 10,
} as const

/** Drawer 규격(명세 5단계) */
export const drawer = {
  minWidth: 480,
  maxWidth: 600,
  defaultWidth: 520,
} as const

/**
 * 리스트 행(ListRow) 간격 — 목록·표 행의 단일 기준.
 * 페이지마다 gap 7/8/12px·padding 제각각으로 손코딩하지 말 것(→ ds/ListRow 사용).
 */
export const row = {
  /** leading ↔ 내용 ↔ trailing 사이 간격 */
  gap: 10,
  /** 행 좌우 padding */
  padX: 16,
  /** 행 상하 padding(기본) */
  padY: 12,
  /** 행 상하 padding(dense — 미리보기·조밀 목록) */
  padYDense: 8,
  /** 제목 ↔ 제목옆요소(담당자 칩 등) 간격 */
  titleGap: 6,
} as const

/** 약한 hover 그림자(과도한 glow 금지) */
export const hoverShadow = '0 2px 10px rgba(0,0,0,.22)'
