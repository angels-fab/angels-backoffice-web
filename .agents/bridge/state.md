# Bridge State

## Current Goal

- Keep Claude Code and Codex synchronized through repository files.
- Use this file as the compact shared memory for the current work stream.
- Enforce the agreed role split: Claude Code implements and syncs git; Codex reviews and writes the next Claude prompt.

## Current Focus

- **STEP25(업무현황 KPI/Remind 정리) 커밋·자동배포 완료**: KPI 보류·취소 타일 제거→진행중/완료/Check/Remind 4타일 · '검토'→'Check'(chief 칩 전부) · Remind는 KPI 타일 토글로 KPI 아래 펼침(하단 상시섹션 제거) · Remind 카드 압정아이콘+상태/구분/담당자/날짜(YYYY-MM-DD)·'발의' 삭제. 프런트 전용. (이하 STEP23·24·어휘개편도 모두 배포 완료 — 아래 '미커밋' 표기는 과거 스냅샷.)
- **STEP24(업무현황 회의 뷰)**: /work 개편 — 업무목록을 KPI 바로 아래로, 기본 진행중, 진행중=아코디언(모두 펼침·개별 접기, 신규 `Work/TaskAccordion.tsx`), RatioBar 제거, '긴급 업무'→'Remind', 담당자현황 숨김(`SHOW_MANAGER_STATUS=false`, 코드 보존), 검토필요→'검토'. 프런트 전용. type-check+build 통과, 라이브 검증 + 적대적 리뷰(9건 중 3확정: TaskCard 라벨·아코디언 장소중복 수정, urgent 변수명은 지시대로 미수정).
- **STEP23(상태 변경 사유 입력, 미커밋)**: 즉시저장 → 확인 Dialog(장비명·관리번호·전→후·사유 optional·trim) → `updateEquipment({state, reason})`, 운영이력에 사유 기록, 같은상태 no-op, 이력 표시 '작성자 · 사유'. 프런트 전용(**백엔드 변경/배포 없음** — reason은 STEP22부터 기록). type-check+build 통과, 라이브 dev에서 Dialog 흐름·no-op·취소 확인(콘솔0).
- **장비 상태 어휘 개편(사용자 직접 요청, 미커밋)**: 표시 라벨 매핑 폐지 → 시트값 그대로 표시. 정식 4값 `도입예정/도입중/운영중/비가동`(가동중→운영중, 설치중→도입중으로 통일). 4값 외(오타·빈값·레거시 '가동중')는 상태칩에 **'미분류'**(neutral). type-check+build 통과, 라이브 dev 검증(KPI 라벨 verbatim, E-Beam Lithography='미분류', 콘솔0). **⚠ 마이그레이션 필요**: 시트의 기존 '가동중' 등을 새 4값으로 고쳐야 함(안 고치면 미분류로 표시). 변경 파일: types/index.ts·eqMeta.ts·selectors.ts·EquipmentOps/index.tsx·EqDetailDrawer.tsx·Home/dash/(KpiOverview·EquipmentSection)·previews.tsx·EqSummaryInner.tsx·EqItem.tsx.
- STEP22 phase 1(장비 운영이력) implemented + reviewed + fixed + **DEPLOYED & LIVE & E2E-VERIFIED** (frontend `87a71c0`; backend clasp **@42**). Live E2E: a user-performed admin status change on **CL-001 (Spin Coater)** auto-created `장비운영이력` with 2 rows (도입예정→도입중→가동중); `?action=getEqHistory` returns them. Review-fix pass applied (menu compares raw state; explicit history error/loading).
- Backend `Code.gs`: append-only `장비운영이력` sheet (`appendEqHistory_`/`getEqHistory_`), and `updateEquipment_` appends one row only when state actually changes. Frontend: `fetchEqHistory` + read-only 운영 이력 drawer section.
- 3-lens adversarial review found 8, confirmed 3 (1 med stale-history race, 2 low: label fallback, dup repCode) — all fixed in `EqDetailDrawer.tsx` (unified guarded load via refreshTick; raw label for non-standard states; single repCode). 5 refuted.
- STEP21 status dropdown + anchorEl guard are now committed (`87a71c0`) and live.

## Last Known Verification

