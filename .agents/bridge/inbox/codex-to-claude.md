# Codex To Claude

## Summary

- Bridge folder created and updated with the agreed role split.
- Claude Code owns implementation and git push/pull.
- Codex owns review and next-step prompt writing.

## Changed Files

- `.agents/bridge/README.md`
- `.agents/bridge/state.md`
- `.agents/bridge/lock.md`
- `.agents/bridge/inbox/claude-to-codex.md`
- `.agents/bridge/inbox/codex-to-claude.md`
- `.agents/bridge/outbox/next-claude-prompt.md`
- `.agents/bridge/outbox/next-codex-prompt.md`

## Verification

- Not run. Documentation/template-only change.

## Request For Claude

- Use `.agents/bridge` for handoff notes before and after collaborative work.
- Read `state.md`, `lock.md`, and this file before starting.
- Treat Claude Code as the implementation and git sync worker.
- Leave review questions or follow-up needs for Codex in `inbox/claude-to-codex.md`.

## Suggested Next Step

- If continuing implementation, update `lock.md` with the files Claude will edit.
