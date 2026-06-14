# STEP 9 — 공지사항: 팀 공지 허브 (완료 보고)

> 작업일: 2026-06-14
> 단순 게시글 목록 → **팀 공지 허브**. 기존 공지 시트 사용(읽기 전용 표시), 스키마 변경 없음.

---

## 변경 내용

| 순서 | 섹션 | 내용 |
|------|------|------|
| ① | KPI | 전체 공지 · **중요 공지(상단고정)** · 이번달 공지(작성일) · 최근 7일(isNew) — StatTile |
| ② | 분류 필터 + 검색 | 분류 StatusChip(공지/일반/회의/교육/행사/점검 + 긴급) · 검색(제목/작성자/분류) |
| ③ | 공지 카드 목록 | 카드(제목/분류/작성자/작성일 + 중요·NEW·만료 칩), CardGrid |
| — | 상세 | 카드 클릭 → **AppDrawer**(제목/분류/작성자/작성일/본문) |

본문: `noticeBodyHTML`(HTML 살균 + 평문 URL 자동 링크 + target rel 강제)로 안전 렌더(DOMPurify).

## 신규/변경 파일

| 파일 | 변경 |
|------|------|
| `pages/Notice/noticeMeta.ts` | 신규 — 분류→StatusKind, 본문 살균/링크 헬퍼(DOMPurify) |
| `pages/Notice/NoticeDrawer.tsx` | 신규 — 공지 상세 Drawer |
| `pages/Notice/index.tsx` | 재작성(KPI+필터+카드+Drawer) |
| `components/ds/AppCard.tsx` | **클릭 카드 키보드 접근성**(role=button/Enter·Space/aria-label) — 전역 개선 |
| `pages/Home/dash/NoticeSection.tsx` | 대시보드 공지도 `noticeMeta` 재사용(렌더·보안 일관) |
| `pages/Notice/NoticeWrite.tsx` | 분류 목록에 회의/교육/점검 추가 |

## 보존(읽기 허브이되 기능 유지)

- **딥링크 `/notice/:num`** (대시보드 NoticeSection에서 진입) → 해당 공지 Drawer 자동 오픈
- **조회수 증가**(bumpNoticeViews) · **새 공지 작성**(NoticeWrite, 게시자 비밀번호) — 헤더 버튼으로 유지

## 검증

- `type-check` 통과 ✅ · `build` 통과 ✅
- 적대적 검증(3관점→재검증) → **수정**:
  - AppCard 키보드 접근성 추가(전역) + Notice 카드 aria-label
  - 대시보드 NoticeSection이 자체 살균 → `noticeBodyHTML` 재사용(HTML 감지·URL 링크·**탭나빙(rel) 방지** 일관)
  - 평문 링크 인라인 색 제거 → 테마(`& a` primary.main)
  - NoticeWrite 분류에 회의/교육/점검 추가
- 금지 준수: MUI DataGrid·게시판 사이트 스타일·Google Docs 스타일 없음, 새 디자인 언어 없음

## 모바일 (375 / 545)
- KPI(CardGrid 4) · 공지 카드(minColWidth 300) → 1열, 가로 스크롤 없음

## 개선 전/후

| 항목 | Before | After |
|------|--------|-------|
| 형태 | 아코디언 게시판(표 행) | **공지 카드 허브** |
| 요약 | 없음 | **KPI 4종** |
| 분류 | 버튼 필터 | StatusChip(통일 색) |
| 상세 | 인라인 아코디언 | **AppDrawer** |
| 스타일 | 레거시 게시판 | 디자인 시스템(다른 페이지와 동일 밀도) |

## 확인 URL
`http://localhost:3600/#/notice`

## 다음
잔여: 바로가기(/links) 이관. 마감/지연은 STEP10+(마감일 컬럼 신설 후).
