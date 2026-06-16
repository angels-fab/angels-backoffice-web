# Claude To Codex

## Summary

- **STEP26 — 업무현황(/work) KPI '전체' 타일 + 목록 2열 + Remind 카드/들여쓰기** 구현 완료(프런트 전용). 커밋·**자동배포 완료**.

## Changed Files

- `src/pages/Work/index.tsx` — KPI 5타일(완료·Check 사이에 '전체' 추가, `counts.total`), 업무목록 상태칩 행 삭제(+`STATUS_CHIPS`/`statusCount`/`W_STATUS_TABS` import 제거), 목록을 `(chiefOnly || 진행중 || 완료)`일 때 `CardGrid columns={2}` 아코디언 그리드(진행중만 `defaultExpanded`)·전체는 컴팩트 행.
- `src/pages/Work/TaskCard.tsx` — Remind 카드 담당자에 `ml: auto` → 담당자+날짜 우측 그룹화.
- `src/pages/Work/TaskAccordion.tsx` — `defaultExpanded` prop(진행중 true/완료·Check false), 본문을 공용 `SubLine`으로 렌더.
- `src/pages/Work/SubLine.tsx` (신규) — 글머리기호(-, •, 번호) 행잉 인덴트 공용 컴포넌트.
- `src/pages/Work/TaskDetailDrawer.tsx` — 로컬 SubLine 제거 → 공용 import(동작 동일).
- `docs/step26-work-2col-remind-card.md`(신규), `docs/HANDOFF.md` 갱신.

## 실행한 검증

- `npm.cmd run type-check` + `npm.cmd run build` 통과.
- 라이브 dev(/work, 서버 재기동 후): KPI 5타일(진행중8·완료116·전체124·Check1·Remind13, '전체'가 완료/Check 사이) / 상태칩행 없음 / 진행중 2열 펼침(1280px=496×2)·완료 2열 접힘(116, expanded 0) / 좁힌 폭 1열(반응형) / Remind 토글→압정 카드(담당자+날짜 우측, marginLeft auto, YYYY-MM-DD) / 글머리기호 마커+본문 분리(`-` 라인 확인) / 콘솔 에러 0.
- (편집 중 HMR 중간상태 에러는 서버 재기동 후 0으로 확인 — 코드 결함 아님.)

## 검토 포인트

1. 보류·취소를 필터에서 완전히 뺌(KPI '전체'로만 전체 접근) — 추후 보류/취소 재노출 경로 필요할지.
2. 완료·Check 아코디언 기본 접힘 + 2열(116건) 적정성 / '모두 펼치기' 토글 필요성.
3. SubLine 공용화로 Drawer 본문도 동일 컴포넌트 — Drawer 회귀 없는지(로직 동일).

## Screenshots

- 없음 — `preview_screenshot` 환경 타임아웃. DOM 검증으로 대체.

## Suggested Next Step

- 시트 상태값 마이그레이션(가동중→운영중) / 담당자현황 재노출 형태 / STEP22 phase2 / 발표·인쇄 모드.
