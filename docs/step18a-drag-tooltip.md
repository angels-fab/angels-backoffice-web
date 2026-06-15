# STEP18A — 드래그 중 실시간 프리뷰 툴팁

> 작성: 2026-06-15 (사무실 PC) · 상태: 구현 완료, main 배포 (관리자 실동작 검증 대기)

## 목표
이동(STEP15)/리사이즈(STEP16) 드래그 중, 얼마나 이동/변경하고 있는지 커서 옆 툴팁으로 실시간 안내. **표시 전용** — 저장·Redux·상태 변경 없음.

## 표시 내용 (0.5개월 스냅과 동일 값)
- 이동: `["+3개월", "2027.10 → 2028.01"]` (반월은 `.5` 표기, 예 `2027.11.5`)
- 리사이즈: `[단계명, "0.5개월 → 1.5개월", "(+1개월)"]` (감소면 `(-1개월)`)
- 드래그 종료 시 자동 사라짐.

## 표시 위치
- 커서 근처(`position:fixed` viewport 좌표 추적). 화면 우/하단 끝에선 반대로 뒤집어 잘림 방지. `pointer-events:none`으로 드래그 방해 없음.

## 구현 (최소 diff)
- **(신규) `DragTip.tsx`**: 공통 툴팁. `createPortal(body)` + 다크 MUI `Box`(`background.paper`/`divider`). 이동·리사이즈가 같은 컴포넌트 공유.
- `timeline.ts`: `fmtStartMonth(start)` 표시용 헬퍼만 추가.
- `index.tsx`: `tip` 상태 1개(이동·리사이즈 공용). 기존 `onMove`에서 set(기존 `dh`/`baseHalves`/`nextHalves` **재사용** — 중복 계산 없음), `onUp`에서 clear. **dispatch/저장/Redux 무수정.**

## 검증
- `npm run type-check` · `npm run build` 통과. 회귀 없음(간트 정상·콘솔 에러 0·에러 폴백 없음). STEP15/16/16.5 및 저장 로직 무수정.
- 관리자 실드래그 툴팁 표시 검증: **대기**(라이브 관리자 로그인 후).
