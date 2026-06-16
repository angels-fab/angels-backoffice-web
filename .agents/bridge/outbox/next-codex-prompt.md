# Next Codex Prompt

Read first: `.agents/bridge/README.md`, `state.md`, `lock.md`, `inbox/claude-to-codex.md`, `docs/step22-eqops-history-plan.md`.

Role: review & next-prompt only. Do not edit source or run git sync.

Context — **STEP22 phase 1 완결**: 구현 + 배포(프런트 `87a71c0` / 백엔드 `@42`) + **라이브 E2E CONFIRMED**(CL-001 상태변경 2건이 `장비운영이력`에 기록, `getEqHistory` 반환) + 리뷰-수정 3건 적용.
- 리뷰-수정(이번 라운드, `EqDetailDrawer.tsx` 미커밋): (1) 상태 Menu no-op/selected를 raw 상태값 비교로(비표준 상태 오선택/정규화차단 해결), (2) `histError` 추가로 이력 fetch 실패를 '이력 없음'과 구분 + no-group 시 로딩 해제, (3) 문서 E2E 일치화.
- 적대적 리뷰(2렌즈): 4건 중 1건 확정(low) — 상태변경 후 refreshTick + 부모 refetch가 겹쳐 `fetchEqHistory` 1회 중복 호출 가능. **alive 가드로 무해**, 즉시성 위해 현행 유지(코드 변경 안 함).
- type-check 통과, 라이브 검증(메뉴 selected·이력 2건·콘솔0) 완료. 스크린샷은 `preview_screenshot` 환경 타임아웃으로 미저장(사유 기록됨).

Please review and decide:
1. 리뷰-수정 diff(`EqDetailDrawer.tsx`: rawState 비교, histError 분기) 적정성 — 추가 엣지케이스 있는지.
2. 확정 low(중복 fetch) — 현행 유지 동의 여부, 아니면 단일 재조회 경로로 통일 지시.
3. **phase 2 범위 결정**: (a) 사유 입력 UI 재노출(+`장비운영관리` 시트 사유 열), (b) 비-상태 수정(updateEquipment 전반) 이력화, (c) 전용 이력 페이지/필터/페이지네이션.
4. (보류) `TopBar.tsx` Tooltip dev 전용 `anchorEl` 경고 별도 처리 여부.

Then write `.agents/bridge/outbox/next-claude-prompt.md` for the chosen next step.

Note: 미커밋 변경(EqDetailDrawer + docs/bridge)은 사용자가 `퇴근`/배포 지시 시 커밋·푸시 예정.
