# Next Claude Prompt

Read these files first:

1. `.agents/bridge/README.md`
2. `.agents/bridge/state.md`
3. `.agents/bridge/lock.md`
4. `.agents/bridge/inbox/codex-to-claude.md`

Then continue the project using the repository's existing rules.

Role:

- You are the implementation and git sync agent.
- Codex reviewed the STEP21 guard change and found no blocker.
- Do not touch `TopBar.tsx` for the Tooltip warning in this task; it is a separate dev-only issue.

Current task:

Start STEP22 phase 1: equipment operation history.

Goal:

- Track equipment state changes in a separate append-only history sheet.
- Show recent operation history in `EquipmentOps` detail drawer.
- Keep first pass read-only. No history editing/deleting.

Storage decision:

- Sheet name: `장비운영이력`
- Columns:
  - `일시`
  - `관리번호`
  - `장비명`
  - `이전상태`
  - `변경상태`
  - `사유`
  - `작성자`
  - `작업유형`
  - `비고`

Backend guidance (`google-apps-script/Code.gs`):

1. Add a history sheet helper.
   - If the history sheet does not exist, append should create it with the header row.
   - Read should return an empty list if the sheet does not exist.

2. Add read support.
   - Suggested doGet route: `?action=getEqHistory&code=<관리번호>`.
   - Return JSON `{ status: 'ok', items: [...] }`.
   - Filter by `관리번호` when `code` is provided.
   - Sort newest first if practical.

3. Append history on successful state change.
   - In `updateEquipment_(req)`, capture previous state before writing.
   - After successful write, if `req.state !== undefined` and previous state differs from new state, append one history row.
   - Use current KST timestamp.
   - Use `req.author` as `작성자`.
   - Use `req.reason || ''`.
   - Use `작업유형 = '상태변경'`.
   - Leave `비고` empty for now.
   - Keep existing update behavior unchanged for non-state edits.

Frontend guidance:

1. In `src/api/sheets.ts`, add:
   - `EqHistoryItem` type
   - `fetchEqHistory(code: string): Promise<EqHistoryItem[]>`

2. In `src/pages/EquipmentOps/EqDetailDrawer.tsx`:
   - Load recent history when a drawer opens and `repCode` exists.
   - Add a read-only `운영 이력` section.
   - Show newest entries compactly: date/time, previous state → new state, author, optional reason.
   - Empty state text is fine when no history exists.
   - After a successful state change, refresh history along with existing `onSaved`.
   - Keep guest read access unless existing product logic suggests otherwise.

3. Keep UI restrained and consistent with the existing Drawer.
   - Use MUI icons only if adding icons.
   - Do not add emoji.
   - Do not add colored left borders.
   - Do not make broad layout/style refactors.

Safety:

- Do not deploy Apps Script unless the user explicitly asks.
- Do not perform live equipment state mutation unless the user explicitly names a safe test equipment record or approves the test.
- If live mutation cannot be tested, document it as unverified.

Verification:

- Run `npm.cmd run type-check`.
- If you change backend code, note that backend deployment is still pending.
- If possible, run a frontend-only check that the drawer handles empty history gracefully.

After finishing:

- Update `.agents/bridge/inbox/claude-to-codex.md`.
- Update `.agents/bridge/state.md`.
- Leave `.agents/bridge/lock.md` as `status: free`.
- Update or extend `docs/step22-eqops-history-plan.md` with the implemented decisions.
- Commit/push only when the user says `퇴근` or explicitly asks to sync.
