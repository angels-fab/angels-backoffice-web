# STEP22 — 장비 운영이력(history)

> 작성: 2026-06-16 · 상태: **phase 1 구현 완료(프런트+백엔드 코드), 백엔드 미배포 / 라이브 검증 대기.**

## 구현 결과 (phase 1)
- **저장**: 별도 append-only 시트 `장비운영이력`. 열: `일시 / 관리번호 / 장비명 / 이전상태 / 변경상태 / 사유 / 작성자 / 작업유형 / 비고`. 없으면 백엔드가 헤더와 함께 자동 생성.
- **백엔드(`Code.gs`)**: `appendEqHistory_`(헤더명 매핑 append) + `getEqHistory_`(`?action=getEqHistory&code=` GET, 관리번호 필터·최신 먼저·최대 100건, 시트 없으면 빈 목록). `updateEquipment_`에서 쓰기 전 이전 상태/장비명 캡처 → `state`가 실제로 바뀐 경우에만 1건 append(`작업유형='상태변경'`). 이력 실패는 상태변경 자체를 실패시키지 않음(try/catch). 조회는 인증 불필요.
- **프런트**: `sheets.ts`에 `EqHistoryItem` + `fetchEqHistory(code)`. `EqDetailDrawer`에 읽기전용 **운영 이력** 섹션(드로어 열릴 때 로드, 상태 변경 성공 시 즉시 재조회, 최신 20건 표시, 빈 상태 문구).
- **읽기 전용**: 이력 추가/수정/삭제 UI 없음. 사유 입력 UI는 이번에도 미노출(시트 사유 열 부재) → 이력의 `사유`는 빈 문자열로 저장.

## 미완 / 다음 (phase 2 후보)
- 백엔드 배포(사용자 승인 필요) 후 라이브 검증: 상태 변경 → 이력 1건 append + 드로어 반영.
- 사유 입력 UI 재노출(상태 변경 시 사유 선택 → 이력 `사유` 기록).
- 정보 수정(비-상태 updateEquipment)도 이력화할지, 이력 페이지/필터/엑셀.

---
## (참고) 착수 전 설계 후보 원본

## 목표
장비 상태 변경 등 운영 이벤트를 **append-only 이력**으로 누적하고, 운영관리 상세 Drawer에서 조회.

## 단일 호출 지점 (이미 준비됨)
- 상태 변경 = `EqDetailDrawer.tsx`의 `applyState(s)` → `updateEquipment({ code, state })` **성공 직후**가 유일한 이력 append 지점.
- 백엔드 `updateEquipment_`는 이미 optional `reason`을 받음(현재 UI는 사유 열이 없어 숨김). 이력에는 reason을 살릴 수 있음.

## 저장 구조 후보 (택1 — 사용자/Codex 결정 필요)
1. **(권장) 별도 이력 시트 append-only** — 예: `장비운영이력` 시트. 열: `일시 / 관리번호 / 장비명 / 이전상태 / 변경상태 / 사유 / 작성자`.
   - 장점: 현재 운영관리 행을 오염시키지 않음, 무한 누적, 조회/필터 쉬움. 기존 헤더명 기반 매핑 패턴 재사용.
   - 백엔드: `appendHistory_(req)` 신규(LockService) + `updateEquipment_` 성공 후 호출 또는 프런트에서 별도 호출.
2. 현재 행에 마지막 변경만 기록 — 이력이 아니므로 비권장(STEP21에서 이미 상태/사유 컬럼 경로 존재).

## 프런트 후보
- `sheets.ts`에 `appendEqHistory(input)` + `loadEqHistory(code)` (또는 updateEquipment 응답에 이력 반영).
- Drawer에 "운영이력" 섹션(6번째) — 최근 N건 타임라인. 조회 전용 우선(CRUD는 이후).
- 상태 변경 성공 Snackbar 후 이력 자동 새로고침.

## 결정 필요 사항 (구현 전)
- [ ] 이력 시트 신설 여부 + 시트명/열 스키마 확정.
- [ ] 사유(reason) 입력 UI를 이력용으로 다시 노출할지(상태 변경 시 사유 선택 → 이력에 저장).
- [ ] 이력 기록 트리거: 상태 변경만? 또는 정보 수정(updateEquipment 전반)도?
- [ ] 조회 범위(최근 N건 / 전체) 및 권한(조회는 게스트 허용?).

## 검증 계획 (구현 시)
- type-check + build, 백엔드 인증 게이트, append 후 조회 반영, 동시성(LockService).
- STEP21 상태 변경 라이브 검증과 묶어서: 상태 변경 → 이력 1건 append 확인(안전 테스트 장비 지정 후).
