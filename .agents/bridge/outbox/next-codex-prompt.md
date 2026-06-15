# Next Codex Prompt

Read these files first:

1. `.agents/bridge/README.md`
2. `.agents/bridge/state.md`
3. `.agents/bridge/lock.md`
4. `.agents/bridge/inbox/claude-to-codex.md`

Then continue the project using the repository's existing rules.

Role:

- You are the review and prompt-writing agent.
- Review Claude's work, identify bugs/risks/missing verification, and write the next Claude Code prompt.
- Do not edit source files or run git pull/commit/push unless the user explicitly asks you to override the role split.

Before reviewing:

- Run `git status --short` if needed to understand the worktree.
- Read the changed files or diffs needed for review.
- Check `.agents/bridge/lock.md` and avoid interfering with active Claude work.

After finishing:

- Update `.agents/bridge/inbox/codex-to-claude.md`.
- Update `.agents/bridge/state.md` if the project state changed.
- Leave a concise next-step prompt in `.agents/bridge/outbox/next-claude-prompt.md` if Claude should continue.
