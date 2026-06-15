# STEP21 — 장비운영관리 상태 변경

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 완료, 백엔드 @41 + 프론트 배포 (관리자 실변경 검증 대기)

## 범위
관리자가 장비 상태(**도입예정/도입중/가동중/비가동**)를 Drawer에서 변경. 사유 선택 입력(optional). **상태 변경만** — 운영이력 CRUD는 STEP22.

## 흐름
카드 → Drawer → (관리자) **[상태 변경]** 버튼 → 다이얼로그(현재 상태 표시 + 변경 상태 Select + 사유 Select) → **[적용]** → `updateEquipment({code, state, reason})` → `loadEqData` 재fetch → picked 갱신 → 칩·KPI·카테고리·담당자 현황 자동 반영.

## UI
- 상단 상태 칩 옆 "상태 변경" 버튼(관리자·조회 모드만). 게스트 미표시.
- 다이얼로그가 선택+확인 일체(현재 상태 → 변경 상태 보이며 적용). 다중 대수는 대표 1대 기준 주석.

## 재사용 / 신규
- 백엔드 `updateEquipment_`에 **'상태' 쓰기** 추가(EQ_EDIT_FIELDS) + **사유 열**('변경사유'/'상태사유'/'사유' 존재 시) 저장. @41 배포. 없으면 무시.
- 프론트 `EquipmentUpdateInput`에 `state?`/`reason?`. `EqDetailDrawer` 상태 변경 버튼+다이얼로그. **새 저장구조 없음**(updateEquipment 재사용, 부분 업데이트).
- 대표 1대(codes[0]) 기준.

## STEP22 연계
- 상태 변경 = `updateEquipment(code, state, reason)` **단일 호출 지점**. STEP22 운영이력은 이 호출 직후 **이력 append만 추가**하면 됨(reason 이미 캡처). 확장 가능 구조.

## 검증
- 백엔드: state+reason 포함 호출도 인증 게이트 동작. 게스트: 상태변경 버튼 없음·5섹션 렌더·콘솔 에러 0. `type-check`·`build` 통과.
- KPI/카테고리/담당자 현황은 raw/groups 파생 → 재fetch 시 자동 반영. 예산 무영향.
- 관리자 실변경(상태→다이얼로그→적용→시트 반영·KPI 갱신): **대기**.
