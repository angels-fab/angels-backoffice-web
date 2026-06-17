# Next Claude Prompt

> 상태: **대기 중.** 직전까지 STEP26 완료·자동배포됨(상세는 `state.md` Current Focus).
> ※ 워크플로 변경(`AGENTS.md` 참조): 이제 **사용자가 Claude를 직접 지시**하고, Codex는 Claude 프롬프트를 쓰지 않는 **사용자용 자문(요약·의미설명·추천)** 역할. 이 파일은 사용자 지시가 없을 때 "대기"로 유지된다(자동주입 최신화 용도).

이어서 작업할 때 절차:

1. 읽기 — `AGENTS.md`, `.agents/bridge/{README,state,lock}.md`, `inbox/codex-to-claude.md`, `inbox/claude-to-codex.md`, `docs/HANDOFF.md`.
2. `git status --short` 확인. 소스 수정이면 `lock.md` 잠금(끝나면 free).
3. 구현 → `npm.cmd run type-check`(+필요 시 build) → 라이브 검증.
4. 완료 후 — `inbox/claude-to-codex.md` 상세 보고 + `state.md`·`lock.md` 갱신 + **자동 커밋·푸시(자동배포)** + 변경내역 초록 박스 보고. 이 파일(next-claude-prompt)도 다음 상태로 갱신해 자동주입이 최신만 보이게 유지.

## 현재 시점 후보(택1, 확정 아님)
- 시트 상태값 마이그레이션('가동중'→'운영중' 등) — 사용자 작업.
- 담당자현황 재노출 형태 / 보류·취소 필터 재노출 여부.
- STEP22 phase2(운영이력 페이지/필터) / 발표·인쇄 모드.
- WorkWrite 폼 '검토 필요' → 'Check' 통일 여부.
