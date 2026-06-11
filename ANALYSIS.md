# ANGELS FAB 구축 관리 — index.html 분석 (React 전환 사전 분석)

> 원본: https://github.com/angels-fab/angels-fab.github.io/blob/main/index.html
> 로컬 사본: [reference/index.html](reference/index.html)
> 분석일: 2026-06-10

## 1. 개요

GIST ANGELS FAB(반도체 팹) 구축 프로젝트의 **사내 관리 대시보드**.
단일 HTML 파일 SPA로, 빌드 도구·외부 라이브러리 없이 순수 HTML/CSS/Vanilla JS로 작성됨.

| 항목 | 값 |
|---|---|
| 전체 크기 | 약 613 KB (2,713줄) |
| CSS | 10–722행 (인라인 `<style>`, 약 700줄) |
| HTML 마크업 | 724–1216행 |
| JavaScript | 1217–2711행 (약 1,500줄, 함수 약 70개) |
| 외부 의존성 | Google Fonts(IBM Plex Sans KR)만. JS 라이브러리 없음 |
| 인라인 base64 이미지 | 17개 (로고, 인사말 일러스트, KPI 아이콘 8종, 공지 본문 이미지 등) — 파일 크기의 대부분 차지 |

## 2. 화면(페이지) 구성

홈 + 5개 페이지를 `display` 토글로 전환하는 구조 (`.page.active`).

| 페이지 | id | 내용 |
|---|---|---|
| 홈 | `#home` | 인사말(시간대별 멘트), 장비현황 요약 카드, FAB 구축 로드맵 타임라인(7단계), 메뉴 카드(PC용 grid / 모바일용 stack 이중 마크업), 공지·캘린더·업무·장비 미리보기 |
| 공지사항 | `#page-공지사항` | 카테고리 필터, 목록 ↔ 글 상세(2레이어), 이전/다음 글 |
| 업무일정(캘린더) | `#page-캘린더` | 카테고리 필터, 월 달력 그리드, 날짜 선택 시 이벤트 목록 |
| 업무현황 | `#page-업무현황` | KPI 카드 3종(진행중/지난/Remind)이 탭 역할, 담당자·구분 필터, 검색, 업무 아코디언 목록 |
| 장비현황 | `#page-장비현황` | KPI 현황, 내자/외자·담당자·상태 필터, 검색, 장비 목록(아코디언), **간트 차트**(월 단위 타임라인, 직접 구현) |
| 바로가기 | `#page-바로가기` | 외부 링크 모음 (GIST, ANGELS, GAIA, 모아팹, RED, 구축총괄시트 등) |

내비게이션: PC는 상단 topbar 칩 + 플라이아웃 드롭다운, 모바일은 하단 탭바(`#bottom-nav`) + 바로가기 시트. `d-only` 클래스와 미디어쿼리(주요 분기점 480/600/640/700/900px)로 PC/모바일 분기.

## 3. 데이터 소스 — ★ 전환 시 핵심

### 3-1. 동적 데이터: Google Apps Script API (JSON)

```
SCRIPT_URL_EQ = https://script.google.com/macros/s/AKfycbwLUGH8.../exec
호출 형식: GET {SCRIPT_URL}?sheet={시트명}
응답 형식: { status: 'ok', data: [[행배열]...] }
```

| 시트명 | 용도 | 로드 함수 |
|---|---|---|
| `센터 업무 현황` | 업무현황 페이지 전체 데이터 | `loadWorkData()` |
| `장비 총괄표` | 장비현황 목록/KPI | `loadEqData()` (Promise.all 병렬) |
| `장비타임라인` | 간트 차트 (행0=컬럼헤더, 행1=월헤더 "2027년 1월"…, 행2~=장비별 상태. 관리번호로 `TL_MAP` 매핑) | `loadEqData()` |

원본 스프레드시트: `docs.google.com/spreadsheets/d/1lnS34m1cQ2mY6W6cBi7kOjDNtNaXtDSg3VRqgFWmUjU`

### 3-2. 하드코딩 데이터 (JS 상수)

- `CAL_EVENTS` — 캘린더 이벤트 20건 (2026년 6~7월). **시트 연동 아님**
- `NOTICES` — 공지 5건, 본문은 HTML 문자열(base64 이미지 포함)
- `CAL_CATS`, `CATS`, `CAT_COLOR`, `WORK_CAT_PALETTE` — 카테고리/색상 정의
- 로드맵 7단계 — HTML에 정적 마크업

### 3-3. 클라이언트 저장소

- `localStorage`: 메뉴 배지(N 표시) 상태 — `BADGE_KEY`, `BADGE_DATE_KEY` (날짜 바뀌면 리셋, `setSampleBadges()`로 데모 배지 주입)
- 페이지 상태(필터, 탭, 검색어, 열린 아코디언)는 전부 **전역 변수** (`workCat`, `workMgr`, `workTab`, `eqFltType`, `eqOpenIdx` 등 약 15개)

## 4. 라우팅

