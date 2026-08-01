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

/**
 * 다크 테마 표면(背) 색.
 *
 * 표면 램프 규칙(2026-07-25 확정): 다크에서 깊이는 그림자가 아니라 "표면 밝기"가 만든다.
 * 인접 단계 명도대비(CR) ≥1.15, 페이지→카드 ≥1.2를 만족해야 한다 — 안 그러면 카드가
 * 배경과 같은 색으로 보여 1px 보더 혼자 깊이를 떠받치게 된다(구 값 bg→paper 1.09 = 사실상 동색.
 * 그래서 KpiSection·RoadmapCard가 다크 전용 hex를 손으로 만들어 썼음).
 * 값 변경 시 이 위에 얹히는 텍스트·강조색이 4.5:1을 유지하는지 반드시 재계산할 것.
 */
export const darkPalette = {
  /** 페이지 전체 배경 (Background) */
  background: '#0F1117',
  /** 사이드바·입력 등 한 단계 표면 (Surface) */
  surface: '#161C26',
  /** 카드/패널 (Card) — bg 대비 1.21:1 */
  paper: '#1C2430',
  /** hover 시 떠오르는 표면 (Hover Surface) — paper 대비 1.17:1 */
  hover: '#26303E',
  /** 카드/입력 테두리 (Border) — 카드가 밝아진 만큼 함께 상향 */
  border: '#32405A',
  /** 구분선 (Divider) — Border보다 옅음 */
  divider: '#2A3546',
  /** 본문 텍스트 (Primary) */
  text: '#FFFFFF',
  /** 보조 텍스트 (Secondary) */
  textSecondary: '#AAB4C3',
  /** 흐린 텍스트 (Muted) — 상향(구 #7D8899는 떠오른/호버 표면 #1D2635 위 4.24:1 미달) → 전 표면 5.5:1+ */
  textMuted: '#909CAE',
  /** 툴팁 표면 — 배경/글자를 짝으로 고정(MUI 기본 전경=흰색에 맡기면 라이트에서 흰글씨/흰배경). 흰 글씨 13.3:1 */
  tooltip: '#26303E',
  tooltipText: '#FFFFFF',
} as const

/**
 * 라이트 테마 표면.
 * 라이트는 다크와 반대로 깊이를 "그림자"가 만든다(업계 관행 — Minimal 등 상용 템플릿 동일):
 * 페이지는 오프화이트, 카드는 순백 + 부드러운 그림자. 보더는 옅게 두고 경계는 그림자가 담당.
 */
export const lightPalette = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  paper: '#FFFFFF',
  hover: '#F0F3F7',
  border: '#E3E8EF',
  divider: '#EDF0F4',
  text: '#1A1D23',
  // 보조 — 틴트 칩·날짜 배지 위(가장 불리한 조건)에서도 4.5:1을 넘도록 한 단 진하게(구 #5A6472는 4.25로 미달)
  textSecondary: '#555E6B',
  // muted — 구 #8A93A2는 2.9:1 미달. 흰 카드가 아니라 페이지 배경(#F4F6F8) 위에서도 4.5:1 여유가 있게(4.97:1)
  textMuted: '#5E6C7A',
  // 툴팁은 라이트에서도 '어두운 표면 + 흰 글씨'(웹 관행·MUI 기본 룩). 흰 글씨 12.6:1
  // hover(#F0F3F7)를 쓰면 흰 글씨와 1.06:1이 되어 글자가 사라진다 — 배경/글자는 반드시 짝으로.
  tooltip: '#2A3441',
  tooltipText: '#FFFFFF',
} as const

/**
 * 미지정·분류없음의 중립 **채움**색 (2026-08-02 신설).
 * 점·아바타 배경·칩 배경처럼 "색을 정할 수 없을 때" 쓰는 폴백 하나. 글자에는 쓰지 말 것(textMuted).
 *
 * 전에는 같은 역할이 다섯 군데에 제각각이었다 — #888 두 곳(외부 참석자·분류없음),
 * #8a8f98(아바타), #4b5563(캘린더 '전체'), #7D8899(캘린더 '기타').
 * 특히 #7D8899 는 대비 미달로 폐기된 **옛 textMuted** 값이 남아 있던 것이다.
 *
 * 값 선정: 정적 상수(CAL_CATS 등)에서도 쓰므로 테마 분기가 불가능 → 라이트·다크 표면 모두에서
 * 3:1(WCAG 1.4.11 그래픽 최소)을 넘는 한 값으로 잡았다.
 *   흰 카드 3.59:1 · 라이트 배경 3.31:1 · 다크 카드 4.36:1 · 다크 배경 5.26:1
 */
