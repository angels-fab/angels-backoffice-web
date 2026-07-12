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

## 🧭 새 메뉴/페이지를 만들 때 (필독)

> 새 화면은 **처음부터 이 시스템으로** 만든다. `index.css`에 새 클래스를 추가하거나, `sx`에 hex 색·px 폰트를 직접 박는 순간 포털 전체 일관성이 깨진다.

### 무엇이 필요하면 → 무엇을 쓰나 (결정표)

| 필요한 것 | 써야 할 것 | 쓰면 안 되는 것 |
|-----------|-----------|----------------|
| 페이지 전체 골격(폭·여백) | `PageContainer` + `PageHeader` | `.page` / `.dashboard` 새 래퍼, 폭·padding 직접 지정 |
| 페이지 안 구획 | `ContentSection`(+`SectionHeader`) | `<h2>`+margin 직접 |
| 카드·패널 표면 | `AppCard` | `.card` / `.dash-panel` / `bgcolor+border` 손코딩 |
| KPI 숫자 타일 | `KpiCard` / `StatTile` | `.kpi-card` 손코딩 |
| 카드/KPI 반응형 배치 | `CardGrid` | `display:grid` + gridTemplate 직접 |
| **목록·표의 한 행** | **`ListRow`** | `.notice-list`/`.task-item`/`.equip-list` 등 손코딩 행 |
| 상태·분류 라벨(작은 칩) | `StatusChip`(onClick 없이) | `.badge-type`/`.task-badge`/`.eq-badge`/`.hdr-badge` |
| 필터 토글 칩 | `StatusChip`(`selected`+`onClick`) | 커스텀 토글 버튼 |
| 필터 영역 가로줄 | `FilterBar` | 손코딩 flex 바 |
| 검색 입력 | `SearchBar` | 손코딩 TextField+아이콘 |
| 상세(우측 슬라이드) | `AppDrawer` | `Dialog`/`Modal` (특별한 이유 없으면) |
| 데이터/검색 결과 없음 | `EmptyState` | "없습니다" 텍스트 손코딩 |
| 색 | `theme.palette.*` / `accent.*` / 토큰 | hex 직접(`#5491DA` 등) |
| 간격·폭·반경 | `layout` / `row` / `radius` 토큰 | 매직넘버 px |
| 아이콘 | `@mui/icons-material` 개별 import | 이모지, 텍스트 화살표(◀▶) |

### 금지 목록 (하면 리뷰에서 되돌림)

- ❌ `sx`/`style`에 **hex 색** 직접 (`#RRGGBB`) — 토큰/`theme.palette` 경유
- ❌ `sx`에 **하드코딩 `fontSize` 숫자** — `variant="h4|body2|caption"` 등 타이포 위계 사용
- ❌ **매직넘버 간격/폭** — `layout`/`row` 토큰 사용
- ❌ **`index.css`에 새 클래스 추가** — 새 화면은 CSS 파일을 건드리지 않는다
- ❌ 카드 **왼쪽 컬러 보더(색 줄)**
- ❌ **이모지·텍스트 화살표** 아이콘

### 새 메뉴 스타터 (복사해서 시작)

```tsx
import { PageContainer, PageHeader, ContentSection, CardGrid, AppCard, ListRow, StatusChip, EmptyState } from '@/components/ds'

export default function NewMenuPage() {
  return (
    <PageContainer>                                   {/* 폭·좌우·상단 여백 통일 */}
      <PageHeader icon={<SomeIcon />} title="새 메뉴" subtitle="한 줄 설명" actions={/* 버튼 */} />

      <ContentSection title="요약">
        <CardGrid columns={4}>{/* <KpiCard .../> ... */}</CardGrid>
      </ContentSection>

      <ContentSection title="목록" count={items.length} last>
        {items.length === 0 ? (
          <AppCard padding={0}><EmptyState title="항목이 없습니다" /></AppCard>
        ) : (
          <AppCard padding={0}>
            {items.map((it, i) => (
              <ListRow
                key={it.id}
                leading={<StatusChip status={it.tone} label={it.cat} />}
                title={it.title}
                subtitle={it.meta}
                trailing={<StatusChip status="neutral" label={it.owner} />}
                divider={i < items.length - 1}
                onClick={() => open(it)}
              />
            ))}
          </AppCard>
        )}
      </ContentSection>
    </PageContainer>
  )
}
```

### 셀프 체크리스트 (PR/커밋 전)

- [ ] `PageContainer`+`PageHeader`로 골격을 잡았다
- [ ] 카드=`AppCard`, 목록 행=`ListRow`, 라벨=`StatusChip`을 썼다 (손코딩 X)
- [ ] `sx`에 hex 색·`fontSize` 숫자·매직넘버 px가 없다 (토큰/타이포 위계)
- [ ] `index.css`에 새 클래스를 추가하지 않았다
- [ ] 아이콘은 `@mui/icons-material` (이모지·텍스트 화살표 X)
- [ ] `npm run design-lint` 로 **새 파일 위반 0** 확인
- [ ] `npm run type-check` 통과

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

