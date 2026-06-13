# STEP 7 — 장비운영관리 Command Center (완료 보고)

> 작업일: 2026-06-14
> 숫자만 보이던 화면 → **운영 상황판(Command Center)**. 현재 장비 상태를 한눈에.

---

## 1) 변경 내용 (섹션 구성)

| 순서 | 섹션 | 내용 |
|------|------|------|
| ① | KPI | 총 장비 / 운영중 / 설치중 / 도입예정 / 비가동 (StatTile, 대수+종 보조) |
| ② | 장비 상태 비율 | RatioBar (운영중·설치중·도입예정·비가동) — 업무현황과 동일 스타일 |
| ③ | 주목 장비 | **비가동 > 설치중 > 도입예정** 우선순위 상위 5건 카드(강조 표면), 클릭→Drawer |
| ④ | 카테고리 현황 | 실제 `cat`별 장비수 + 운영/설치/예정/비가동 요약 카드 |
| ⑤ | 예산 현황 | 총 도입예산 / 지방비 / 국비 **Compact Card**(천원) — 대형 KPI 제거 |
| ⑥ | 전체 장비 목록 | 최하단. 상태 탭 + 카테고리 필터 + 검색, 카드 클릭→Drawer |

상태 매핑: 가동중=운영중, 도입중=설치중 (`selectEqCounts`와 동일 분류 기준).

## 2) 신규 컴포넌트

| 파일 | 역할 |
|------|------|
| `pages/EquipmentOps/eqMeta.ts` | 상태 분류(eqStateKey)·라벨·StatusKind·주목 우선순위 |
| `pages/EquipmentOps/EqDetailDrawer.tsx` | 장비 상세 Drawer |
| `pages/EquipmentOps/index.tsx` | 재작성(6섹션) + 내부 EqCard |

활용: `StatTile`·`RatioBar`·`CardGrid`·`AppCard`·`StatusChip`·`FilterBar`·`SearchBar`·`AppDrawer`(전부 기존 디자인 시스템).

## 3) Drawer 상세

장비명(제목) · 상태(StatusChip) · 관리번호 · 장비종류 · 도입금액(천원) · 담당자 · 설치위치 · 비고 — **명세 8개 필드만**, 그룹(EqGroup) 데이터 기반.

## 4) 데이터 (구글시트만)

- 상태/카운트: `selectEqCounts`(eq.raw) — units(대)/typesBy(종)
- 예산: Σ`price`(천원), 지방비/국비 = `fund` 포함 합 (EqKpi와 동일 계산)
- 카테고리: 실제 `cat` 필드로 동적 그룹화(하드코딩·추론 없음)
- 주목/목록: `eq.groups`(장비명 단위)
- **없는 컬럼 추론·하드코딩·스키마 변경 없음**

## 5) 모바일 (375 / 545)

- KPI(CardGrid columns=5) → xs 1열 · 주목/카테고리(minColWidth auto-fill) → 375·545px 1열
- 전체 목록도 카드 그리드(1열) → **가로 스크롤 없음**

## 6) 검증

- `type-check` 통과 ✅ · `build` 통과 ✅
- 적대적 검증(3관점→재검증) 12건 중 6 confirmed → **5건 수정**:
  - EQ_STATE `color` 미사용 데드코드 제거
  - Drawer 명세 외 필드(용도·제조사) 제거 → 명세 8필드
  - 카테고리 현황에 '도입예정' 집계 추가(총합 일치)
  - 주목 장비 카드 강조(전체 목록과 시각 구분, 왼쪽 컬러보더 규칙 준수)
  - (제외) EqKpi 하드코딩 → 이미 미사용 죽은코드(정리 과제)
- 후속: EqKpi·EqSummaryInner 등 죽은 코드 정리 과제(task_8aca1bbf)

## 7) 개선 전/후

| 항목 | Before | After |
|------|--------|-------|
| 성격 | 상태 숫자 + 예산 KPI 나열 | **운영 상황판** |
| 비가동/주목 | 숫자만 | **주목 장비 섹션(우선순위 상위 5)** |
| 카테고리 | 없음 | **카테고리별 현황 카드** |
| 예산 | 대형 KPI 카드(이미지) | **Compact Card** |
| 전체 목록 | 없음 | **필터·검색 + 카드→Drawer** |
| 스타일 | 레거시 CSS·이미지 | 디자인 시스템(대시보드/업무와 동일 밀도) |

## 확인 URL
`http://localhost:3600/#/equipment-ops`

## 다음 단계
STEP 8 — 장비도입관리(/equipment)·공지·바로가기 등 잔여 페이지 이관. (마감 기반 기능은 STEP10+)
