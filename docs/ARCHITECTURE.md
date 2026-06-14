# ANGELS FAB 백오피스 — 프로젝트 아키텍처

GIST ANGELS FAB(반도체 팹) 구축·운영 관리 대시보드. 내부용 SPA.
원본 단일 HTML SPA를 React로 전환했고, STEP1~7.5에 걸쳐 SaaS Admin 디자인 시스템으로 개편 중.

> 최종 갱신: 2026-06-14 (STEP 7.5까지)

---

## 1. 기술 스택

| 영역 | 사용 기술 |
|------|-----------|
| 프레임워크 | React 18 + TypeScript |
| 빌드 | Vite 6 (dev 포트 **3600** 고정) |
| 상태관리 | Redux Toolkit (`@reduxjs/toolkit`, react-redux) |
| 라우팅 | react-router-dom v7 (**HashRouter** — 정적 호스팅 대응) |
| UI | **MUI v9** (@mui/material, @mui/icons-material, emotion) |
| 캘린더 | FullCalendar 6 (daygrid/timegrid/list) |
| 데이터 | Google Apps Script 웹앱(구글시트) + 구글캘린더 |
| 살균 | DOMPurify (공지 본문) |
| 폰트 | IBM Plex Sans KR |

경로 별칭: **`@/` → `src/`**.
명령: `npm run dev`(3600) · `npm run type-check`(tsc) · `npm run build`(tsc -b && vite build) · `npm run deploy:backend`(clasp).

---

## 2. 디렉토리 구조

```
src/
├─ main.tsx              앱 진입. <Provider>(redux) + <ThemeProvider>(다크) + <HashRouter> + <App>
├─ App.tsx               → <AppRouter/>
├─ router/AppRouter.tsx  라우트 정의
│
├─ theme/                ── 디자인 토큰 & MUI 테마 (STEP 2~3)
│  ├─ tokens.ts          색/간격/반경/breakpoints — 단일 진실 공급원
│  └─ theme.ts           createTheme(다크/라이트) + 컴포넌트 기본 스타일
│
├─ components/ds/        ── 디자인 시스템 (STEP 1~3, 재사용 UI)
│  ├─ AppCard · AppDrawer · AppLayout
│  ├─ PageContainer · PageHeader · ContentSection · SectionHeader · CardGrid
│  ├─ StatTile · KpiCard · RatioBar · StatusChip · FilterBar · SearchBar · EmptyState
│  └─ index.ts           배럴 export
│
├─ layouts/              ── 앱 셸 (레거시 CSS 기반, 아직 유지)
│  ├─ MainLayout.tsx     app-shell + 데이터 프리페치 + body 클래스 토글
│  ├─ TopBar · SideNav(PC 좌측) · BottomNav(모바일 하단)
│  └─ useNavBadges.ts    내비 배지 카운트
│
├─ store/                ── Redux
│  ├─ index.ts           store: { work, eq, notice, cal }
│  ├─ hooks.ts           useAppDispatch / useAppSelector (타입드)
│  ├─ selectors.ts       selectEqCounts, selectCurrentWork (createSelector)
│  └─ slices/            workSlice · eqSlice · noticeSlice · calSlice (createAsyncThunk)
│
├─ api/sheets.ts         Apps Script 웹앱 호출(fetchSheet, fetchCalendarEvents)
├─ constants/            calendar(CAL_CATS) · roadmap(ROADMAP_STEPS) · links
├─ utils/                date · color(hexA) · workCat(rank/normCat)
├─ types/index.ts        WorkItem · EqRawItem · EqGroup · EqCounts · CalEvent · Notice · QuickLink
├─ pages/                페이지 (아래 4·8장 참조)
└─ index.css             레거시 전역 CSS(원본 포팅) — 토큰값을 theme와 미러링, 점진 제거 중
```

---

## 3. 데이터 레이어

### 백엔드 (수정은 repo의 google-apps-script가 원본)
- **Google Apps Script 웹앱**(`api/sheets.ts`의 `SCRIPT_URL`) — 구글시트를 JSON 행배열로 반환.
  - 시트: `센터 업무 현황`(업무) · `장비운영관리`(장비) · `공지사항` · (`장비도입관리`)
  - `?calendar=1` → 구글캘린더 일정(RawCalEvent).
- 배포: `npm run deploy:backend` = `clasp push` + `clasp redeploy <배포ID>`(URL 유지). PC마다 1회 `clasp login`.

### 프론트 상태 (Redux, 4 슬라이스)
각 슬라이스 동일 패턴: `createAsyncThunk(load…)` → `{ items/raw, ready, loading, error, updatedAt }`.

| 슬라이스 | 소스 | 주요 state | 가공 |
|----------|------|-----------|------|
| `work` | 센터 업무 현황 | `items: WorkItem[]` | 헤더 자동탐색, 체크박스(share/remind/chief) 파싱 |
| `eq` | 장비운영관리 | `raw: EqRawItem[]`, `groups: EqGroup[]`, `months` | 장비명 기준 그룹핑 |
| `notice` | 공지사항 | `items: Notice[]` | 상단고정→연번 최신순 정렬, isNew(7일) |
| `cal` | 구글캘린더 | `events: CalEvent[]` | 다중일 일정을 날짜별로 펼침, 제목 키워드로 cat 분류 |

### 데이터 흐름
1. `MainLayout` 마운트 시 4개 `load…` thunk **프리페치**(앱 진입 1회).
2. 페이지/컴포넌트는 `useAppSelector`로 구독, selector·util로 파생(필터/집계).
3. 새로고침: 각 페이지 헤더 액션이 해당 `load…` 재디스패치.

