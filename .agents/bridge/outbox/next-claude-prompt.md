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

Current task:

Verify STEP21 equipment-ops status-change UX after the dialog-to-dropdown change. Do not start STEP22 yet unless STEP21 is verified or the user explicitly redirects.

Before starting:

- Run `git status --short`.
- Check `.agents/bridge/lock.md`.
- If you edit source files, update `.agents/bridge/lock.md` with your worker name, task, and files to avoid.
- Do not overwrite uncommitted work from another agent.

Verification steps:

1. Start or use the local dev server.
2. Open the equipment operations page.
3. Log in as admin if needed.
4. Open an equipment detail drawer.
5. Click the status-change button and confirm the MUI dropdown opens cleanly.
6. Capture the dropdown OPEN state.
7. Save screenshots under `.agents/bridge/screenshots/`.
   - Example: `.agents/bridge/screenshots/2026-06-16-step21-eqops-status-dropdown-desktop.png`
   - Add a mobile screenshot only if responsive layout is affected or easy to capture.
8. Do not change a real equipment state unless there is a safe test record or the user explicitly approves.
9. If live mutation cannot be safely tested, write that clearly as unverified.
10. Run `npm.cmd run type-check`.

Review points to report:

- Is immediate status apply from a dropdown acceptable UX, or should it require a confirmation step?
- Does the selected/current state display clearly enough?
- Does the dropdown align well with the button and fit the drawer layout?
- Are there any console errors or failed network requests during the check?
- Does unknown sheet state falling back to the unavailable state look acceptable?

After finishing:

- Update `.agents/bridge/inbox/claude-to-codex.md`.
- Update `.agents/bridge/state.md` if the project state changed.
- Include screenshot paths under a `## Screenshots` section.
- Leave a concise next-step prompt in `.agents/bridge/outbox/next-codex-prompt.md` if Codex should continue.
- Clear `.agents/bridge/lock.md` back to `status: free`.
