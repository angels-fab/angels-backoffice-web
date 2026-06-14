# 센터 업무현황 CRUD 구현 (완료 보고)

> 작업일: 2026-06-15 · 작업 위치: `C:\Users\조성범\projects\angels-backoffice-web`
> 읽기 전용이던 업무현황을 Google Sheets와 **양방향 CRUD**로 전환. **열 위치(index) 비의존 — 전부 헤더명 기반 매핑.**

---

## 1. 변경 파일 목록

| 파일 | 변경 |
|------|------|
| `google-apps-script/Code.gs` | getWorks_/createWork_/updateWork_/deleteWork_/workCtx_/workEndAuto_ 추가, doGet(`?action=getWorks`)·doPost(create/update/deleteWork, 잠금) 라우팅 |
| `src/api/sheets.ts` | `getWorks`·`WorkRow`·`WorkInput`·`createWork`·`updateWork`·`deleteWork` |
| `src/store/slices/workSlice.ts` | 읽기를 getWorks(백엔드 헤더 매핑)에 위임 — 클라이언트는 id만 부여 |
| `src/pages/Work/workMeta.ts` | 상태 모델 4종(진행중/완료/보류/취소), `W_STATUS_TABS`, `WORK_STATUS_OPTIONS` |
| `src/pages/Work/WorkWrite.tsx` (신규) | 등록/수정 공용 모달(body 포털) |
| `src/pages/Work/TaskDetailDrawer.tsx` | 전체 항목 표시 + 관리자 수정/삭제 |
| `src/pages/Work/TaskCard.tsx` | 검토 칩 |
| `src/pages/Work/index.tsx` | 상태 필터(진행중/완료/보류/취소)·검토필요 KPI/필터·긴급(Remind)·검색 강화·CRUD 연결·Snackbar·삭제 Dialog·[업무 등록] |
| `src/pages/Home/dash/{derive.ts,WorkStatusSection.tsx,KpiOverview.tsx}` | 대시보드 상태 집계 4종 반영 |

## 2. Apps Script (요지 — 전문은 `google-apps-script/Code.gs`)

- **헤더명 기반 매핑** `workCtx_()`: 첫 8행에서 `구분`+`업무` 포함 행을 헤더로 인식, 각 필드를 **헤더명(동의어)** 으로 열 위치 해석 → 열을 옮겨도 안전. 행 식별은 `번호` 열.
- `getWorks_()`: 헤더→객체 배열 반환(`{num,cat,task,dept,mat,start,plan,time,loc,mgr,status,end,link,remind,chief}`), 날짜는 KST `yyyy-MM-dd`로 포맷.
- `createWork_` / `updateWork_` / `deleteWork_`: 인증(`authError_`, 담당자 이름+비번 대조) → 작성/수정/행삭제. doPost에서 **LockService 잠금** 하에 처리(번호 충돌·행삭제 경합 방지).
- **완료일자 자동** `workEndAuto_(status,end,today)`: 상태='완료'면 채움(미지정 시 오늘), 그 외(진행중/보류/취소)면 비움 → 진행중↔완료 전환 시 완료일자 자동 입력/제거.
- Remind·검토 필요는 `insertCheckboxes().setValue()`로 체크박스 유지.

## 3. 기능별 구현

- **상세 Drawer**: 업무명·구분·관련부서·관련자료·발의일자·예정일·시간·장소·담당자·상태·Remind·검토필요·링크 표시. 관리자면 **수정/삭제** 버튼.
- **신규 등록**: 우상단 **[업무 등록]** → 모달(구분·업무·관련부서·관련자료·발의일자·예정일·시간·장소·담당자·상태·Remind·검토필요·링크) → 시트 신규 행.
- **수정**: Drawer **[수정]** → 기존값 자동 로드 → updateWork → 즉시 반영(목록 재로드, Drawer 갱신).
- **삭제**: Drawer **[삭제]** → 확인 Dialog("정말 삭제하시겠습니까?") → deleteWork → 행 삭제.
- **상태 필터**: 진행중 / 완료 / 보류 / 취소 (상태값 자동 분류, + 전체). 기존 진행중/지난/Remind/센터장 구조 제거.
- **긴급 업무(Remind)**: Remind 체크된 업무만 상단 영역(상태와 별개).
- **검토 필요**: 별도 KPI 집계 + 별도 토글 필터.
- **완료일자 자동**: 위 workEndAuto_ (Apps Script에서 처리).
- **검색 강화**: 업무명·담당자·관련부서·구분·장소 통합 검색.
- **UI 유지**: 다크 테마·KPI·카드 디자인·레이아웃 유지, 기능만 추가.

## 4. 테스트 결과 (배포 @35, 실엔드포인트)

```
GET ?action=getWorks      → status:ok, items:124, 상태분포 {완료:116, 진행중:7, 보류:1}
                            (헤더→객체 변환, 날짜 KST yyyy-MM-dd, remind/chief 불리언 정상)
POST createWork (더미인증) → {"status":"error","message":"등록된 게시자가 아니거나 비밀번호가 일치하지 않습니다"}
POST updateWork (더미인증) → 동일 (인증 게이트 동작 = 라우팅 정상)
POST deleteWork (더미인증) → 동일
```
- `npm run type-check` 통과 ✅ · `npm run build` 통과 ✅

## 5. 발견된 문제점 / 결정사항

- **쓰기 = 관리자 인증 필수(결정)**: 공개 웹앱 URL 보호를 위해 createWork/updateWork/deleteWork는 인증(이름+비번)을 요구하고, [업무 등록]/수정/삭제 UI는 **관리자 로그인 시에만** 노출(비번 재입력 없음, 공지 CRUD와 동일 정책). 명세엔 admin 언급이 없었으나 미인증 시트 쓰기를 막기 위한 필수 조치 — 누구나 쓰게 하려면 알려주세요.
- **완료일자 일반화(결정)**: 명세는 완료↔진행중만 명시했으나, '완료일자는 상태=완료일 때만 유효'로 일반화(보류/취소 시에도 비움). 의도된 동작.
- **읽기 일원화**: 읽기를 getWorks(백엔드 헤더 매핑)로 통합 — 헤더명 기반 요구를 백엔드에서 단일 보장. 기존 클라이언트 컬럼 로직 제거.
- **검증 결과**: 멀티에이전트 3-렌즈 리뷰(42건) → 적대적 검증 → 진짜 **2건(low)** 수정.
  - 백엔드 CRUD(번호 행매칭·deleteRow·완료일자 자동·잠금·체크박스·날짜포맷)·프런트 상태머신 관련 지적은 거짓양성으로 기각(의도된 동작/이미 처리).
  - 수정①: WorkWrite 제출 실패 시 모달 내 오류 + Snackbar 중복 → 모달 내 표시만 유지(onError 경로 제거).
  - 수정②: 담당자 칩 `검토필요`(붙임) → `검토 필요`로 라벨 통일.
- (참고) NoticeWrite도 동일한 모달+Snackbar 오류 중복 패턴이 있으나 STEP12 범위라 이번엔 미변경(경미·기능 영향 없음).
