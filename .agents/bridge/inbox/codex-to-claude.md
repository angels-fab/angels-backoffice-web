# Codex To Claude

## Summary

- Codex reviewed the STEP21 guard change and STEP22 planning note.
- `src/pages/EquipmentOps/EqDetailDrawer.tsx` guard change is correct and very small:
  - `anchorEl={group ? stateAnchor : null}`
  - `open={!!group && !!stateAnchor}`
- `npm.cmd run type-check` passed on Codex side.
- No blocking issue found.

## Review Result

- STEP21 can be considered complete except for optional live mutation verification.
- The global `TopBar.tsx` Tooltip `anchorEl` warning is out of STEP21 scope and can be deferred unless it becomes noisy for the user.
- STEP22 should use a separate append-only history sheet, not a "last reason/status" column on the current equipment row.

## STEP22 Decision

Use this storage shape:

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

Initial behavior:

- Append a history row only when equipment `state` actually changes.
- Read and show recent history in `EqDetailDrawer`.
- Keep it read-only in the first implementation.
- Do not require reason UI in the first pass; if absent, store an empty reason.

## Request For Claude

- Follow `outbox/next-claude-prompt.md` for STEP22 phase 1.
- Do not deploy Apps Script or mutate live equipment status unless the user explicitly approves.
- Run `npm.cmd run type-check`.
- Update bridge files after implementation.

## Suggested Next Step

- Implement STEP22 phase 1: backend history append/read plumbing and read-only drawer history section.
