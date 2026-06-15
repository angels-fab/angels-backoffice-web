# Bridge State

## Current Goal

- Keep Claude Code and Codex synchronized through repository files.
- Use this file as the compact shared memory for the current work stream.
- Enforce the agreed role split: Claude Code implements and syncs git; Codex reviews and writes the next Claude prompt.

## Current Focus

- STEP21 status-change dropdown verified in dev (admin simulated via `localStorage.role='admin'`, no live sheet mutation): dropdown opens cleanly with 4 states (current `selected`), same-state is no-op; guest shows 5 sections and NO admin buttons.
- Two items remain unverified: screenshots (preview_screenshot times out — env limitation, documented) and a real live state mutation (intentionally not performed per the no-mutation rule).
- Console: only dev-only warnings (Redux serializable-middleware; MUI `anchorEl invalid` when menu open as drawer/route tears down — not reachable by normal mouse use, stripped in prod).
- Next: Codex decides among (a) safe live-mutation test, (b) optional 1-line anchorEl guard, (c) start STEP22 equipment operation history.

## Last Known Verification

- 2026-06-15: Claude reported `npm run type-check` and `npm run build` passed for STEP21.
- 2026-06-16: Codex ran `npm.cmd run type-check`; passed.
- 2026-06-16: Claude ran browser/admin verification in dev (dropdown + guest gating OK) and `npm run type-check`; passed. Screenshots could not be saved (preview_screenshot timeout). Live state mutation left unverified by design.

## Decisions

- Use `.agents/bridge` as the shared handoff area.
- Use role-specific inbox files to avoid overwriting each other's notes.
- Use `lock.md` before source edits when both agents may be active.
- For this repository, run type check with `npm.cmd run type-check` on Windows.
- Claude Code is responsible for development implementation and git push/pull.
- Codex is responsible for reviewing Claude's output, identifying risks, and preparing the next Claude Code prompt.
- Codex should avoid source edits and git sync unless the user explicitly overrides the role split.

## Warnings

- Do not run destructive git commands unless the user explicitly asks.
- Do not let both agents edit the same file at the same time.
- Do not store credentials in bridge files.
- Do not have Codex and Claude Code implement changes concurrently.
- Do not mutate live equipment status unless there is a safe test record or explicit user approval.

## Next Handoff

- Codex: review STEP21 verification in `inbox/claude-to-codex.md` (immediate-apply UX, anchorEl dev warning, eqStateKey fallback), then write `outbox/next-claude-prompt.md` choosing a safe live-mutation test, the optional anchorEl guard, or STEP22.
