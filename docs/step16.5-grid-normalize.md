# STEP16.5 — 타임라인 그리드 너비 정규화

> 작성: 2026-06-15 (사무실 PC) · 상태: 완료, main 배포

## 문제
- `gantt.tsx`의 `monthWidthUnits`가 월 자릿수에 따라 2fr/3fr 반환 + `fr` 단위 → 컨테이너 폭에 따라 칸 너비가 불균일(특히 두 자리 월이 더 넓음).
- 드래그/리사이즈는 `offsetWidth / (months×2)` **평균값**을 써서 실제 칸과 미세하게 어긋남 → 스냅이 부정확.

## 해결 — 단일 너비 상수
- `timeline.ts`: `MONTH_WIDTH = 56`, `HALF_MONTH_WIDTH = 28`. 월/반월 너비를 **여기 한 곳에서만** 정의.
- 간트 그리드(헤더 연도행·월행, 바, 격자선): `repeat(N, ${MONTH_WIDTH}px)` 고정. 연도행 = 월수 × MONTH_WIDTH.
- 바 컨테이너(`index.tsx` 헤더/각 행)를 `width = months×MONTH_WIDTH, flexShrink:0` **고정폭**으로(기존 `flex:1`+fr 채움 → 고정). 스크롤 컨테이너 minWidth도 MONTH_WIDTH 기준.
- 드래그/리사이즈 `halfPx = HALF_MONTH_WIDTH`(측정값 대신 상수) → 스냅 정확, 헤더·바와 완전 동일 기준.
- 중복 너비 값 제거: `monthWidthUnits` 함수 삭제, index.tsx의 `38` 제거.

## 변경 파일
- `timeline.ts` (상수 추가), `gantt.tsx` (그리드 템플릿·연도행 px), `Equipment/index.tsx` (바 고정폭·halfPx 상수·minWidth·barAreaRef 제거)

## 검증
- 측정: 모든 월 = **56px**, 모든 반월 = **28px**(단일 값), 헤더↔바 좌측 정렬 일치, 바폭 = 월수×56(예: 21×56=1176).
- `npm run type-check` · `npm run build` 통과. STEP15 이동·STEP16 리사이즈 **로직 무수정**. 현재 빌드 렌더 정상(에러 바운더리 미발생, 콘솔 에러 0).

## STEP17 대비
- 비즈니스 로직 무수정 — `buildTimelines` 단일 재계산 경로 유지. 그리드만 정규화.
