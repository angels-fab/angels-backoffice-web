# 모바일에서 데스크톱(PC) 보기 토글

> 2026-06-19 · 프런트 전용. type-check·build 통과, 라이브 dev 검증(콘솔0).

폰에서도 PC 레이아웃(사이드바·풀 대시보드)을 보고 싶다는 요청. 앱의 PC/모바일 분기는
`@media(max-width:768px)` **폭 분기점**에 의존하므로, `<meta viewport>`의 레이아웃 폭을
고정 데스크톱 폭으로 덮어쓰면(브라우저 '데스크톱 사이트 요청'과 동일 원리) 폰에서도 PC
레이아웃이 화면 폭에 맞춰 축소되어 보인다.

## 구현
- `src/utils/viewportMode.ts` — `isForceDesktop()`/`setForceDesktop(on)`/`applyViewport(on)`/`isTouchDevice()`.
  - on=true → `viewport=width=1280`(폭만 지정 → 브라우저가 화면 폭에 맞춰 자동 축소), off → `width=device-width, initial-scale=1`.
  - 선택은 `localStorage['forceDesktop']`에 저장(새로고침 유지).
- `index.html` — `<head>`에 인라인 복원 스크립트: 로드 시 저장값이 '1'이면 첫 페인트 전에
  viewport를 `width=1280`으로 세팅(레이아웃 깜빡임 방지).
- `src/layouts/TopBar.tsx` — 우측 클러스터에 토글 IconButton 추가(검색 버튼 왼쪽).
  - **터치 기기에서만 노출**(`isTouchDevice`: `pointer:coarse` 또는 모바일 UA) → PC에선 안 보임.
  - 아이콘: 기본 `DesktopWindows`('데스크톱 보기로'), 활성 시 `PhoneIphone`('모바일 보기로').
  - 데스크톱 보기 상태에서도 TopBar는 항상 떠 있어 같은 버튼으로 즉시 복귀 가능.

## 검증/한계
- 데스크톱 dev 프리뷰는 `isTouchDevice=false`라 버튼 미노출(정상). 메커니즘은
  `localStorage` 세팅+새로고침으로 viewport meta가 `width=1280`↔`device-width`로 전환되는 것 확인.
- 실제 축소 렌더링은 모바일 브라우저에서만 적용(데스크톱 브라우저는 viewport meta 무시) → 폰에서 최종 확인.
- 브라우저 자체 '데스크톱 사이트 요청'으로도 즉시 가능(앱 무관, 이미 배포된 사이트에서도 동작).
