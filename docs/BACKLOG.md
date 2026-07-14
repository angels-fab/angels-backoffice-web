# 프로젝트 진행상황 · 백로그 (인수인계)

> 다른 컴퓨터/새 세션에서 이어받을 때 **이 문서를 먼저 읽으세요.** Claude 작업 메모는 각 컴퓨터
> 로컬(`~/.claude`)에만 있어 git으로 안 넘어가서, 핵심 진행상황·백로그·결정사항을 여기에 옮겨 둡니다.
> (비밀키·비밀번호 미포함. Supabase anon key는 원래 공개 키로 `src/api/supabase.ts`에 있음.)
>
> 최종 갱신: 2026-07-14. 배포 브랜치 = **main** (main에 push → GitHub Actions가 빌드→`angels-fab.github.io` 배포).
> **feat/work-hold-archive 등 다른 브랜치에서 작업 금지**(배포 안 됨). `git checkout main && git pull` 후 작업.
> ★ **2026-07-14: 포털 전체 감사(19에이전트) 실시 → [7. 포털 전체 감사 백로그](#7-포털-전체-감사-백로그-2026-07-14) 신설.** 저장 멈춤 안전장치·CSS 경고는 즉시 수정 완료, 나머지 26건은 거기 정리.

---

## 0. 프로젝트 한 줄 요약
GIST ANGELS FAB(반도체 팹) 구축 관리 사내 대시보드. React18+TS+Vite+MUI+Redux, HashRouter.
데이터·인증 = **Supabase**(프로젝트 ref `rmvutlhdcfkqubzrckqf`, 서울). 구글시트/Apps Script는 읽기전용 백업. 상세 규칙 [CLAUDE.md](../CLAUDE.md).

**디자인 규칙(필수)**: ① 이모지 아이콘 금지 — `@mui/icons-material`만. ② 카드 왼쪽 컬러 보더 금지. ③ 홈 대시보드는 크게(작아 보이는 디자인 지양).

---

## 1. 인증·역할 구조 (현재)
- Supabase Auth. **사번 로그인** — 앱이 내부적으로 `사번 → {사번}@도메인` + 비밀번호 `.angels` 패딩(`padPassword`)으로 변환. 사용자는 이메일 안 봄/안 씀.
- 역할 3단계: **guest / member / admin** (`profiles.role`). `src/auth/role.tsx`. `is_admin()` DB 함수로 RLS 게이트.
- **auth 이메일 도메인 = `angels-fab.com`**(신규). 기존 4계정은 `@angels.local`이라 login이 신규→레거시 순 폴백(`empEmailLegacy`). 이유: `.local`은 예약 TLD라 GoTrue 신규 가입에서 거부.
- DB 현황: `profiles` 4건 전부 admin, pending 0. `calendar_events` 278건 전부 단독(series_id='').

---

## 2. 이번(2026-07-07) 세션에 완료 (전부 배포됨, 상세는 커밋 메시지)
- **W3 UI 통일 마무리**: 필터칩 공용화(`components/FilterChip.tsx` TintChip/PillChip), 모달 3종 MUI Dialog+TextField 전환(커스텀 `.m*/.modal-*` CSS 전부 제거), 색 팔레트 토큰 통합, 장비대장 표→모바일 카드(`.rtable` 재사용 패턴), 공지 표 모바일 가독성, 죽은 CSS 대량 제거.
- **W2b① 순서편집 손잡이(≡)**: 카드 본문 스크롤 유지, 손잡이만 드래그.
- **W4 반복 일정 개별 예외**(materialize): 반복=발생일별 개별 행+`series_id`, 수정/삭제 시 **이 일정만/이후/전체** 3-범위. 적대적 리뷰 반영(월말 앵커·경계·방어).
- **계정·개인화 A(계정 기본)**: ①비밀번호 변경(설정) ②가입 신청→관리자 승인(설정) ③잔재 정리.
- 적대적 리뷰(멀티에이전트) 결론: 기능 회귀 0.

---

## 3. ⚠️ 라이브 확인 대기 (운영 DB 쓰기라 사람이 실제로 눌러 확인해야 함)
1. **모달 3종 실제 저장**: 업무 등록/수정·장비 추가·일정 추가/수정. (필드 바인딩은 preview 확인, 실제 create/update 미실행)
2. **W4 반복**: 매주/매월 시리즈 생성 → 그 중 하나 "이 일정만/이후/전체" 수정·삭제.
3. **가입/승인 흐름**: 사번 가입 신청 → 설정 "가입 승인 대기"에 뜸 → 일반/관리자 승인 → 그 계정 로그인.

### ✅ 해결됨 — 가입 이메일 블로커 (2026-07-07)
`email address invalid` 원인 = GoTrue가 확인 메일을 보내려다 막힘(사번 계정은 받을 메일함 없음). **대시보드 Authentication → Sign In / Providers → Email → "Confirm email" OFF 완료.** GoTrue `/auth/v1/settings`에서 `mailer_autoconfirm: true` 확인 = 자동 확인(메일 안 보냄). 이제 사번 가입 통과.
- (직전 전송 시도로 최대 1시간 rate limit 잔존 가능 → 이후 메일 안 보내니 자연 해소.)

---

## 4. 남은 작업 백로그

### 계정·개인화 로드맵 (A→B→C→D, A 완료)
- **A. 계정 기본 — ✅ 완료**(위 2번).
- **B. 권한 4단계(게스트/유관자/팀원/관리자) — Phase 1 완료·배포 / 나머지 보류 (2026-07-07)**: 사용자 확정 모델. **Phase 2·3은 사용자 요청으로 나중에**(필요해질 때).
  - **모델**: `role` 단일 필드 `guest < associate(유관자) < member(팀원) < admin`. **admin은 member의 상위 집합**(관리자=팀원+관리). 명칭 맵 `ROLE_LABEL`(role.tsx). 게이트: `isAdmin`(관리)·`isMember`(팀원 이상=열람+작성)·`isAssociate`·`loggedIn`.
    - **게스트**: 홈 로드맵·행사·바로가기. **유관자**: 로그인 + 행사·바로가기(+장비 제한열람=Phase 2). **팀원**: 팀 콘텐츠 전체 열람+**작성**(공지·업무일정·업무현황·개선·장비). **관리자**: +사용자 승인/관리·포털관리. 승격=현 관리자가 **팀원에게만** admin 부여(Phase 3 화면).
  - **✅ Phase 1 완료·배포**: 프런트 4단계 골격 — role.tsx(associate 추가·isMember·ROLE_LABEL), `RequireMember` 가드(+ /notice·/calendar·/work·/improve·/equipment 적용), SideNav·BottomNav·MobileMenuDrawer 4단계 메뉴, TopBar·설정 표시명, 홈 대시보드=팀원+, 승인 버튼 **유관자/팀원**. **DB**: `is_member()` 함수 + 장비 3테이블(`equipments`·`equipment_history`·`schedules`) SELECT `is_member()` 정책 추가 → **팀원 장비 열람**(sim 확인: is_member=true·eq 29건). 쓰기 정책 무변경(팀원 아직 열람만).
  - **⏸️ Phase 2 (보류 — 나중에)**: 팀원 **작성** 권한 — 공지·업무·일정·개선 write RLS(is_admin()→is_member) + 프런트 write 버튼 게이트(isAdmin→isMember). + 유관자 **장비 제한열람**(예산 price·제조사 maker·모델 제외한 뷰 `equipments_public` + 컬럼 숨김). ※ 팀원이 실제로 글을 쓸 때 / 유관자를 실제로 초대할 때 착수.
  - **🔶 Phase 3**: 설정 "사용자 관리"에 **회원 목록 + 권한 변경(Select) + 강퇴** ✅ 완료(관리자만·본인계정 잠금방지·관리자승격은 팀원에게만). **⏸️ 보류(나중에)**: 가입/승인/거절/권한변경/강퇴 **이력**(`account_events` 테이블). (auth.users 완전 삭제는 service_role 필요 → 강퇴=프로필 삭제 소프트킥.)
  - **🐞 버그픽스(2026-07-07)**: ① `profiles_role_check` CHECK에 'associate' 없어 **유관자 승인 무반응** → 제약을 `guest/associate/member/admin/pending`으로 교체. ② `signUp()`이 기본 supabase 클라이언트로 실행돼 **가입 시 현재(관리자) 세션을 덮어써 로그아웃** → `makeSignupClient()`(persistSession:false) 격리 클라이언트로 변경, signOut 제거.
  - **⏳ 기타**: 유관자·팀원은 `/settings`(RequireAdmin) 못 들어가 **본인 비밀번호 변경 불가** — 필요 시 Settings를 RequireAuth로 열고 승인섹션만 isAdmin.
- **C. 개인화 1차 (진행 2026-07-07)**: 사용자 결정 = **캘린더 뷰·업무 뷰·업무 카드 순서 = 계정별(로그인 사람별) / 카드 이동·삭제 = 팀 전체 공유**.
  - **✅ Stage 1 — user_settings 서버 배선 + 뷰 계정별**: `user_settings`(user_name PK·settings jsonb) RLS 정책 추가(`user_settings_own`: `user_name=my_name()` self read/write, 마이그레이션 적용·member 컨텍스트 sim 검증). `api/userSettings.ts`(fetch/save upsert) + `userSettingsSlice`(load·setSetting·putSetting 디바운스 저장·resetUserSettings) + store 등록 + MainLayout 로그인 시 로드/로그아웃 시 리셋. 캘린더 뷰·업무 KPI 뷰를 **계정별**로 전환(로컬 캐시 즉시 + 설정 로드 시 서버값 1회 동기화 = 기기 넘나들며 유지).
  - **✅ Stage 2 — 내 기준 새 글 배지 + 필터 기억 (2026-07-12 완료)**: `user_settings`에 `seen.{notice|work|improve}` = **내가 확인한 시점의 새 글 num 배열** 저장(게시일이 일 단위뿐이라 시각 비교로는 같은 날 늦게 올라온 글을 놓침 → num 집합 방식, 7일 만료로 자동 정리. 공지 id는 idx 기반이라 num이 안정키). `useNavBadges`가 새 글(7일 규칙) 중 seen에 없는 것만 카운트, seen 미저장(비로그인·첫 사용)은 기존 전체 폴백. 읽음 처리 = 각 페이지의 `useMarkSeen`(useNavBadges.ts) — 데이터 ready + 설정 로드 **성공**(`loadedOk` 신설, rejected여도 ready=true라 분리) + 로그인 게이트(자동 저장이 서버 설정을 빈 값으로 덮는 사고 방지), 값 같으면 저장 생략. 필터 기억 = `work.filter.cats/mgrs`(정렬 배열), usReady 후 1회 복원(복원 전 저장 금지)·변경 시 저장·해제 상태([])도 기억. 라이브 실측: 배지 2→0, DB seen 조작 후 새로고침→배지 1(안 본 것만), 필터 저장→복원→해제, 기존 settings 키 보존, 콘솔 0. **적대적 리뷰 확정 9건 반영**: 설정 저장을 전체 스냅샷 upsert → **키 단위 병합**(RPC `user_settings_merge`, 슬라이스 pendingPatch)으로 교체(멀티탭/기기 LWW 클로버 구조 해결), useMarkSeen에 `!error` 게이트(로드 실패=새글0 오인 방지), 필터 복원 loadedOk 게이트·저장은 사용자 토글에서만(0건 프룬이 계정 저장값 지우던 회귀 차단).
  - **✅ Stage 3 — 업무 카드 순서 계정별 (2026-07-12 완료)**: 진행중 카드 드래그 순서를 `user_settings` `work.order`(num 배열)로 이동 — rank = 개인 순서 index(목록에 없는 신규·복원 카드는 맨 아래=기존 미지정 관례), 개인 순서 없으면(드래그 안 함·설정 로드실패) 종전 팀 기준선(works.sort_order) 폴백이라 화면 무변화. commitOrder = 낙관 orderMap + `putSetting`(병합 저장, usLoadedOk 게이트). **팀 works.sort_order는 드래그로 더 이상 갱신 안 함**(신규·복원 시 서버 부여 기준선으로만 유지, 상태변경·삭제는 계속 팀 공유). 팀 저장 배관 제거(updateWorkOrder 호출·3초 타이머·sendBeacon·실패 스낵바 — api 함수는 잔존). 드래그는 종전대로 관리자만(상태드롭·삭제드롭과 한 시스템 — 팀원 개방은 권한 Phase 2와 함께). 실측: 드래그→work.order 저장·sort_order 불변·새로고침 유지·키 삭제 시 팀 순서 복귀.
- **✅ D. 개인화 2차 (2026-07-12 완료) → A~D 메인 트랙 완주**: ① **홈 섹션 개인화** — Home/index.tsx 섹션 레지스트리(kpi/schedule/pins/work/equipment/notice), `home.order`(모르는 id 무시·누락 id 기본순서 병합)+`home.hidden`. PageHeader 톱니(팀원+loadedOk) → Popover 위/아래·표시토글·'기본 배치로'. 로드맵은 게스트 공개·디자인 규칙상 개인화 제외(최상단 고정). ② **관심 업무 핀** — TaskAccordion 헤더 별(Star) 토글(`WorkPinButton`, `work.pins` num 배열) → 홈 '관심 업무' 섹션(`PinnedWorksSection`, 핀 순서·미존재 자동 제외·행에서 해제 가능, 핀 0이면 미렌더). 아이콘은 Remind 압정과 혼동 방지 위해 **별** 채택. (구 '결정 대기: 업무카드 정렬 팀vs개인'은 Stage 3에서 개인별로 확정·구현 완료.)
- 참고: `user_settings` 테이블 준비돼 있음.

### 구글캘린더 ↔ 앱 양방향 동기화 (2026-07-09 구축, 승인 대기)
- **배경**: 7/4·7/6 이관은 일회성 스냅샷 — 상시 동기화는 원래 없었음(이후 GCal 신규 일정이 앱에 안 넘어와 "끊긴 것처럼" 보임). 사용자 결정 = **양방향 복원**.
- **구조**: GAS 시간트리거(10분) `syncCalendar()` — GCal(-30d~+365d) 조회→`calendar_sync` RPC 업서트(키: 단일=iCal UID·반복 인스턴스=UID/발생일, LWW)→앱쪽 변경(생성/수정/삭제) GCal 반영→`calendar_sync_ack`(CAS). 앱 삭제=톰스톤(calendar_del_log)→GCal 삭제 / GCal 삭제=후보 반환→GAS 실존확인 후 확정(2단계). DB 기록본 `docs/db/gcal-sync.sql`, 엔진 Code.gs 끝 섹션.
- **적대적 리뷰(멀티에이전트) 13건 반영**: 톰스톤 키 업서트 제외(삭제 부활 차단)·클레임 GCal시각 시딩(첫실행 역덮어쓰기 차단)·삭제 2단계(창밖 이동 오삭제 차단)·ack CAS/항목격리/0행 톰스톤·LIKE 이스케이프·중복키 스킵·설정 토큰 사전검증.
- **✅ 가동 완료 (2026-07-09)**: authorizeSync 승인(bliverus 계정) → 토큰 주입 + 트리거 3종 설치 — ① 10분 타이머(안전망) ② **캘린더 변경 트리거**(구글→포털 즉시) ③ **nudge**(포털 저장 직후 즉시, `calendar.ts`가 `?calsyncnudge=1` fire-and-forget · 30초 대기1 패턴). GAS @66.
- **✅ E2E 검증**: 첫 동기화 = 클레임 77·유입 5(7/13 연구개발특구 포함)·push 2(KITECH·KANC). 테스트 일정으로 앱→구글 생성/삭제 즉시 반영 + **skippedTombstoned 방어 실동작 확인**(삭제 부활 차단). 톰스톤 0·연결 84행.
- **✅ 사용자 실측 완료(2026-07-09)**: 캘린더→포털 즉시 ✓, 포털→캘린더 수초 내 ✓(옛 탭은 하드 새로고침 필요했음 — nudge 코드가 배포 전 탭엔 없어서). 중복 3쌍 병합(상세 제목 기준) 완료 — 부산 2건 구글 제목 상세본 갱신, KANC 1건 수렴. **동기화 프로젝트 종결.**
- **⚠️ 운영 규칙**: 반복은 개별 이벤트로 push(시리즈 아님) / 제목·장소·시간·종일만 동기화(설명·색·참석자 제외) / 충돌=최신 수정 우선.

### 캘린더 UX (비치명)
0. ✅ **완료(2026-07-09)**: 일정 작성 폼에 **일정 종류 픽커**(참석자 칩과 동일 스타일, CAT_META 색·단일선택·해제 가능). 선택 시 제목 앞 `[태그]` 자동 부착(STD_TAG — 국내출장/국외출장은 classify의 국외 판별까지 통과), 미선택 시 기존 자동분류. **수정 시 기존 태그 자동 인식·종류 안 바꾸면 원본 태그 문구 보존**(`[출장] 국내(…)` 형식 유지).
1. ✅ **완료(2026-07-07)**: 일정 클릭 → (관리자) **수정 모달 바로 열기**. 열람 사용자는 상세 팝오버 유지. 호버는 여전히 빠른 상세. 드래그 직후 클릭은 `dragClickSuppress`로 무시.
2. ⏳ 반복 일정 **발생일 드래그 이동** (현재 시리즈 발생행은 `editable:!ev.recurring`이라 비활성). ※ 폼 "이 일정만" 날짜 변경은 W4로 이미 됨. **주의**: 활성화 전 updateCalEvent가 그 발생행만 이동하는지(시리즈 전체 아님) 확인 필요.
3~4. 특정/범위 삭제 → **W4에서 이미 커버**. 라이브 확인만.

### 캘린더 후속 다듬기 (난이도/제약 커 보류)
- 무한 스크롤(FC 커스텀 큼) · 멀티데이 세로줄(데이터 구조) · 월/주 자동 가로회전(**iOS 사파리가 웹 화면회전 잠금 막음** — 안내만) · 상세 팝오버→아코디언.

### 표 → 카드 (남은 것)
- 개선요청 표(관리자 전용 인라인 편집) 모바일 카드화 = 손 많이 가고 가치 낮아 **보류**. 필요 시 `.rtable` 재사용.

### 안 하기로 함
- **W5 공개 소개페이지** — 사용자가 안 함 결정.
- **사진 갤러리 메뉴(별도 팀 사진첩)** — 오해로 판명(2026-07-12 사용자): 원래 의도는 **데모결과의 이미지 갤러리**(이미 구현됨)였음. 별도 메뉴 안 만듦. (참고용 용량 검토: Storage 1GB ≈ 웹최적화 2~3천 장, egress 여유.)

---

## 7. 포털 전체 감사 백로그 (2026-07-14)

업무포털 전체를 6관점(기능버그·모바일UX·미완성·접근성·데이터권한·성능코드) 19에이전트로 병렬 점검 + 버그성 항목 적대 검증. 총 29건 발견(적대검증 통과, 오탐 0). 심각도 = 데이터유실/오작동 위험 순.

### ✅ 즉시 수정 완료 (2026-07-14, 커밋 `cd02b77`)
- **[A1] 저장 멈춤 안전장치 전면 적용**(감사 최상위 = high×2, 기능버그+데이터권한 중복 발견). 공지·데모에만 있던 `ensureSession()+withTimeout(20s)` 안전장치를 **works·improve·calendar·eq·userSettings·events 전 write + demo 이력 insert**에 전부 적용. 사무실망 토큰갱신 스톨로 저장이 무한정 멈추던 문제(메모리 `supabase-write-session-stall`) 근본 차단. 특히 낙관적 UI(업무 상태 드래그·캘린더 일정 이동)는 저장 실패해도 "저장된 것처럼" 보이다 새로고침 시 유실됐는데, 이제 타임아웃 오류로 드러남.
- **[A2] index.css:854 주석 `*/` 조기종료**(low, 성능코드). 주석 안 `.modal-*/`의 `*/`가 주석을 조기 종료해 뒤 텍스트가 CSS로 새어나가 esbuild 경고 + `.post-wrap` 규칙 무효화. 문구 수정으로 경고 제거.

### 🔴 우선순위 높음 (데이터 유실·기능 고장 — 다음 후보)
- **[B1] 상세 드로어 '수정'이 서식 업무 본문을 사라지게 함**(high, 기능버그). 업무 수정 경로가 둘(카드 연필=리치편집기 / 상세창 '수정'=구형 WorkWrite 밋밋한 입력창)인데 서로 다름. 구형 입력창은 본문을 '글자만' 저장하는데 화면은 서식본(contentFmt) 우선 표시라, 여기서 본문 고쳐 저장하면 **제목만 바뀌고 본문 수정이 화면에 안 나타남**(사라진 것처럼 보임). 서식 없는 평문 업무는 정상. 관리자만 해당. → 상세 드로어 '수정'도 인라인 리치편집기로 통일하거나 WorkWrite 폐기(신규등록 경로는 이미 죽어 있고 편집만 실사용). `Work/index.tsx:1337`·`TaskDetailDrawer.tsx:65`·`WorkWrite.tsx:131`
- **[B2] 장비 로드 한 번 실패 → 목록 통째로 사라짐 + 오류배너·재시도 없음**(med, 기능버그). 업무·공지·캘린더는 로드 실패해도 마지막 목록 유지 + 빨간 배너를 띄우는데, 장비관리(eqSlice)는 정반대로 데이터를 전부 비우고 배너·자동재시도도 없음 → 네트워크 잠깐 끊긴 채 새로고침 1회 실패하면 장비 목록이 통째로 없어지고 "조건에 맞는 장비 없음"(사실과 다름)만 남음. → rejected에서 기존 데이터 유지 + Alert(다시 시도) + 마운트 시 1회 자동재시도. `eqSlice.ts:183`·`Equipment/index.tsx:116`·`EquipmentOps/index.tsx:48`
- **[B3] 일정 편집 중 새로고침하면 미저장 드래그/리사이즈 변경 소실**(med, 기능버그). 장비 '일정 편집'은 끌어 바꾼 뒤 '편집 종료→저장'을 눌러야 실제 저장인데, 편집 도중 헤더 새로고침 버튼을 누르면 서버 원본이 편집 내용을 경고 없이 덮어씀. 새로고침 버튼이 편집 중에도 눌리는 위치라 오조작 쉬움. → 편집 모드일 때 새로고침 비활성 또는 '저장 안 된 변경 사라짐' 확인. `Equipment/index.tsx:561,676`
- **[B4] 60일 초과 멀티데이 일정은 61일째부터 막대 안 그려짐**(low지만 명확한 버그). 캘린더가 여러 날 일정을 하루씩 펼치는 로직이 최대 60칸까지만 만듦 → 두 달 넘는 긴 일정은 중간에 끊긴 것처럼 보임. → `calSlice.ts:44` `expandRawEvent` 상한 60→366.

### 🟠 안정성·오류 처리
- **[C1] React ErrorBoundary 부재 → 렌더 오류 시 앱 전체 백지**(med, UX). 화면 그리다 한 곳이라도 예외(예: 서버가 예상과 다른 모양 데이터) 나면 그 페이지만이 아니라 포털 전체가 흰 화면. 안내·복구 UI 없음. → App 감싸는 ErrorBoundary('일시적 문제·새로고침'). `main.tsx:18`·`App.tsx:3`
- **[C2] 로드 실패를 '데이터 없음'으로 오인 + 준비된 ErrorBanner 미사용**(med, UX). 공지·개선·장비는 로드 실패 시 "○○ 없습니다" 빈 상태만 뜸(실패인데 원래 빈 것처럼). Work는 제대로 '다시 시도'를 보여줌. 만들어 둔 `ds/ErrorBanner`가 실제 페이지엔 안 쓰이고 예시 화면에만 있음. → 각 목록 empty 분기 전 error 먼저 검사해 ErrorBanner(onRetry)로. `Notice:366`·`Equipment:739`·`Improve:679`
- **[C3] 설정>사용자 관리: 성공/실패 스낵바·확인창 전무**(med, UX). 관리자가 권한 변경·승인/거절·강퇴해도 확인 메시지 없음(목록만 조용히 재로드). 실패해도 무표시 → 바뀐 줄 알지만 안 바뀐 상태 가능. 권한 드롭다운은 확인창도 없이 즉시 반영. → useSnack 부착 + error 확인 + 권한변경 확인 스텝. `Settings/index.tsx:109,115`

### 🔵 보안·권한 (일부는 Supabase 대시보드 직접 조작 필요)
- **[D1] ★ 읽기 RLS가 로그인 전원 `true` — 유관자에게 백엔드 개방**(med, 데이터권한). 화면/주소창에선 유관자(associate)가 업무·공지·개선·일정·데모 페이지에 못 들어가게 막았지만, DB 규칙은 이 표들이 "로그인만 하면 누구나 읽기(true)"라 유관자 계정이 API로 직접 요청하면 전부 읽힘(화면만 숨긴 상태). 장비·도입일정은 이미 `is_member()`로 제대로 막힘. **지금 유관자 계정이 없으면 당장 새는 건 아니지만, 외부 유관자에게 계정 주는 순간 사내 전 업무 노출.** (비로그인은 전부 차단돼 안전.) → 해당 표 SELECT 정책 `true`→`is_member()`. **DB 마이그레이션 필요.**
- **[D2] profiles 사번(로그인 ID) 노출**(low, 데이터권한). 직원 명단(profiles)도 '로그인 전원 읽기'라 유관자 포함 누구나 전 팀원 이름+사번을 뽑을 수 있음. 자동완성엔 이름만 필요(fetchAuthors는 이미 name만 조회). → 이름만 뷰로 제한하거나 emp_no는 관리자만. **DB 정책.**
- **[D3] 비밀번호 정책 약함**(low, 데이터권한). ① Supabase '유출된 비밀번호 차단(HaveIBeenPwned)' 꺼짐(켜면 무료로 흔한 유출 비번 차단) ② 고정 `.angels` 접미사는 코드·문서 공개라 보안 효과 0(사번 UX용, 없앨 순 없지만 '보안 아님' 인지 필요) ③ 설정 비번변경이 4자만 넘으면 통과. → **①은 Supabase Auth 대시보드에서 클릭 한 번**, ②③은 코드/문서. `supabase.ts:45`·`Settings:58`
- **[D4] DB 함수 search_path·정책 role 하드닝**(low, 데이터권한). ① 여러 DB 함수 search_path 미고정(보안 어드바이저 WARN) ② demo_chat_update 정책 대상이 `public`(조건식 덕에 지금 새진 않으나 `authenticated`로 명시 권장). → **DB.** 지금 뚫리는 건 아님.

### ♿ 접근성 (키보드·스크린리더)
- **[E1] 캘린더 월/주 그리드가 마우스 좌표로만 동작 — 키보드/스크린리더로 일정 열람·편집 불가**(high, 접근성). 일정 칸을 clientX/Y 히트테스트로만 감지 → 마우스 없이는 달력 일정을 못 엶. 상단 요약 목록으로 일부만 조회 가능. → FullCalendar eventClick/키보드 포커스 활용 또는 tabIndex·Enter 핸들러. `Calendar/index.tsx:536,554`
- **[E2] `<main>` 랜드마크·'본문 바로가기' 스킵링크 부재**(med). 매 페이지 왼쪽 메뉴를 Tab으로 전부 통과해야 본문 도달, 낭독기 '본문 점프' 불가. → app-content를 `<main>`으로 + 스킵링크. `MainLayout.tsx:61,64`
- **[E3] 파일 드롭존이 onClick만 — 키보드로 첨부 불가**(med). 포스터·사진 첨부 네모가 마우스 클릭 전용(진짜 input은 hidden). → role="button"·tabIndex=0·onKeyDown. `SubmitEventModal.tsx:94`·`DemoResults.tsx:464`
- **[E4] 주 메뉴가 `<nav>` 아님·aria-current 없음**(med). 사이드바가 `<aside>`라 낭독기 '내비게이션 이동' 안 됨, 현재 페이지를 색으로만 표시. → `<nav aria-label="주 메뉴">` + 활성 버튼 aria-current="page"(BottomNav도). `SideNav.tsx:31,39`
- **[E5] 토글 선택 칩 aria-pressed 없음**(low). 일정 작성의 종류·참석자 칩이 선택 여부를 색으로만 표시(행사 신청 칩엔 이미 있음). → aria-pressed. `CalEventWrite.tsx:267,300`
- **[E6] 일부 입력창 프로그램적 라벨 없음**(low). 데모 비번확인·행사 URL·참석자 이름 칸이 placeholder/시각 라벨만. → aria-label 또는 label htmlFor. `DemoResults.tsx:739,760`·`SubmitEventModal.tsx:144`·`AttendeeSection.tsx:53`

### 📱 모바일·마감
- **[F1] 하단 탭바가 페이지 맨 아래 내용 가림 (safe-area 부족)**(med, 모바일). 본문 하단 여백 60px 고정이 아이폰 제스처 바 높이를 감안 안 함 → 노치 아이폰서 마지막 줄/버튼이 탭바에 가림. 원래 막으려던 CSS(main 84px)는 대상 요소가 없어 무용. → PageContainer 하단 패딩 `calc(60px + env(safe-area-inset-bottom))`. `index.css:1058,1022`
- **[F2] 메뉴 경유 페이지(장비·개선·행사·바로가기)에선 하단 탭 활성표시 없음**(low, 모바일). 이 페이지들은 '메뉴'로 들어가는데 도착하면 하단 탭 어디도 강조 안 됨 → 현재 위치 파악 어려움. → 해당 경로면 '메뉴' 탭 active. `BottomNav.tsx:47,67`
- **[F3] window.confirm(브라우저 기본 확인창) 3곳 잔존**(low, UX). 강퇴·일정 삭제·작성 중 이탈이 투박한 회색 시스템 팝업(다른 삭제는 앱 디자인 ConfirmDialog). → ds ConfirmDialog(destructive)로 교체. `Settings:119`·`CalEventWrite:216`·`Work/index.tsx:505`

### 🧩 미완성·정리
- **[G1] /settings가 RequireAdmin이라 팀원·유관자 본인 비번변경 불가**(med, 미완성). 비번변경 카드는 'loggedIn 전원' 대상으로 이미 구현됐는데 설정 페이지 자체가 관리자 전용 문이라 못 들어감(만들어놓고 잠금). → 라우트 `RequireAdmin`→`RequireAuth`(내부가 이미 비번=loggedIn·사용자관리=isAdmin 분기라 안전). 권한 Phase 2와 함께 확정 권장. `AppRouter.tsx:43`
- **[G2] 행사 '게시완료' 상태변경이 실제 카드 게시로 안 이어짐**(med, 미완성). 팀원 신청→관리자 '게시완료' 표시해도 이름표만 바뀌고 실제 카드는 안 올라옴(FAB_EVENTS가 코드 상수라 수동 편집=클로드에게 요청 필요). 신청자는 "승인됐다는데 화면에 없다" 혼란 가능. → 수동 발행이 의도라면 신청/검토 화면에 '게시는 담당자가 별도 반영' 안내 문구. 장기적으로 자동 발행 경로 검토. `SubmissionsAdmin.tsx:31`
- **[G3] 새 업무 첨부(클립) 아이콘 영구 비활성('첨부 준비 중')**(low, 미완성). 공지엔 첨부 완비인데 업무는 자리만 있고 안 됨 → 혼란. → 공지 Storage 패턴 재사용해 동작시키거나, 계획 없으면 버튼 렌더 제거. `inlineFields.tsx:445`
- **[G4] api/sheets.ts 죽은 함수 ~34개(~700줄)·index.css `.post-*` 블록 미사용**(low, 정리). Supabase 이관 후 미호출(타입 6개만 실사용 → 빌드서 자동 제외라 성능 피해는 없음, 가독성 문제). → 실사용 타입만 분리 후 죽은 함수 삭제, `.post-*`(856~880줄) 제거, type-check. (CLAUDE.md에 'sheets.ts는 타입용 잔존' 명시돼 있으니 삭제 아닌 '타입 분리'가 안전.)

### ⚡ 성능 (큰 작업 — 별도 착수)
- **[H1] 코드 스플리팅 전무 — 단일 JS 번들 2.11MB(gzip 655KB)**(high, 성능). 모든 라우트 + FullCalendar·TipTap×2·JSZip·UTIF가 한 청크. 게스트가 홈 로드맵만 봐도 안 쓰는 무거운 것 전부 다운(빌드 시 Vite가 500KB 초과 경고). → ① 라우트별 `React.lazy`+`Suspense`(특히 Calendar·편집기) ② JSZip·UTIF는 `await import()`로 쓸 때만 ③ vite manualChunks로 react/mui/fullcalendar/tiptap 분리. 홈 첫 로딩 절반↓ 기대. `AppRouter.tsx`·`vite.config.ts`
- **[H2] topbar-logo.jpg 98KB 과대**(low, 성능). 모든 페이지 상단바 로고치고 큼(보통 10~20KB나 SVG면 충분). → SVG 교체 또는 축소·재압축 20KB↓. (근본 개선은 H1이 체감 효과 훨씬 큼.) `assets/topbar-logo.jpg`

---

## 5. 개발 참고
- `npm run dev`(port 3600) / `npm run type-check`(수정 후 항상). 스타일 = `src/index.css` 단일 파일(CSS 변수).
- 배포: main push → GitHub Actions → `angels-fab.github.io`(1~2분). 반응형 분기 768px.
- Supabase 마이그레이션 최근: `calendar_events_add_series_id`(W4), `profiles_signup_approval`(가입승인).

---

## 6. 다음 세션 시작 가이드
1. `git checkout main && git pull origin main`.
2. **3번 라이브 확인 먼저**(특히 가입 블로커 = Confirm email OFF).
3. **계정·개인화 B(member 역할 분리)** 진행. 진입 전 "member 쓰기 범위" 결정 확인.
