# STEP27 — 새 업무 인라인 폼 개편 + 완료 다이얼로그 Remind 체크박스

> 2026-06-18 · 프런트 전용(백엔드/시트 스키마 변경 없음). type-check·build 통과, 라이브 dev 검증.

진행중 뷰의 인라인 새 업무 작성 카드([NewTaskCard.tsx](../src/pages/Work/NewTaskCard.tsx))를 입력 보조 기능 위주로 개편하고, 업무 완료 확인 다이얼로그에 Remind 토글을 추가했다.

## 변경 요약

1. **완료 다이얼로그 Remind 체크박스** ([index.tsx](../src/pages/Work/index.tsx))
   - 진행중 카드의 완료(체크) 아이콘 → "업무를 완료하시겠습니까?" 다이얼로그에 **"Remind 업무로 설정"** 체크박스 추가.
   - 다이얼로그가 열릴 때 해당 업무의 현재 `remind` 값으로 초기화(`useEffect([completeTarget])`), 확인 시 `updateWork({ remind: remindOnComplete, status:'완료' })`로 함께 반영.

2. **신규 공용 입력 위젯** ([inlineFields.tsx](../src/pages/Work/inlineFields.tsx))
   - `ComboField` — MUI Autocomplete(freeSolo·openOnFocus). 히스토리 옵션을 드롭다운으로 고르거나 직접 타이핑. 구분·담당자·부서·장소에 사용.
   - `DateField` — 네이티브 `<input type=date>`를 시각적으로 숨기고, 빈값일 때 한글 라벨('발의일자'·'예정일')을 표시. 달력 아이콘/필드 클릭 시 `showPicker()`로 네이티브 피커 오픈.
   - `TimeRangeField` — 시작/종료 시각을 **wheel picker**(스크롤 스냅, 시 00–23 / 분 5분 간격)로 선택 → `"HH:MM ~ HH:MM"` 한 문자열로 `time`에 저장. Popover 안에 시작/종료 2그룹 + 지우기/확인.
   - `LinkButton` — 제목 우측 외부링크 아이콘. 클릭 시 Popover에 관련링크 입력. 값이 있으면 아이콘 초록(활성).
   - `AttachButton` — 첨부 아이콘(비활성, "첨부 (준비 중)" 툴팁). **파일 업로드 백엔드 미구현이라 기능 없음**(자리만).

3. **NewTaskCard 레이아웃 재배치**
   - 제목줄: `구분(ComboField)` · `제목` · `링크아이콘` · `첨부아이콘` · `담당자(ComboField)` · `발의일자(DateField)` · 저장/취소.
   - 본문 첫 행: `부서(ComboField)` · `예정일(DateField)` · `시간(TimeRangeField)` · `장소(ComboField)`.
   - 본문에 있던 관련링크 입력 Field 제거(제목줄 아이콘으로 이동).

4. **히스토리 옵션 수집** ([index.tsx](../src/pages/Work/index.tsx) `fieldOptions` memo)
   - 진행중·완료 등 **전체 업무(items)**에서 `cat/mgr/dept/loc` 고유값을 모아 트림·정렬(구분은 `workCatRank`, 나머지는 ko locale). `NewTaskCard`에 `options`로 전달.

## 검증 (라이브 dev, 콘솔 에러 0)

- 모든 신규 필드 렌더 확인(구분·제목·링크·첨부·담당자·발의일자·부서·예정일·시간·장소·내용·Check·저장/취소).
- 발의일자/예정일 라벨 텍스트 = '발의일자'/'예정일' (네이티브 'yyyy-mm-dd' 미노출).
- 담당자 드롭다운 = 히스토리값(강동호·박세리·박주봉·센터·신현진·장우현·조성범·NEPES).
- 시간 wheel에서 14:30 / 16:45 선택 → 필드 `"14:30 ~ 16:45"`.
- 링크 입력 후 아이콘 활성(초록).
- 완료 다이얼로그 "Remind 업무로 설정" 체크박스 토글 동작.

## 후속 보완 (사용자 피드백 반영)

- **구분 = 드롭다운 선택만(입력 불가)**: `ComboField`(freeSolo) → 신규 `SelectField`(Autocomplete non-freeSolo + `readOnly` input). 옵션은 시트 '구분' 열 기준 6개 `WORK_CAT_OPTIONS`(장비·인사·예산·행정·교육세미나·설계적정성). (초기 MUI `Select` 시도는 `notched` 경고로 폐기.)
- **담당자 = 입력 가능 + 기본 보기 고정**: 옵션을 히스토리 대신 `WORK_MGR_OPTIONS`(센터·신현진·박주봉·박세리·조성범)로. freeSolo 유지(새 이름 직접 입력 가능).
- **시간 wheel 감도↓ + 버튼명**: 휠을 시간 쓰로틀(110ms)로 한 번에 1칸씩 이동(네이티브 큰 점프 방지, `{passive:false}` 리스너). picker '지우기' → '취소'(적용 안 하고 닫기).
- **글머리 dash→bullet**: 표시용 `displayBullet()`로 dash 계열(- – — * ·)을 '•'로 렌더(`SubLine.tsx`·`WorkRow.tsx`). 입력 textarea는 `dashToBullet()`로 줄 시작 '- '를 실시간 '• ' 변환, 저장 시 `bulletToDash()`로 '- '로 되돌려 **시트엔 dash 유지**. 라운드트립 검증 완료(중간/공백없는 dash는 미변환).

## 후속 보완 2 (사용자 피드백)

- **담당자 자동완성 = 담당자 시트 동적 로드**: 하드코딩 5명 → `fetchAuthors()`(`?authors=1`, 백엔드 `findManagerCols_`가 '이름'열 헤더 자동 인식). 새 담당자 추가 시 자동 반영, 열 이동에도 헤더 기준. 로드 실패 시 `WORK_MGR_OPTIONS`로 폴백. **백엔드 변경 없음**(기존 엔드포인트 재사용).
- **업무카드 수정 = in-place 편집(팝업 없음)**: 카드 '수정' → `editingId` 설정 → 그 자리에서 `NewTaskCard`를 `initial`(기존 값)로 펼침(전폭), 저장 시 `updateWork`(상태·완료일·관련자료·Remind는 기존 값 유지). `NewTaskCard`에 `initial?` prop 추가(작성/수정 공용). 발의일자/예정일은 시트가 `yyyy-MM-dd`라 무손실 round-trip. 구분이 표준 6개 밖이면 그 값도 옵션에 포함(손실 방지). (상세 Drawer의 수정은 기존 모달 유지.)
- **업무내용 Enter = 자동 글머리**: 본문 textarea에서 Enter → 새 줄에 `• ` 자동 추가(빈 글머리 줄에서 Enter는 글머리 제거=리스트 빠져나가기). 커서 위치 `useLayoutEffect`로 복원. 저장 시 `bulletToDash`로 시트엔 `- ` 저장.

## 메모 / 후속 후보

- 구분·담당자는 freeSolo로 두어 **드롭다운 선택 + 새 값 타이핑** 모두 가능. 엄격 드롭다운(기존값만)으로 제한할지는 사용자 확인 필요.
- 첨부는 UI만. 파일 업로드 DB/백엔드 도입 시 기능 연결.
- 시간 포맷은 `"HH:MM ~ HH:MM"` 단일 문자열(시트 `시간` 열 그대로). 기존 자유 입력 값도 첫 두 시각을 파싱해 wheel 초기값으로 사용.
