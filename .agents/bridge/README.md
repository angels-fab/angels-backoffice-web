# Agent Bridge

Claude Code and Codex use this folder to pass concise handoff messages through the local repository.

## Role Split

- Claude Code owns implementation, local development commands, and git sync (`pull`, `commit`, `push`).
- Codex owns review, risk analysis, project-state整理, and writing the next Claude development prompt.
- Codex should not edit source code or run git sync unless the user explicitly asks.
- If Codex finds a required fix, it should write a precise prompt for Claude instead of taking over implementation by default.

## Folder Map

- `state.md`: shared project state, current focus, decisions, and warnings.
- `lock.md`: optional work lock. Fill this before one agent edits files that another agent should avoid.
- `inbox/claude-to-codex.md`: Claude writes here when Codex should review, decide, or create the next prompt.
- `inbox/codex-to-claude.md`: Codex writes here when Claude should continue implementation.
- `outbox/next-claude-prompt.md`: prompt to paste into Claude Code.
- `outbox/next-codex-prompt.md`: prompt to paste into Codex.
- `logs/`: dated work notes. Keep long details here instead of bloating `state.md`.

## Operating Rules

1. Read `state.md`, `lock.md`, and the relevant inbox file before starting work.
2. Run `git status --short` before editing. Do not overwrite the other agent's uncommitted work.
3. If you are editing source files, claim them in `lock.md`.
4. Keep bridge messages short and action-oriented.
5. At the end of work, update one inbox file for the other agent and one outbox prompt if the next step is clear.
6. Do not store secrets, passwords, tokens, or private credentials in this folder.
7. Prefer Claude Code for commit/push and cross-device sync. This bridge shares context, not runtime state.

## Recommended Turn Ending

Each agent should leave:

- What changed
- What was verified
- What is blocked or risky
- What the other agent should do next
