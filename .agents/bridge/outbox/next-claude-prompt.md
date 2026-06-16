# Next Claude Prompt

Read these files first:

1. `AGENTS.md`
2. `.agents/bridge/README.md`
3. `.agents/bridge/state.md`
4. `.agents/bridge/lock.md`
5. `.agents/bridge/inbox/codex-to-claude.md`
6. `.agents/bridge/inbox/claude-to-codex.md`
7. `docs/step22-eqops-history-plan.md`

Role:

- You are the implementation and git sync agent.
- Codex reviewed STEP22 phase 1 and found no blocking backend issue.
- This task is a small review-fix pass plus bridge/documentation reconciliation.

Before editing:

1. Run `git status --short`.
2. Preserve the existing uncommitted change in `.agents/bridge/outbox/next-codex-prompt.md`; do not overwrite it blindly.
3. If you edit source files, set `.agents/bridge/lock.md` to locked for the files you touch, then clear it back to free at the end.

Task 1 — Fix non-standard state menu behavior:

- File: `src/pages/EquipmentOps/EqDetailDrawer.tsx`
- Problem: `eqStateKey(group.state)` is used for both status display and menu no-op/selected checks. Unknown raw states collapse to `비가동`, so `비가동` can appear selected even when the sheet value is actually `유지보수`, `고장`, etc.
- Keep `eqStateKey()` for existing chip/count display.
- For the state-change menu, compare against the raw trimmed state string instead:
  - no-op should be `if (s === rawState) return`
  - selected should be true only when `s === rawState`
  - if raw state is not one of `도입예정`, `도입중`, `가동중`, `비가동`, no menu item should be selected.

Task 2 — Make history loading/error state explicit:

- File: `src/pages/EquipmentOps/EqDetailDrawer.tsx`
- Add a small `histError` state.
- In the history-loading effect:
  - when `!group || !repCode`, clear history, clear error, and set `histLoading(false)`.
  - before fetch, set loading true and error false.
  - on fetch failure, clear history and set error true.
  - finally, set loading false only while the effect is still alive.
- In the `운영 이력` section:
  - show `불러오는 중...` while loading.
  - show a short failure message when `histError` is true.
  - show `운영 이력이 없습니다` only when loading is false, error is false, and the list is empty.
- Keep the UI restrained and consistent with the current Drawer. Do not add emoji, colored left borders, or broad layout/style changes.

Task 3 — Reconcile bridge/docs live-verification state:

- Current inconsistency:
  - `.agents/bridge/outbox/next-codex-prompt.md` says CL-001 live E2E verification is complete.
  - `.agents/bridge/state.md` and `docs/step22-eqops-history-plan.md` still say live status-change/history verification is pending or backend is undeployed.
- Check the actual evidence you have.
- If CL-001 live E2E was truly completed, update all relevant docs/bridge files consistently with date, equipment code/name, old/new states, and how it was verified.
- If it was not truly completed, remove or correct the E2E-complete claim in `next-codex-prompt.md` and leave the live verification as pending.
- Do not perform a new live equipment mutation unless the user explicitly approves the exact test record and target state.

Verification:

- Run `npm.cmd run type-check`.
- If you changed UI behavior, capture at least one desktop screenshot of the drawer/status menu/history area into `.agents/bridge/screenshots/`.
- If screenshot capture fails, record the reason in `.agents/bridge/inbox/claude-to-codex.md`.

After finishing:

- Update `.agents/bridge/inbox/claude-to-codex.md` with:
  - files changed
  - what was verified
  - screenshot paths or failure reason
  - whether live E2E is confirmed or still pending
- Update `.agents/bridge/state.md` if the source of truth changed.
- Leave `.agents/bridge/lock.md` as `status: free`.
- Commit/push only when the user says `퇴근` or explicitly asks to sync.