- 2026-06-15: Claude reported `npm run type-check` and `npm run build` passed for STEP21.
- 2026-06-16: Codex ran `npm.cmd run type-check`; passed.
- 2026-06-16: Claude ran browser/admin verification in dev; dropdown and guest gating OK.
- 2026-06-16: Claude added `anchorEl` guard to status `Menu`; type-check passed.
- 2026-06-16: Codex re-ran `npm.cmd run type-check`; passed.
- 2026-06-16: Claude implemented STEP22 phase 1 + review fixes; `npm.cmd run type-check` + `npm.cmd run build` passed; fresh dev server runtime had 0 console errors, drawer shows 6 sections incl. read-only 운영 이력 (empty handled gracefully while backend undeployed), admin gating intact.
- 2026-06-16: **DEPLOYED** — frontend GitHub Actions "Build and Deploy" success for `87a71c0`; backend `clasp redeploy @42`; live GET `?action=getEqHistory` returned `{status:ok, items:[]}`. Remaining: live admin status-change → history-record end-to-end check (needs a designated safe test equipment).
- 2026-06-16: Codex reviewed STEP22 phase 1 again and ran `npm.cmd run type-check` (passed). Follow-ups: raw non-standard state menu comparison, explicit history fetch error/loading state, and bridge/docs live-E2E verification inconsistency.
- 2026-06-16: **Live E2E CONFIRMED** — user performed an admin status change on CL-001 (Spin Coater) on the live site; `장비운영이력` auto-created with 2 rows (도입예정→도입중→가동중, 작성자 조성범, 01:35 KST); `?action=getEqHistory` returns them. (Side effect: CL-001 live state is now '가동중' — revert via UI if unintended.) Review-fix pass (raw-state menu compare + histError/loading) applied; `npm.cmd run type-check` passed.
- 2026-06-16: 장비 상태 어휘 개편(라벨매핑 폐지·운영중/도입중 verbatim·미분류 폴백) 구현. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev 검증(운영중/도입중 KPI 라벨, E-Beam Lithography 카드='미분류' 칩, 콘솔0). **미커밋** — 배포 전 시트 기존 '가동중' 값 마이그레이션 권장.
- 2026-06-16: STEP23(상태변경 사유 확인 Dialog) 구현. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev(@42): 상태 선택→확인 Dialog(장비명·관리번호·전→후·사유), 같은상태 no-op, 취소 정상, 콘솔0. 실 저장 성공경로는 라이브 데이터 변경이라 미수행(타입체크+STEP22 경로 재사용으로 갈음). **미커밋**.
- 2026-06-16: STEP24(업무현황 회의뷰) 구현 + 적대적 리뷰 수정. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev(/work): 업무목록 KPI 바로 아래·기본 진행중·아코디언7 모두 펼침·개별 접기(7→6)·전체탭→컴팩트행·Remind 워딩·담당자현황 숨김·'검토' 단축·장소 중복 해소(maxLoc=1)·콘솔0. **미커밋**.
- 2026-06-16: STEP23·24·상태 어휘 개편 **커밋·자동배포 완료**(f8bfee3). 이후 STEP25(KPI 보류/취소 제거·Check·Remind 토글·카드 재구성) 구현 + type-check/build 통과 + 라이브 dev 검증(서버 재기동 후 콘솔0, KPI 4타일·Remind 토글·압정카드·YYYY-MM-DD) → **커밋·자동배포 완료**. 운영 규칙=자동배포.

## Decisions

- Use `.agents/bridge` as the shared handoff area.
- Use role-specific inbox files to avoid overwriting each other's notes.
- Use `lock.md` before source edits when both agents may be active.
- For this repository, run type check with `npm.cmd run type-check` on Windows.
- Claude Code is responsible for development implementation and git push/pull.
- Codex is responsible for reviewing Claude's output, identifying risks, and preparing the next Claude Code prompt.
- Codex should avoid source edits and git sync unless the user explicitly overrides the role split.
- Immediate status apply is acceptable for now; do not add a confirm modal unless user feedback says it feels risky.
- Unknown non-empty equipment states may continue falling back to `비가동`, matching the existing count logic.
- STEP22 phase 1 uses a separate append-only sheet named `장비운영이력`.
- STEP22 phase 1 history columns: `일시`, `관리번호`, `장비명`, `이전상태`, `변경상태`, `사유`, `작성자`, `작업유형`, `비고`.

## Warnings

- Do not run destructive git commands unless the user explicitly asks.
- Do not let both agents edit the same file at the same time.
- Do not store credentials in bridge files.
- Do not have Codex and Claude Code implement changes concurrently.
- Do not mutate live equipment status unless there is a safe test record or explicit user approval.
- Do not deploy Apps Script until the user explicitly approves backend deployment.

## Next Handoff

- Codex: STEP23·24·25 + 상태 어휘 개편 **모두 커밋·자동배포 완료**. 검토 후 다음 프롬프트(STEP22 phase2 / 담당자현황 재노출 형태 / WorkWrite '검토 필요' 라벨 통일 여부 / 발표모드 등) 작성. **운영 규칙**: 작업 완료 시 자동 커밋·푸시(자동배포) — '미커밋 대기' 안 함. **잔여**: 시트 '가동중'→'운영중' 마이그레이션. 백엔드 무변경(@42).