- `history.pushState` + `location.hash` 직접 구현
- 패턴: `#장비현황`, `#공지사항-{id}` (글 상세)
- `popstate` 리스너로 뒤로가기 처리, `restoreView()` IIFE로 새로고침 시 현재 페이지 복원
- 특이: `goPage('회의')`는 `'캘린더'`로 alias 처리
- 페이지 id·해시·함수 인자에 **한글을 키로 사용** — React Router 전환 시 URL 인코딩/매핑 결정 필요

## 5. 스타일

- 다크 테마 고정. CSS 변수 13개: `--ink/--ink2/--ink3`(배경), `--text/--text2/--text3`, `--border/--border2`, `--blue/--amber/--green/--red/--teal/--purple`
- GitHub 다크와 동일 팔레트 (#58A6FF, #3FB950, #F85149 …)
- 폰트: IBM Plex Sans KR (Google Fonts), 일부 IBM Plex Mono
- 인라인 `style=""` 속성이 마크업 곳곳에 다수 (전환 시 정리 필요)

## 6. JS 함수 지도 (도메인별)

- **업무현황**: `loadWorkData, renderWork, renderWorkFilters, workFilterCat/Mgr, workDoSearch, workHTML, currentHTML, workDetail, toggleWork, switchWork, renderWorkPreview, workCatStyle`
- **장비현황**: `loadEqData, eqRender, eqFilter(+Type/Mgr/State), eqDoSearch, eqCounts, renderEqKPI, renderEqPreview, eqToggle, eqStateColor, baseName`
- **간트**: `monthWidthUnits, ganttGridTemplate, renderGanttHeader, renderGantt` (TL_STAGE_COLOR, TL_VISIBLE_MONTHS)
- **캘린더**: `calMove, renderCal, renderCalFilter, setCalCat, getFilteredEvents, renderCalGrid, selectCalDate, renderCalPreview`
- **공지**: `renderNoticeList, setNoticeCat, openPost, backToNoticeList, renderNoticePreview`
- **배지**: `initBadges, getBadges, setBadge, clearBadge, renderBadges, setNavBadge, renderNavBadges, setSampleBadges, todayKey`
- **홈/공통**: `renderGreeting, eqSummaryCardInner, renderEqSummary, renderStatBoard, goPage, goHome, restoreView, setBottomNav, toggleLinksSheet, refreshPage, setLoad, esc, fmtDate, hexA, nowStamp`

렌더링은 전부 **템플릿 문자열 + innerHTML** 방식. XSS 방지용 `esc()` 존재하나 일관 적용은 아님.

## 7. React 전환 시 제안 컴포넌트 분해

```
App (라우터, 테마)
├─ layout/  TopBar, NavFlyout, BottomNav, LinksSheet, PageHeader
├─ home/    Greeting, EqSummaryCard, RoadmapTimeline, MenuGrid(PC)/MenuStack(모바일 → 1개로 통합 권장),
│           NoticePreview, CalPreview, WorkPreview, EqPreview, StatBoard
├─ notice/  NoticeList, NoticeFilter, NoticePost
├─ calendar/ CalendarGrid, CalFilter, DayEventList
├─ work/    WorkKpiTabs, WorkFilters, WorkList, WorkItem(아코디언)
├─ equip/   EqKpi, EqFilters, EqList, EqItem, GanttHeader, GanttChart
└─ shared/  Badge, CategoryChip, LoadingSpinner, Card
```

### 전환 포인트 정리

1. **데이터 계층 분리**: Apps Script fetch 2종 → React Query/SWR 훅(`useWorkData`, `useEqData`)으로. 행 배열 → 객체 파싱 로직을 별도 모듈로
2. **하드코딩 데이터**: `CAL_EVENTS`/`NOTICES`를 일단 데이터 파일(ts/json)로 분리, 추후 시트 연동 여부 결정
3. **라우팅**: React Router. 한글 해시 → 영문 경로 매핑 권장 (`/notice`, `/calendar`, `/work`, `/equipment`, `/links`) + 기존 한글 해시 리다이렉트
4. **상태**: 전역 변수 15개 → 페이지별 로컬 state + URL 쿼리(필터/탭은 URL에 두면 새로고침 복원이 공짜). 배지는 localStorage 훅
5. **PC/모바일 이중 마크업**(메뉴 카드 d-only/menu-stack) → 반응형 단일 컴포넌트로 통합
6. **base64 이미지 17개** → 별도 에셋 파일로 추출 (HTML 613KB의 대부분, 빌드 시 최적화 가능)
7. **innerHTML 렌더링** → JSX로 자연 해소. 단, 공지 body가 HTML 문자열이므로 sanitize 후 `dangerouslySetInnerHTML` 또는 구조화 데이터로 변환
8. **간트 차트**: CSS grid 기반 자체 구현 — 라이브러리 없이 그대로 포팅 가능한 수준
9. **CSS**: 변수 체계가 깔끔해서 그대로 글로벌 CSS 또는 CSS Modules/Tailwind 토큰으로 이관 용이. 인라인 style 정리 필요
10. **날짜 하드코딩 주의**: `goPage('캘린더')`에서 `calYear=2026; calMonth=5` 고정 → `new Date()` 기반으로 수정 필요
