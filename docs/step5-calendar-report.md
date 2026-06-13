# STEP 5 — 일정관리(Calendar) UX 개선 (완료 보고)

> 작업일: 2026-06-14
> "일정 표시" 수준 → **업무 일정 관리 시스템** 수준으로. 디자인 시스템 기반, 사용성 개선.

---

## 개선 결과 (요구 7항목)

| # | 요구 | 구현 |
|---|------|------|
| 1 | 월간 캘린더 유지 | FullCalendar 월간뷰 유지(테마 재사용) |
| 2 | 요약 패널(오늘/이번주/다가오는/D-Day) | 우측(모바일 하단) `SummaryPanel` — 미니 통계(오늘·이번주·다가오는) + 오늘 일정 리스트 + **다가오는 일정 D-Day 배지** |
| 3 | 상태 시각화 + 색상 통일 | 카테고리→**StatusKind(테마 accent) 매핑**(`catMeta.ts`). 캘린더 이벤트·범례·요약·드로어 색 일치. **대시보드(CAL_CATS)도 accent로 정렬**해 앱 전체 통일 |
| 4 | 클릭 UX(Drawer/Modal) | 일정 클릭 → **AppDrawer 상세**(카테고리·시간·장소·반복) |
| 5 | 모바일 뷰 전환 | **월간/주간/목록** 토글(StatusChip) — FullCalendar API `changeView` |
| 6 | 디자인 시스템 사용 | PageContainer·PageHeader·ContentSection·FilterBar·StatusChip·AppDrawer만 사용. 새 디자인 언어 없음 |
| 7 | 대시보드 동일 밀도 | 동일 토큰·간격·StatusChip·AppCard 밀도 |

---

## 구조

```
PageContainer
├─ PageHeader (아이콘 + "업무 일정" + 업데이트시간 + 새로고침)
├─ ContentSection — FilterBar
│   ├─ 카테고리 칩(전체/회의/교육/채용/출장/기타, 통일 색·토글 필터)
│   └─ trailing: 뷰 토글(월간/주간/목록)
└─ ContentSection — 2열 그리드 (모바일 1열)
    ├─ FullCalendar (월간/주간/목록)
    └─ SummaryPanel (오늘·이번주·다가오는 + D-Day)
AppDrawer — 일정 상세
```

## 신규/변경 파일

| 파일 | 변경 |
|------|------|
| `pages/Calendar/index.tsx` | 디자인 시스템 기반 재작성(헤더·필터·뷰토글·2열·Drawer) |
| `pages/Calendar/catMeta.ts` | 신규 — 카테고리→StatusKind/accent 색 통일 매핑 |
| `pages/Calendar/SummaryPanel.tsx` | 신규 — 오늘/이번주/다가오는 + D-Day |
| `constants/calendar.ts` | CAL_CATS 색을 accent 토큰으로 정렬(대시보드 통일) |
| `index.css` | FullCalendar 테마 하드코딩 `#3b78e7` → `var(--blue)` 토큰화 |

기존 6개 페이지 본문 미수정. 캘린더는 **읽기 전용 유지**(작성 폼 `CalEventWrite`는 미사용 죽은코드 → 정리 과제).

---

## 검증

- `type-check`·`build` 통과 ✅
- 적대적 검증(3관점→재검증) 13건 중 8 confirmed → **5건 수정**:
  - 다가오는 일정 **D-Day 배지 추가**(명세 핵심)
  - 대시보드↔캘린더 카테고리 색 통일(CAL_CATS→accent)
  - 모바일 뷰토글을 헤더→FilterBar로 이동(여백)
  - 요약 오늘/이번주 집계 방식 일치(id dedupe)
  - FullCalendar 테마 하드코딩 색 토큰화
  - (정리 과제) CalEventWrite·레거시 CSS 죽은코드 — 별도 분리

## 확인 URL
`http://localhost:3600/#/calendar`

## 비고
- 캘린더 이벤트에는 담당자 필드가 없어 상세는 시간·장소·반복·카테고리로 구성(데이터 한계).
- "구글 캘린더"가 아닌 "업무 일정관리"로: 요약 패널·D-Day·상태 칩·필터로 관리 맥락 강화.

## 다음 단계
STEP 6 — 업무현황 등 나머지 페이지 순차 이관.