export const neutralFill = '#7D8899' as const

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
  rose: '#D87CA6', // 연차/휴가 — domain.calendar.leave 와 같은 값(글자용 짝 accentText.rose 를 두려고 fill 도 등록)
} as const

/**
 * 강조색 "글자용" 변형 (fill/text 2계층).
 *
 * 위 accent는 **채움(fill)** 전용 — 점·솔리드칩·아이콘·프로그레스·보더.
 * 같은 색을 **글자(text)** 로 쓰면 배경에 따라 대비가 무너지므로 테마별 글자값을 따로 둔다.
 * 소비는 theme.palette.accentText(테마가 자동 선택) 한 경로로만 — 컴포넌트에서 직접 분기 금지.
 */
/**
 * 흰 배경/옅은 틴트 위 글자 — accent 원색은 2.3~3.6:1이라 미달, 이 진한 값으로.
 * 기준은 "흰 카드"가 아니라 **페이지 배경(#F4F6F8) 위 12% 틴트칩**(더 불리한 쪽)에서 4.5:1 — 실측 검증.
 */
export const accentTextLight = {
  blue: '#225BB4',
  green: '#196533',
  amber: '#7F5B00',
  red: '#A82B26',
  purple: '#653FB1',
  teal: '#0D6369',
  rose: '#A6386B', // 22% 틴트 알약 위 4.58:1 · 달력칩 18% 틴트 위 5.20:1
} as const
/**
 * 다크 표면 위 글자 — accent 원색을 그대로 글자로 쓰면 "떠오른 표면 위 12% 틴트칩"(가장 불리한 조건)에서
 * 3.4~4.1:1로 미달한다. 그 조건에서도 4.5:1을 넘도록 한 단 밝힌 값(실측 4.66~5.55).
 */
