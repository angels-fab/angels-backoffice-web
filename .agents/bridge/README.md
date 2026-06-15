# Agent Bridge

Claude Code and Codex use this folder to pass concise handoff messages through the local repository.

## Role Split

- Claude Code owns implementation, local development commands, git sync (`pull`, `commit`, `push`), and UI/UX screenshot capture for Codex review.
- Codex owns review, risk analysis, project-state整理, and writing the next Claude development prompt. Codex does NOT capture screenshots.
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
- `screenshots/`: Claude Code saves UI/UX screenshots here so Codex can review on any machine without re-running the app (Claude only — Codex does not capture).

## Operating Rules

1. Read `state.md`, `lock.md`, and the relevant inbox file before starting work.
2. Run `git status --short` before editing. Do not overwrite the other agent's uncommitted work.
3. If you are editing source files, claim them in `lock.md`.
4. Keep bridge messages short and action-oriented.
5. At the end of work, update one inbox file for the other agent and one outbox prompt if the next step is clear.
6. Do not store secrets, passwords, tokens, or private credentials in this folder.
7. Prefer Claude Code for commit/push and cross-device sync. This bridge shares context, not runtime state.

## Screenshots (Claude Code only)

Only Claude Code captures screenshots; Codex never does. The point is that Codex (or a different machine) can review UI/UX changes without re-running the app.

- Save to `.agents/bridge/screenshots/`. Filename includes date + task, e.g. `2026-06-15-step21-equipment-ops-dropdown-desktop.png`.
- Capture whenever you change screen structure, buttons, Drawer, Dialog, dropdown, menu, cards, or responsive layout.
- At least 1 desktop shot. Add 1 mobile shot if the change affects responsive layout.
- For state-change UI, capture before/after (or closed/open). For dropdown/menu/modal, include the OPEN state.
- Always record the screenshot paths in `inbox/claude-to-codex.md` under a `## Screenshots` section.
- If capture is impossible, write the reason in `claude-to-codex.md` instead of a path.

## Recommended Turn Ending

Each agent should leave:

- What changed
- What was verified
- What is blocked or risky
- What the other agent should do next
