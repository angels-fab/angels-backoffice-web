# 장비도입관리 페이지 아키텍처

> 경로: `/equipment` · 페이지: `src/pages/Equipment/`
> 역할: **장비 도입 프로젝트 추적 대시보드(Project Tracking)** — 구매 절차 단계·타임라인 중심.
> (자매 페이지 `/equipment-ops` 장비운영관리 = 자산 현황 Asset Dashboard. 둘은 **같은 데이터(eq slice)** 를 서로 다른 관점으로 본다.)

---

## 1. 한눈에 보기

```
Google Sheets ──(Apps Script ?sheet=)──► Redux(eqSlice) ──► Equipment 페이지
  ├ '장비운영관리'  : 장비 1대=1행(목록·금액·상태·담당)        groups(EqGroup) / raw(EqRawItem)
  └ '장비도입관리'  : 관리번호·시작년월·단계별 기간(개월)        → timeline(반월 단계코드) + months
```

- 데이터는 **MainLayout 진입 시 `loadEqData()` 1회 로드**(홈/운영/도입 공용). 페이지는 store만 읽음.
- 표시 단위 = **장비명 그룹(EqGroup)**. 변형(예: `장비명 (A)`, `(B)`)은 한 그룹으로 묶고 대표 타임라인 1개 사용.
- 도입 단계/진행률/도입예정월은 시트 원본이 아니라 **타임라인에서 파생**(stageMeta).

## 2. 데이터 소스 & 변환 (`src/store/slices/eqSlice.ts`)

`loadEqData` 썽크가 두 시트를 동시에 읽어 `{ raw, groups, months }` 생성.

### 2-1. 타임라인 (장비도입관리 시트 → 반월 단위)
- 헤더(첫 8행에서 `연번` 기준 행 탐색) 정규화 후 **헤더명으로 열 인식**(`관리번호`, `시작년월`, 단계 6열).
- 단계 헤더 ↔ 간트 약어: `사전규격→사 · 구매공고→공 · 기술평가→평 · 기술협상→협 · 장비제작→제 · 장비설치→설`.
- **반월(half-month) 모델**: 한 달 = 2칸(전반/후반). `시작년월`이 15일 이후면 그 달 후반 칸부터 시작(시트 수식과 동일).
- 각 단계 기간(개월, 0.5 단위)을 `round(개월 × 2)` 칸으로 채워 `timeline: string[]`(칸별 단계 약어) 생성.
- 기준 연도 `TL_BASE_YEAR = 2026`. 일정이 있는 구간 앞뒤로 한 달씩 여유를 둬 `months: TlMonth[]`(연/월 라벨) 생성, timeline을 그 범위로 패딩·슬라이스.

### 2-2. 목록·금액 (장비운영관리 시트 → EqRawItem/EqGroup)
- **2단 헤더(그룹행+세부행) 병합** 후 헤더명으로 열 인식(연번·관리번호·장비명·분류·구분·입찰방법·재원·담당자·도입금액·상태·…).
- `raw: EqRawItem[]` 생성 후 **장비명 baseName 기준 그룹핑** → `groups: EqGroup[]`(codes/price 합산/count/variants, 대표 timeline = `tlMap[관리번호]`).

### 2-3. 타입 (`src/types/index.ts`)
`EqRawItem`(장비 1대), `EqGroup`(name·cat·mgr·bid·type·price·count·codes·timeline …), `TlMonth{year,month}`.

## 3. 단계 메타 / 파생 로직 (`src/pages/Equipment/stageMeta.ts`)

| 심볼 | 역할 |
|------|------|
| `STAGE_ORDER` = `['사','공','평','협','제','설']` | 단계 순서(6종) |
| `STAGE[code]` | `{label, status(StatusKind), color(accent 토큰)}` — 간트·칩·파이프라인 색 통일 |
| `todayHalfIndex(months)` | 오늘이 months 축에서 몇 번째 반월인지(범위 밖이면 -1 또는 length×2) |
| `groupStage(timeline, months, todayHalf)` → `StageInfo` | `phase`(done/progress/upcoming/none) · `code`(현재/최종 단계) · `dueMonth`(도입예정월 'YYYY.M') · `progress`(0~1) · `durationMonths`(반월→개월 올림) |
| `phaseChip(info)` | 요약 칩: 설치완료/착수 전/미정 또는 현재 단계 라벨·색 |