- Radius **6단**(`tokens.radius`, P1 확정): Chip `8` · Control(Button/Input) `10` · Card `12` · **Modal `16`** · Pill `999` · Circle `50%` — 이 밖의 값 금지, sx 숫자 배수(borderRadius:3=36px) 함정 주의
- Hover(인터랙티브 카드): `translateY(-2px)` + `shadow.sm`(glow 금지)
- Focus Ring: 버튼·입력·검색·칩 공통 `0 0 0 3px rgba(84,145,218,.4)` — ThemeProvider가 관리. 커스텀 클릭 요소도 이 링으로 통일(P2 focusRingSx)

### 레거시 페이지 색 (`src/index.css :root`)

기존 페이지는 MUI를 쓰지 않으므로 `index.css`의 CSS 변수(`--ink/--ink2/--text/--blue` 등)를 위 토큰과 **동일 값으로 미러링**한다. 정본은 `tokens.ts`이며, 페이지를 디자인 시스템으로 이관하면서 점진 제거한다.

---

## ★ 정본 스케일 (P1 확정 — 2026-07-12, docs/design-system-decisions.md)

> 아래 값 밖의 크기·색·간격·그림자·모션은 금지. `npm run design-lint`가 hex·fontSize·fontWeight·borderRadius·boxShadow·zIndex·className 7종을 탐지한다.

### 타이포 사다리 8단 (`tokens.typescale` ↔ MUI variant)

| 슬롯 | px/weight | variant | 용도 |
|------|-----------|---------|------|
| caption | 11 / 500 | `caption` | 타임스탬프·캡션 |
| small | 12 / 400 | `small`(커스텀) | 표 본문·메타 |
| body | 13 / 400 | `body2` | 기본 본문 |
| emphasis | 14 / 600 | `subtitle1` | 강조 본문·행 제목 |
| **카드 제목** | 16 / 700 | `h4` | 카드·패널 제목 |
| **섹션 제목** | 18 / 700 | `h3` | 페이지 내 구획 제목 |
| **페이지 제목** | 22 / 800 | `h2` | PageHeader |
| display | 28 / 800 | `h1` | 대형 숫자·KPI |

잡값 스냅: 10.5→11 · 11.5→12 · 12.5→13 · 13.5→14. `sx`에 fontSize/fontWeight 숫자 금지.

### 간격 (4px 그리드) · 폭

| 항목 | 토큰 | 값 |
|------|------|----|
| Page Header 아래 | `pageHeaderGap` | 24 |
| Filter 영역 아래 | `filterGap` | **16** (P1 정규화) |
| Section 간 | `sectionGap` | 24 |
| KPI 그리드 / KPI 스트립 | `kpiGap` / `kpiStripGap` | 16 / 8 |
| Card padding 3단 | `cardPaddingSm/Md/(기본)` | 12 / 16 / 24 |
| 목록 행 | `row.padY(Dense)/padX` | 12(8) / 16 |
| 콘텐츠 최대 폭 | `maxWidthWide` / `maxWidthDetail` | 1400 / 1200 |

### 모션 (`tokens.motion`) · 그림자 (`tokens.shadow`) · z-index

- duration: fast `.12s`(배경·보더 피드백) / base `.15s`(hover·일반) / slow `.2s`(패널 열림) — 이 3값만
- easing: `ease` 기본 + `spring`(cubic-bezier(0.22,1,0.36,1)) 드래그·카드 이동 — `prefers-reduced-motion` 필수 대응
- 그림자 3단: `sm` hover / `md` 팝오버 / `lg` 모달·드래그 — 이 밖의 boxShadow 리터럴 금지
- z-index: `theme.zIndex` 참조 원칙(modal±1 패턴). 로컬 스태킹 0~9만 리터럴 허용. 레거시 셸 저층(10/50/55/60)은 이관 전까지 이원 체계

### 상태 의미색 전역 배정표 (`tokens.statusMeaning` — 사용자 지정)

| 의미 | StatusKind | 색 |
|------|-----------|----|
| 진행중·활성 | `success` | 그린 |
| **완료·처리됨** | `info` | **파랑** |
| **예정·대기** | `neutral` | **회색** |
| 임박(D-N 카운트다운) | `warning` | 앰버 |
| 보류 | `warning` | 앰버 |
| 지연·불가·오류 | `error` | 레드 |

