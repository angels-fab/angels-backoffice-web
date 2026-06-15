# STEP15 — 장비도입관리 타임라인 전체 이동 (드래그)

> 작성: 2026-06-15 (사무실 PC) · 상태: 완료, main 배포

## 목표
장비도입관리 간트에서 **막대를 드래그해 전체 일정을 이동**한다. 6단계(사전규격·구매공고·기술평가·기술협상·장비제작·장비설치)가 **동일한 양만큼** 이동한다. 단계 길이(Duration) 변경은 **STEP16**에서. 이동 단위는 **반월(0.5개월) 스냅**.

## 동작
- 드래그 중에는 막대만 `translateX`로 실시간 미리보기(격자선 고정), **드롭 시 Redux만 변경**(시트 즉시 저장 안 함).
- 본질은 **`start`(시작년월)을 N반월 이동** → 타임라인 재파생(모든 단계가 따라 이동, stages 불변).
- 저장은 상단 **"N건 이동됨 · 되돌리기 / 저장"** 줄에서 기존 `updateSchedule`(시작년월 기록) 호출 → 재fetch. 되돌리기는 재fetch로 원복.
- 관리자 전용. 막대 "클릭"(드래그 아님)은 기존처럼 상세 Drawer.

## 변경 파일
- **(신규) `src/pages/Equipment/timeline.ts`** — 순수 유틸(재파생·이동·스냅 단일 창구)
  - `buildTimelines(items)` : start+stages → `{months, byCode}` (eqSlice 로더와 동일 규칙)
  - `shiftStart(start, deltaHalves)` / `startToHalf` / `halfToStart` : 반월 단위 시작월 이동
  - `calcHalfDelta(px, halfPx)` : 픽셀 이동량 → 반월 스냅(정수)
- `src/store/slices/eqSlice.ts` — 리듀서 `shiftScheduleStart({code, deltaHalves})`: start 이동 후 buildTimelines로 `months`·`schedule[].timeline`·`raw[].timeline` 일괄 재파생
- `src/pages/Equipment/gantt.tsx` — `GanttBar`에 `previewPx` prop(드래그 미리보기)
- `src/pages/Equipment/index.tsx` — 막대 드래그(mousedown→move(스냅)→up→dispatch), 3px 임계로 클릭 억제, 미저장 저장줄

## 데이터·드래그 흐름
```
mousedown(막대, 관리자) → halfPx = 막대폭 / (months×2)
 → mousemove: px=Δx, deltaHalves=round(px/halfPx), 막대 translateX 미리보기
 → mouseup: dispatch(shiftScheduleStart) ; movedCodes에 추가 ; (px>3이면 클릭 억제)
저장: movedCodes 순회 → updateSchedule(시작년월=새 start) → 재fetch
```

## STEP16(리사이즈) 대비
- `buildTimelines`가 재계산 단일 창구 → STEP16은 "단계 길이(stages) 변경 → 같은 buildTimelines 재파생"이면 끝.
- 유틸 분리(calcHalfDelta 공용) + 막대의 단계 경계(연속 같은 코드의 끝)로 리사이즈 핸들 확장 가능.

## 검증
- `npm run type-check` · `npm run build` 통과. 페이지 렌더·기존 CRUD 정상, 콘솔 에러 0.
- 관리자 드래그·저장 라운드트립: 사용자 정상 확인.

## 후속 수정 (2026-06-15)
- **마우스 휠 → 간트 가로 스크롤 변환**: 마우스 사용자가 휠로 타임라인을 좌우 이동 못 하던 문제(마우스 휠은 기본적으로 가로 overflow를 스크롤 안 함 — 트랙패드 스와이프/하단 스크롤바/Shift+휠로만 됨). `scrollRef` + 비수동(`{passive:false}`) wheel 리스너로 `deltaY → scrollLeft` 변환. **가로 overflow가 있을 때만** 작동(없으면 페이지 세로 스크롤 유지). 드래그(이동)·트랙패드 스와이프와 무관.
  - 원인: STEP15 버그가 아니라 입력장치 차이(집=트랙패드 / 사무실=마우스).
  - 변경: `src/pages/Equipment/index.tsx` (휠 리스너 + 스크롤 컨테이너 ref).
  - **사용자 정상 확인** — 마우스 휠로 타임라인 좌우 스크롤 동작.
