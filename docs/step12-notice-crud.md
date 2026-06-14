# STEP 12 — 공지사항 CRUD + 운영형 UX 개선 (완료 보고)

> 작업일: 2026-06-14
> 카드 나열 중심이던 공지사항을, 공지가 누적돼도 관리·탐색이 쉬운 **운영형 구조(중요공지 + 테이블)** 로 개선하고 **실제 Google Sheet CRUD**(작성·수정·삭제)를 구현.

---

## 1. 운영형 UX 개선

| 구역 | 내용 |
|------|------|
| 상단 **중요 공지** | **상단고정(중요) 또는 '긴급' 분류** 공지를 최대 5건, 카드형으로 고정 표시. 제목·작성일·분류. 클릭 → 상세 Drawer |
| 하단 **공지 목록** | **테이블**(분류·제목·작성자·작성일), 최신순(상단고정 우선→연번 desc). 분류 필터·검색 유지. 행 클릭 → 상세 Drawer |

- KPI(전체/중요/이번달/최근7일)는 상단에 유지(중요 = 상단고정+긴급 기준으로 일치).
- 테이블은 모바일에서 가로 스크롤, 행은 키보드 접근(Enter/Space·focus-visible).

## 2. CRUD (관리자 전용)

| 동작 | 흐름 |
|------|------|
| **작성** | 헤더 "새 공지" → 모달(제목·내용·분류·**게시일**·기타) → `addNotice` |
| **수정** | 상세 Drawer "수정" → 모달에 **기존 데이터 자동 로드** → `updateNotice`(연번 기준, 게시자 원본 유지) |
| **삭제** | 상세 Drawer "삭제" → **확인 Dialog** → `deleteNotice`(연번 기준 시트 행 삭제) |

- 모든 동작은 로그인한 관리자의 이름+비밀번호로 백엔드 인증(**비밀번호 재입력 없음**). 작성자 소유권 제한 없이 관리자면 수정/삭제 가능.
- 작성/수정 폼은 **단일 모달**(NoticeWrite) 겸용 — `editing` 유무로 모드 전환.

## 3. Google Sheet 연동 (Apps Script)

`Code.gs`에 추가:
- `updateNotice_` — 연번으로 행을 찾아 분류·제목·내용·게시일·부서·해당자·종료일·상단고정 갱신. **게시자(M열)는 덮어쓰지 않음.**
- `deleteNotice_` — 연번으로 행을 찾아 `deleteRow`.
- `noticeCtx_`/`findNoticeRow_` — 시트·헤더·연번 행 탐색 공용(헤더명 자동 인식 = 열 이동 OK).
- `doPost` 라우팅: add/update/delete를 **LockService 잠금** 하에 처리(연번 충돌·행삭제 경합 방지).
- `addNotice_`: 게시일(`req.date`)을 받으면 그 날짜로 기록(없으면 오늘).
- C/R/U/D 모두 실제 시트 반영 → 새로고침 후에도 유지.

## 4. 사용자 경험 (Snackbar)

페이지 하단 Snackbar 한 곳으로 통일:
- 작성 성공 / 수정 성공 / 삭제 성공 → success
- 작성·수정·삭제 오류 → error (메시지는 백엔드 사유 그대로)

## 구현 파일

| 파일 | 내용 |
|------|------|
| `google-apps-script/Code.gs` | updateNotice_/deleteNotice_/noticeCtx_/findNoticeRow_, 라우팅+잠금, addNotice_ 게시일 |
| `src/api/sheets.ts` | `updateNotice`/`deleteNotice`, `AddNoticePayload.date` |
| `src/pages/Notice/NoticeWrite.tsx` | 작성/수정 겸용 모달(자동로드·게시일·onError) |
| `src/pages/Notice/NoticeDrawer.tsx` | 관리자 수정/삭제 버튼 |
| `src/pages/Notice/index.tsx` | 중요공지 영역 + 테이블 + Snackbar + 삭제 Dialog + CRUD 연결 |

기존 디자인 시스템(PageContainer·ContentSection·AppCard·AppDrawer·StatusChip·StatTile) 유지, 색은 토큰/StatusKind만 사용.

## 검증
- `npm run type-check` 통과 ✅ · `npm run build` 통과 ✅
- 멀티에이전트 3-렌즈 리뷰(정확성·디자인·엣지케이스, **28건**) → 적대적 검증.
  - 백엔드 CRUD(연번 행매칭·deleteRow·인증·잠금·헤더 자동인식)·프런트 상태머신 관련 지적은 **거짓양성으로 기각**(의도된 동작/이미 처리).
  - 진짜 **1건(low)** 수정: 수정 모드에서 게시자 필드가 현재 관리자명을 보여 저장값(원본 게시자)과 불일치 → **원본 게시자를 표시**하도록 변경(라벨 "게시자 (원본 유지)").
- 백엔드 clasp 배포 완료(공지 update/delete action 반영).

## 비고
- 보안 인증이 아닌 내부용 UI 게이트(기존 STEP10 정책 유지). 비밀번호는 프런트로 내려오지 않음.
- 수정 시 게시자는 원본 유지(편집해도 작성자 재할당 안 함).
