# ANGELS FAB 구축 관리 대시보드

GIST ANGELS FAB(반도체 팹) 구축 프로젝트의 사내 관리 대시보드.
원본은 단일 HTML SPA([reference/index.html](reference/index.html), 분석: [ANALYSIS.md](ANALYSIS.md))이고, 이 저장소는 React로 전환한 버전.

## 스택 & 명령어

- React 18 + TypeScript + Vite, Redux Toolkit, react-router-dom(HashRouter), @mui/icons-material (+@mui/material, emotion)
- `npm run dev` — 개발 서버 (`.claude/launch.json`에 port 3600 등록, preview_start로 실행)
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

## 학술·교육 행사(Events) 등록 규칙 & 워크플로

페이지: `/events` (`src/pages/Events/index.tsx`). 카드 = 유형3(풀블리드 포스터 3:4 + 그라데이션 오버레이 + 상태 pill + 링크아이콘), 클릭 시 **인카드 슬라이드업 상세**(Dialog 아님).
데이터: `src/constants/events.ts`의 `FAB_EVENTS`(repo 모델, git 저장). 포스터 이미지: `public/events/`, 없으면 `accent` 그라데이션. D-day/상태는 `eventStatus()` 자동.

**Events 파일 구조 (3분할)**: `index.tsx`(오케스트레이터 — `useMediaQuery('(max-width:768px)',{noSsr:true})`로 PC 4열 그리드 ↔ 모바일 캐러셀 분기, PC `EventCard` 래퍼) / `eventCard.tsx`(PC·모바일 공유 비주얼 — `EventCardInner`=포스터+칩+기본오버레이+슬라이드업 상세, `PosterBg`/`InCardDetail`/`eventCategory`/`CAT_COLOR` 등. 상수만 import → 순환참조 없음) / `MobileCarousel.tsx`(모바일 전용).
**모바일(≤768px) UX**: 상태탭(진행중=그린·예정=앰버솔리드+짙은글씨·종료=그레이틴트, `eventStatus().tone`으로 분류·건수) + CSS `scroll-snap` 스냅 캐러셀(카드 86%, 다음 카드 ~12% peek, 라이브러리 없음) + `1 / N` 페이저. **상태 보존 모델**: 세 패널을 모두 마운트하고 비활성만 `display:none`(scrollLeft 보존, `useLayoutEffect`로 탭전환 시 복원) / 카드 열림 = 행사 id 전역 `Set`(탭 무관 독립·유지) — open이 React 상태라 탭전환만으로는 transform/scrim이 안 바뀌어 **슬라이드업 애니메이션 재생 안 됨**(사용자 토글 때만). 카드 토글은 `pointerdown/move`로 **스와이프(>9px)와 탭 구분**, 사이트 링크/버튼 클릭은 `closest('a,button')`로 토글 제외. 상세는 PC 양식 재사용(Event/Place/Business 아이콘+일시·장소·주최, summary 최대 3, OpenInNew 사이트버튼). ※ CDP 프리뷰 리사이즈는 matchMedia `change`를 안 쏴서 라이브 리사이즈로 분기 검증 불가 → **각 폭에서 새로고침(fresh mount)으로 검증**.

**워크플로 (옵션 B — 추가비용 0, Claude API 키 불필요)**: 팀원은 Events "새 예정행사 등록" 버튼(`isAdmin`만 노출, `EVENT_REQUEST_FORM_URL` 구글폼)으로 **행사 URL·구분·포스터(선택)** 제출 → 폼 소유자 이메일 알림 → 관리자가 Claude에게 "행사 큐 등록" 요청 → Claude가 URL에서 정보 추출해 `FAB_EVENTS`에 추가·커밋·푸시. 포스터는 구글폼 업로드(드라이브 저장) → Claude가 가져와 리사이즈(가로 800px·JPEG·~200KB)해 `public/events/`.

**등록 규칙 (반드시 지킬 것)**
- **제목 = 정식행사명(영문/약칭)이 메인, 한글명은 ` - `(dash) 뒤에.** 예: `ISPSA 2026 - 제22회 반도체 물리·응용 국제심포지엄`. **카드**(`CardTitle`): 한 줄에 들어가면 ` - `로 연결, **줄바꿈되면 dash 빼고 한글명부터 다음 줄**(약칭 한 줄 유지) — JS로 한 줄 여부 측정. **팝업**(`splitTitle`): 한 줄이면 ` - `로 연결.
- **주관기관 = 실제 주최/주관의 한글 정식명.** 약어 단독 금지, 불확실하면 **검증**. 행사목록 사이트(KASPA 등)는 주관 아님 (ISPSA 주최=한국물리학회(KPS)).
- **요약 3~5 bullets** (`EventSummaryItem[]`). 자동추출은 초안 → 확정 전 검토. (회차·참가규모 같은 개요성 bullet은 넣지 않음)
  - **헤더-내용 구분**: `{label, value}` — **label(설명제목)은 흰색(강조)·내용(날짜·연사)은 본문색(secondary)**. 사전등록·초록마감은 각각 별도 bullet.
  - **연사(Plenary/Keynote)**: `{label, speakers[]}` — **이름만(소속 생략)**, 라벨 옆에 **한 줄**로 적당히(약 4명, 너비 70%선)만 쓰고 넘치면 끝에 ` 등`. (요약 bullet 앞 점은 없음)
