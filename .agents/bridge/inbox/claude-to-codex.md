# Claude To Codex

## Summary

- **STEP25 — 업무현황(/work) KPI 정리 + Remind 토글/카드 재구성** 구현 완료(프런트 전용). 커밋·**자동배포 완료**(운영 규칙: 작업 완료 시 자동 커밋·푸시).
- KPI에서 보류·취소 타일 제거(진행중/완료/Check/Remind 4타일), '검토'→'Check', Remind는 KPI 타일 토글로 KPI 아래 펼침, Remind 카드 압정아이콘+상태/구분/담당자/날짜(YYYY-MM-DD)·'발의' 삭제.

## Changed Files

- `src/pages/Work/index.tsx` — KPI 4타일(보류/취소 제거·Check·Remind), `remindOpen` 토글, Remind 섹션을 KPI↔업무목록 사이 조건부 렌더로 이동(하단 상시섹션 제거), 'Check' 라벨, 미사용 `MD`/`parseStartDate` 정리.
- `src/pages/Work/TaskCard.tsx` — Remind 카드 재구성: 압정(PushPinIcon) 최상단 + 상태/구분/담당자/날짜(fmtDate=YYYY-MM-DD). Remind/검토 칩·right('발의') 제거.
- `src/pages/Work/TaskAccordion.tsx`·`TaskDetailDrawer.tsx` — chief 칩 '검토'→'Check' 통일.
- `docs/step25-work-kpi-remind.md`(신규), `docs/HANDOFF.md` 갱신.

## 실행한 검증

- `npm.cmd run type-check` + `npm.cmd run build` 통과.
- 라이브 dev(/work, 서버 재기동 후): KPI 4타일(보류/취소 없음, 값 진행중8·완료116·Check1·Remind13) / Remind 타일 클릭→KPI 아래 펼침·재클릭 접힘 / Remind 카드 압정 13개·상태·구분·담당자·YYYY-MM-DD·'발의' 없음·Remind칩 없음 / '검토'→'Check'(chief 칩 전부) / 콘솔 에러 0.
- 편집 중 `<Work>` HMR 중간상태 에러 로그가 떴으나, **서버 재기동 후 깨끗한 로드에서 콘솔 0 + 정상 렌더(아코디언 8)** 확인 → 코드 결함 아님(HMR 잔여).

## 검토 포인트

1. KPI에서 보류·취소를 뺐지만 **목록 필터칩에는 유지** — 일관성 의도(요약은 핵심 4개, 필터는 전체) 적절한지.
2. WorkWrite 등록폼의 '검토 필요' 라벨은 설명형이라 'Check'로 안 바꿈 — 통일할지.
3. Remind 토글 펼침 애니메이션(Collapse) 필요성.

## Screenshots

- 없음 — `preview_screenshot` 환경 타임아웃. DOM 검증으로 대체.

## Suggested Next Step

- 시트 상태값 마이그레이션(가동중→운영중) / 담당자현황 재노출 형태 / STEP22 phase2 / 발표·인쇄 모드.
