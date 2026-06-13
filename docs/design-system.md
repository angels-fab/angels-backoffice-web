# ANGELS FAB 포털 — 디자인 시스템

반도체 FAB 연구센터 운영 포털에 맞는 차분하고 전문적인 SaaS Admin 다크 테마.
참고 철학: Linear · Notion · Vercel Dashboard · MUI Admin.

> 목표는 "예쁜 페이지"가 아니라 **일관성 · 재사용성 · 확장성**을 갖춘 유지보수 가능한 UI 시스템이다.

---

## 원칙

1. **색을 하드코딩하지 않는다.** 항상 `theme.palette.*` 또는 `src/theme/tokens.ts`를 통해 참조한다.
2. **MUI 시스템 우선.** 커스텀 CSS보다 `theme`, `sx`, MUI 컴포넌트를 먼저 사용한다.
3. **이모지 아이콘 금지.** 아이콘은 전부 `@mui/icons-material`.
4. **카드 왼쪽 컬러 보더(색 줄) 금지.**
5. **레이아웃 간격 통일.** 페이지마다 다른 여백을 쓰지 않는다(아래 표 참조).

---

## 색 토큰 (`src/theme/tokens.ts`)

### 다크(기본) — STEP 2

| 용도 | 토큰 | 값 |
|------|------|----|
| 페이지 배경 (Background) | `background.default` | `#0F1117` |
| 사이드바 (Surface) | `background.sidebar` | `#131722` |
| 카드/패널 (Card) | `background.paper` | `#161B22` |
| Hover 표면 | `background.elevated` | `#1D2635` |
| 테두리 (Border) | `tokens.border` | `#293244` |
| 구분선 (Divider) | `divider` | `#232C3A` |
| 본문 텍스트 (Primary) | `text.primary` | `#FFFFFF` |
| 보조 텍스트 (Secondary) | `text.secondary` | `#AAB4C3` |
| 흐린 텍스트 (Muted) | `text.disabled` | `#7D8899` |

### 의미 색 (`theme.palette.accent` / status) — 채도 낮춘 SaaS 톤

| 키 | 값 | 의미 |
|----|----|------|
| `blue` | `#5491DA` | primary / info |
| `green` | `#4DA167` | success |
| `amber` | `#D6A23E` | warning |
| `red` | `#E05B54` | error |
| `purple` | `#A98AE0` | 보조 강조 |
| `teal` | `#46B7BE` | 보조 강조 |

라이트 테마는 `lightPalette`로 구조만 정의되어 있고, 토글·마감은 다음 단계에서 완성한다.

### Radius / Hover / Focus

- Radius: Card `12` · Button `10` · Chip `8` · Input `10` (`tokens.radius`)
- Hover(인터랙티브 카드): `translateY(-2px)` + 약한 그림자 `hoverShadow`(glow 금지)
- Focus Ring: 버튼·입력·검색·칩 공통 `0 0 0 3px rgba(84,145,218,.4)` — ThemeProvider가 관리

### 레거시 페이지 색 (`src/index.css :root`)

기존 페이지는 MUI를 쓰지 않으므로 `index.css`의 CSS 변수(`--ink/--ink2/--text/--blue` 등)를 위 토큰과 **동일 값으로 미러링**한다. 정본은 `tokens.ts`이며, 페이지를 디자인 시스템으로 이관하면서 점진 제거한다.

---

## 레이아웃 간격 규칙 (`layout`)

| 항목 | 토큰 | 값 |
|------|------|----|
| Page Header 아래 | `pageHeaderGap` | 24px |
| Filter 영역 아래 | `filterGap` | 24px |
| Content 상단 | `contentGap` | 32px |
| Section 간 | `sectionGap` | 24px |
| Card 내부 padding | `cardPadding` | 24px |
| 콘텐츠 최대 폭 | `maxWidth` | 1280px |

모서리 반경 `radius`: sm 8 / md 12 / lg 16. Drawer 폭: 480~600 (기본 520).

---

## 공통 컴포넌트 (`src/components/ds`)

