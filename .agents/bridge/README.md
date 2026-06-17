# Agent Bridge

Claude Code and Codex use this folder to pass concise handoff messages through the local repository.

## Role Split

> 기준 문서: 루트 `AGENTS.md`의 "Codex 역할 변경" 섹션 (Codex = 자문위원).

- Claude Code owns implementation, local development commands, git sync (`pull`, `commit`, `push`), and UI/UX screenshot capture.
- **Codex = 비개발자(사용자)를 위한 UX/UI/기능 개발 자문위원.** Claude 보고를 쉽게 요약하고, 업무적 의미를 설명하며, 시각 예시·선택지·추천을 제공한다.
- **Codex는 사용자가 명시적으로 요청하지 않는 한 Claude용 개발 프롬프트를 작성하지 않는다.** 소스 편집·git 동기화·스크린샷 캡처도 하지 않는다(스크린샷은 Claude 전용).
- Codex가 필요한 수정을 발견하면, 기본적으로 사용자에게 의미·선택지로 설명한다(직접 구현 인수 금지). 사용자가 명시 요청할 때만 Claude용 프롬프트를 작성한다.

## Folder Map

- `state.md`: shared project state, current focus, decisions, and warnings.
- `lock.md`: optional work lock. Fill this before one agent edits files that another agent should avoid.
- `inbox/claude-to-codex.md`: Claude writes here for Codex to summarize/explain to the user (변경·검증·의미 참고자료). Codex가 사용자에게 설명·추천하는 근거로 읽는다.
- `inbox/codex-to-claude.md`: Codex writes here when Claude should continue implementation (보통 사용자 지시를 옮길 때).
- `outbox/next-claude-prompt.md`: Claude용 프롬프트 — **사용자가 명시 요청할 때만** 작성/사용.
- `outbox/next-codex-prompt.md`: prompt to paste into Codex.
- `logs/`: dated work notes. Keep long details here instead of bloating `state.md`.
- `screenshots/`: Claude Code saves UI/UX screenshots here so Codex can review on any machine without re-running the app (Claude only — Codex does not capture).

## Operating Rules

1. Read `state.md`, `lock.md`, and the relevant inbox file before starting work.
2. Run `git status --short` before editing. Do not overwrite the other agent's uncommitted work.
3. If you are editing source files, claim them in `lock.md`.
4. Keep bridge messages short and action-oriented.
5. At the end of work, update one inbox file for the other agent. (outbox prompt는 사용자가 명시 요청할 때만 작성.)
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
