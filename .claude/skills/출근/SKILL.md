---
name: 출근
description: 작업 시작 준비 루틴. git pull로 다른 곳(집/사무실)에서 한 최신 코드를 받고, 의존성이 바뀌었으면 npm install, 개발 서버(localhost:3600) 실행, 권한 자동승인 정책 보장, 현재 상태를 요약 보고한다. "출근", "작업 시작", "이어서 하자" 류의 요청에 사용.
---

# 출근 — 작업 시작 준비

사용자가 작업을 시작할 때, 다른 PC(집↔사무실)에서 한 작업을 받아 바로 코딩할 수 있는 상태로 만든다.
출력은 항상 `가독성` 형식(🔧 회색=실행한 작업 / 💡 파란줄=쉬운 의미 / ✋ 노란=사용자 할 일)을 따른다.

## 순서

1. **권한 자동승인 정책 보장** — 아래 "## 권한 자동승인 정책" 절차 실행(이 PC에 정책 없으면 심기). 머신마다 한 번만 적용되면 됨.
2. **위치 확인** — 작업 폴더 `angels-backoffice-web`인지 확인. 아니면 거기로 이동.
3. **최신 코드 받기** — `git pull origin main`.
   - 충돌·에러가 나면 **절대 강제로 덮어쓰지 말고** 사용자에게 그대로 보고하고 멈춘다.
4. **의존성 동기화** — `node_modules`가 없거나 `package-lock.json`이 이번 pull로 바뀌었으면 `npm install`.
5. **개발 서버 실행** — `npm run dev`(백그라운드, 포트 3600). 이미 떠 있으면 생략.
6. **상태 요약** — 방금 받은 커밋(최근 `git log` 몇 개), 현재 브랜치, 접속 주소 `http://localhost:3600`를 가독성 형식으로 보고.

## 권한 자동승인 정책 (머신 간 유지)

목적: 안전한 작업은 자동승인하고, 되돌리기 어려운(치명적) 작업만 확인받게 해 승인 피로를 없앤다. 전역 파일 `~/.claude/settings.json`에 두므로 **이 PC에서 만드는 모든 새 세션에 유지**된다. PC마다 파일이 별개라, 새 PC에서 처음 `/출근`할 때 한 번 심으면 된다.

절차:
1. `~/.claude/settings.json`을 읽는다(없으면 새로 만든다).
2. 이미 `permissions` 블록이 있고 아래 정책과 사실상 같으면 **그대로 둔다**(덮어쓰지 않는다).
3. `permissions`가 없거나 비어 있으면, 기존 다른 키(예: `skipWorkflowUsageWarning`)는 보존하면서 아래 `permissions` 블록을 병합해 넣는다.
4. 사용자가 별도로 조정한 흔적(allow/ask에 수기 항목)이 보이면 덮어쓰지 말고 사용자에게 확인한다.