> **상태 파생 규칙(데이터 충실형):** 시트에 없는 상태/필드를 만들지 않는다.
> - 업무: 진행중(share) / 지난(!share&!remind) / Remind / 센터장Check(chief). '예정/완료/지연·마감일' 없음 → 마감 기능은 STEP10+.
> - 장비: 가동중(=운영중) / 도입중(=설치중) / 도입예정 / 비가동 (`selectEqCounts`, `eqMeta.eqStateKey`).

---

## 4. 디자인 시스템 (STEP 1~3)

- **토큰**(`theme/tokens.ts`): SaaS 다크 — bg `#0F1117`, surface `#131722`, card `#161B22`, border `#293244`, divider `#232C3A`, text 3단계, accent(blue/green/amber/red/purple/teal, 채도 낮춤). 간격(Top32/Header24/Section24/KPI·Card16/Pad24), 폭(목록1400/상세1200), Radius(Card12/Btn10/Chip8/Input10).
- **테마**(`theme/theme.ts`): `createTheme` 다크/라이트, MUI 컴포넌트 기본 스타일·통일 Focus Ring·약한 hover.
- **규칙**: 색·폰트 크기 **하드코딩 금지**(테마/토큰·Typography variant 사용). 카드 왼쪽 컬러보더 금지. 이모지 아이콘 금지(MUI 아이콘만).
- **컴포넌트 문서**: `docs/design-system.md`. 쇼케이스 라우트 `/#/design-system`, `/#/layout-system`(내비 미노출).

---

## 5. 레이아웃 & 라우팅

- **셸**: `MainLayout`(app-shell) = TopBar + SideNav(PC) + `<Outlet/>` + BottomNav(모바일). 반응형 분기 768px. (셸은 아직 레거시 `index.css` 기반.)
- **페이지 레이아웃**: 이관된 페이지는 `PageContainer`(폭/여백 통일)로 감싸고, `<main>` 레거시 패딩을 쓰지 않음.
- **라우트**(HashRouter):

| 경로 | 페이지 | 상태 |
|------|--------|------|
| `/` | Home(운영 대시보드) | ✅ 디자인 시스템 |
| `/calendar` | 업무일정 | ✅ |
| `/work` | 업무현황 Command Center | ✅ |
| `/equipment-ops` | 장비운영관리(구축 준비 현황판) | ✅ |
| `/roadmap` | FAB 구축 로드맵 | ✅ |
| `/equipment` | 장비도입관리(간트) | ⏳ 레거시 |
| `/notice`, `/notice/:num` | 공지사항 | ⏳ 레거시 |
| `/links` | 바로가기 | ⏳ 레거시 |
| `/design-system`, `/layout-system` | 쇼케이스 | (개발용) |

---

## 6. 페이지별 구성 (이관 완료분)

- **Home**(`pages/Home/`): `dash/`에 섹션 컴포넌트(KpiOverview·ScheduleSection·WorkStatusSection·EquipmentSection·NoticeSection) + `derive.ts`(업무/일정 집계).
- **Calendar**(`pages/Calendar/`): FullCalendar + `SummaryPanel`(오늘/이번주/다가오는·D-Day) + `catMeta`(카테고리→StatusKind/accent 통일). 읽기 전용.
- **Work**(`pages/Work/`): `workMeta`(상태 분류) + `TaskCard` + `TaskDetailDrawer`. KPI+RatioBar / 긴급 / 담당자 / 전체목록.
- **EquipmentOps**(`pages/EquipmentOps/`): `eqMeta`(상태) + `EqDetailDrawer`. 구축 준비 현황(KPI/비율/도입 우선/카테고리/예산/목록).

---

## 7. 빌드 & 배포

- **빌드**: `tsc -b && vite build` → `dist/`.
- **프론트 배포**(자동): 소스 repo `.github/workflows/deploy.yml`(peaceiris/actions-gh-pages) — **main push 시** 클라우드 빌드 후 `angels-fab.github.io`(GitHub Pages)에 자동 배포. 실서비스 https://angels-fab.github.io/.
  - ⚠️ **main push = 즉시 실서비스 배포.**
- **백엔드 배포**: `npm run deploy:backend`(clasp) — 동일 배포ID에 덮어써 URL 유지.
- **동기화**: 집↔사무실 GitHub로 동기화. 작업 전 `git pull`(또는 `/출근`), 후 `git add/commit/push`.

---

## 8. 알려진 기술 부채 / 진행 예정

- **레거시 페이지 미이관**: `/equipment`(장비도입관리·간트), `/notice`, `/links` — STEP 8+ 이관 예정.
- **죽은 코드**(이관으로 미사용 → 정리 과제): `Home/Greeting`, `Home/previews`, `Home/RoadmapTimeline`, `Calendar/CalEventWrite`, `Work/WorkRow`, `components/EqSummaryInner`, `Equipment/EqKpi`, `utils/workCat.workCatStyle`, 관련 레거시 CSS·에셋.
- **index.css 점진 제거**: 이관된 페이지의 레거시 클래스는 정리 대상. 셸(layouts)도 추후 디자인 시스템(AppLayout)으로 이관 후보.
- **마감 기반 기능**: 시트에 '마감일' 컬럼이 없어 STEP10+에서 컬럼 추가 후 구현.
- **단계별 작업 기록**: `docs/step*-report.md` (STEP 2~7.5).
