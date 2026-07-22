# ANGELS FAB 구축 관리 대시보드

GIST ANGELS FAB(반도체 팹) 구축 프로젝트의 사내 관리 대시보드.
원본은 단일 HTML SPA([reference/index.html](reference/index.html), 분석: [ANALYSIS.md](ANALYSIS.md))이고, 이 저장소는 React로 전환한 버전.

## 작업 원칙 (항상 적용)

### 1. 코딩 전에 판단한다
- 요청과 관련 코드를 먼저 확인하고, 확인하지 않은 내용을 사실처럼 가정하지 않는다.
- 결과를 크게 바꾸는 모호함은 구현 전에 질문한다. 영향이 작은 가정은 명시하고 진행한다.
- 더 단순하거나 안전한 방법이 있으면 이유와 함께 제안한다.

### 2. 가장 단순한 해결책을 선택한다
- 요청받은 범위만 구현한다. 요청하지 않은 기능, 추상화, 확장성, 예외 처리를 미리 추가하지 않는다.
- 한 번만 쓰는 코드를 위한 새 계층이나 헬퍼를 만들지 않는다.
- 같은 결과라면 코드와 변경 파일이 적은 방법을 우선한다.

### 3. 필요한 부분만 수정한다
- 문제 해결에 필요한 줄과 파일만 건드린다.
- 관련 없는 코드, 주석, 이름, 스타일을 임의로 정리하거나 재작성하지 않는다.
- 기존 프로젝트의 코드 방식과 디자인 규칙을 따른다. UI 재설계는 가능하지만 요청 범위를 넘기지 않는다.

### 4. 검증 가능한 결과로 끝낸다
- 작업 전에 완료 조건을 분명히 하고, 변경 후 그 조건을 직접 확인한다.
- 코드 수정 후 최소한 `npm run type-check`를 실행하고, UI 변경은 실제 화면에서도 확인한다.
- 검증하지 못한 항목이나 남은 위험은 완료한 것처럼 말하지 않고 명확히 알린다.

## 스택 & 명령어

- React 18 + TypeScript + Vite, Redux Toolkit, react-router-dom(HashRouter), @mui/icons-material (+@mui/material, emotion)
- `npm run dev` — 개발 서버 (`.claude/launch.json`에 port 3600 등록, preview_start로 실행)
- `npm run type-check` — tsc 타입 체크 (수정 후 항상 실행할 것)
- **데이터: Supabase(프로젝트 ref `rmvutlhdcfkqubzrckqf`, 서울)** — 2026-07-05 전체 이관 완료(업무·공지·개선요청·답글·임시저장·장비·캘린더 전부 테이블+RLS+RPC). API 레이어 `src/api/{supabase,works,notices,improve,eq,calendar}.ts`, 인증 = Supabase Auth(사번 로그인 `{사번}@angels.local` + 비밀번호 패딩 `.angels`, `src/auth/role.tsx`), 역할 guest/member/admin(profiles.role). 구글시트·Apps Script(Code.gs)·clasp는 **읽기전용 백업**(더 이상 호출 안 함 — sheets.ts는 타입 재사용용 잔존). 하드코딩 상수: 행사·로드맵·바로가기. 상세는 메모리 supabase-project.md

## 구조 요약

- `src/layouts/` — TopBar(로고만), **SideNav(PC 좌측 사이드바, 내비 주체)**, BottomNav(모바일 하단 탭바), MainLayout(app-shell 플렉스 구조), useNavBadges(배지 건수 공용 훅)
- `src/pages/` — Home(대시보드), Notice, Calendar, Work, Equipment, Links, Milestone(팹 구축~개소 실행계획 현황판 — Supabase `milestones` 62건, 상태 4종 수동+임박·지연 자동파생, 퍼지 분기 매핑은 model.tsx·시딩 스크립트 주석 참조)
- `src/constants/` — links.tsx, roadmap.tsx (아이콘이 ReactNode라서 .tsx)
- 스타일은 전부 `src/index.css` 단일 파일 (CSS 변수 --ink/--ink2/--border/--blue 등)
- 반응형 분기점 768px: `.d-only`는 PC 전용 (사이드바 등), 모바일은 하단 탭바 + menu-stack

## ★ 디자인 규칙 (사용자 피드백 — 반드시 지킬 것)

1. **이모지 아이콘 금지.** 아이콘은 전부 `@mui/icons-material` 사용 (개별 경로 import: `import XIcon from '@mui/icons-material/X'`). 텍스트 화살표(◀▶←▲▼)도 Chevron/ArrowBack 계열 MUI 아이콘으로. "클로드가 짠 것 같은" 이모지 디자인에 사용자가 강한 거부감 있음.
   - 예외: 공지 본문의 "▲ 이미지 캡션" 텍스트, WorkRow.tsx의 불릿 파싱 정규식(●○▪◦)은 데이터/관례라 유지.
2. **카드 왼쪽에 컬러 보더(색 줄) 넣지 말 것.** 기존 `.card::before` 3px 색 줄은 사용자 요청으로 전부 제거함. 다시 추가 금지.
3. **홈 대시보드 우선순위: FAB 구축 로드맵 > 장비현황 > 나머지.** 둘 다 동일 레벨 섹션(`.dashboard` + `.dash-title`)이고 크게 유지. 전체적으로 "작아 보이는" 디자인 지양.

## 포털개선요청 '메모표시' (작업 메모)

