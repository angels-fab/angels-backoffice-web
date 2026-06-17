# STEP 27 — 업무현황 상단 KPI UX 개편 (진행중 중심)

> 작업일: 2026-06-16 · 범위: **업무현황(/work) 최상단 KPI 카드 섹션 + 연동 상태 로직만**. 하단 목록/레이아웃/사이드바 미변경.

## 개편 내용
기존 KPI 5개(`진행중 / 완료 / 전체 / Check / Remind`) → **3축**으로 재편(우선순위: 진행중 > Check > Remind > 완료).

- **공통 레이아웃**: 세 카드 **동일 너비**(CardGrid 3열), 내부는 **상태 칩(좌, size=medium·크게) + 건수(우)** 가로 배치로 카드를 가득 채움.
1. **진행중 카드(메인)** — 메인 행(진행중 칩 + 건수 34px) 아래에 **임베드 Check 서브카드**(보라 톤, `Check + 건수`만 — 설명 문구 없음).
   - 임베드 Check는 **표시 전용**(자체 onClick 없음 → 클릭은 진행중 카드로 위임).
   - 진행중 카드 클릭 → 하단 목록 진행중 필터(기본값).
2. **Remind 카드** — 칩(warning)+건수. 클릭 시 KPI 아래 Remind 목록 펼침/접힘(`remindOpen`, 유지).
3. **완료 카드** — **회색(neutral) `완료` 칩** + 완료 건수만('전체'·보조문구 제거). 클릭 시 완료 목록(`tab='done'`).

## Check 시각 구분 (진행중 ↔ 목록 연동)
- 진행중 뷰(`tab==='inProgress'`)에서 **Check 업무(`t.chief`) 카드는 보라 테두리**(2px, `accent.purple`)로 강조. → `TaskAccordion`에 `highlight` prop 추가.
- 임베드 Check 카드의 보라 톤과 시각적으로 연결.

## 변경 파일
- `src/pages/Work/index.tsx` — KPI 3카드 동일너비(CardGrid 3열)·칩(좌)+건수(우), 진행중 내 임베드 Check, 완료 회색 칩(완료 건수만), `chiefOnly` 상태·필터 제거(진행중 내 강조로 대체), 진행중 목록에 `highlight` 전달. (StatTile import 제거)
- `src/pages/Work/TaskAccordion.tsx` — `highlight` prop(보라 테두리).

## 동작/주의
- type-check·build 통과. 다크 테마·하단 목록/레이아웃 미변경.
- 완료 카드 클릭 = 완료 목록(`tab='done'`). 전체 목록 진입 KPI 타일은 없음(필요 시 추가 가능).
