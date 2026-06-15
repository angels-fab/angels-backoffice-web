# STEP20 — 장비운영관리 수정(Update)

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 완료, 백엔드 @40 + 프론트 배포 (관리자 실저장 검증 대기)

## 범위
운영관리 상세 Drawer에서 **관리자 수정(Update)만**. 추가(Create)·삭제(Delete)는 미구현(요청에 따름).

## 흐름
카드 클릭 → Drawer → (관리자) **[수정]** → 폼 전환 → **[저장]** → 변경분 **확인 모달**(필드별 before→after) → **[적용]** → `updateEquipment`(시트 저장) → `loadEqData` 재fetch → `picked` 갱신 → Drawer 즉시 반영. 폼 **[취소]** = 원복(저장 없음).

## 수정 가능(10) / 읽기 전용
- 수정: 담당자·제조사·모델명·자산번호·NFEC번호·설치장소·설치일자·업체명·엔지니어·연락처
- 읽기 전용: 관리번호·장비명·장비종류·도입금액·재원 + **비고**
- 다중 대수 그룹은 **대표 1대(codes[0])** 행 기준 저장(주석 표시).

### 후속 — 비고 읽기 전용 처리
- 운영관리 시트에 **'비고' 열이 없어** 백엔드 `col('비고')`가 -1 → 저장이 조용히 무시됨. 편집 가능처럼 보이는 혼란을 막기 위해 **비고를 편집 목록(EDIT_KEYS)에서 제외하고 읽기 전용으로** 표시(열 추가는 보류). 추후 시트에 '비고' 열 추가 시 EDIT_KEYS에 되돌리면 됨.

## 재사용 / 신규
- 백엔드 `Code.gs`: `updateEquipment_`(헤더명 기반 · **2단 헤더 대응** · 관리번호로 행 식별) + doPost 라우팅(LockService) + `authError_` 인증 — updateSchedule 패턴 복제. **@40 배포**.
- 프론트: api `updateEquipment`(updateSchedule 시그니처), `EqDetailDrawer` 인라인 수정 + 확인 모달(STEP18B식), `EquipmentOps` onSaved 재fetch+re-pick + Snackbar. `useRole` 인증 재사용. **eqSlice 무변경**.

## 검증
- 백엔드: `updateEquipment` 인증 게이트 동작('등록된 게시자…'), 미지 action과 구분 확인.
- 프론트(게스트 E2E): Drawer 5섹션 렌더, **게스트 수정 버튼 없음**, fresh 서버 콘솔 에러 0, `type-check`·`build` 통과.
- 관리자 실저장(수정→모달→적용→시트 반영, 취소 원복): **대기**(라이브 관리자 로그인 후).