- 학회/심포지엄 **필수**: 등록일정(사전등록·초록마감 분리) + Plenary/Keynote. / 교육·세미나: 신청기간·대상·강사·수강료. / 전시회: 관람기간·입장방법·규모.
- **포스터·정보 자동 수집(URL/구글링)**: 행사 URL 또는 행사명만 주어지면 Claude가 **공식 사이트·구글 검색에서 포스터 이미지와 정보(일정·장소·주최/주관·등록일정·Plenary 등)를 파싱**해 등록(여러 행사면 워크플로로 병렬 조사). 실전 팁:
  - ① 사이트 HTML이 **403(봇차단)** 이어도 **이미지 파일 CDN URL은 브라우저 UA(`Invoke-WebRequest -UseBasicParsing`)로 직접 다운로드** 가능(예: semi.org).
  - ② **풀 세로 포스터**는 메인페이지보다 **공지 첨부(WordPress `kboard_attached`)·보도자료(전자신문 `img.etnews.com`)·협회 배너(`kpca.or.kr`)** 에 있는 경우가 많음. Wix 사이트(`static.wixstatic.com`)는 히어로=그라데이션 배경+로고 CSS합성이라 풀포스터 단일파일이 없을 수 있음.
  - ③ **합성은 2스타일(사용자 확정)**: 실제 **풀 세로 포스터**(ISPSA·ASPS 등)는 그냥 가로 800px 리사이즈. 그 외 합성은 — **풀/정사각 키비주얼=KPCA식**(이미지 상단 배치 + 그 아래를 `바탕색→어두운 바탕색(×0.3) 세로 그라데이션`, 하단 ~90px 페더) / **와이드 배너=SEDEX식**(배너 중앙 0.40 + 전체 `바탕색→어두운 바탕색` 세로 그라데이션 bg, 배너 상하단 페더). **❌ 검정 급전환·열별 세로연장(streaks) 금지** — 바탕색(보라/청록/파랑)을 유지한 채 어두워지게. 텍스트가 어두워지면 2존(텍스트 위는 약하게, 아래는 강하게)으로. (`LinearGradientBrush`는 `[LinearGradientMode]::Vertical` 열거형 필수, 문자열 'Vertical' 바인딩 실패)
  - ④ **라이브 포스터가 사용자가 준 버전보다 최신**일 수 있음(예: ISE 일정 7.14~16→14~17, 논문마감 5.11→6.08 변경) — **공식 사이트 기준**으로 쓰고 차이는 사용자에게 알릴 것.
  - ⑤ 보도자료 아트워크의 **언론사 워터마크/기자연락처**는 잘라낸 뒤 합성.
