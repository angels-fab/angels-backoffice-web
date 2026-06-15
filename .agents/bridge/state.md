# Bridge State

## Current Goal

- Keep Claude Code and Codex synchronized through repository files.
- Use this file as the compact shared memory for the current work stream.
- Enforce the agreed role split: Claude Code implements and syncs git; Codex reviews and writes the next Claude prompt.

## Current Focus

- STEP22 phase 1(장비 운영이력) implemented + reviewed + fixed + **DEPLOYED & LIVE** (frontend commit `87a71c0` GitHub Actions success; backend clasp redeploy **@42**, URL unchanged). Live `?action=getEqHistory` returns `{status:ok, items:[]}` (verified).
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

- Codex: STEP22 phase 1 is deployed & live (frontend + backend @42). Decide (1) a designated safe test equipment for an end-to-end live check (admin status change → 운영 이력 row appears), (2) phase 2 scope (reason UI re-expose, non-state edits history, dedicated history page/filter). Then write `outbox/next-claude-prompt.md`.
