# Claude To Codex

## Summary (최신: 캘린더 해당자·상세 + 포털 새글 규칙 통일)

- **업무일정 해당자 표시/상세 + 포털 전체 새 글 판정**을 사용자 지시(12개 항목)대로 전면 개편. **프런트 전용**(시트/Apps Script 무변경). type-check+build 통과, 라이브 dev 적대적 리뷰(12에이전트)+브라우저 검증(콘솔0).

### What changed
1. **해당자 표시(월간)** — 첫 해당자만 이름, 나머지는 첫 칩 뒤로 포갠 초승달(색만). 겹침 z-index=첫번째 위. `+N` 폐지. 상세엔 전체 이름. 해당자 없으면 센터. (`ChipContent.tsx` CrescentStack, `members.eventMembers`)
2. **해당자 위치** — 단일=칸 우측끝 / 멀티데이=첫 칸 우측끝(막대 전체끝 아님). 제목이 첫 칸을 넘치면 제목 뒤로 자연스럽게 밀림(공간 있으면 말줄임 안 함). 주 단위 분할 구간도 동일. (측정기반 reserve)
3. **주간 2줄** — 여러 시간칸 일정은 2줄(①아이콘·시간·제목 ②전체 해당자 이름, +N 없음). 짧은 일정은 월간과 동일 1줄.
4. **상세 내용** — 장소-목적 자동분리 폐지. 호버·클릭 상세에 **작성된 원본 제목 그대로** + 시간 + 전체 해당자 + 분류. (`rawTitleNoTags`, splitPlacePurpose 미사용)
5. **상세 위치** — MUI Tooltip → **마우스 위치 기준 커스텀 팝오버**(`EventPopover.tsx`). 호버=포인터 근처, 클릭=클릭 지점 고정(재클릭/바깥/Esc 닫힘), 멀티데이 어느 구간이든·일정 빈 영역 클릭도 동작, 뷰포트 경계 자동 보정.
6. **새 글 공통 규칙** — `utils/newPost.ts` 공용 함수로 통일(페이지 N=사이드바 **동일 함수**). `isRecentNew` 기준 = 등록일 포함 7일(8일째 제외).
   - 공지: 게시일 7일 + 종료 제외 (`isNoticeNew`, 슬라이스 isNew).
   - 업무현황: **새 업무 = 진행중 + 발의 7일**(완료·Remind 제외, Check 무관). 사이드 숫자 = 새 업무 수, 진행중 카드 제목 옆 N배지 추가.
   - 개선요청: 접수·검토중·보류 + 7일(완료·불가 제외). 페이지 N과 사이드 일치.
   - 업무일정: 새 글 개념 제거(사이드·하단 배지 삭제, 집계·기능 유지).
7. **사이드 배지 재설계** — 새 글=행 오른쪽 끝 빨강 숫자(볼드X·0숨김·99+) / 개선메모=메뉴명 우상단 노란 점(숫자 없음, 관리자 전용·겹침 없음).

### 적대적 리뷰 결과
- 12에이전트(3차원 리뷰 + 항목별 검증). 9건 제기 → **1건만 확정**: 상세 팝오버 z-index(1350)가 FullCalendar '+N건' 더보기 팝오버(9999) 아래 → **10000으로 수정**. 나머지 8건은 오탐/허용 트레이드오프(날짜 경계 수식·배지 일치·측정 안정성·닫기 메커니즘·데드코드 컴파일 모두 정상).

### 자문 요청 (사용자용)
- **데드코드 정리**: `WeekBoard.tsx`·`ChipTooltip.tsx`는 이제 미사용(주간뷰는 FullCalendar timeGridWeek). 다음에 삭제 권장(이번엔 컴파일 유지 위해 보존).
- **모바일**: 캘린더 변경은 PC 기준. 모바일 캘린더 별도 점검 필요 시 알려주세요.

---

## (이전) Summary (사이드 배지 + 캘린더 한 줄 칩)

- **PC 사이드 메뉴 위첨자 배지 개편 + 업무일정(월간 캘린더) 일정 칩 한 줄 배열** 구현·라이브 검증 완료. 사용자 직접 지시(참고 시안 `public/calendar-one-line-demo.html`). **프런트 전용**(시트/Apps Script 무변경).
- type-check 통과, 라이브 dev 검증(콘솔 에러 0).

### What changed

1. **사이드 배지(아이폰 알림 스타일)** — `src/layouts/SideNav.tsx` + `src/index.css`
   - 새글=빨강(`--red`)·개선메모=노랑(`--amber`) **원형 위첨자 배지, 색+숫자만**(N 글자·아이콘 제거). 메뉴명 바로 뒤 우상단에 나란히. 높이 15px(14~16px). 0건 숨김·99초과 99+.
   - 기존 행 우측 회색 pill(`.snav-badge`)·앰버 MUI 박스 배지 제거 → `.snav-labelwrap`+`.sup-badge.new/.memo`로 교체. 메모 Tooltip(개선 메모 N건)·관리자 전용 게이트 유지.
2. **캘린더 일정 칩 한 줄** — `src/pages/Calendar/ChipContent.tsx` (2줄→1줄 재작성)
   - 종일·멀티데이 포함 **항상 한 줄**: 구분아이콘 → 시간 → 장소-목적(말줄임) → 해당자 원형칩(20px, 겹침). `dense` prop 제거.
   - 해당자는 우측 끝으로 안 밀림: 제목 `flex:0 1 auto`, 해당자 `flex:none`(margin-left:auto 미사용). 짧은 제목=바로 옆(간격 5px), 긴 제목=제목만 말줄임+해당자 항상 표시. 멀티데이 바도 동일(측정: 4일 span에서 해당자 제목 옆 5px, 우측 264px 여백).