`import { AppCard, KpiCard, ... } from '@/components/ds'`

쇼케이스: 개발 서버에서 `/#/design-system` (내비 미노출).

### AppCard
모든 카드/패널의 기본 표면.

| Prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `children` | ReactNode | — | 내용 |
| `padding` | number | 24 | 내부 padding(px) |
| `interactive` | boolean | false | hover 떠오름 |
| `onClick` | () => void | — | 클릭(자동 interactive) |
| `sx` | SxProps | — | 추가 스타일 |

규칙: 왼쪽 컬러 보더 금지, padding 24px 통일.

```tsx
<AppCard interactive onClick={() => nav('/equipment')}>…</AppCard>
```

### KpiCard
숫자 중심 KPI (숫자 강조 · 설명 최소 · 아이콘 보조).

| Prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `value` | ReactNode | — | 큰 숫자 |
| `unit` | string | — | 단위(종/대 등) |
| `label` | string | — | 설명 라벨 |
| `sub` | string | — | 보조 정보 |
| `icon` | ReactNode | — | 보조 아이콘 |
| `accentColor` | blue\|green\|amber\|red\|purple\|teal | blue | 강조 색 |
| `onClick` | () => void | — | 클릭 |

```tsx
<KpiCard value={20} unit="종" label="총 도입장비" sub="29대 운영중" icon={<Memory/>} />
```

### PageHeader
페이지 상단 헤더. 아래 여백 24px.

| Prop | 타입 | 설명 |
|------|------|------|
| `title` | string | 제목 |
| `subtitle` | string | 부제 |
| `actions` | ReactNode | 우측 액션 |

### FilterBar
필터 영역 가로 컨테이너. 아래 여백 24px, 좁으면 wrap.

| Prop | 타입 | 설명 |
|------|------|------|
| `children` | ReactNode | 필터 요소들 |
| `trailing` | ReactNode | 우측 끝 요소(검색 등) |

### StatusChip
상태/분류를 일관된 색 규칙으로 표시.

| Prop | 타입 | 설명 |
|------|------|------|
| `status` | success\|info\|warning\|error\|neutral\|purple\|teal | 색 결정 |
| `label` | string | 텍스트 |
| `selected` | boolean | 채워진 스타일(필터 토글) |
| `icon` | ReactNode | 아이콘 |
| `onClick` | () => void | 클릭 |
| `size` | small\|medium | 크기 |

규칙: 색은 `status`로만 결정. hex 직접 지정 금지.

### SectionHeader
페이지 내 섹션 제목 줄(PageHeader보다 작은 위계).

| Prop | 타입 | 설명 |
|------|------|------|
| `title` | string | 제목 |
| `count` | ReactNode | 옆 건수 |
| `actionLabel` | string | 더보기 라벨 |
| `onAction` | () => void | 더보기 클릭 |
| `action` | ReactNode | 임의 우측 액션 |

### AppDrawer
상세 정보용 공통 우측 슬라이드 드로어. Modal보다 우선(명세 5단계).

| Prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `open` | boolean | — | 열림 |
| `onClose` | () => void | — | 닫기 |
| `title` | ReactNode | — | 헤더 제목 |
| `subtitle` | ReactNode | — | 헤더 부제 |
| `children` | ReactNode | — | 본문(스크롤) |
| `footer` | ReactNode | — | 하단 고정 영역 |
| `width` | number | 520 | 폭(480~600 clamp) |

대상: 장비/일정/업무/공지 상세.

### EmptyState
데이터/검색 결과 없음.

| Prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `title` | string | — | 안내 제목 |
| `description` | string | — | 보조 설명 |
| `icon` | ReactNode | InboxOutlined | 아이콘 |
| `action` | ReactNode | — | 액션 |
| `size` | sm\|md | md | 세로 여백 |

### SearchBar
통일된 검색 입력(좌측 검색 아이콘 + 입력 시 지우기 버튼).

