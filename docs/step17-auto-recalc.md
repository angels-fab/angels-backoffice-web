# STEP17 — 자동 재계산 (총소요기간·도입예정월·KPI·파이프라인)

> 작성: 2026-06-15 (사무실 PC) · 상태: **완료 (기존 반응형 구조로 충족 — 신규 코드 없음)**

## 결론
STEP15~16.5의 **"timeline 단일 파생"** 구조 덕분에 자동 재계산이 **이미 동작**한다. 이동(STEP15)·리사이즈(STEP16)로 `timeline`이 바뀌면 아래 값이 **저장 전에도 실시간 재계산**된다(React useMemo 파생).

| 항목 | 계산 위치 | 표시 |
|---|---|---|
| 도입 예정월 | `groupStage(timeline).dueMonth` | 카드·Drawer |
| 총 소요기간 | `groupStage(timeline).durationMonths` | Drawer (저장값 아닌 **파생값**) |
| KPI(전체/진행중/완료/착수전) | `overview`(enriched 파생) | StatTile |
| 단계 파이프라인 | `overview.tally` | RatioBar |

## 영속(저장)
- 시트 `총소요기간`은 **"(자동)" 수식 컬럼** → stages만 저장하면 시트가 재계산(Code.gs는 총소요기간을 기록하지 않음 — 616줄 주석). 새로고침 시 반영.

## 검증
- 라이브: KPI 타일·파이프라인·카드 도입예정월 렌더 확인(파생 소스 = `timeline`/`schedule` useMemo). 이동/리사이즈 → `timeline` 변경 → useMemo 재계산 → 즉시 반영.
- **신규 코드 없음** — 아키텍처로 충족. 사용자 (A) "이대로 충분" 결정으로 마감.

## 향후(선택, 필요 시 별도 단계)
- 카드/요약에 총소요기간 노출 강화, dirty(미저장 변경분) 시각 강조.
