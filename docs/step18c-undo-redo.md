# STEP18C — Undo/Redo (저장된 작업까지)

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 + 적대적 코드리뷰 반영 완료, main 배포 (관리자 실동작 검증 대기)

## 기능
- **Ctrl+Z = Undo / Ctrl+Shift+Z = Redo** + 헤더 우측 **↶/↷ 버튼**(가능 시 활성, 불가 시 비활성). 확인창 없이 즉시 실행.
- 이미 **저장된** 이동(STEP15)/리사이즈(STEP16)를 복원 → 기존 `updateSchedule`로 시트 저장 + `loadEqData` 재fetch(항상 시트 동기화).
- 히스토리 **최근 50건**(`slice(-50)`), 새 변경(STEP18B 적용 성공) 시 redo 비움.

## 구조
- `eqSlice`: `setScheduleStart`/`setScheduleStage`(절대값 set, `recomputeEq`로 재파생). 기존 델타 reducer도 `recomputeEq`로 통일.
- `index.tsx`: `undoStack`/`redoStack`(컴포넌트 state, `HistEntry{code,kind,stage?,before,after}`), `applyHistory`(절대값 set + updateSchedule + 재fetch), `undo`/`redo`, 단축키(refs), 헤더 버튼.
- before/after **절대값** 저장(델타 아님) → 클램프/누적 오류 없음. STEP18B 모달 안 거침.

## 적대적 코드리뷰 반영 (4관점 병렬 → 확정 4건 수정)
1. **[high]** 단축키 가드가 진행 중 드래그/리사이즈 미포함 → 막대 잡은 채 Ctrl+Z 충돌. `blockKeyRef`에 `dragging/resizing/histBusy` 추가 + `e.repeat` 차단.
2. **[med]** `startDrag/startResize`가 `histBusy` 미체크 → undo/redo 중 새 드래그 경쟁. 가드에 `histBusy` 추가.
3. **[med]** 재진입 락이 React state라 동기성 부족 → `histBusyRef`(동기 ref) 락 + `try/finally` 해제.
4. **[low]** undo 후 `loadEqData` 미await → 재fetch 실패 시 먹통. 재fetch `await` + 실패 swallow.

## 검증
- `npm run type-check` · `npm run build` 통과. 회귀 없음(간트 29줄·56px, 콘솔 에러 0). 저장은 `updateSchedule` 재사용.
- 관리자 실동작(Ctrl+Z/Shift+Z·버튼·시트 반영·드래그 중 단축키 차단) 검증: **대기**.
