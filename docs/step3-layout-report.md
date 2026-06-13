# STEP 3 — Layout System 구축 (완료 보고)

> 작업일: 2026-06-13
> 범위: **레이아웃 시스템 컴포넌트 구축 + 적용 방식 문서화**. 페이지 디자인/구조/기능 미수정.

---

## 1) Layout 구조도

```
AppLayout (최상위 셸)
├─ Sidebar (256px, 데스크톱 고정 / 모바일 햄버거+Drawer)
└─ Main
   └─ PageContainer            ← 폭 1400(목록)/1200(상세) · 좌우 24 · 상단 32
      ├─ PageHeader            ← 아이콘 + 제목 + 업데이트시간 + 우측 액션
      ├─ ContentSection "KPI"  ← Section↔Section 24
      │  └─ CardGrid columns=4 ← KPI↔KPI 16 (Mobile 1 / Tablet 2 / Desktop 4)
      └─ ContentSection "목록"
         └─ CardGrid minColWidth=290  ← Card↔Card 16
```

---

## 2) 신규 / 확장 컴포넌트

| 컴포넌트 | 역할 | 상태 |
|----------|------|------|
| `AppLayout` | 최상위 셸 — Sidebar + Main + 반응형(데스크톱 고정 / 모바일 햄버거+Drawer) | 신규 |
| `PageContainer` | 폭(wide 1400 / detail 1200)·좌우·상단 padding 통일 | 신규 |
| `ContentSection` | 섹션 단위, 하단 간격 24 통일 (+ SectionHeader 동반) | 신규 |
| `CardGrid` | KPI·카드 반응형 그리드, 간격 16 (Mobile 1 / Tablet 2 / Desktop N) | 신규 |
| `PageHeader` | 아이콘 + 페이지명 + 업데이트시간 + 우측 액션 | 확장 |
| `SectionHeader` | 제목 + 설명(선택) + 액션(선택) | 확장 |

---

## 3) 기존 페이지 적용 방식 (이관 레시피 — STEP 4+ 적용)

```tsx
<PageContainer>                          {/* 폭·여백 통일 */}
  <PageHeader icon={…} title="제목" updatedAt="…" actions={…} />
  <ContentSection title="KPI">
    <CardGrid columns={4}>{kpis}</CardGrid>   {/* KPI 16px */}
  </ContentSection>
  <ContentSection title="목록" last>
    <CardGrid minColWidth={290}>{cards}</CardGrid>
  </ContentSection>
</PageContainer>
```

현재는 컴포넌트만 구축하고 7개 페이지에는 적용하지 않음(명세 "페이지 수정 금지"). STEP 4(홈 리디자인)부터 위 레시피로 점진 이관.

---

## 4) Before / After 비교

실측 조사(9개 영역 병렬 스캔) 결과 — 현재 페이지별 폭·여백이 제각각:

| 항목 | Before (현재, 페이지별 상이) | After (통일) |
|------|------|------|
| 콘텐츠 최대폭 | 홈 1180 · `.page` 1320 · 요약 960 · 타임라인 98vw | **1400 (목록) / 1200 (상세)** |
| 상단 padding | main 36 (+ `.page` 32 중복 → 공지 68) | **32** |
| Header → 첫 Section | 홈 20 · `.page` 28 | **24** |
| Section ↔ Section | 12 / 14 / 16 / 20 / 28 / 38 | **24** |
| Card ↔ Card | 12 / 14 / 18 | **16** |
| KPI ↔ KPI | 10 / 12 / 14 | **16** |
| Card 내부 padding | 16×18 / 20 / 22×24 / 13×15 | **24** |

---

## 5) 검증 & 확인

- `npm run type-check` 통과 ✅ · `npm run build` 성공 ✅ · 7개 페이지·셸 미수정(git 확인) ✅
- 적대적 검증(3관점 리뷰 → 재검증) 6건 중:
  - **수정** StatusChip `#fff` 하드코딩 → 토큰(`common.white`)
  - **수정** PageContainer 하단 `60px` → `pageBottom` 토큰화
  - **기각** "내비 Drawer 24px 미적용" — 24px 규칙은 상세용 `AppDrawer`(이미 준수) 대상, 내비 Drawer 아님
  - **기각** "7개 페이지 미적용=위반" — 명세가 "페이지 수정 금지·Layout만 구축"이라 미적용이 의도. STEP 4부터 적용
- 확인 URL(dev 3600): `/#/layout-system` · `/#/design-system` · `/`

---

## 다음 단계 — STEP 4

Dashboard(Home) 리디자인. Layout System을 홈에 처음 적용하며 위 이관 레시피로 진행.
