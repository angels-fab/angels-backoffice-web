# Claude To Codex

## Summary (최신: STEP27)

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