시트 `메모표시` 체크 개선요청을 해당 `개선위치` 페이지에 공유 작업 메모로 띄움(로그인 관리자만, 게스트 미노출).
- **시트 헤더 대응**(`Code.gs` improveCtx_): content=`요청내용`(기존 개선내용/내용/상세 호환), memo=`메모표시/메모`. getImprovements가 memo:boolean 반환. create는 신규행 memo=FALSE + `insertCheckboxes` 명시.
- **자동 규칙**(`updateImprovement_`): 접수/접수중→검토중 **전환 순간만** 자동 TRUE(시트의 이전 상태와 비교) / 보류·완료·불가 자동 FALSE / 그 외(검토중 유지)는 자동 변경 안 함(수동 해제 유지·재로딩해도 강제 TRUE 안 됨) / `req.memo`(핀·패널 수동토글)가 자동규칙보다 우선. 인증 유지·수정권한 정책(로그인 관리자 전체) 유지·삭제(담당자만) 미변경.
- **경로 매핑 공용유틸** `src/utils/improveMemo.ts`: `MEMO_LOCATION_PATH`(홈→/ · 공지사항→/notice · 업무일정→/calendar · 업무현황→/work · 장비도입·운영·관리→/equipment · 학술·교육·전시→/events · 구축 로드맵→/roadmap · 바로가기→/links · 설정→/settings · 기타/unknown→null). `memosForPath`(하위경로 매칭) / `memoCountByPath`(장비도입+운영을 /equipment로 합산).
- **보드 핀**(`Improve/index.tsx`): `작업 메모` 열(canEdit일 때만 = 게스트 미노출, colSpan은 memoCol로 8/9 분기). PushPinOutlined↔PushPin(앰버), 종결·기타 비활성+이유 Tooltip, 셀 onClick stop. `toggleMemo`→updateImprovement({memo}).
- **대상 페이지 UI**: `src/components/PageImprovementMemo.tsx`의 `usePageImprovementMemo()`가 현재경로 메모로 {chip,panel,snackbar} 반환 → `PageHeader`가 제목 옆 칩·아래 패널 렌더(메모 없으면 null=무변화). 진입 시 패널 접힘, 칩 클릭 시 열림+항목 접힘. 스낵바는 마지막 메모 해제 후에도 보이게 관리자에게 항상 렌더.
- **SideNav**: 경로별 앰버 memoBadge(건수, Tooltip `개선 메모 N건`), 기존 배지와 공존, 관리자 전용.

## 현재 홈(PC) 레이아웃

1. FAB 구축 로드맵 — 7단계 타임라인, 아이콘 76px로 확대된 상태
2. 장비현황 섹션 — `.eq-dash`에 EqPreview(5타일 풀와이드 한 줄), 클릭 시 /equipment
3. 미리보기 — 공지사항·업무일정 2열 + 업무현황 풀와이드(gridColumn '1 / -1')
- 콘텐츠 폭: **PageContainer 1400(wide)/1200(detail)** — 정본은 `tokens.layout.maxWidthWide/Detail`. (구 `.dashboard`/`.grid` 1180px는 레거시 죽은 규칙). **디자인시스템 정본 = `docs/design-system-decisions.md`(확정 표준 D1~D7·표·카드 규격)** — UI 작업 전 반드시 참조

## 행사 게시

새 행사 등록, 신청된 행사 게시, 행사 정보·포스터 조사 요청에는 `publish-events` 스킬을 사용한다. Google Form과 Google Drive는 사용하지 않으며, 현재 포털의 Supabase 신청 데이터와 `FAB_EVENTS` 게시 구조를 따른다. 행사 페이지의 단순 UI 수정이나 버그 수정에는 이 스킬을 적용하지 않는다.


## 작업 이력 (2026-06-10)

1. 이모지/수제 SVG 아이콘 전부 MUI 아이콘으로 교체. 매핑: 📢Campaign 📅📆CalendarMonth 📊Assessment 🖥️Monitor 🔗Link 🕐Schedule 🗂️FolderCopy 🔔NotificationsActive 🔍Search(검색창 `.search-wrap` 어돈먼트) / 로드맵: Assignment·DesignServices·Construction·LocalShipping·FactCheck·Settings·RocketLaunch / 바로가기: School·AutoAwesome·Public·Memory·Factory·Bolt·TableChart
2. 좌측 사이드바 도입(SideNav). 그룹: 홈 / 업무(업무일정·업무현황) / 장비(장비현황) / 정보(공지사항·바로가기). 활성 하이라이트 + 건수 배지. TopBar의 메뉴 칩·바로가기 플라이아웃 제거. 홈 카드 라벨 "메뉴"→"미리보기".
3. 대시보드 확대 + 카드 왼쪽 컬러 보더 제거. 로드맵 아이콘 52→76px 등 전반 확대, 폭 960→1180px.
4. 장비현황을 로드맵과 동일 레벨 섹션으로 승격, 미리보기 그리드에서 장비현황 카드 제거.

## 미정리 항목 (다음 세션 후보)

- `src/assets/bnav-*-mask.png` + `.bnav-mask/.bnav-jangbi/.bnav-gongji` CSS — MUI 교체로 미사용, 삭제 가능
- `body.eq-wide main{max-width:98vw}` — React 버전에선 사실상 무효(장비 페이지는 `.page` 사용)
- 사용자가 사이드 메뉴 "레퍼런스" 디자인을 따로 갖고 있을 수 있음 — 공유받으면 SideNav 스타일 맞출 것
