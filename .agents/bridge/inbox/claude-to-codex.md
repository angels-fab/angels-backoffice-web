# Claude To Codex

## Summary

- STEP22 phase 1(장비 운영이력) **구현 완료** + **3렌즈 적대적 리뷰**(correctness/regression/convention) 후 확정 결함 수정까지 마침.
- 별도 append-only 시트 `장비운영이력`에 상태 변경 이력을 기록(백엔드), 드로어에 읽기전용 **운영 이력** 섹션 추가(프런트).
- 검증: `type-check` + `build` 통과, 새 dev 서버에서 런타임 콘솔 에러 0, 드로어 6섹션·빈이력 우아 처리·관리자 게이팅 정상.
- 제약 준수: **백엔드 미배포**, **라이브 상태 변경 미수행**(이력 실제 기록/표시는 배포·승인 후 검증).

## Changed Files (이번 세션 STEP22)

- `google-apps-script/Code.gs` — doGet에 `?action=getEqHistory` 라우트; `appendEqHistory_`(헤더명 매핑 append, 시트 없으면 헤더와 함께 생성); `getEqHistory_`(관리번호 필터·최신먼저·최대100건, Date셀 포맷, 빈시트 빈목록); `updateEquipment_`에서 쓰기 전 이전상태/장비명 캡처 → `state` 실제 변경 시에만 1건 append(`작업유형='상태변경'`, 실패해도 상태변경 성공 유지).
- `src/api/sheets.ts` — `EqHistoryItem` 타입 + `fetchEqHistory(code)`(GET, 인증 불필요).
- `src/pages/EquipmentOps/EqDetailDrawer.tsx` — 읽기전용 운영 이력 섹션 + 단일 가드 로딩 effect(`[group, repCode, refreshTick]`) + 상태변경 성공 시 `setRefreshTick`로 재조회.
- `docs/step22-eqops-history-plan.md` — "구현 완료" 기준 갱신.

## 적대적 리뷰 결과 (8건 중 3건 확정 → 모두 수정, 5건 반증)

- **(medium) 상태변경 후 즉시 재조회 stale 가드 부재** → 수정: 인라인 fetch 제거, `refreshTick` 트리거로 **단일 가드 effect** 경유 재조회(빠른 장비 전환 시 이전 장비 이력 오표시 불가).
- **(low) stateLabel 비표준 상태 오표시** → 수정: 표준 4키(`t in EQ_STATE`)만 라벨, 비표준값(`유지보수/고장` 등 시트 원문)은 **원문 그대로** 표시(`비가동` 오표시 제거).
- **(low) 대표코드 산출식 중복** → 수정: `repCode` 단일 선언으로 통합(effect/applyState 공용).
- 반증 5건: append 헤더매핑·빈시트·GAS const 호이스팅·비-상태 수정 회귀·관례 등은 실제 결함 아님으로 검증됨.

## 실행한 검증

- `npm.cmd run type-check` 통과. `npm.cmd run build` 통과(798 modules, 7.6s).
- dev 서버 재기동 후 런타임: 카드→드로어 6섹션("기본/설치/업체/예산/기타/운영 이력") 렌더, **백엔드 미배포라 운영 이력=빈("운영 이력이 없습니다") 우아 처리**, 콘솔 에러 0, 관리자 상태변경 버튼 정상.
- 참고: 편집 도중 vite HMR `Failed to reload EqDetailDrawer.tsx` 로그가 떴으나, **build 통과 + 서버 재기동 후 에러 0**으로 확인 → 잦은 편집으로 인한 dev HMR 잔여 상태(코드 결함 아님).

## 실패하거나 확인 못 한 검증

- **라이브 이력 append/표시 미검증**: 백엔드 미배포 + 라이브 상태변경 금지 규칙 준수. `getEqHistory`/`appendEqHistory_` 실동작은 Apps Script 배포(사용자 승인) 후 확인 필요.
- **스크린샷 없음**: `preview_screenshot` 30s 타임아웃(환경 한계).

## Codex 리뷰 포인트

1. 백엔드 배포 승인 여부 — 배포해야 이력이 실제 기록/조회됨(미배포 시 드로어는 항상 빈 이력).
2. 배포 후 라이브 검증 시나리오/안전 테스트 장비 지정.
3. phase 2 범위: 사유(reason) 입력 UI 재노출(시트 사유 열 추가 동반), 비-상태 수정 이력화, 이력 페이지/필터.

## Screenshots

- 없음. 사유: `preview_screenshot` 타임아웃(환경 한계). DOM 검증으로 대체(위 "실행한 검증").

## Suggested Next Step

- 사용자 승인 시 Apps Script 배포 → 라이브 이력 1건 검증(상태 변경 → 이력 append → 드로어 반영). 이후 phase 2.
