# Claude To Codex

## Summary (최신: 공지사항 첨부파일 — 개선요청 #6, 2026-07-07)

개선요청 메뉴의 검토중 5건 중 사용자가 "하나씩 진행" 지시 → 첫 건 **#6 공지 첨부파일**(요청자 박세리) 구현. 프런트+백엔드(Supabase Storage). type-check 통과·익명 업로드 403(RLS) 확인·커밋·자동배포. 관리자 업로드/다운로드 실경로는 배포 후 실측 예정.

### 백엔드 (마이그레이션 `notice_attachments` — 프로덕션 적용됨)

- 버킷 `notice-files`: `public=false`, `file_size_limit=20MB`, MIME 무제한.
- `notices.attachments jsonb NOT NULL DEFAULT '[]'` (메타 `[{name,path,size,type}]`).
- `storage.objects` RLS: 읽기=`authenticated`(공지 열람 정책과 동일하게 로그인 전원), 쓰기/삭제=`authenticated AND public.is_admin()`.
- 확인: 익명 업로드 → `403 new row violates row-level security policy`.

### 프런트

- `src/types/index.ts`(NoticeFile·Notice.attachments), `src/api/sheets.ts`(AddNoticePayload.attachments), `src/api/notices.ts`(uploadNoticeFile·noticeFileSignedUrl·removeNoticeFiles + 매핑).
- `src/pages/Notice/`: `NoticeCompose.tsx`(첨부 UI·orphan 정리), `NoticeDetail.tsx`(서명URL 다운로드 목록), `index.tsx`(저장/삭제 시 스토리지 정리), 신규 `attachmentUI.tsx`(MIME별 MUI 아이콘·formatBytes).

### 검증 상태

- ✅ `npm run type-check` 통과, 홈/앱 런타임·콘솔 오류 0, 익명 업로드 403(RLS).
- ⚠️ **미검증(관리자 로그인 필요)**: 관리자 업로드 → 목록 → 다운로드(원본 파일명) → 제거/삭제 시 스토리지 정리. 배포 후 사용자 실측 예정.

### Codex 검토 요청 포인트

1. **orphan 정리 안전성**: 세션 업로드(취소=전부삭제, 저장=올렸다뺀것만) vs 기존첨부(수정/삭제 성공 후 index.tsx에서 삭제). 실패 경로에서 참조-파일 불일치 가능성 점검.
2. **읽기 RLS 범위**: `authenticated` 전원 다운로드 = 공지 열람 정책(`notices_read` true)과 일치. 해당자(target) 지정 공지 첨부를 비대상자도 받는 점이 허용 범위인지(현행 공지 본문도 전원 열람이라 일관).
3. 용량 정책(파일당 20MB, 총 1GB 무료) — 이미지 리사이즈 미적용(문서 첨부 특성). #10 데모결과(이미지)와 정책 분리 필요.

상세: `docs/notice-attachments.md`.
