# STEP 27 — 업무현황 상단 KPI UX 개편 (진행중 중심)

> 작업일: 2026-06-16 · 범위: **업무현황(/work) 최상단 KPI 카드 섹션 + 연동 상태 로직만**. 하단 목록/레이아웃/사이드바 미변경.

## 개편 내용
기존 KPI 5개(`진행중 / 완료 / 전체 / Check / Remind`) → **3축**으로 재편(우선순위: 진행중 > Check > Remind > 완료·전체).

1. **진행중 카드(메인)** — 가장 크게(flex 2). 좌측 진행중 건수(34px), 우측에 **임베드 Check 서브카드**(약 1/3 폭, 보라 톤 `Check · 건수 · "센터장 검토 필요"`).
   - 임베드 Check는 **표시 전용**(자체 onClick 없음 → 클릭은 진행중 카드로 위임). 독립 KPI 아님.
   - 진행중 카드 클릭 → 하단 목록 진행중 필터(기본값).
2. **Remind 카드** — 기존 유지(클릭 시 KPI 아래 Remind 목록 펼침/접힘 `remindOpen`). 폭만 정리.
3. **완료 / 전체 통합 카드** — `완료 / 전체` 요약(`{done} / {total}` + "완료된 업무 / 전체 업무"). 클릭 시 전체 목록.

## Check 시각 구분 (진행중 ↔ 목록 연동)
- 진행중 뷰(`tab==='inProgress'`)에서 **Check 업무(`t.chief`) 카드는 보라 테두리**(2px, `accent.purple`)로 강조. → `TaskAccordion`에 `highlight` prop 추가.
- 임베드 Check 카드의 보라 톤과 시각적으로 연결.

## 변경 파일
- `src/pages/Work/index.tsx` — KPI 섹션 3카드 재구성(진행중+임베드 Check / Remind / 완료·전체), `chiefOnly` 상태·필터 제거(Check 단독 필터 폐지 → 진행중 내 강조로 대체), 진행중 목록에 `highlight` 전달.
- `src/pages/Work/TaskAccordion.tsx` — `highlight` prop(보라 테두리).

## 동작/주의
- type-check·build 통과.
- **완료 단독 필터는 KPI에서 직접 진입 불가**(완료/전체 통합 → 전체 목록). 완료 업무는 전체 목록에 포함. (완료 de-prioritize 의도 반영 — 필요 시 완료 전용 필터 재추가 가능)
- 다크 테마·하단 목록/레이아웃 미변경.
