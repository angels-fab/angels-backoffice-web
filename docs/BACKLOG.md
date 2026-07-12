# 프로젝트 진행상황 · 백로그 (인수인계)

> 다른 컴퓨터/새 세션에서 이어받을 때 **이 문서를 먼저 읽으세요.** Claude 작업 메모는 각 컴퓨터
> 로컬(`~/.claude`)에만 있어 git으로 안 넘어가서, 핵심 진행상황·백로그·결정사항을 여기에 옮겨 둡니다.
> (비밀키·비밀번호 미포함. Supabase anon key는 원래 공개 키로 `src/api/supabase.ts`에 있음.)
>
> 최종 갱신: 2026-07-07. 배포 브랜치 = **main** (main에 push → GitHub Actions가 빌드→`angels-fab.github.io` 배포).
> **feat/work-hold-archive 등 다른 브랜치에서 작업 금지**(배포 안 됨). `git checkout main && git pull` 후 작업.

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
- **D. 개인화 2차**: 홈 섹션 순서/숨김 + 관심 업무 핀. **⏳ 결정 대기: 업무카드 정렬 = 팀 공유 vs 개인별.**
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

### 사진 갤러리 메뉴 (승인 대기)
- Supabase Storage 1GB(현재 0 사용). 웹 최적화면 ~2,000-3,000장, 포스터급(800px·200KB)이면 ~5,000장. 실병목=1GB 스토리지(egress 5GB/월은 내부 팀이라 여유).
- 접근: Storage 버킷 + 업로드 시 리사이즈/썸네일 + 그리드(썸네일)·상세(원본). 이벤트 포스터 리사이즈 파이프라인 재사용 가능.

### 안 하기로 함
- **W5 공개 소개페이지** — 사용자가 안 함 결정.

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