어느 페이지에서나 같은 의미 = 같은 색 (P1-3 적용 완료 — 로드맵·Work·EqOps·Equipment). 보조 도메인 상태(도입중 등)는 핵심 의미와 충돌하지 않는 한 `teal`/`purple` 허용. **Remind는 상태가 아닌 직교 플래그 = 퍼플**(보류 앰버와 구분, 압정 아이콘 유지). Events D-# 칩 = '임박' 의미로 앰버(단순 예정 아님).

### 반응형 2계층 · 터치

- 셸(사이드바↔하단탭·페이지 모드) = **768** — `theme.breakpoints.down('shell')` 또는 `tokens.shellMq`. 문자열 하드코딩 금지
- 콘텐츠 열수 = sm **600** / md **900** (CardGrid). 769~899 = "PC 셸 + 2열"이 공식 상태
- PC→모바일 변환 4패턴에서 선택: 넓은 표→카드 스택(rtable) / KPI 타일→가로 스와이프 / 카드 그리드→스냅 캐러셀 / 밀도 뷰→목록 뷰
- 모바일 터치 타겟 최소 `touchTarget` 44px (시각 크기 유지 시 히트영역 padding 확장)

### DataTable 표 규격 (최종 확정 2026-07-13)

- **내부선 = 가로선만**(세로선·지브라 없음) · 셀 12px · 행 hover(elevated) · 모바일 가로 스크롤
- **헤더 = 12px/600/`text.secondary` + 배경 채움(`background.elevated`)** — sticky 시 스크롤 가림막 겸용
- **정렬 = 헤더는 항상 자기 열의 본문 정렬을 따름**: 긴 본문성 텍스트 열(제목·내용)=좌측 / 짧은 값 열(번호·위치·상태·담당·날짜·첨부)=중앙 / **금액·수량 등 크기 비교 숫자 열(예산 등)=우측+모노스페이스**
- **날짜 열(작성일·게시일) = 중앙 + `monospace` + `text.disabled`** — 포털 날짜 관례의 표 표준화(자릿수 정렬로 세로 스캔)
- **첨부 표식 = `AttachFile`(클립) 16px `text.secondary` + Tooltip "첨부파일 N개"** — 손그림 SVG·플로피 은유 금지 (사용자 확정 2026-07-13)

### Dialog 규격 (테마 MuiDialog + P2 컴포넌트)

- 반경 modal 16 · 배경 `background.paper`(테마 상속) — 개별 지정 금지
- 2계열: **ConfirmDialog**(확인형 — 제목·본문·확인/취소·busy 가드, **삭제류는 destructive 모드가 빨간 버튼 강제**) / **FormDialog**(작성폼형 — 아이콘+제목+닫기 헤더, width 560)
- 버튼 색 원칙: 저장·확인=파랑(primary) / 삭제·되돌릴 수 없음=빨강(error) / 취소=text

Drawer 폭: 480~600 (기본 520).

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

### ListRow
목록·표의 **한 행** 공통 프리미티브. `[leading] [제목·(titleTrailing)/subtitle] [trailing]` 가로 배치. 간격·padding·hover·말줄임 규칙을 한곳으로 통일한다(페이지마다 손코딩 금지).

| Prop | 타입 | 설명 |
|------|------|------|
| `leading` | ReactNode | 좌측 고정 요소(아이콘·StatusChip·dot). 안 줄어듦 |
| `title` | ReactNode | 주 텍스트. 넘치면 말줄임. 문자열이면 자동 Typography |
| `titleTrailing` | ReactNode | 제목 바로 옆 요소(담당자 칩 등) — 제목이 길어도 항상 보임 |
| `subtitle` | ReactNode | 제목 아래 보조 텍스트. 넘치면 말줄임 |
| `trailing` | ReactNode | 우측 끝(날짜·상태칩·액션) |
| `onClick` | () => void | 지정 시 hover·키보드 접근성 자동 |
| `selected` | boolean | 선택 강조(배경 유지) |
| `divider` | boolean | 하단 구분선(AppCard 안 나열용) |
| `dense` | boolean | 촘촘한 높이(미리보기·조밀 목록) |

규칙: 색·간격은 `row`/theme 토큰만. `titleTrailing`/`trailing`은 안 줄고 제목만 말줄임 → "제목 옆 담당자" 패턴에서 빈 공간이 벌어지지 않는다.

### 배지·라벨은 StatusChip으로 수렴
`index.css`의 레거시 배지 6종(`badge-type`·`task-badge`·`eq-badge`·`kpi-cat-badge`·`hdr-badge`·`card-badge`)은 모두 "작은 색 라벨"이다 → **`StatusChip`(onClick 없이)** 로 대체한다. 신규 코드는 새 배지 클래스를 만들지 않는다. (알림 카운트 점 배지는 별개 — SideNav/BottomNav 배지 컴포넌트 사용.)

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
