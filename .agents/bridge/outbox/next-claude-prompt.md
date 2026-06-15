# Next Claude Prompt

Read these files first:

1. `.agents/bridge/README.md`
2. `.agents/bridge/state.md`
3. `.agents/bridge/lock.md`
4. `.agents/bridge/inbox/codex-to-claude.md`

Then continue the project using the repository's existing rules.

Role:

- You are the implementation and git sync agent.
- You may edit source files for the requested task.
- You are responsible for local verification and, when asked to finish/sync, git pull/commit/push.
- Codex will review your result and prepare follow-up prompts.

Before editing:

- Run `git status --short`.
- If you will modify source files, update `.agents/bridge/lock.md` with your worker name, task, and files to avoid.
- Do not overwrite uncommitted work from another agent.

After finishing:

- Update `.agents/bridge/inbox/claude-to-codex.md`.
- Update `.agents/bridge/state.md` if the project state changed.
- Leave a concise next-step prompt in `.agents/bridge/outbox/next-codex-prompt.md` if Codex should continue.
