# STEP 4.5 — Dashboard 시각화 강화 (완료 보고)

> 작업일: 2026-06-14
> 레이아웃/정보구조는 유지하고 **시각적 밀도·데이터 시각화·완성도만** 향상.

---

## 개선 항목 (5)

### 1. KPI 카드 보조지표 추가
6개 KPI 전부에 의미 있는 보조지표(sub) 부여:

| KPI | 값 | 보조지표 |
|-----|----|---------|
| 전체 장비 | N종 | N대 보유 |
| 운영 중 | N대 | **가동률 N%** |
| 진행중 업무 | N건 | **지연 N건** |
| 오늘 일정 | N건 | **7일내 N건** |
| 신규 공지 | N건 | 총 N건 |
| 이번달 도입 | N대 | 예정 N대 |

### 2. 업무 현황 — Progress Bar(Mini Chart)
- 신규 `RatioBar` 컴포넌트(가로 누적 비율 막대 + 범례)
- 진행중·예정·완료·지연 비율을 한눈에, 아래 상태별 타일과 병행

### 3. 장비 현황 — 상태 비율 시각화
- 동일 `RatioBar`로 운영중·설치중·도입예정·비가동 비율(대수 기준) 시각화

### 4. 공지사항 — 카드형 리스트 강화
- 단순 행 → **테두리 카드**(분류/NEW 칩 + 2줄 제목 + 부서·게시자 메타 + 날짜)
- hover 시 살짝 떠오름, 넓은 화면에서 2열(CardGrid auto-fill)

### 5. FAB 구축 로드맵 — 전용 메뉴로 분리
- Home에서 제거 → 전용 **`/roadmap`** 페이지 신설(디자인 시스템 기반 **반응형 세로 타임라인**, 모바일·데스크톱 모두 노출)
- 사이드바 '정보' 그룹에 **'구축 로드맵'** 메뉴 추가(모바일 하단탭은 5개 고정 유지)

---

## 신규/변경 파일

| 파일 | 변경 |
|------|------|
| `components/ds/RatioBar.tsx` | 신규 — 비율 막대 시각화(디자인 시스템) |
| `pages/Home/dash/derive.ts` | 신규 — 업무상태/일정 집계 공용 로직(KPI·업무 섹션 공유) |
| `pages/Home/dash/KpiOverview.tsx` | 보조지표 추가 |
| `pages/Home/dash/WorkStatusSection.tsx` | RatioBar 추가 |
| `pages/Home/dash/EquipmentSection.tsx` | RatioBar 추가 |
| `pages/Home/dash/NoticeSection.tsx` | 카드형 리스트 |
| `pages/Roadmap/index.tsx` | 신규 — 로드맵 전용 페이지 |
| `pages/Home/index.tsx` | 로드맵 섹션 제거 |
| `router/AppRouter.tsx` · `layouts/SideNav.tsx` | /roadmap 라우트·메뉴 |

레이아웃 구조(PageContainer/ContentSection 순서·간격)와 다른 6개 페이지 본문은 **그대로 유지**.

---

## 검증

- `type-check`·`build` 통과 ✅ / 다른 6개 페이지 본문 미수정 ✅ (SideNav 메뉴 1개 추가는 항목5)
- 적대적 검증(3관점→재검증): **4건 수정**
  - RatioBar `neutral` 색 누락 → 명시(완료 색 일관)
  - 업무 완료 판정: '완료일자 입력됨' 기준으로 수정(명세 일치)
  - KPI '이번달 도입' 보조문구 중복/모호 → '예정 N대'
  - 공지 카드 `aria-label` 추가(접근성)
- 후속: 죽은 코드(Greeting/previews/RoadmapTimeline) 정리 과제 분리

## 확인 URL (dev 3600)
- 홈: `http://localhost:3600/`
- 로드맵: `http://localhost:3600/#/roadmap`

## 다음 단계 — STEP 5
일정관리(Calendar) 리디자인 예정.
