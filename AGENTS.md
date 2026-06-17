# ANGELS FAB 구축 관리 대시보드

GIST ANGELS FAB(반도체 팹) 구축 프로젝트의 사내 관리 대시보드.
원본은 단일 HTML SPA([reference/index.html](reference/index.html), 분석: [ANALYSIS.md](ANALYSIS.md))이고, 이 저장소는 React로 전환한 버전.

## 스택 & 명령어

- React 18 + TypeScript + Vite, Redux Toolkit, react-router-dom(HashRouter), @mui/icons-material (+@mui/material, emotion)
- `npm run dev` — 개발 서버 (`.Codex/launch.json`에 port 3600 등록, preview_start로 실행)
- `npm run type-check` — tsc 타입 체크 (수정 후 항상 실행할 것)
- 데이터: Google Apps Script API(업무/장비 시트) + 하드코딩 상수(공지, 캘린더, 로드맵, 바로가기)

## 구조 요약

- `src/layouts/` — TopBar(로고만), **SideNav(PC 좌측 사이드바, 내비 주체)**, BottomNav(모바일 하단 탭바), MainLayout(app-shell 플렉스 구조), useNavBadges(배지 건수 공용 훅)
- `src/pages/` — Home(대시보드), Notice, Calendar, Work, Equipment, Links
- `src/constants/` — links.tsx, roadmap.tsx (아이콘이 ReactNode라서 .tsx)
- 스타일은 전부 `src/index.css` 단일 파일 (CSS 변수 --ink/--ink2/--border/--blue 등)
- 반응형 분기점 768px: `.d-only`는 PC 전용 (사이드바 등), 모바일은 하단 탭바 + menu-stack

## ★ 디자인 규칙 (사용자 피드백 — 반드시 지킬 것)

1. **이모지 아이콘 금지.** 아이콘은 전부 `@mui/icons-material` 사용 (개별 경로 import: `import XIcon from '@mui/icons-material/X'`). 텍스트 화살표(◀▶←▲▼)도 Chevron/ArrowBack 계열 MUI 아이콘으로. "클로드가 짠 것 같은" 이모지 디자인에 사용자가 강한 거부감 있음.
   - 예외: 공지 본문의 "▲ 이미지 캡션" 텍스트, WorkRow.tsx의 불릿 파싱 정규식(●○▪◦)은 데이터/관례라 유지.
2. **카드 왼쪽에 컬러 보더(색 줄) 넣지 말 것.** 기존 `.card::before` 3px 색 줄은 사용자 요청으로 전부 제거함. 다시 추가 금지.
3. **홈 대시보드 우선순위: FAB 구축 로드맵 > 장비현황 > 나머지.** 둘 다 동일 레벨 섹션(`.dashboard` + `.dash-title`)이고 크게 유지. 전체적으로 "작아 보이는" 디자인 지양.

## 현재 홈(PC) 레이아웃

1. FAB 구축 로드맵 — 7단계 타임라인, 아이콘 76px로 확대된 상태
2. 장비현황 섹션 — `.eq-dash`에 EqPreview(5타일 풀와이드 한 줄), 클릭 시 /equipment
3. 미리보기 — 공지사항·업무일정 2열 + 업무현황 풀와이드(gridColumn '1 / -1')
- 콘텐츠 폭: `.dashboard`/`.grid`/`.menu-label` max-width 1180px

## 작업 이력 (2026-06-10)

1. 이모지/수제 SVG 아이콘 전부 MUI 아이콘으로 교체. 매핑: 📢Campaign 📅📆CalendarMonth 📊Assessment 🖥️Monitor 🔗Link 🕐Schedule 🗂️FolderCopy 🔔NotificationsActive 🔍Search(검색창 `.search-wrap` 어돈먼트) / 로드맵: Assignment·DesignServices·Construction·LocalShipping·FactCheck·Settings·RocketLaunch / 바로가기: School·AutoAwesome·Public·Memory·Factory·Bolt·TableChart
2. 좌측 사이드바 도입(SideNav). 그룹: 홈 / 업무(업무일정·업무현황) / 장비(장비현황) / 정보(공지사항·바로가기). 활성 하이라이트 + 건수 배지. TopBar의 메뉴 칩·바로가기 플라이아웃 제거. 홈 카드 라벨 "메뉴"→"미리보기".
3. 대시보드 확대 + 카드 왼쪽 컬러 보더 제거. 로드맵 아이콘 52→76px 등 전반 확대, 폭 960→1180px.
4. 장비현황을 로드맵과 동일 레벨 섹션으로 승격, 미리보기 그리드에서 장비현황 카드 제거.

## 미정리 항목 (다음 세션 후보)

- `src/assets/bnav-*-mask.png` + `.bnav-mask/.bnav-jangbi/.bnav-gongji` CSS — MUI 교체로 미사용, 삭제 가능
- `body.eq-wide main{max-width:98vw}` — React 버전에선 사실상 무효(장비 페이지는 `.page` 사용)
- 사용자가 사이드 메뉴 "레퍼런스" 디자인을 따로 갖고 있을 수 있음 — 공유받으면 SideNav 스타일 맞출 것

## Codex 역할 변경

Codex는 Claude에게 다음 작업 프롬프트를 작성하지 않는다.

Claude가 bridge 폴더에 남긴 개발 보고서는 사용자와 대화하기 위한 참고자료로만 사용한다.

Codex의 역할은 비개발자인 사용자를 위한 UX/UI/기능 개발 자문위원이다.

Codex는 각 단계에서:
- 클로드 보고 내용을 쉽게 요약한다.
- 개발 결과가 실제 업무에 어떤 의미인지 설명한다.
- 필요한 경우 시각 예시나 선택지를 제공한다.
- 사용자에게 상황에 맞는 추천을 한다.
- 사용자가 명시적으로 요청하지 않는 한 Claude 지시용 프롬프트를 작성하지 않는다.
