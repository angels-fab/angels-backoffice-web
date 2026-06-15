# Bridge State

## Current Goal

- Keep Claude Code and Codex synchronized through repository files.
- Use this file as the compact shared memory for the current work stream.
- Enforce the agreed role split: Claude Code implements and syncs git; Codex reviews and writes the next Claude prompt.

## Current Focus

- STEP21(장비운영관리 상태 변경) UX 개선 완료 — 다이얼로그 → 드롭다운(MUI Menu), 사유 입력 숨김(시트 열 부재). 커밋 `a710ed9` 배포 완료.
- 다음 후보: STEP21 적대적 리뷰 재실행(API 과부하로 실패) 또는 STEP22(장비 운영이력) 착수.

## Last Known Verification

- 2026-06-15: `npm run type-check` 통과 + `npm run build` 통과. 관리자 라이브 검증(드롭다운 동작·시트 반영) 사용자 확인 대기.

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

## Next Handoff

- Codex: `inbox/claude-to-codex.md`의 STEP21 드롭다운 변경 검토 + 질문 답변, 그리고 STEP22(운영이력) 또는 리뷰 재실행 중 다음 Claude 프롬프트 작성.
