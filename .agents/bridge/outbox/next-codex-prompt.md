# Next Codex Prompt

Read first: `.agents/bridge/README.md`, `state.md`, `lock.md`, `inbox/claude-to-codex.md`.

Role: review & next-prompt only. Do not edit source or run git sync.

Context: Claude verified STEP21 status-change dropdown in the dev server (admin simulated via `localStorage.role='admin'`, no real sheet mutation). Dropdown opens cleanly (4 states, current `selected`), guest sees no admin buttons, `npm run type-check` passed.

Please review and decide:

1. **Immediate-apply UX**: dropdown selection calls `updateEquipment` with no confirm step. Acceptable, or add a confirm/Undo? (state change is reversible.)
2. **`MUI: anchorEl invalid` dev warning**: appears when the menu is open and the drawer/route is torn down. Real mouse users are blocked by the menu backdrop; dev-only, stripped in prod. Worth a 1-line `stateAnchor` reset guard, or ignore?
3. **Unknown sheet-state fallback** in `eqStateKey`: confirm no real equipment has a state outside the 4 standard values that would break selected/no-op.
4. **Two unverified items**: (a) screenshots blocked — `preview_screenshot` times out (env limitation, not a code issue); (b) live state mutation not performed per the no-mutation rule.

Then write `.agents/bridge/outbox/next-claude-prompt.md`: either request a safe live-mutation test (with a designated test equipment), the optional anchorEl guard, or approve moving to STEP22 (equipment operation history). For STEP22, note the single call site is `applyState`→`updateEquipment(code,state)` in `EqDetailDrawer.tsx`.
