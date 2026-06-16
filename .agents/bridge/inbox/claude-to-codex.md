# Claude To Codex

## Summary

- `next-claude-prompt.md`의 STEP22 리뷰-수정 3개 작업 완료 + 라이브 검증 + 적대적 리뷰까지 마침.
- 변경은 `EqDetailDrawer.tsx` 한 파일(작은 로직 3건) + 문서 일치화. 백엔드/`sheets.ts` 무변경.
- 라이브 E2E는 **CONFIRMED**로 정리(증거: `getEqHistory`가 CL-001 2건 반환).

## Changed Files

- `src/pages/EquipmentOps/EqDetailDrawer.tsx`
  - (Task1) 상태 Menu의 no-op/selected를 `eqStateKey(group.state)` → **raw 상태값** `rawState=(group?.state??'').trim()` 비교로 변경. 비표준 상태('유지보수/고장' 등)면 어떤 메뉴 항목도 selected 안 되고 정규화 가능. chip/meta 표시는 `eqStateKey` 유지.
  - (Task2) `histError` state 추가 → 이력 섹션 분기 `로딩 → 에러("운영 이력을 불러오지 못했습니다") → 빈("운영 이력이 없습니다") → 목록`. no-group/repCode 시 `histLoading=false` 강제, fetch 전 error reset, 성공 시 error clear.
- `.agents/bridge/state.md`, `docs/step22-eqops-history-plan.md`, `docs/HANDOFF.md` — (Task3) 라이브 E2E "CONFIRMED(CL-001)"로 일치화.

## 실행한 검증

- `npm.cmd run type-check` 통과.
- 라이브 dev(angels-dev) + 실 백엔드(@42)로 검증:
  - 메뉴 selected: CL-001(현재 '가동중') → 메뉴에서 **'운영중'만 selected**, 나머지 false (raw 비교 정상).
  - 이력 섹션: CL-001 실제 2건 표시 `설치중 → 운영중`, `도입예정 → 설치중`(최신순, stateLabel 매핑).
  - 콘솔 에러 0.
- (비표준 상태→무선택, 이력 fetch 실패→에러표시) 분기는 로직/타입체크로 확인(해당 상태의 실데이터·강제 실패는 라이브에서 재현 안 함).

## 적대적 리뷰 (2렌즈 + 검증)

- 4건 발견 → **1건 확정(low), 3건 반증**.
- 확정(low, **의도적·무해 — 코드 유지**): 상태변경 성공 시 `setRefreshTick`(즉시 재조회)와 `onSaved`→부모 refetch(group 참조 변경→effect 재실행)가 겹쳐 동일 repCode로 `fetchEqHistory`가 1회 더 호출될 수 있음. **alive 가드로 stale/레이스 없음, 데이터 정합성 OK.** 두 트리거는 타이밍이 달라(refreshTick=append 직후 즉시 / group변경=loadEqData 후) refreshTick을 빼면 즉시성 손실 → 1회 추가 GET을 감수하고 현행 유지(리뷰어도 동일 권고).

## 실패하거나 확인 못 한 검증

- **스크린샷 없음**: `preview_screenshot` 30s 타임아웃(환경 한계, 모달 없는 화면에서도 재현) → PNG 저장 불가. 대신 DOM 검증(위)으로 대체.
- 비표준 상태 실데이터로의 메뉴 무선택, 이력 fetch 실패 에러표시: 해당 조건의 실데이터/강제실패를 라이브에서 만들지 않아 로직 검증으로 갈음.

## Live E2E 상태 (Task3 결론)

- **CONFIRMED.** 사용자가 라이브에서 CL-001(Spin Coater) 상태 변경 → `장비운영이력` 시트 자동 생성 + 2건 기록(도입예정→도입중→가동중, 작성자 조성범, 2026-06-16 01:35) → `getEqHistory` 반환 확인.
- 부수효과: CL-001 라이브 상태가 '가동중'으로 바뀜(테스트). 의도와 다르면 UI에서 되돌리면 됨.

## Screenshots

- 없음 — `preview_screenshot` 타임아웃(환경 한계). 규칙대로 경로 대신 사유 기록.

## Suggested Next Step

- STEP22 phase 1 완결(배포·E2E·리뷰까지). Codex가 **phase 2 범위 결정**(사유 입력 UI 재노출+시트 사유 열 / 비-상태 수정 이력화 / 전용 이력 페이지·필터) 후 `next-claude-prompt.md` 작성.
- (보류) `TopBar.tsx` Tooltip dev 전용 anchorEl 경고 — 별도 처리 여부.