- **포스터(직접 업로드)**: 구글폼 업로드(드라이브) → Claude가 가져와 처리. **공통: 가로 800px·JPEG·~200KB → `public/events/`. 썸네일=팝업 동일 이미지.** PDF 변환 불가(표지 캡처로).
- **썸네일 초점(`posterFocus`)**: 카드 썸네일은 포컬 포인트 크롭. 새 포스터 등록 시 `posterFocus: { x: 50, y: <행사제목 세로%> }` 지정 — `PosterBg`가 그 y를 카드 **~40%**로 `translate` 정렬(제목 높이 일관화), `cover`로 비율 유지·넘침 크롭, 빈 영역은 같은 포스터 블러배경이 채움. 제목이 이미 ~40%면 생략 가능(기본 x50/y40/scale1/cover). 풀 표시가 필요하면 `fit:'contain'`(여백=블러). 카드 UI 제목과 포스터 속 제목은 별개.
- **날짜(`fmtEventDate`)**: 같은 연·월→끝은 일만(`2025.05.05-08`) / 같은 연·다른 월→끝은 월.일(`2025.05.30 - 06.05`) / 다른 연→전체.
- **칩 순서**: 분류칩 → 상태칩 (카드·팝업 둘 다). **분류칩 = 메뉴 3대 분류(학술·교육·전시)** — `eventCategory(kind)`로 매핑(국제·국내학회·컨퍼런스·심포지엄·포럼=학술 / 교육·세미나·실습·워크숍=교육 / 전시회·박람회·산업전·쇼=전시). **카드칩**=분류명(학술/교육/전시) / **팝업칩**=세부 kind(국제학회 등). 색은 `CAT_COLOR`: **학술=#3b82f6 블루 / 교육=#10b981 그린 / 전시=#a855f7 퍼플**(상태칩 초록·노랑과 안 겹치게 전시는 퍼플). filled + `getContrastText` 자동대비.
- **카드 상태칩**: 진행중=초록 점멸 dot / 예정=노랑 dot+D-# / 종료=회색. 카드 **바로가기 아이콘은 좌상단 상태칩 옆**(칩줄 안). **칩 글자 전부 흰색**(분류칩·세부분류칩·상태칩=반투명펄+색점).
- **상세 팝업 정보영역 어둠처리**: 합성 포스터(바탕색형)는 `darkInfo:true` → 정보 높이만큼 **반투명 검정 스크림(`.78`, 상단 페이드)** 로 바탕색이 비치며 어두워짐(검정 급전환 금지). 실제 풀포스터(ISPSA·ASPS)는 `darkInfo` 없이 **기본 옅은 그라데이션**(`.98→0`). **ISPSA는 건드리지 말 것**(사용자가 원본 선호). **하단 '행사 사이트' 버튼만** `KIND_BLUE`(#3b82f6).

**행사 등록 양식 (구글폼 제출 → URL서 정보 추출 → 이 형태로 `FAB_EVENTS`에 추가·커밋·푸시)**
```ts
{
  id: 'ispsa2026',                        // 영문 약칭 소문자
  title: 'ISPSA 2026 - 제22회 반도체 물리·응용 국제심포지엄', // 약칭 - 한글정식명
  kind: '국제학회',                        // 국제/국내 분류
  start: '2026-06-28', end: '2026-07-02',  // 단일일정이면 end 생략
  venue: '제주 해비치 호텔 & 리조트',
  organizer: '한국물리학회(KPS)',           // 실제 주최/주관 한글 정식명(검증)
  link: 'https://ispsa.or.kr/',
  poster: 'events/ispsa2026.jpg',          // 드라이브 포스터 → 가로 800px JPEG 리사이즈
  accent: 'blue',                          // 포스터 없을 때 카드 배경
  summary: [                               // 개요(회/명) bullet 금지. label=설명제목, value=내용
    { label: '사전등록', value: '2026.06.05 ~ 06.19' },
    { label: '초록마감', value: '2026.04.03 (채택 통보 4.24)' },
    { label: 'Plenary', speakers: ['Henk Bolink', 'Jing Kong', 'John A. Rogers', 'Feng Wang'] }, // 이름만, 4명+등
    { label: '공동주관', value: 'CHIPS(한양대)·성균관대·이화여대·군산대' },
  ],
}
```
유형별 summary 필수: 학회·심포지엄=사전등록·초록마감·Plenary / 교육·세미나=신청기간·대상·강사·수강료 / 전시회=관람기간·입장방법·규모.

## 작업 이력 (2026-06-10)

1. 이모지/수제 SVG 아이콘 전부 MUI 아이콘으로 교체. 매핑: 📢Campaign 📅📆CalendarMonth 📊Assessment 🖥️Monitor 🔗Link 🕐Schedule 🗂️FolderCopy 🔔NotificationsActive 🔍Search(검색창 `.search-wrap` 어돈먼트) / 로드맵: Assignment·DesignServices·Construction·LocalShipping·FactCheck·Settings·RocketLaunch / 바로가기: School·AutoAwesome·Public·Memory·Factory·Bolt·TableChart
2. 좌측 사이드바 도입(SideNav). 그룹: 홈 / 업무(업무일정·업무현황) / 장비(장비현황) / 정보(공지사항·바로가기). 활성 하이라이트 + 건수 배지. TopBar의 메뉴 칩·바로가기 플라이아웃 제거. 홈 카드 라벨 "메뉴"→"미리보기".
3. 대시보드 확대 + 카드 왼쪽 컬러 보더 제거. 로드맵 아이콘 52→76px 등 전반 확대, 폭 960→1180px.
4. 장비현황을 로드맵과 동일 레벨 섹션으로 승격, 미리보기 그리드에서 장비현황 카드 제거.

## 미정리 항목 (다음 세션 후보)

- `src/assets/bnav-*-mask.png` + `.bnav-mask/.bnav-jangbi/.bnav-gongji` CSS — MUI 교체로 미사용, 삭제 가능
- `body.eq-wide main{max-width:98vw}` — React 버전에선 사실상 무효(장비 페이지는 `.page` 사용)
- 사용자가 사이드 메뉴 "레퍼런스" 디자인을 따로 갖고 있을 수 있음 — 공유받으면 SideNav 스타일 맞출 것
