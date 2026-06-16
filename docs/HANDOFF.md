# 인계 노트 (집 ↔ 사무실 이어가기)

> 갱신: 2026-06-16 (사무실 PC) · 다음 작업: 시트 상태값 마이그레이션(가동중→운영중) / 담당자현황 재노출 형태 / STEP22 phase2 등
> 이 파일은 머신 간 동기화되지 않는 Claude 로컬 메모리를 대신해, 다른 PC에서 맥락을 빠르게 잡기 위한 요약입니다.

## 현재 상태
- **STEP 1~25 완료** (…23 상태변경 사유·24 업무현황 회의뷰·25 업무 KPI/Remind 토글·카드 재구성). **모두 `main` 커밋·자동배포 완료.** (운영 규칙: 작업 완료 시 자동 커밋·푸시 = 자동배포)
- **⚠ 시트 마이그레이션 잔여**: 상태 어휘 개편으로 시트의 기존 '가동중' 등은 '운영중' 등 4값으로 정리해야 '미분류' 표시가 사라짐(드롭다운 권장). 백엔드 무변경(@42).
- **상태 어휘 개편(미커밋)**: 표시 라벨 매핑 폐지 → 시트값 그대로. 정식 4값 `도입예정/도입중/운영중/비가동`(가동중→운영중·설치중→도입중), 그 외는 칩에 '미분류'. **⚠ 시트 기존 '가동중' 등은 새 값으로 마이그레이션 필요**(드롭다운 권장).
- 배포: 프런트는 `main` push → GitHub Actions 자동배포(angels-fab.github.io). 백엔드(Apps Script) **@42** (clasp, URL 불변 · STEP22에서 운영이력 append + getEqHistory 조회 추가). **STEP22 프런트·백엔드 모두 라이브 반영 완료 · CL-001로 라이브 E2E(상태변경→이력 기록) 검증됨**.
- 빌드 상태: `npm run type-check`·`npm run build` 통과.
- **운영 규칙: 작업 완료 시 자동으로 커밋·푸시(자동배포)하고, 작업 내역을 `docs/`에 MD로 기록한다.**

