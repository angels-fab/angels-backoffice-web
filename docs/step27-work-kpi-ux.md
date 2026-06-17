# STEP 27 — 업무현황 상단 KPI UX 개편 (진행중 중심)

> 작업일: 2026-06-16 · 범위: **업무현황(/work) 최상단 KPI 카드 섹션 + 연동 상태 로직만**. 하단 목록/레이아웃/사이드바 미변경.

## 개편 내용 (최종)
KPI 5개 → **3카드 동일 너비**(CardGrid 3열). **단일 선택**(`view`: inProgress/remind/done) — 한 번에 하나만 선택, 같은 카드 재클릭해도 해제되지 않고, 다른 카드 클릭 시 자동 전환. 선택된 카드가 하단 목록을 결정.

1. **진행중 카드(메인)** — 좌상단: **진행중 정사각 칩(라운드, 60px, 큰 글자)** + 그 우측에 건수. 우하단: **Check 건수(보라)** 위 + **Check 칩(보라)** 아래(표시 전용, 클릭은 진행중 카드로 위임). 진행중 선택 시 하단 진행중 목록의 Check 업무 = 보라 테두리 강조.
2. **Remind 카드** — 칩(좌)+건수(우). 선택 시 하단에 Remind 목록(압정 카드) 표시.
3. **완료 카드** — 회색 `완료` 칩(좌) + **`완료건수/전체건수 건`**(예 `116/124 건`). 선택 시 완료 목록.

**선택 상태 표시**: 선택된 카드 테두리 = 칩 색(진행중 초록·Remind 앰버·완료 회색), 내부 채움 = 같은 색의 옅은 톤(alpha ~0.1).

## Check 시각 구분 (진행중 ↔ 목록 연동)
- 진행중 뷰(`tab==='inProgress'`)에서 **Check 업무(`t.chief`) 카드는 보라 테두리**(2px, `accent.purple`)로 강조. → `TaskAccordion`에 `highlight` prop 추가.
- 임베드 Check 카드의 보라 톤과 시각적으로 연결.

## 변경 파일
- `src/pages/Work/index.tsx` — KPI 3카드 단일 선택(`view`), 진행중 카드 내부 재배치(정사각 칩+건수 / Check 건수+칩), 완료 `done/total 건`, 선택색=칩색+옅은 채움. `tab`/`remindOpen`/`pickStatus`/`compactRow`/`urgent` 제거 → `view`/`selectView`로 통합. Remind는 별도 펼침 패널 → 단일 선택 뷰로 흡수(선택 시 하단에 Remind 목록).
- `src/pages/Work/TaskAccordion.tsx` — `highlight` prop(보라 테두리).

## 동작/주의
- type-check·build 통과. 다크 테마·하단 목록 렌더 스타일·레이아웃 유지.
- 단일 선택이므로 '전체' 뷰 진입 KPI는 없음(완료=완료만, Remind=Remind만, 진행중=진행중만). 필요 시 '전체' 카드 재추가 가능.