- 진행 판정: `todayHalf > last` → 완료 / `< first` → 착수 전 / 그 사이 → 진행중(현재 칸의 단계코드).

## 4. 화면 구성 (`src/pages/Equipment/index.tsx`)

| 구역 | 내용 |
|------|------|
| PageHeader | 제목 "장비도입관리" + 새로고침(`loadEqData`) |
| ① 도입 개요 | 보조 KPI 4 — 전체 도입장비(종)/진행중/설치완료/착수 전 (`StatTile`) |
| ② 단계 파이프라인 | 단계별 현재 장비 수 `RatioBar`(STAGE_ORDER 색) |
| ③ 도입 진행 현황 | 필터(구분·담당자) + 검색(장비명·담당자) → 카드 그리드. 카드: 단계 칩·진행률 막대·담당자·도입예정월. 클릭 → Drawer |
| ④ 도입 타임라인 | 가로 스크롤 간트(`gantt.tsx`) — 행 클릭 → Drawer |
| Drawer | `EqProjectDrawer` |

- `infoMap`: `groups`마다 `groupStage` 결과 캐시(useMemo). `overview.tally`: 단계별 현재 장비 수 집계.
- 필터: `fltType`(구분)·`fltMgr`(담당자)·`query`. 정렬은 groups 순서(그룹핑 순).

## 5. 간트 렌더링 (`src/pages/Equipment/gantt.tsx`)

- `GanttHeader`: 2단(연도행 + 월행). 연속 같은 연도 묶어 표시, 월 너비는 자릿수에 따라 2fr/3fr.
- `GanttBar`: 각 월을 **전반/후반 2칸**으로 그리고 `timeline[mi*2], [mi*2+1]` 단계코드의 `STAGE.color`로 채움. 뒤에 월 격자선 레이어.
- `TL_VISIBLE_MONTHS=36` 상한(실제 구간은 eqSlice가 앞뒤 빈 달 제거). 색·이름은 stageMeta에서 가져와 통일(하드코딩 없음). 격자/막대 스타일은 `index.css`의 `.gantt-*` 클래스.

## 6. 상세 Drawer (`src/pages/Equipment/EqProjectDrawer.tsx`)

`AppDrawer`(폭 480). 표시: phase 칩 · **도입 단계**(STAGE_ORDER 칩, 현재 단계까지 강조) · 담당자 · 도입 예정월 · 총 소요기간 · 도입금액(천원) · 관리번호(들). props `{group, months, todayHalf, onClose}`.

## 7. 파일 맵

```
src/pages/Equipment/
  index.tsx            페이지 본체(4구역 + 필터 + 간트 + Drawer)
  stageMeta.ts         단계 상수·파생(STAGE/groupStage/phaseChip/todayHalfIndex)
  gantt.tsx            GanttHeader / GanttBar (반월 그리드)
  EqProjectDrawer.tsx  도입 상세 Drawer
src/store/slices/eqSlice.ts   2개 시트 로드·타임라인 계산·그룹핑
src/types/index.ts            EqRawItem / EqGroup / TlMonth
src/api/sheets.ts             fetchSheet, SHEET_NAME_EQ / SHEET_NAME_SCHEDULE
src/index.css                 .gantt-* 스타일
```

## 8. 디자인 시스템

`PageContainer · PageHeader · ContentSection · AppCard · CardGrid · FilterBar · SearchBar · StatusChip · StatTile · RatioBar · AppDrawer`. 색은 `tokens.ts accent` / `StatusKind`만(하드코딩 금지). 간트 단계색도 동일 accent 토큰.

## 9. 제약 / 설계 결정

- **지연/목표일 기능 없음**: 시트에 목표 도입일 컬럼이 없어 미구현. 도입예정일 = 시작 + 단계 소요기간으로 파생(타임라인 마지막 칸).
- **그룹(장비명) 단위** 관리. 단계 코드는 6종 고정.
- 읽기 전용(이 페이지엔 쓰기 없음). 데이터 정합은 헤더명 인식에 의존 — 단계/시작년월/관리번호 헤더명이 바뀌면 eqSlice 동의어 보강 필요.
- 운영관리(`/equipment-ops`)와 동일 `eq.groups`를 공유하되, 운영관리=현재 자산 현황 / 도입관리=도입 프로젝트(단계·간트)로 역할 분리.