## 단계 요약 (상세는 각 docs/stepN-*.md)
- STEP 1~3 디자인 시스템/테마/레이아웃 · 4~5 홈 대시보드/캘린더 · 6 업무현황 Command Center · 7 장비운영관리 · 8 장비도입관리(타임라인) · 9 공지 허브 · 10 Guest/Admin(사번+비번) · 11 통합검색.
- STEP 12 공지 CRUD — `docs/step12-notice-crud.md`
- STEP 13 센터 업무현황 CRUD + 시트 스키마(상태/발의일자/예정일/검토필요) + onEdit 트리거 — `docs/step13-work-crud.md`
- STEP 14 장비도입관리 CRUD(도입관리 시트 1:1) — `docs/step14-schedule-crud.md`
- **STEP 15 장비도입관리 타임라인 전체 이동(드래그) — `docs/step15-timeline-move.md`**
- **STEP 16 타임라인 단계 리사이즈(오른쪽 핸들) — `docs/step16-timeline-resize.md`**
- **STEP 16.5 타임라인 그리드 너비 정규화(고정 px 단일 상수 MONTH_WIDTH/HALF_MONTH_WIDTH) — `docs/step16.5-grid-normalize.md`**
- **STEP 17 자동 재계산(총소요기간·도입예정월·KPI·파이프라인) — 기존 timeline 반응형 파생으로 충족(신규 코드 없음), `docs/step17-auto-recalc.md`**
- **STEP 18A 드래그 중 실시간 프리뷰 툴팁(이동/리사이즈, 표시 전용) — `docs/step18a-drag-tooltip.md`**
- **STEP 18B 드래그 후 확인 모달 → 적용 시 자동 저장(updateSchedule 재사용), "변경됨 N건" 저장바 제거 — `docs/step18b-confirm-save.md`**
- **STEP 18C Undo/Redo(Ctrl+Z·Ctrl+Shift+Z·헤더 버튼, 저장된 작업까지·시트 동기화, 50건) — `docs/step18c-undo-redo.md`**
- **STEP 19 장비운영관리 상세 Drawer 고도화(5섹션·빈값 미등록·폭520, 조회 전용) — `docs/step19-eqops-drawer.md`**
- **STEP 20 장비운영관리 수정(Update만, 관리자·확인모달·updateEquipment, 백엔드@40) — `docs/step20-eqops-update.md`**
- **STEP 21 장비운영관리 상태 변경(관리자·칩 클릭 → 드롭다운 선택 즉시 변경·사유 숨김(시트 열 부재)·updateEquipment 재사용, 백엔드@41) — `docs/step21-eqops-state.md`**
- **STEP 22 장비 운영이력 phase1(별도 append-only `장비운영이력` 시트·상태 변경 시 자동 1건 기록·드로어 읽기전용 "운영 이력" 섹션·`getEqHistory` 조회, 백엔드@42, 라이브 반영) — `docs/step22-eqops-history-plan.md`**
- **STEP 23 상태 변경 사유 입력(즉시저장 → 확인 Dialog: 장비명·관리번호·전/후·사유 optional·trim → updateEquipment(state,reason), 운영이력에 사유 기록, 같은상태 no-op, 표시 '작성자 · 사유'). 프런트 전용, 백엔드 변경/배포 없음 — `docs/step23-eqops-state-reason.md`**
- **STEP 24 업무현황(/work) 회의 뷰(업무목록을 KPI 바로 아래로·기본 진행중·진행중 아코디언 모두 펼침/개별 접기·RatioBar 제거·'긴급 업무'→'Remind'·담당자현황 숨김(SHOW_MANAGER_STATUS)·검토필요→'검토'). 신규 `Work/TaskAccordion.tsx`, 프런트 전용 — `docs/step24-work-meeting-view.md`**
- **STEP 25 업무 KPI/Remind 정리(KPI 보류·취소 타일 제거→진행중/완료/Check/Remind 4타일·'검토'→'Check'·Remind는 KPI 타일 토글로 KPI 아래 펼침·Remind 카드 압정아이콘+상태/구분/담당자/날짜(YYYY-MM-DD)·'발의' 삭제). 프런트 전용 — `docs/step25-work-kpi-remind.md`**
- 아키텍처: `docs/ARCHITECTURE.md`, `docs/equipment-page-architecture.md`(도입관리), `docs/equipment-ops-architecture.md`(운영관리)

## 핵심 규칙 (작업 시 유지)
- 시트 매핑은 **헤더명 기반**(열 위치 비의존). 쓰기는 **관리자 인증 필수**(author=로그인이름/key=비번, 비번 재입력 없음).
- 타임라인 재파생은 `src/pages/Equipment/timeline.ts`의 `buildTimelines` **단일 창구**(STEP16 리사이즈도 재사용).
- CRUD 패턴 통일: 백엔드 Code.gs create/update/delete + LockService, 프런트 모달(body 포털) + 삭제 확인 Dialog + Snackbar + 성공 후 재fetch.
- MUI v9 → `Stack` 금지(Box flex). 색은 `tokens.ts`/StatusKind만(하드코딩 금지). 디자인/레이아웃 임의 변경 금지.
- 백엔드 배포: `npm run deploy:backend`(clasp push+redeploy). 프런트 배포 = `git push`(자동).

## 남은 사용자 확인/할 일
- [x] 시트 onEdit 트리거 설치 — 완료(집에서 1회 설치, 클라우드에 보존 · PC 무관).
- [x] 인앱 CRUD 확인 — 완료.

## 다음 작업 (예정 — 택1)
- 장비운영관리 고도화 · 근무현황(Google Calendar 기반 조회 전용) · 권한관리 · NAS 연동 · UI 스프린트.
- (보류) 바로가기(/links) 디자인 시스템 이관.
- (확정) **일정(캘린더) CRUD는 구현하지 않음** — Google Calendar를 원본으로 유지, 포털은 조회 전용.