export const accentTextDark = {
  blue: '#79AEF2',
  green: '#6FC98A',
  amber: '#E0B155',
  red: '#F5837C',
  purple: '#B79BE8',
  teal: '#5CC8CF',
  rose: '#E9A8C4', // 다크 22% 틴트 알약 위 4.94:1
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
  /** PageHeader 제목 줄 높이 — 아이콘 배지(40)·액션 버튼(control.height 36)과 중심선을 맞추는 기준 */
  headerRowHeight: 40,
  /** 섹션 제목 줄 아래 여백(제목 → 섹션 내용) — 실측 전 페이지 12px 일치, SectionHeader 가 정본 */
  sectionTitleGap: 12,
  /** Filter 영역 아래 여백 — P1 정규화: 전 페이지 실화면 값(16)으로 확정 */
  filterGap: 16,
  /** Section 간 간격 */
  sectionGap: 24,
  /** KPI 스트립(꽉 찬 한 줄 타일) 칸 간격 — 실화면 표준.
   *  ★ Work KpiSection의 모바일 값(26px)은 이탈이 아니다 — 타일 아래로 14px 튀어나오는
   *  '부서장 확인' 칩(KpiSection.tsx:216)을 피하려고 잡은 값이라, 8로 내리면 칩이 겹친다. */
  kpiStripGap: 8,
  /** 일반 카드/그리드 간 간격 */
  cardGap: 16,
  /** 세로로 쌓는 카드 목록의 카드 간 간격 */
  listCardGap: 8,
  /** Card 내부 padding — 기본 16 (사용자 확정 2026-07-13: 콤팩트가 표준) */
  cardPadding: 16,
  /** Card 내부 padding — 최소 12 (미리보기 타일). 목록 카드는 0 */
  cardPaddingSm: 12,
  /** Drawer·바텀시트 내부 padding — 실화면 값(16). 구 24는 실사용처가 없던 오기 */
  drawerPadding: 16,
  /** 콘텐츠 최대 폭 — Dashboard / 목록 페이지 */
  maxWidthWide: 1400,
  /** 콘텐츠 최대 폭 — 상세 페이지 */
  maxWidthDetail: 1200,
  /** 콘텐츠 최대 폭 — 울트라(사진 중심 화면 한정, 2026-07-24 데모결과 적용). 새 사용처는 사진·간트처럼
   *  넓을수록 정보가 커지는 화면만 — 텍스트 위주 화면에 쓰면 줄 길이가 길어져 가독성이 나빠진다. */
  maxWidthUltra: 1680,
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
/**
 * 겹침 순서 사다리 (2026-08-01 신설). **현재 화면의 값을 그대로 이름만 붙인 것**이다 —
 * 순서를 바꾸면 겹침이 어긋나는데 모든 조합을 확인할 방법이 없어, 재배치는 별건으로 둔다.
 *
 * 남의 층과 부딪히는 지점(이름을 보고 판단하라는 뜻에서 남긴다):
 *   MUI 기본  — appBar 1100 · drawer 1200 · modal 1300 · snackbar 1400 · tooltip 1500
 *   FullCalendar — '+N건' more-link 팝오버 9999
 * 그래서 dragTip(2000)·pendingConfirm(2100)은 MUI 모달보다 **위**에 있고,
 * calendarPopover(10000)는 FullCalendar 팝오버를 넘기 위한 값이다. 둘 다 의도된 예외.
 *
 * 0~9 는 컴포넌트 안 지역 쌓임(간트 막대·로드맵 선 등)이라 토큰을 쓰지 않는다.
 */
export const z = {
  /** 레이아웃 내부 레이어(AppLayout) */
  layer: 10,
  /** 스크롤 중 붙는 페이지 내부 요소(업무 KPI) */
  sticky: 30,
  /** 상단바 — 사이드바보다 아래로 미끄러져 들어간다 */
  topbar: 50,
  /** 모바일 하단 탭바 — 상단바(50)와 화면 하단 고정 바(60) 사이 */
  bottomNav: 55,
  /** 화면 하단 고정 바(업무 선택 액션) */
  bottomBar: 60,
  /** PC 사이드바 — 페이지 콘텐츠(최대 sticky 30) 위, MUI 모달 아래 */
  sidenav: 100,
  /** 우측 상세 패널(행사 종료 상세) — MUI drawer 와 같은 층 */
  sidePanel: 1200,
  /** 드래그 중 따라다니는 안내 — 모달 위에 떠야 한다 */
  dragTip: 2000,
  /** 포인터 근처 확인 UI(장비 일정 변경) — dragTip 바로 위 */
  pendingConfirm: 2100,
  /** 캘린더 일정 팝오버 — FullCalendar 자체 팝오버(9999) 위 */
  calendarPopover: 10000,
} as const

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
/**
 * 표 셀 규격 (2026-08-01 확정). 소비는 theme.ts 의 MuiTableCell 오버라이드 한 곳.
 * 레거시 .eq-ledger(index.css:793/795)와 같은 값 — 마크업 이관이 끝날 때까지 두 구현이 공존한다.
 */
export const table = {
  /** 셀 상하 padding — 장비 3표의 실화면 값(8). 공지·개선은 MUI 기본 6이 노출돼 있던 것 */
  cellPadY: 8,
  /** 셀 좌우 padding */
  cellPadX: 16,
} as const

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
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
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
 *
 * ★ 제목에 body2/small/caption/subtitle2 금지 — 이 네 variant는 theme.ts에서 color: textSecondary를
 *   함께 박아 둔다(본문·메타 전용). '13px이 필요해서' body2를 고르고 fontWeight만 600으로 올리면
 *   "굵지만 흐린 제목"이 된다(실측 라이트 5.1:1 vs 정상 13.1:1). 제목은 emphasis(subtitle1) 또는
 *   body2 + color:'text.primary' 명시.
 */
/**
 * 굵기 사다리 (2026-08-01 신설) — 크기와 분리한다.
 *
 * typescale 은 "역할 = 크기+굵기 한 벌"이라, 굵기만 필요할 때 쓰면 이름이 거짓말이 된다
 * (12px 글자에 typescale.cardTitle.weight(700)를 쓰는 식). 굵기만 쓸 자리는 이걸 쓴다.
 *
 * 특히 medium(500)은 typescale 어느 칸에도 크기와 짝지어 있지 않은데 실화면에서는
 * '행 식별자'(표의 장비명·공지 제목·행사명)가 전부 14/500이라 손코딩이 20곳 생겨 있었다.
 */
export const weight = {
  /** 본문 */
  regular: 400,
  /** 행 식별자·코드셀 — 본문보다 한 단만 또렷하게 */
  medium: 500,
  /** 라벨·표 헤더·강조 본문 */
  semibold: 600,
  /** 카드/섹션 제목 */
  bold: 700,
  /** 페이지 제목·대형 숫자 */
  heavy: 800,
} as const

export const typescale = {
  /** 타임스탬프·캡션 */
  caption: { size: 11, weight: 500 },
  /** 메타·셀 부제 (표 본문은 body 13 — 2026-08-01 상향) */
  small: { size: 12, weight: 400 },
  /** 기본 본문 · 표 본문 셀 */
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
/**
 * 컨트롤 높이 정본 — 헤더·툴바에서 나란히 놓이는 버튼과 입력이 같은 높이를 갖게 한다.
 * 예전엔 MUI 기본값을 그대로 써서 Button(small) 30px · TextField(small) 37px로 7px 어긋났고,
 * 검색창 옆 '새 공지·장비 추가' 버튼이 낮아 짝이 안 맞아 보였다(사용자 지적 2026-07-26).
 */
export const control = { height: 36 } as const

export const iconSize = {
  caption: 13,
  body: 16,
  action: 18,
  header: 20,
} as const

/**
 * 도메인 색 그룹 (P1-2, D5-1 승격 — 값 무변경 이동, 화면 무변화).
 * accent 6색 밖에서 규칙화된 색의 유일한 서식지. 여기 없는 새 색 추가 금지
 * (필요하면 accent 재사용 검토 → 그래도 필요할 때만 이 그룹에 등록).
 * ※ Events 3색·로드맵 색은 D5-2(accent 통합 A/B 시안)·D3(상태색) 승인 결과에 따라
 *   "이 토큰의 값"만 바뀔 수 있음 — 소비처는 무수정.
 * ※ 형광펜(--hl-*)·에디터색(--ec-*)은 CSS 전용이라 index.css :root가 서식지(P4 재배치).
 */
export const domain = {
  /** 행사(Events) — 분류칩·사이트 버튼 (D5-2 확정: accent 통합 — 팔레트 1계열화) */
  events: {
    /** 분류칩: 학술 */
    academic: accent.blue,
    /** 분류칩: 교육 */
    education: accent.green,
    /** 분류칩: 전시 */
    exhibition: accent.purple,
    /** 하단 '행사 사이트' 버튼 */
    link: accent.blue,
    /** 포스터 없는 카드 배경 그라데이션(EventAccent별) */
    grad: {
      blue: 'linear-gradient(150deg,#1e3a6b,#2f5fa6 60%,#3f7bd0)',
      teal: 'linear-gradient(150deg,#0f3f3a,#15756b 60%,#1fa192)',
      green: 'linear-gradient(150deg,#1c4a2f,#2f7d4d 60%,#4da167)',
      purple: 'linear-gradient(150deg,#332a6b,#5a4bb0 60%,#9b8cff)',
      amber: 'linear-gradient(150deg,#5b4410,#9a7420 60%,#d6a23e)',
      red: 'linear-gradient(150deg,#5b1f1c,#a23a34 60%,#e05b54)',
    },
  },
  /** 홈 FAB 로드맵 — 상태 대표색(시안 팔레트 내 D3 맞교환: 완료=파랑·진행중=그린). 카드 크롬은 P3 */
  roadmap: {
    done: '#4f8bff',
    current: '#35d39a',
    plan: '#9fb0c4',
  },
  /** 업무(Work) — 담당자 채움 칩(고정 4인 + 해시 fallback) · 카드 상태톤(rgb 트리플릿) */
  manager: {
    // 솔리드 칩에 흰 글자를 얹으므로 모든 색이 흰 글자 4.5:1 이상이어야 한다(구 값은 센터·조성범·박세리가 3.8~4.1로 미달).
    fixed: {
      센터: '#177A7A',
      박주봉: '#2f6db8',
      조성범: '#277A42',
      박세리: '#8F6316',
      신현진: '#6f5fb0',
    } as Record<string, string>,
    palette: ['#b8557e', '#177A7A', '#AC4E2A', '#667325', '#5a6cc0', '#a04ab0'],
    unknown: '#5f6b7e',
  },
  /** Work 카드 상태톤 — 'R G B' 트리플릿(알파 사다리용). D3 적용 배정:
   *  green=진행중 · blue=완료 · amber=보류 · purple=Remind(플래그) · gray=예비 */
  workTone: {
    green: '114 199 141',
    blue: '121 169 226',
    gray: '194 202 213',
    amber: '224 188 116',
    purple: '169 138 224',
  },
  /** 일정(Calendar) — 연차 로즈핑크(accent에 없는 도메인 색) */
  calendar: {
    leave: '#D87CA6',
  },
} as const

/**
 * 담당자(사람) → 색 단일 진실 공급원. Work(mgrColor)·Calendar(members)가 모두 이 함수로
 * 색을 얻어 "같은 사람 = 같은 색"을 보장한다(예전엔 Work=domain·Calendar=accent로 어긋났음).
 * 지정 담당자=고정색 / 미지정(빈값)=unknown 회색 / 그 외=이름 해시 자동배정(솔리드 칩 흰글자 대비 고려).
 */
export function managerColor(name: string): string {
  const s = (name || '').trim()
  if (!s) return domain.manager.unknown
  const fixed = domain.manager.fixed[s]
  if (fixed) return fixed
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return domain.manager.palette[h % domain.manager.palette.length]
}

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
  /** 임박(D-N 카운트다운) — 단순 예정과 구분되는 마감 임박 신호 (사용자 확정 2026-07-12) */
  imminent: 'warning',
  /** 보류 */
  hold: 'warning',
  /** 지연·불가·오류 */
  blocked: 'error',
} as const