표준 정책(자동승인=allow / 확인필요=ask). 치명적 경계는 "느슨" 기준 — 파일 삭제·`reset --hard`·`clean`·강제푸시·history 재작성·repo 삭제만 확인받고 나머지(clasp 배포·reset soft·revert·rebase·restore·branch 삭제 포함)는 자동승인:

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Read", "Glob", "Grep", "ToolSearch",
      "Bash(ls:*)", "Bash(cat:*)", "Bash(pwd)", "Bash(echo:*)", "Bash(grep:*)", "Bash(rg:*)",
      "Bash(head:*)", "Bash(tail:*)", "Bash(wc:*)", "Bash(sort:*)", "Bash(uniq:*)", "Bash(which:*)",
      "Bash(find:*)", "Bash(diff:*)", "Bash(sed:*)", "Bash(awk:*)", "Bash(mkdir:*)", "Bash(cp:*)",
      "Bash(mv:*)", "Bash(touch:*)",
      "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)",
      "Bash(git branch:*)", "Bash(git fetch:*)", "Bash(git pull:*)", "Bash(git add:*)",
      "Bash(git commit:*)", "Bash(git push:*)", "Bash(git stash:*)", "Bash(git switch:*)",
      "Bash(git checkout:*)", "Bash(git remote:*)", "Bash(git rev-parse:*)", "Bash(git rev-list:*)",
      "Bash(git describe:*)", "Bash(git tag:*)", "Bash(git ls-files:*)", "Bash(git config:*)",
      "Bash(git reset:*)", "Bash(git revert:*)", "Bash(git rebase:*)", "Bash(git restore:*)",
      "Bash(git reflog:*)", "Bash(git merge:*)", "Bash(git cherry-pick:*)",
      "Bash(npm install:*)", "Bash(npm ci:*)", "Bash(npm run:*)", "Bash(npm ls:*)", "Bash(npm test:*)",
      "Bash(npx tsc:*)", "Bash(npx vitest:*)", "Bash(npx jest:*)", "Bash(vitest:*)", "Bash(jest:*)",
      "Bash(node:*)", "Bash(curl:*)", "Bash(clasp:*)", "Bash(npx clasp:*)",
      "Bash(gh auth:*)", "Bash(gh repo view:*)", "Bash(gh pr:*)", "Bash(gh issue:*)",
      "Bash(gh run:*)", "Bash(gh api:*)", "Bash(gh secret:*)",
      "PowerShell(git status:*)", "PowerShell(git log:*)", "PowerShell(git diff:*)",
      "PowerShell(git show:*)", "PowerShell(git add:*)", "PowerShell(git commit:*)",
      "PowerShell(git push:*)", "PowerShell(git pull:*)", "PowerShell(git fetch:*)",
      "PowerShell(git branch:*)", "PowerShell(git config:*)", "PowerShell(git remote:*)",
      "PowerShell(git reset:*)", "PowerShell(git rebase:*)", "PowerShell(git restore:*)",
      "PowerShell(npm run:*)", "PowerShell(npm install:*)", "PowerShell(npm ci:*)",
      "PowerShell(node:*)", "PowerShell(clasp:*)", "PowerShell(Get-ChildItem:*)",
      "PowerShell(Get-Content:*)", "PowerShell(Get-Command:*)", "PowerShell(Test-Path:*)",
      "mcp__visualize__read_me", "mcp__visualize__show_widget",
      "mcp__Claude_Preview__preview_start", "mcp__Claude_Preview__preview_list",
      "mcp__Claude_Preview__preview_eval", "mcp__Claude_Preview__preview_console_logs",
      "mcp__Claude_Preview__preview_logs", "mcp__Claude_Preview__preview_network",
      "mcp__Claude_Preview__preview_snapshot", "mcp__Claude_Preview__preview_screenshot",
      "mcp__Claude_Preview__preview_click", "mcp__Claude_Preview__preview_fill",
      "mcp__Claude_Preview__preview_resize", "mcp__Claude_Preview__preview_inspect",
      "mcp__Claude_Preview__preview_stop",
      "mcp__ccd_session__mark_chapter", "mcp__ccd_session__spawn_task",
      "mcp__ccd_session__dismiss_task", "mcp__ccd_session__read_widget_context"
    ],
    "ask": [
      "Bash(git reset --hard:*)", "Bash(git clean:*)", "Bash(git push --force:*)",
      "Bash(git push -f:*)", "Bash(git push --force-with-lease:*)", "Bash(git filter-branch:*)",
      "Bash(rm:*)", "Bash(del:*)", "Bash(rmdir:*)", "Bash(gh repo delete:*)",
      "PowerShell(Remove-Item:*)", "PowerShell(git reset --hard:*)", "PowerShell(git clean:*)",
      "PowerShell(git push --force:*)", "PowerShell(git push -f:*)"
    ]
  }
}
```

비고: `defaultMode: acceptEdits`라 파일 편집(Read/Edit/Write)은 자동 수락. `git push:*`는 allow지만 `git push --force:*`가 ask라 강제푸시는 더 구체적 규칙(ask)이 우선해 항상 확인받는다. `git reset:*`/`npm run:*`도 같은 원리로 `reset --hard`만 확인.

## 주의

- 코드 수정에 들어가기 전 저장소의 `CLAUDE.md`/`AGENTS.md` 디자인 규칙(이모지 아이콘 금지·MUI만, 카드 왼쪽 컬러보더 금지 등)을 먼저 읽는다.
- pull로 받은 변경이 크면 무엇이 바뀌었는지 한 줄 요약해 사용자가 맥락을 잡게 한다.
- 권한 정책은 머신마다 별개 파일(`~/.claude/settings.json`)이라 자동 동기화되지 않는다. 새 PC에서 처음 `/출근`할 때 심긴다.
