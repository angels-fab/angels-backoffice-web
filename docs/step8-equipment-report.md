# STEP 8 — 장비도입관리: Project Tracking Dashboard (완료 보고)

> 작업일: 2026-06-14
> `/equipment` = "장비 도입 프로젝트 관리". **"현재 각 장비가 어느 단계인가"**가 핵심. 타임라인·간트가 메인, KPI는 보조.
> (운영관리 `/equipment-ops` = 자산 현황 / 도입관리 = 도입 진행 — 역할 분리)

---

## 1) 변경 내용 (섹션)

| 순서 | 섹션 | 내용 |
|------|------|------|
| ① | 도입 개요 (보조 KPI) | 전체 도입장비 · 진행중 · 설치완료 · 착수 전 (StatTile) |
| ② | 단계 파이프라인 | 사전규격→구매공고→기술평가→기술협상→장비제작→장비설치 **단계별 현재 장비 수**(RatioBar, 단계색 통일) |
| ③ | **도입 진행 현황 (메인)** | 필터(구분/담당자/검색) + 장비 카드(**현재 단계 · 진행률 바 · 도입 예정월 · 담당자**), 클릭→Drawer |
| ④ | **도입 타임라인 간트 (메인)** | GanttHeader(연·월 축) + 장비별 단계 막대, 자체 가로 스크롤, 행 클릭→Drawer |

**Drawer**: 현재 단계(칩) · 단계 진행(6단계, 도달분 강조) · 담당자 · 도입 예정월 · 총 소요기간 · 도입금액 · 관리번호.

## 2) 신규/변경 컴포넌트

| 파일 | 역할 |
|------|------|
| `pages/Equipment/stageMeta.ts` | 신규 — 단계 메타(코드·라벨·색·StatusKind) + `groupStage`(현재 단계·도입예정·진행률·소요기간) + `todayHalfIndex` |
| `pages/Equipment/EqProjectDrawer.tsx` | 신규 — 도입 상세 Drawer |
| `pages/Equipment/index.tsx` | 재작성(4섹션) |
| `pages/Equipment/gantt.tsx` | 단계 색을 stageMeta(accent 토큰)로 통일 (GanttHeader/GanttBar 로직 유지) |

활용: `PageContainer·ContentSection·AppCard·StatTile·StatusChip·RatioBar·AppDrawer·CardGrid·FilterBar·SearchBar`(기존 디자인 시스템). 간트는 특수 시각화라 전용 그리드 유지 + 색만 통일.

## 3) 핵심 데이터 계산 (구글시트만)

- `timeline`(반월 단위 단계코드, `tl[mi*2]`=전반/`tl[mi*2+1]`=후반) + `months` 축 → 장비명(그룹) 단위로:
  - **현재 단계** = 오늘 반월 위치(`todayHalfIndex`)의 단계(또는 직전 채워진 단계)
  - **도입 예정월** = timeline 마지막 단계 시점의 month (시작 + 단계별 소요)
  - **진행률** = 단계 순서 index / 6
  - **총 소요기간** = (첫~마지막 반월)/2 개월
- **지연 기능 미구현**(목표도입일 컬럼 없음 — 신설 후 STEP10+). 하드코딩·스키마 변경 없음.

## 4) 모바일 (375 / 545)

- KPI(CardGrid 4) · 도입 진행 현황(minColWidth 280) → **375·545px 1열**
- 간트는 `overflowX: auto` 컨테이너 안에서 **자체 가로 스크롤**(월 수 기반 동적 minWidth) — 페이지 전체는 가로 스크롤 없음

## 5) 검증

- `type-check` 통과 ✅ · `build` 통과 ✅
- 적대적 검증(3관점→재검증) → **4건 수정**:
  - 간트 컨테이너 minWidth 고정 → months 수 기반 동적 계산
  - 파이프라인 done 집계가 무조건 '설' → 실제 마지막 단계 코드
  - Drawer 단계 진행: done이 전 단계 채움 → 실제 도달 단계까지만
  - Drawer 필드 정리(장비종류 제거)
  - (제외) dueMonth 가드 기존 처리 / 단계코드 6종뿐 / 간트 모바일은 동적폭+overflow로 해소
- 후속: EqItem·EqCard·EqKpi 등 죽은 코드 정리 과제(task_3e0e5add)

## 6) 개선 전/후

| 항목 | Before(레거시) | After |
|------|------|------|
| 정체성 | 도입 장비 카드 + 간트(레거시 CSS) | **Project Tracking Dashboard** |
| 현재 단계 파악 | 간트 색만 | **현재 단계 칩 + 진행률 + 도입예정월** |
| 단계 분포 | 없음 | **단계 파이프라인(RatioBar)** |
| 개요 | 종/대 수 | **진행중/설치완료/착수전 KPI** |
| 상세 | 없음 | **AppDrawer(단계 진행·소요기간·예정월)** |
| 색 | 단계 하드코딩 hex | **accent 토큰 통일** |
| 스타일 | 레거시 | 디자인 시스템(다른 페이지와 동일 밀도) |

## 확인 URL
`http://localhost:3600/#/equipment`

## 다음
잔여: 공지사항 · 바로가기 이관. 마감/지연 기능은 STEP10+(마감일 컬럼 신설 후).