| Prop | 타입 | 기본 | 설명 |
|------|------|------|------|
| `value` | string | — | 값 |
| `onChange` | (v:string)=>void | — | 변경 |
| `placeholder` | string | "검색" | 안내 |
| `width` | number\|string | 240 | 폭 |
| `autoFocus` | boolean | — | 자동 포커스 |

---

---

## Layout System (STEP 3)

모든 페이지가 동일한 구조·간격·폭을 쓰도록 하는 레이아웃 컴포넌트. 쇼케이스: `/#/layout-system`.

### 간격 규칙 (`layout` 토큰)

| 항목 | 토큰 | 값 |
|------|------|----|
| Page Top Padding | `pageTop` | 32 |
| Header → 첫 Section | `pageHeaderGap` | 24 |
| Section ↔ Section | `sectionGap` | 24 |
| KPI ↔ KPI | `kpiGap` | 16 |
| Card ↔ Card | `cardGap` | 16 |
| Card 내부 padding | `cardPadding` | 24 |
| Drawer 내부 padding | `drawerPadding` | 24 |
| 좌우 padding | `pageX` / `pageXMobile` | 24 / 16 |

### 폭 규칙

| 페이지 종류 | 토큰 | 값 |
|------|------|----|
| Dashboard / 목록 | `maxWidthWide` | 1400 |
| 상세 | `maxWidthDetail` | 1200 |

### 반응형

`breakpoints`: Mobile `<600` 1열 · Tablet `600~899` 2열 · Desktop `≥900` N열. 모든 공통 컴포넌트 동일 적용.

### 컴포넌트

- **AppLayout** — 최상위 셸. `sidebar` + `children`(메인) + 반응형. 데스크톱 고정 사이드바, 모바일 햄버거+임시 Drawer. props: `sidebar`, `children`, `sidebarWidth`(256), `brand`.
- **PageContainer** — 페이지 공통 컨테이너. 폭(`variant` wide 1400 / detail 1200, 또는 `maxWidth`)·좌우·상단 padding 통일. props: `variant`, `maxWidth`, `disableTop`.
- **ContentSection** — 섹션 단위. 하단 간격 24px, `title`/`description`/`count`/`action` 주면 SectionHeader 동반. `last`로 마지막 섹션 간격 제거.
- **CardGrid** — KPI·카드 반응형 그리드. 간격 16px. `columns`(데스크톱 열 수) 또는 `minColWidth`(auto-fill). Mobile 1열 / Tablet 2열.
- **PageHeader** — `icon` + `title` + `subtitle`/`updatedAt` + `actions`.
- **SectionHeader** — `title` + `description`(선택) + `count`/`action`(선택).

### 기존 페이지 적용 방식 (이관 레시피 — STEP 4+ 적용)

```tsx
// Before: 페이지마다 다른 .page / .dashboard 래퍼 (폭 1180/1320, 여백 제각각)
// After:
export default function SomePage() {
  return (
    <PageContainer>                         {/* 폭·여백 통일 */}
      <PageHeader icon={<Icon/>} title="제목" updatedAt="…" actions={…} />
      <ContentSection title="KPI">
        <CardGrid columns={4}>{kpis}</CardGrid>   {/* KPI 16px */}
      </ContentSection>
      <ContentSection title="목록" last>
        <CardGrid minColWidth={290}>{cards}</CardGrid>
      </ContentSection>
    </PageContainer>
  )
}
```

AppLayout은 셸(현재 MainLayout/SideNav)을 대체할 후보로, 페이지 이관이 진행되며 적용한다.

---

## 적용 로드맵 (페이지 개선 우선순위)

디자인 시스템 구축 후 아래 순서로 페이지를 점진 이관한다(단계별 보고·승인).

1. 홈 대시보드 → 2. 업무현황 → 3. 업무일정(Calendar) → 4. 장비운영관리
→ 5. 장비도입관리 → 6. 공지사항 → 7. 바로가기

각 페이지 이관 시 해당 페이지의 `index.css` 의존 부분을 디자인 시스템 컴포넌트로 대체하고, 사용하지 않게 된 CSS를 제거한다.
