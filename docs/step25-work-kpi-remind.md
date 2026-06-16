# STEP25 — 업무현황 KPI 정리 + Remind 토글/카드 재구성

> 작성: 2026-06-16 · 상태: 구현 완료(프런트 전용), type-check + build 통과, 라이브 dev 검증 완료. 자동배포.

## 변경 사항
1. **KPI 카드 정리**: 상단 KPI에서 **보류·취소 타일 제거**. 4타일로 = 진행중 · 완료 · **Check**(구 ‘검토’) · **Remind**(신규).
   - ‘검토’ → ‘Check’로 단어 변경(KPI 타일 + 목록 필터칩 + 컴팩트행/아코디언 chief 칩 + 상세 Drawer 모두 통일). 단, 카테고리명 ‘설계적정성검토’·관리자 등록폼 설명·검색 키워드의 ‘검토’는 데이터/별개라 유지.
   - 보류·취소는 **목록 하단 상태 필터칩에는 그대로 유지**(KPI 타일에서만 제거).
2. **Remind 위치 = 토글**: 하단 상시 카드 섹션을 제거하고, **KPI ‘Remind’ 타일 클릭 시 KPI 바로 아래(업무목록 사이)에 펼침/접힘**. 기본 접힘.
3. **Remind 카드 재구성**(`TaskCard`): ‘Remind’ 칩 → **압정 아이콘(PushPinIcon, 맨 좌측)**. 최상단 행 = `압정 · 업무상태 · 업무구분 · 담당자 · 날짜`. 날짜는 **년-월-일(YYYY-MM-DD, fmtDate)**. ‘발의’ 글자 전부 삭제(기존 `발의 MM/DD` 보조텍스트 제거).

## 수정 파일
- `src/pages/Work/index.tsx` — KPI 4타일(보류/취소 제거·Check·Remind 타일), `remindOpen` 토글 상태, Remind 섹션을 KPI↔업무목록 사이 조건부 렌더로 이동, Check 라벨, 미사용 `MD`/`parseStartDate` 정리.
- `src/pages/Work/TaskCard.tsx` — 압정 아이콘 최상단 + 상태/구분/담당자/날짜(YYYY-MM-DD), Remind/검토 칩·right(발의) 제거.
- `src/pages/Work/TaskAccordion.tsx`·`TaskDetailDrawer.tsx` — chief 칩 ‘검토’→‘Check’ 통일.

## 검증 결과
- `npm run type-check` 통과 / `npm run build` 통과.
- 라이브 dev(`/work`, 서버 재기동 후): KPI 4타일(진행중·완료·Check·Remind, 보류/취소 없음) / Remind 타일 클릭→KPI 아래 펼침·재클릭 접힘 / Remind 카드 압정+상태+구분+담당자+YYYY-MM-DD(‘발의’ 없음, Remind 칩 없음) / ‘검토’ 칩 → ‘Check’ / 콘솔 에러 0.
  - (편집 중 HMR 중간상태 에러 로그가 떴으나 서버 재기동 후 0으로 확인 — 코드 결함 아님.)
- 스크린샷: `preview_screenshot` 환경 타임아웃 → DOM 검증 대체.

## 남은 개선 후보
- WorkWrite(등록/수정 폼)의 ‘검토 필요’ 라벨도 ‘Check’로 통일할지(현재 설명형이라 보류).
- Remind 토글에 펼침 애니메이션(Collapse) / 카테고리 ‘설계적정성검토’ 명칭 축약 검토.
