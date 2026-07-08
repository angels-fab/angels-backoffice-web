# 학술·교육·전시(/events) — 참석자·행사신청 개편

행사 페이지에 (1) 종료행사 비모달 상세 드로어, (2) 참석자 하이브리드 입력, (3) 팀원 행사 신청 포털을 붙인 작업 기록.

## 데이터 (Supabase)

마이그레이션 `event_attendees_and_submissions`:

- **event_attendees** `(id, event_id text, name text, member_uid uuid, created_by, created_at, unique(event_id,name))`
  - RLS: read=`true` / insert=`is_admin() OR (is_member() AND member_uid=auth.uid())` / delete=`is_admin() OR member_uid=auth.uid()`
  - 행사 자체는 아직 상수(`FAB_EVENTS`)에 있고, 참석자만 행사 id(문자열)로 DB에서 실시간 집계.
- **event_submissions** `(id, category, title, start_date, end_date, venue, organizer, link, poster, summary jsonb, status default 'pending', submitter, note, created_at)`
  - RLS: read/insert=`is_member` / update/delete=`is_admin`
- Storage 비공개 버킷 **event-submissions**(20MB) — RLS read/insert/delete=is_member.

API: `src/api/events.ts` — `fetchAttendees / addAttendee({eventId,name,self}) / removeAttendee`, `uploadSubmissionPoster / submissionPosterUrl / submitEvent / fetchSubmissions / updateSubmissionStatus`. `addAttendee(self:true)`면 `member_uid=본인 uid`(로그인 팀원 본인 참석), false면 null(관리자 수기추가).

## 종료행사 상세 = 비모달 우측 고정 패널

`src/pages/Events/index.tsx` — MUI Drawer의 pointer-events 트릭이 X닫힘 등에서 불안정 → **custom `position:fixed` 패널**로 교체(top {xs:48,md:54}, right:0, bottom {xs:60,md:0}, width 380, zIndex 1200, `panelRef`).
- 닫힘 조건: X 버튼 · Esc · 바깥 mousedown · **같은 행 재선택(토글)**.
- 바깥 클릭 판정(`onDown`): 패널 내부·`.eq-ledger tbody tr`(목록 행=다른 행사로 전환)·`.MuiPopover-root/.MuiModal-root`(관리자 관리 팝오버) 안이면 유지, 그 외 바깥만 닫음.
- 목록은 계속 클릭 가능 → 페이지 비활성화 없이 종료행사 연속 열람.
- 상세는 `EventDrawerDetail`(`eventCard.tsx`) — 카드 슬라이드업이 아니라 **포스터 풀사이즈 + 그 아래 제목·일시·장소·주최·요약·참석자(읽기전용)·사이트 버튼**.

## 참석자 하이브리드 — 조작은 "목록"에서

사용자 요청으로 참석 토글/관리자 추가·제거를 상세 드로어에서 **종료 목록(`EndedList.tsx`)** 으로 이동.
헤더: 구분 · 행사명 · 기간 · 장소 · 참석자 · **참/불** · **관리(관리자만)**. (모바일=구분·장소·참석자·관리 숨김)

- **참/불 스위치**(`AttendSwitch.tsx`) = 안드로이드형 토글, 가장 우측 열.
  - 켜짐 = 푸른톤(테마 primary) 배경 + 왼쪽 '참석', 손잡이 오른쪽.
  - 꺼짐 = 회색톤 배경 + 오른쪽 '불참', 손잡이 왼쪽.
  - 로그인 **팀원(member)+** 만 토글(본인 참석). 그 외(유관자·게스트)는 '-' 표시.
- **관리 셀**(`AttendeeManageCell.tsx`) = 관리자 전용, 스위치 우측 열. `관리 N` 버튼 → Popover 안에서 `AttendeeSection`(`hideSelfToggle`)로 이름 추가·삭제.
- 스위치·관리 셀은 `onClick stopPropagation`으로 행(드로어) 클릭과 분리.
- 상세 드로어는 참석자 **읽기전용 이름만**(`endedView`가 DB 이름을 `e.attendees`에 병합).

`AttendeeSection.tsx`는 드로어/팝오버 공용 — `hideSelfToggle?`+`onToggleSelf?`(옵션)로 자기토글 숨김 지원.

## 행사 신청 포털 (구글폼 대체, 옵션 B)

`SubmitEventModal.tsx`(팀원+ '새 행사' 버튼) — 카드처럼 위=포스터 첨부(드래그·드롭 이미지/PDF, 좌상단 분류 칩), 아래=URL·제목·날짜·장소·주관·요약.
- **분류별 요약 프리셋**: 학술=사전등록·초록마감·Plenary / 교육=신청기간·대상·강사 / 전시=관람기간·입장방법·규모. 분류 칩 선택 시 항목 자동 표시(최대 3), **값 적은 항목만** 게시 요약에 포함(`submitEvent`가 `summary.filter(s => s.value.trim())`).
- 제출은 `status='pending'` 저장 → 관리자에게 "신청 대기 N" 노출.
- **게시(실제 카드 등록)는 여전히 클로드에게 요청하는 수동 단계** — `SubmissionsAdmin.tsx`는 검토·상태(게시완료/반려/대기) 표시만.

## 검증

- `npm run type-check` 통과. dev 서버 컴파일 오류 0.
- `/events`는 `RequireAuth`(로그인 필요) → 게스트 프리뷰로는 스위치/관리 실동작 검증 불가. **팀원/관리자 로그인 실측 필요.**