3. **호버 상세 분리** — 신규 `src/pages/Calendar/ChipTooltip.tsx` + `members.ts splitPlacePurpose()`
   - 칩은 "장소-목적" 그대로, **호버 Tooltip에서만** 목적=제목(굵게)·장소=세부정보로 분리(+구분칩·시간·해당자). 월간(`index.tsx renderEventContent`)·주간(`WeekBoard.tsx`) 공통 적용. 국내/국외출장도 "목적지-목적" 동일 규칙.
   - 기존 필터·분류색·클릭 동작 유지. 월간 뷰엔 기존에 호버 상세가 없어 신규 추가.

### Verification (live dev, console 0 errors)

- 사이드: 공지사항 [2빨강] / 업무일정 [6빨강][1노랑 나란히] / 업무현황 [6빨강]. 스타일 계산값 = new bg #E05B54·흰글씨, memo bg #D6A23E·짙은글씨, h15px·fs9.5px.
- 캘린더: 전 칩 높이 20~25px(한 줄). 멀티데이 3건(여수·부산·제주) 한 줄+해당자 옆. 호버 "한양대-반도체소자 관련" → {국내출장 / 목적:반도체소자 관련 / 장소:한양대 / 해당자:신현진}.

### 자문 요청 (사용자용 — 요약·추천만)

- **모바일**: 이번 작업은 PC 사이드바·월간 캘린더 한정. 모바일 하단탭 배지(`bnav-badge`)는 그대로 둠 — 동일 스타일 적용할지 사용자 의견.
- (별건) Events 행사 상세 팝업 낮은 화면 잘림 수정 커밋 `7c90f09`은 구 Dialog 구조 기반이라 현재 인카드 구조에선 무의미(폐기됨).

---

## (이전) Summary (STEP27)

- **STEP27 — 새 업무 인라인 폼 개편 + 완료 다이얼로그 Remind 체크박스** 구현·라이브 검증 완료. 사용자 직접 지시(9개 항목). **프런트 전용**: 시트 스키마/Apps Script 무변경(@42 유지).
- type-check 통과, production build 통과(기존 chunk-size 경고만), 라이브 dev에서 9개 항목 모두 동작 확인(콘솔 에러 0).

## What changed

- 신규 파일 `src/pages/Work/inlineFields.tsx` — 공용 입력 위젯 5종:
  - `ComboField`: MUI Autocomplete(freeSolo·openOnFocus). 히스토리 드롭다운 + 직접 타이핑. (구분·담당자·부서·장소)
  - `DateField`: 네이티브 date 숨기고 빈값일 때 한글 라벨('발의일자'·'예정일') 표시, 아이콘/클릭→`showPicker()`.
  - `TimeRangeField`: 시작·종료 시각 wheel picker(스크롤 스냅, Popover) → `"HH:MM ~ HH:MM"` 한 문자열로 `time`에 저장. 기존 자유입력값은 첫 두 시각을 파싱해 초기값.
  - `LinkButton`: 제목 우측 외부링크 아이콘 → 관련링크 입력 Popover, 값 있으면 아이콘 초록.
  - `AttachButton`: 첨부 아이콘(비활성, "준비 중" 툴팁) — 파일 업로드 백엔드 없어 기능 없음.
- `src/pages/Work/NewTaskCard.tsx` — 위 위젯으로 교체·재배치(제목줄에 링크/첨부 아이콘 이동, 본문 링크 Field 제거), `options` prop 추가.
- `src/pages/Work/index.tsx` — `fieldOptions` memo(전체 items에서 cat/mgr/dept/loc 수집)로 옵션 공급, 완료 다이얼로그에 `Remind 업무로 설정` 체크박스(+`remindOnComplete` 상태, `completeTarget` 변경 시 초기화), `confirmComplete`가 체크값을 `updateWork({remind})`에 반영.
- `docs/step27-newtask-form-revamp.md` 신규.

## 자문 요청 (사용자용 — 요약·추천만, 프롬프트 작성 X)

1. **구분·담당자 드롭다운 정책** — 현재 freeSolo(기존값 선택 + 새 값 타이핑 모두 허용). 신규 담당자/구분을 인라인에서 못 만들면 불편할 수 있어 freeSolo로 둠. 엄격 드롭다운(기존값만)으로 제한할지 추천 의견 부탁.
2. **시간 포맷** — `"HH:MM ~ HH:MM"`로 시트 `시간` 열에 저장. 분 간격(현재 5분)·기본값(09:00~10:00) 적절성.
3. **첨부 버튼** — 자리만 둔 상태. 파일 저장소(Drive 폴더/Apps Script 업로드 등) 옵션 비교가 필요하면 사용자에게 선택지 제시 바람.

## Verification (live dev, console 0 errors)

- 신규 필드 전부 렌더, 발의일자/예정일 라벨 노출, 담당자 드롭다운=히스토리값, 시간 wheel 14:30~16:45 적용, 링크 입력 후 아이콘 활성, 완료 다이얼로그 Remind 체크박스 토글.

---

## (이전) 역할 정렬 (사용자 요청)

- 브릿지 `README.md`·`state.md`를 루트 `AGENTS.md` 최신 역할에 맞춰 정리함: **Codex = 비개발자 사용자용 UX/UI/기능 자문위원**(요약·의미설명·선택지·추천). **사용자가 명시 요청하지 않는 한 Codex는 Claude용 개발 프롬프트를 작성하지 않음**(구 '다음 프롬프트 작성' 규칙 폐지). Claude=구현·git·스크린샷.
