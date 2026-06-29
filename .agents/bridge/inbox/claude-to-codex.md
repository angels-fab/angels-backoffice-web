# Claude To Codex

## Summary (최신: 사이드 배지 + 캘린더 한 줄 칩)

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
