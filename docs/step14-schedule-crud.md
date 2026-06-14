# STEP 14 — 장비도입관리 CRUD (완료 보고)

> 작업일: 2026-06-15 · 경로: `/equipment`
> 읽기 전용이던 장비도입관리를 Google Sheets와 **양방향 CRUD**로 전환. **열 위치(index) 비의존 — 전부 헤더명 기반.** 타임라인 편집/드래그/자동계산은 구현하지 않음(명세 준수).

---

## 핵심 설계 결정 (사용자 승인)
- **카드를 `장비도입관리` 시트 행 1:1로 전환**(29건). 기존엔 `장비운영관리` 그룹(20개)을 카드로 쓰고 타임라인만 도입관리에서 가져와, CRUD 대상(도입관리 시트)과 카드가 1:1이 아니었음 → 추가/수정/삭제가 정확히 반영되도록 도입관리 행 기준으로 통일. **카드·타임라인·필터·검색 디자인과 레이아웃은 그대로 유지.** 운영관리 페이지(`/equipment-ops`)는 영향 없음.
- 행 식별 키 = **관리번호**(수정 시 원본 관리번호 origCode로 행 탐색). **연번·총 소요기간은 시트 자동값**이라 CRUD가 쓰지 않음(연번은 신규 시 max+1만 부여).
- 헤더 정규화: 공백·`(자동)` 제거 후 매핑(`장비명 (자동)`→`장비명`). 향후 "(자동)" 컬럼이 직접입력으로 바뀌어도 편집 폼에 이미 포함(연번/총소요기간만 시트자동으로 제외).
- 쓰기는 **관리자 인증 필수**(미인증 시트쓰기 방지). [장비 추가]/수정/삭제 UI는 관리자 로그인 시 노출, 비번 재입력 없음(공지·업무 CRUD와 동일 정책).

## 1. 수정된 파일
| 파일 | 변경 |
|------|------|
| `google-apps-script/Code.gs` | scheduleCtx_/normSched_/numCell_/applyScheduleFields_/createSchedule_/updateSchedule_/deleteSchedule_ + doPost 라우팅(잠금) |
| `src/api/sheets.ts` | `ScheduleInput`·`createSchedule`·`updateSchedule`·`deleteSchedule` |
| `src/store/slices/eqSlice.ts` | 도입관리 행 1:1 `schedule[]` 빌드(헤더명 기반) + state |
| `src/types/index.ts` | `ScheduleItem` |
| `src/pages/Equipment/EqProjectDrawer.tsx` | `EqGroup`→`ScheduleItem`, 관리자 수정/삭제 footer |
| `src/pages/Equipment/index.tsx` | `groups`→`schedule` 기반 카드·간트, [장비 추가]·삭제 Dialog·Snackbar·CRUD 연결 |

## 2. 신규 생성 파일
- `src/pages/Equipment/ScheduleWrite.tsx` — 등록/수정 공용 모달(body 포털). 입력: 관리번호·장비명·담당자·진행상태·시작년월·6단계(개월)·구분·도입방법·도입금액.

## 3. Apps Script 연동 함수
| 함수 | 역할 |
|------|------|
| `scheduleCtx_()` | 시트·헤더 위치 컨텍스트(헤더명 정규화 매핑) |
| `createSchedule_(req)` | 인증→신규 행 append(연번=max+1, 편집컬럼 기록) |
| `updateSchedule_(req)` | 인증→origCode로 행 탐색→편집컬럼 갱신 |
| `deleteSchedule_(req)` | 인증→관리번호로 행 탐색→행 삭제 |
| `applyScheduleFields_` / `numCell_` / `normSched_` | 필드 기록·숫자 정규화·헤더 정규화 보조 |
| (라우팅) `doPost` | create/update/deleteSchedule를 LockService 잠금 하 처리 |

## 4~6. 테스트 결과 (배포 @39)
- **읽기**: `?sheet=장비도입관리` 파싱 시뮬 → 29건, 헤더 인덱스 정확(연번0·관리번호1·장비명2·…·도입금액15), 샘플 PR-001/PL-001/CL-001 정상.
- **쓰기 라우팅·인증(더미 인증)**:
  - 등록 `createSchedule` → `{"status":"error","message":"등록된 게시자가 아니거나 비밀번호가 일치하지 않습니다"}`
  - 수정 `updateSchedule` → 동일(인증 게이트 동작 = 라우팅 정상)
  - 삭제 `deleteSchedule` → 동일
- `type-check`·`build` 통과 ✅
- **실제 등록/수정/삭제 라운드트립**은 라이브 시트를 변경하므로(실데이터) **관리자 로그인 후 화면에서 확인 필요** — 아래 TODO 참조.

## 7. 남은 TODO
- [ ] **관리자 로그인 후 인앱 CRUD 검증**: [장비 추가] 등록 → 카드/간트 즉시 반영 / 카드 클릭 → 수정 → 반영 / 삭제 확인창 → 행 삭제. (개발자가 실 계정 비번을 쓰지 않으므로 사용자 확인 필요)
- [ ] 통합검색(GlobalSearchDialog)의 장비도입관리 결과는 아직 `eq.groups`(운영관리) 기준 — 필요 시 `schedule` 기준으로 정렬/딥링크 일원화(현재는 focus를 name·code 둘 다 매칭해 호환).
- [ ] 진행상태 입력은 자유 텍스트(도입예정 등). 표준값 select가 필요하면 추가.
- (명세상 제외) 타임라인 드래그/리사이즈/간트 편집/단계 자동계산 — 미구현 유지.
- **검증 결과**: 멀티에이전트 3-렌즈 리뷰(21건) → 적대적 검증 → **진짜 문제 0건**(백엔드 행매칭·numCell·잠금·헤더 normalize, 프런트 파싱·CRUD 핸들러, 금지기능 미유입 모두 확인, 21건 전부 거짓양성으로 기각). 추가 수정 없음.
