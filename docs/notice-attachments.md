# 공지사항 첨부파일 기능 (개선요청 #6)

> 2026-07-07 · 요청자 박세리("공지사항 내 첨부파일 등록 기능 추가", 개선요청 #6 검토중) · 프런트+백엔드(Supabase Storage)

## 개요

공지 작성/수정 시 파일을 첨부하고, 상세에서 다운로드할 수 있게 함. 기존 `ref`(단일 URL 링크)는 그대로 두고, **실제 파일 업로드**를 별도로 추가.

## 백엔드 (Supabase — 마이그레이션 `notice_attachments`)

- **버킷 `notice-files`** — 비공개(`public=false`), 파일당 20MB(`file_size_limit=20971520`), MIME 제한 없음.
- **`notices.attachments jsonb NOT NULL DEFAULT '[]'`** — 첨부 메타 배열 `[{name, path, size, type}]`. 기존 11행은 `[]`.
- **Storage RLS(`storage.objects`)** — 공지 쓰기 권한과 동일 정책:
  - `notice_files_read` : SELECT / `authenticated` / `bucket_id='notice-files'` (서명URL 발급 가능 — 로그인 사용자 전원, 공지 열람 정책과 일치)
  - `notice_files_insert/update/delete` : `authenticated` + `public.is_admin()` (업로드·삭제는 관리자만)
- 검증: 익명 업로드 시도 → `403 new row violates row-level security policy`.

## 프런트엔드

- **타입** `src/types/index.ts` — `NoticeFile{name,path,size,type}`, `Notice.attachments?`.
- **API** `src/api/notices.ts` — `NOTICE_BUCKET`, `NOTICE_FILE_MAX(20MB)`; `getNotices`/`addNotice`/`updateNotice`에 attachments 매핑; 헬퍼:
  - `uploadNoticeFile(file)` — 20MB 초과 사전 차단, 키=`notice/{uuid}{ext}`(원본명은 name 보존), 반환 메타.
  - `noticeFileSignedUrl(path, name)` — 1시간 서명URL(원본 파일명으로 `download` 지정).
  - `removeNoticeFiles(paths)` — orphan 정리(best-effort).
- **`src/api/sheets.ts`** — `AddNoticePayload.attachments?`.
- **`NoticeCompose.tsx`** — 본문 아래 "파일 첨부" 버튼(dashed 칩) + 업로드 목록 칩(아이콘·이름·크기·제거). 선택 즉시 업로드, 업로드 중 저장/취소 잠금. `sessionPaths`로 이번 세션 업로드 추적 → **취소 시 새 업로드 전부 삭제**, **저장 시 올렸다 뺀 파일만 삭제**.
- **`NoticeDetail.tsx`** — 본문과 관련자료 버튼 사이에 "첨부파일 N" 목록. 클릭 시 서명URL로 다운로드(원본 파일명), 진행 스피너·오류 표시.
- **`index.tsx`** — 저장 핸들러에 attachments 전달; **수정 성공 후** 제거된 기존 첨부 정리, **삭제 성공 후** 해당 공지 첨부 정리(모두 best-effort).
- **`attachmentUI.tsx`(신규)** — MIME/확장자별 MUI 아이콘 매핑(`AttachmentIcon`)·`formatBytes`. 이모지 미사용.

## orphan 정리 정책 (요약)

| 상황 | 삭제 주체 | 안전성 |
|------|-----------|--------|
| 세션 업로드 후 목록에서 뺌 | 저장 시 NoticeCompose (`sessionPaths − final`) | 미저장 파일이라 항상 안전 |
| 작성 취소 | NoticeCompose (`sessionPaths` 전체) | 기존 첨부는 미포함 → 보존 |
| 수정에서 기존 첨부 제거 | 저장 **성공 후** index.tsx | 실패 시 삭제 안 함 |
| 공지 삭제 | 삭제 **성공 후** index.tsx | — |

## 검증

- `npm run type-check` 통과 · 홈/앱 런타임·콘솔 오류 0 · 익명 업로드 403(RLS) 확인.
- **미검증(관리자 로그인 필요, 배포 후 실측)**: 관리자 업로드 → 목록 노출 → 다운로드(원본 파일명) → 제거/삭제 시 스토리지 정리.

## 참고

- 무료 티어 총 1GB(개선요청 #10 조성범 답글). 문서 위주라 파일당 20MB 제한. 이미지 리사이즈는 미적용(문서 첨부 특성상 원본 보존).
- 이미지도 강제 다운로드(원본 파일명 보존 우선). 인라인 미리보기가 필요하면 추후 확장.
