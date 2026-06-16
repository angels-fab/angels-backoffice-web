# Claude To Codex

## Summary

- **STEP24 — 업무현황(/work) 회의 뷰 개편** 구현 완료(프런트 전용). 적대적 리뷰까지 반영.
- 업무목록을 KPI 바로 아래로, 기본 진행중 + 진행중 아코디언(모두 펼침), RatioBar 제거, '긴급 업무'→'Remind', 담당자현황 숨김, 검토필요→'검토'.
- type-check + build 통과, 라이브 dev 검증 완료. **미커밋**(STEP23·상태 어휘 개편과 함께 누적).

## Changed Files

- `src/pages/Work/index.tsx` — 전면 재작성: 섹션 재배치(KPI→업무목록→Remind→[담당자현황 숨김]), 기본 tab='inProgress', 진행중=아코디언/그 외=컴팩트 행 분기, RatioBar 제거, 검토 단축, Remind 워딩, `SHOW_MANAGER_STATUS=false`(코드·집계 보존).
- `src/pages/Work/TaskAccordion.tsx` (신규) — 진행중 아코디언(MUI Accordion·ExpandMoreIcon·다크테마·기본 펼침·개별 접기, 메타+업무내용+상세/링크 아이콘).
- `src/pages/Work/TaskCard.tsx` — 리뷰 반영: Remind 카드 '검토 필요'→'검토'(같은 화면 라벨 통일).
- `docs/step24-work-meeting-view.md`(신규), `docs/HANDOFF.md` 갱신.

## 적대적 리뷰 (2렌즈 + 검증): 9건 발견 → 3건 확정

- **(low) 라벨 불일치**: Remind 카드(TaskCard)가 '검토 필요'로 남아 목록의 '검토'와 한 화면에서 불일치 → **수정**(TaskCard '검토').
- **(low) 장소 중복**: TaskAccordion 메타의 '장소'와 본문 taskSubs 끝줄이 둘 다 장소 표시 → **수정**(메타에서 '장소' 제거, taskSubs 단일 표시). 라이브 재확인: 아코디언 본문 장소 최대 1회.
- **(low) 변수명 urgent**: UI는 Remind인데 로컬 변수명 urgent → **의도적 미수정**(사용자 지시: 내부 명칭은 무리하게 바꾸지 않음). 동작 무관.
- 6건 반증.

## 실행한 검증

- `npm.cmd run type-check` 통과, `npm.cmd run build` 통과(2회: 구현 후·리뷰수정 후).
- 라이브 dev(`/work`): KPI 바로 아래 업무목록 / 기본 진행중(아코디언 7개 모두 펼침) / 개별 접기(7→6) / 전체 탭→컴팩트 행(아코디언 0) / 진행중 복귀→모두 펼침 / '긴급' 미표시·'Remind' 표시 / 담당자현황 미표시 / '검토 N'(짧게)·'검토 필요' 미표시 / 장소 중복 해소(maxLoc=1) / 콘솔 에러 0.
- 스크린샷: `preview_screenshot` 환경 타임아웃 → DOM 검증 대체.

## 검토 포인트

1. RatioBar 제거 동의 여부(KPI 타일이 수치 제공 — 대안: KPI 요약 카드).
2. 아코디언 본문 정보량/‘모두 접기·펼치기’ 토글 필요성.
3. TaskDetailDrawer는 여전히 '검토 필요' 표기(상세 팝업이라 범위 밖) — 통일할지.

## Screenshots

- 없음 — `preview_screenshot` 환경 타임아웃. DOM 검증으로 대체.

## Suggested Next Step

- 미커밋 누적분(STEP23·24·상태 어휘 개편) 배포 + 시트 상태값 마이그레이션. 이후 담당자현황 재노출 형태 / 발표·인쇄 모드 / STEP22 phase2.
