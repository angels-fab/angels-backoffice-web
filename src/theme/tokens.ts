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
  /** Filter 영역 아래 여백 — P1 정규화: 전 페이지 실화면 값(16)으로 확정 */
  filterGap: 16,
  /** Section 간 간격 */
  sectionGap: 24,
  /** KPI 카드 간 간격(CardGrid) */
  kpiGap: 16,
  /** KPI 스트립(꽉 찬 한 줄 타일) 칸 간격 — 실화면 표준 */
  kpiStripGap: 8,
  /** 일반 카드/그리드 간 간격 */
  cardGap: 16,
  /** Card 내부 padding — 기본(lg). 콤팩트 카드가 사실상 표준이라 3단 운용 */
  cardPadding: 24,
  /** Card 내부 padding — 콤팩트(md, 목록·보조 카드 표준) */
  cardPaddingMd: 16,
  /** Card 내부 padding — 최소(sm, 미리보기 타일) */
  cardPaddingSm: 12,
  /** Drawer 내부 padding */
  drawerPadding: 24,
  /** 콘텐츠 최대 폭 — Dashboard / 목록 페이지 */
  maxWidthWide: 1400,
  /** 콘텐츠 최대 폭 — 상세 페이지 */
  maxWidthDetail: 1200,
} as const

/**
 * 반응형 — 2계층 정책 (P1 확정, D2).
 *  ① 셸 분기(사이드바 ↔ 하단탭, 페이지 모드 전환) = 768px — theme.breakpoints의
 *     커스텀 키 'shell'로 주입됨. CSS/미디어쿼리 문자열이 필요하면 shellMq 사용.
 *  ② 콘텐츠 열수(그리드) = MUI 기본 sm 600 / md 900 (CardGrid 등).
 *  769~899px 구간 = "PC 셸 + 태블릿 2열"이 공식 상태.
 */
export const breakpoints = {
  /** 셸(내비) 전환점 — theme.breakpoints.down('shell')과 동일 */
  shell: 768,
  /** 콘텐츠 모바일 상한(= MUI sm) */
  mobileMax: 600,
  /** 콘텐츠 태블릿 상한(= MUI md) */
  tabletMax: 900,
} as const

/** 셸 분기 미디어쿼리 문자열 — useMediaQuery(shellMq)로 사용(문자열 산재 금지) */
export const shellMq = `(max-width:${breakpoints.shell}px)` as const

/** 모바일 터치 타겟 최소 높이(px) — 시각 크기 유지 시 히트영역 padding으로 확보 */
export const touchTarget = 44 as const

/**
 * 모서리 반경 — 6단 정본 스케일 (P1 확정, docs/design-system-decisions.md B#5).
 * 이 6개 밖의 값 금지. sx 숫자 borderRadius(1/2/3…)는 12배수 함정이 있으므로
 * 항상 이 토큰 또는 px 문자열로 지정한다.
 */
export const radius = {
  /** 칩·작은 라벨 */
  chip: 8,
  /** 버튼·입력 등 컨트롤 */
  button: 10,
  input: 10,
  /** 카드·패널·팝오버 */
  card: 12,
  /** 다이얼로그·모달·바텀시트 */
  modal: 16,
  /** 알약형(배지·페이저) */
  pill: 999,
  /** 원형(아바타·dot) */
  circle: '50%',
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

/**
 * 그림자 — 3단 엘리베이션 (P1 확정, B#2). 현 코드 최빈값을 승격, 이 밖의 리터럴 금지.
 *  sm = 카드 hover / md = 팝오버·컨텍스트메뉴 / lg = 모달·드래그 고스트·바텀시트.
 * focusRing(파란 링)은 그림자 스케일과 별개 축(theme.ts 관리).
 */
export const shadow = {
  sm: '0 2px 10px rgba(0,0,0,.22)',
  md: '0 8px 24px rgba(0,0,0,.3)',
  lg: '0 20px 50px rgba(0,0,0,.48)',
} as const

/** @deprecated shadow.sm 사용 (호환 유지용 별칭) */
export const hoverShadow = shadow.sm

/**
 * 모션 — duration 3단 + easing 2종 (P1 확정, B#1). 이 밖의 지속시간·곡선 금지.
 *  fast = 배경/보더 등 미세 피드백 / base = hover·일반 전환 / slow = 패널 열림·강조.
 *  spring = 드래그 복귀·카드 이동(기존 3중 정의 통합본). prefers-reduced-motion 필수 대응.
 */
export const motion = {
  fast: '0.12s',
  base: '0.15s',
  slow: '0.2s',
  ease: 'ease',
  spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const

/**
 * 타이포 정본 사다리 — 8단 (P1 확정, D1). px/weight. 이 밖의 크기 금지.
 * 잡값 스냅 규칙: 10.5→11 · 11.5→12 · 12.5→13 · 13.5→14 (역할이 캡션이면 한 단계 아래 허용).
 * MUI variant 매핑: caption=caption · small=small(커스텀) · body=body2 · emphasis=subtitle1
 *  · cardTitle=h4 · sectionTitle=h3 · pageTitle=h2 · display=h1. sx fontSize 숫자 금지.
 */
export const typescale = {
  /** 타임스탬프·캡션 */
  caption: { size: 11, weight: 500 },
  /** 표 본문·메타 */
  small: { size: 12, weight: 400 },
  /** 기본 본문 */
  body: { size: 13, weight: 400 },
  /** 강조 본문·행 제목 */
  emphasis: { size: 14, weight: 600 },
  /** 카드 제목 */
  cardTitle: { size: 16, weight: 700 },
  /** 섹션 제목 */
  sectionTitle: { size: 18, weight: 700 },
  /** 페이지 제목 */
  pageTitle: { size: 22, weight: 800 },
  /** 대형 숫자·KPI */
  display: { size: 28, weight: 800 },
} as const

/**
 * 아이콘 크기 4단 (P1 확정, B#8) — sx fontSize에 이 값만 사용. 17·19 등 중간값 스냅.
 */
export const iconSize = {
  caption: 13,
  body: 16,
  action: 18,
  header: 20,
} as const

/**
 * 상태 의미색 전역 배정표 (P1 확정, D3 — 사용자 지정 2026-07-12).
 * 값은 ds/StatusChip의 StatusKind. 어느 페이지에서나 같은 의미 = 같은 색.
 *  유의: '예정'과 '종료'가 공존하는 화면(Events)은 종료를 더 흐린 비활성 회색으로 구분.
 *  보조 도메인 상태(도입중 등)는 핵심 5의미와 충돌하지 않는 한 teal/purple 허용.
 */
export const statusMeaning = {
  /** 진행중·활성 */
  active: 'success',
  /** 완료·처리됨 */
  done: 'info',
  /** 예정·대기 */
  planned: 'neutral',
  /** 보류 */
  hold: 'warning',
  /** 지연·불가·오류 */
  blocked: 'error',
} as const
