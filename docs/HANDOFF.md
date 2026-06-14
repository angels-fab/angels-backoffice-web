# 인계 노트 (집 ↔ 사무실 이어가기)

> 갱신: 2026-06-15 (집 PC) · 다음 작업: 사무실 PC
> 이 파일은 머신 간 동기화되지 않는 Claude 로컬 메모리를 대신해, 다른 PC에서 맥락을 빠르게 잡기 위한 요약입니다.

## 현재 상태
- **STEP 1~14 완료**. 모든 코드·문서 `main`에 push 완료(작업 시작 전 `/출근`으로 pull).
- 배포: 프런트는 `main` push → GitHub Actions 자동배포(angels-fab.github.io). 백엔드(Apps Script)는 **@39** (clasp, URL 불변).
- 빌드 상태: `npm run type-check`·`npm run build` 통과.

## 단계 요약 (상세는 각 docs/stepN-*.md)
- STEP 1~3 디자인 시스템/테마/레이아웃 · 4~5 홈 대시보드/캘린더 · 6 업무현황 Command Center · 7 장비운영관리 · 8 장비도입관리(타임라인) · 9 공지 허브 · 10 Guest/Admin(사번+비번) · 11 통합검색.
- **STEP 12** 공지 CRUD + 운영형 UX(중요공지+테이블) — `docs/step12-notice-crud.md`
- **STEP 13** 센터 업무현황 CRUD + 시트 스키마 갱신(상태/발의일자/예정일/검토필요) + 시트 onEdit 트리거 — `docs/step13-work-crud.md`
- **STEP 14** 장비도입관리 CRUD(도입관리 시트 행 1:1) — `docs/step14-schedule-crud.md`
- 아키텍처: `docs/ARCHITECTURE.md`, `docs/equipment-page-architecture.md`

## 핵심 규칙 (작업 시 유지)
- 시트 매핑은 **헤더명 기반**(열 위치 비의존). 쓰기는 **관리자 인증 필수**(author=로그인이름/key=비번, 비번 재입력 없음).
- CRUD 패턴 통일: 백엔드 Code.gs에 create/update/delete + LockService 잠금, 프런트는 등록/수정 모달(body 포털) + 삭제 확인 Dialog + Snackbar + 성공 후 재fetch.
- MUI v9 → `Stack` 금지(Box flex). 색은 `tokens.ts`/StatusKind만(하드코딩 금지). 디자인/레이아웃 임의 변경 금지.
- 백엔드 배포: `npm run deploy:backend`(clasp push+redeploy, 승인창 뜸). 프런트 배포 = `git push`(자동).

## 남은 사용자 확인/할 일
- [ ] **시트 onEdit 트리거 설치(1회)**: Apps Script 편집기에서 `setupWorkEditTrigger` 실행 → 시트에서 업무 상태=완료 시 검토필요 해제+완료일자 자동(미설치 시 웹에서만 동작).
- [ ] **인앱 CRUD 확인**: 업무현황(STEP13)·장비도입관리(STEP14) 관리자 로그인 후 등록/수정/삭제 라운드트립.

## 다음 작업 (예정)
- **바로가기(/links) 이관** — 마지막 레거시 페이지를 디자인 시스템으로 이관.
- (보류) 마감/지연 기반 기능: 마감일 컬럼 신설 후.
