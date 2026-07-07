# 공지사항 첨부파일 기능 (개선요청 #6)

> 2026-07-07 · 요청자 박세리("공지사항 내 첨부파일 등록 기능 추가", 개선요청 #6 검토중) · 프런트+백엔드(Supabase Storage)

## 2차 개선 (2026-07-08, 사용자 피드백 반영)

- **권한: 팀원(member)+로 개방** — 공지 작성/수정/삭제 + 첨부 업로드를 `is_admin()`→`is_member()`로. (마이그레이션 `notice_write_member_and_10mb`) Notice UI 게이팅도 `isAdmin`→`isMember`(새 공지 버튼·작성/수정 폼·상세 수정/삭제). NoticeDetail prop `isAdmin`→`canEdit`.
- **파일 제한 20MB→10MB** — 버킷 `file_size_limit` 및 `NOTICE_FILE_MAX`.
- **저장 멈춤 수정** — 첨부를 파일별 상태 모델(`Upload{status:'uploading'|'done'|'error'}`)로 재작성. 업로드 60초 타임아웃(스톨→에러), 파일별 스피너/실패 표시, 저장 버튼 스피너("저장 중"). 완료(done) 파일만 저장 대상.
- **첨부 유무 목록 표시** — 아코디언 안 열어도 목록 제목 옆에 클립 아이콘 + 개수(`AttachFile`).
- **모두 다운로드(ZIP)** — 첨부 2개↑일 때 상세에 "모두 다운로드" 버튼. `downloadNoticeBlob`로 원본 Blob 수집 → JSZip으로 `{제목}_첨부.zip`(동명파일 번호부여). 의존성 `jszip` 추가.
- **확장자 대표 아이콘 강화** — `attachmentUI.tsx` 매핑 확장(이미지·PDF·엑셀·PPT=Slideshow·워드=Article·한글·압축·텍스트=TextSnippet). ※ 이 icons 버전엔 `ErrorOutline`이 없어 `ErrorOutlineOutlined` 사용.
- 검증: type-check 통과·앱 런타임/서버 오류 0·Notice 모듈 트랜스폼 정상. 팀원/관리자 로그인 실경로(업로드 상태·저장·모두 다운로드·행 표시)는 배포 후 실측.

### 4차 — 실제 파일 아이콘 적용 (2026-07-08)

- 파일 유형 아이콘을 **사용자가 캡처해 제공한 실제 아이콘**(pdf·docx·xlsx·pptx·hwp·zip)으로 교체. 캡처 PNG의 흰 배경을 **가장자리 플러드필로 투명 처리**(내부 흰 글자·페이지 보존, jimp 스크립트), `src/pages/Notice/filetypes/*.png`로 번들(import → base 안전). `fileTypeIcons.tsx`가 확장자/MIME→PNG 매핑, 이미지·txt 등 미제공 유형은 인라인 SVG 대체. csv→xlsx, doc→docx 등 연관 확장자 매핑. (미제공 이미지/txt 아이콘은 추후 제공 시 추가) 검증: type-check·PNG 200 서빙·img 로드 확인.

### 3차 보정 (2026-07-08, 실사용 피드백)

- **개별 다운로드 한글 파일명 깨짐 수정** — 서명URL의 `download` 파라미터가 한글을 퍼센트 인코딩(`260227_%EC%B9%B4...`)해서, ZIP처럼 **원본 Blob(`downloadNoticeBlob`) → `URL.createObjectURL` → 앵커 `download=원본명`** 방식으로 변경(한글 그대로 유지). `noticeFileSignedUrl` 제거(미사용).
- **유형별 아이콘 색상** — 모양만 나뉘고 전부 단색이라 구분이 약했음 → `iconTone()`로 **유형별 색까지** 매핑(이미지/워드=파랑·PDF=빨강·엑셀=초록·PPT/압축=앰버·한글=teal·텍스트=purple). `AttachmentIcon`이 기본 색을 적용(호출부 sx에서 color 제거).

---


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
