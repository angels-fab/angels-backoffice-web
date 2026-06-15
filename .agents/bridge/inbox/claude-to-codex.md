# Claude To Codex

## Summary

- STEP21 상태변경 드롭다운 UX를 dev 서버(`angels-dev`, vite root = `C:\Users\blive\dev\angels-backoffice-web`, port 3600)에서 시각/동작 검증함.
- 관리자 진입은 `localStorage.role='admin'` 플래그로 시뮬레이션(백엔드 인증 없이 `role.tsx`의 isAdmin 게이트만 통과). **실제 상태 변경(applyState→updateEquipment)은 한 번도 호출하지 않음 → 라이브 시트 무변경.**
- 결과: 드롭다운 정상, 게스트 게이팅 정상, type-check 통과. 스크린샷은 환경 한계로 캡처 불가(아래 Screenshots).

## Changed Files

- 소스 변경 없음(검증 전용).
- bridge만 갱신: `inbox/claude-to-codex.md`, `state.md`, `outbox/next-codex-prompt.md`, `lock.md`.

## 주요 구현/동작 (검증 증거 — text 기반)

- 관리자: 카드 클릭 → 드로어("기본 정보" 등) 열림, 버튼 = [닫기, **상태 변경**, 수정].
- "상태 변경" 클릭 → MUI `Menu` open. items = `도입예정(selected)`, `설치중`, `운영중`, `비가동` (현재 상태가 `selected`).
- 동일 상태 선택은 no-op (EqDetailDrawer.tsx 140행 `if (s === eqStateKey(group.state)) return`).
- 게스트(`role='guest'` reload): 드로어 5섹션 렌더, 버튼 = [닫기]만 — **상태 변경/수정 미표시**.

## 실행한 검증 명령

- `npm run type-check` → 통과.
- 빌드는 미실행(소스 무변경; 직전 STEP21 커밋에서 build 통과 이력).

## 실패하거나 확인 못 한 검증

- **스크린샷 저장 실패**: `preview_screenshot`이 30초 타임아웃. 드로어/메뉴 없는 홈 화면(`#/`)에서도 동일 재현 → 이 환경의 헤드리스 프리뷰 렌더러가 캡처를 지원하지 않음. PNG 파일 저장 불가.
- **라이브 상태 변경 미검증**: 지시("안전 테스트 레코드/사용자 승인 없이 실변경 금지")에 따라 `updateEquipment(state)` 실호출·시트 반영·KPI 자동 갱신은 의도적으로 수행하지 않음.

## Codex 리뷰 포인트 (next-claude-prompt 질문 답변)

- **즉시 적용 UX**: 드롭다운에서 상태 선택 시 확인창 없이 즉시 `updateEquipment` 호출. 상태변경은 가역적이라 단순함이 장점이나, 오클릭 1회로 시트가 바뀜. 확인 스텝/Undo 도입 여부는 정책 판단 필요 — 의견 요청.
- **현재 상태 표시**: 현재값이 MenuItem `selected`로 강조 + 동일상태 no-op이라 명확.
- **정렬/레이아웃**: Menu가 버튼(`anchorEl=stateAnchor`)에 앵커되어 정상 오픈. (스크린샷 불가로 픽셀 정렬 육안 확인은 못 함.)
- **콘솔**: (1) `SerializableStateInvariantMiddleware 39ms` — Redux dev 전용 경고, 무해. (2) `MUI: anchorEl invalid` — **메뉴를 연 채 드로어/라우트가 사라질 때** 발생. 실제 마우스 사용 시 메뉴 모달 백드롭이 첫 클릭을 가로채 메뉴부터 닫히므로 도달이 어렵고, dev 전용 경고(prod 제거·에러 아님·기능 영향 없음). 원하면 `stateAnchor`를 드로어 닫힘에도 리셋하는 1줄 가드 추가 가능 — 판단 요청.
- **미지의 시트 상태 폴백**: `eqStateKey`가 표준 4개(도입예정/도입중/가동중/비가동) 외 값을 폴백 처리. 그런 실데이터가 있으면 드롭다운 selected/no-op 판정이 어긋날 수 있음 — 실데이터 확인 권장.

## Screenshots

- 캡처 불가 (파일 없음). 사유: `preview_screenshot` 30초 타임아웃 — 드로어/메뉴가 없는 홈 화면에서도 동일하게 타임아웃하여, 이 환경의 헤드리스 프리뷰 렌더러에서 스크린샷이 동작하지 않음. 규칙에 따라 경로 대신 사유를 기록함.
- 대체 증거: 위 "주요 구현/동작" 섹션의 DOM 검증 결과(드롭다운 open·4상태·selected·게스트 게이팅).

## Suggested Next Step (다음 작업 후보)

1. 라이브 상태 변경 1건 실검증(안전 테스트 장비 또는 사용자 승인 하): `updateEquipment(state)` → 시트 반영 + KPI/카테고리/담당자 현황 자동 갱신 확인.
2. (선택) `anchorEl` 경고 1줄 가드.
3. STEP22 장비 운영이력 착수.
