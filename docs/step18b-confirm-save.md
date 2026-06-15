# STEP18B — 드래그 후 확인 모달 → 적용 시 자동 저장

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 완료, main 배포 (관리자 실동작 검증 대기)

## 변경 흐름
드래그 → 실시간 툴팁(18A) → 마우스 놓음 → **확인 모달** → [취소]/[적용] → 적용 시 기존 `updateSchedule` 저장.

## 확인 모달
- 이동: "일정을 이동하시겠습니까?" / 변경 전·변경 후·변경량.
- 리사이즈: "기간을 변경하시겠습니까?" / 단계·변경 전·변경 후·변경량.
- 모달 열려 있는 동안 **추가 드래그 금지**(startDrag/startResize `if(pending) return` + Dialog 백드롭).

## 취소 / 적용
- **취소**: 프리뷰(translateX·tl 오버라이드)만 폐기 → 드래그 이전 상태로 **즉시 복원**(Redux/시트 무변경).
- **적용**: 기존 reducer(shiftScheduleStart/resizeScheduleStage)로 낙관적 반영 + **기존 `updateSchedule`** 호출 + `loadEqData` 재fetch. 새 저장 로직 없음. 저장 실패 시 reload로 시트 기준 재동기화.

## "변경됨 N건" 저장바 — 제거
- 적용 즉시 저장되어 미저장 누적이 없으므로 제거. 일괄저장/일괄되돌리기는 **건별 취소** + (STEP18C) **Undo/Redo**로 대체.
- 장점: 이중 확인 제거·UI 단순·"확인 후 저장" 흐름과 일관. 단점(일괄 처리 불가)은 위로 상쇄.

## STEP18C 대비
- 적용 커밋 = 단일 reducer dispatch(이동/리사이즈) 1건 → 향후 Undo 스택에 그대로 적재 가능. 모달은 커밋 전 게이트라 Undo와 무충돌.

## 변경 파일
- `Equipment/index.tsx`만: `onUp`(즉시반영→모달 오픈), `applyPending`/`cancelPending`, 확인 `Dialog`, 저장바·`movedCodes` 제거. `DragTip`·`timeline`·reducers·`updateSchedule`는 그대로.

## 검증
- `npm run type-check` · `npm run build` 통과. 회귀 없음(간트 정상 29줄·56px, 콘솔 에러 0, 저장바 제거 확인). 저장 흐름은 `updateSchedule` 재사용.
- 관리자 실동작(드래그→모달→적용 저장 / 취소 원복) 검증: **대기**.
