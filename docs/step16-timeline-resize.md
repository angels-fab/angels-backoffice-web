# STEP16 — 장비도입관리 타임라인 단계 리사이즈 (오른쪽 핸들)

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 완료, main 배포 (관리자 실동작 검증 대기)

## 목표
간트에서 각 단계(사전규격~장비설치)의 **오른쪽 끝 핸들을 드래그해 기간(개월)을 조절**. 0.5개월 스냅, 최소 0.5개월. STEP15 전체 이동은 그대로 유지. **왼쪽 핸들은 미구현**(요청에 따름).

## 동작
- 단계 막대 오른쪽 끝 핸들(`ew-resize`) 드래그 → 해당 단계 `stages[label]` ±0.5개월 → `buildTimelines` 재파생(뒤 단계가 따라 밀림).
- 드래그 중에는 현재 months 축에 정렬한 미리보기(`itemTimelineForMonths`, 축 안 흔들림), 드롭 시 **Redux만 변경**. 저장은 기존 "변경됨 N건 · 저장/되돌리기"(`updateSchedule`, stages 포함) 재사용.
- 이동(STEP15)·리사이즈(STEP16) 모두 동일 dirty(`movedCodes`)로 관리 → "N건 변경됨" 통합 표시.

## 이동 vs 리사이즈 충돌 방지
- 핸들 `mousedown`에서 `stopPropagation` → 막대 본체의 이동 드래그(startDrag)로 안 번짐. 핸들=리사이즈, 그 외 막대=이동.

## 변경 파일
- `timeline.ts`: `itemCells` 추출(셀 생성 DRY) + `itemTimelineForMonths`(리사이즈 미리보기, 현재 축 고정)
- `store/slices/eqSlice.ts`: `resizeScheduleStage` 리듀서(최소 1반월, `buildTimelines` 재파생)
- `gantt.tsx`: `GanttBar` `onResizeStart` — 단계 오른쪽 경계 칸에 `.gantt-resize-h` 핸들
- `Equipment/index.tsx`: `startResize` + 리사이즈 `useEffect` + `tl` 미리보기 오버라이드, 저장줄 라벨 "변경됨"
- `index.css`: `.gantt-cell{position:relative}` + `.gantt-resize-h`

## STEP17 대비
- 리사이즈도 **stages 변경 → `buildTimelines` 단일 경로**. STEP17 자동 재계산(총소요기간·도입예정월·KPI·파이프라인)은 stages 합 + `buildTimelines` 결과를 한 곳에서 파생하면 됨(중복 계산 없음).

## 검증
- `npm run type-check` · `npm run build` 통과. 페이지·STEP15 이동 정상, 콘솔 에러 0. 핸들은 관리자 모드에서만 표시(게스트 미표시).
- 관리자 실드래그 라운드트립: **검증 대기**(라이브에서 관리자 로그인 후).
