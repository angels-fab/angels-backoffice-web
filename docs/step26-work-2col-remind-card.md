# STEP26 — 업무현황 KPI 전체타일 + 목록 2열 + Remind 카드/들여쓰기

> 작성: 2026-06-16 · 상태: 구현 완료(프런트 전용), type-check + build 통과, 라이브 dev 검증 완료. 자동배포.

## 변경 사항
1. **Remind 카드 담당자 위치**: 최상단 행에서 담당자명을 우측으로 보내 **날짜와 붙여** 그룹화(담당자에 `ml: auto`). 행 = `압정 · 상태 · 구분 … (우측)담당자 · 날짜`.
2. **상태 칩 행 제거 + 전체 KPI 타일**: 업무목록 제목 아래 상태 카운트 칩(전체/진행중/완료/보류/취소) 행을 **삭제**. 대신 KPI에 **‘전체’ 타일을 완료·Check 사이**에 추가. KPI = `진행중 · 완료 · 전체 · Check · Remind`(5타일). 보류·취소는 더 이상 필터로 노출하지 않음.
3. **목록 2열 정렬**: 진행중·완료·Check 목록을 **2열 아코디언 그리드**(`CardGrid columns={2}` → 데스크톱/태블릿 2열, 모바일 1열로 자동 줄바꿈)로. **진행중=기본 펼침**, **완료·Check=기본 접힘**(`TaskAccordion defaultExpanded`). 전체는 컴팩트 행 유지.
4. **글머리기호 들여쓰기**: 업무 내용 줄이 자동 줄바꿈될 때 `-`·번호 등 글머리기호 아래로 본문이 들여쓰기(행잉 인덴트)되도록, 기존 Drawer의 SubLine 로직을 공용 컴포넌트 `Work/SubLine.tsx`로 추출해 아코디언·Drawer 공통 사용.

## 수정 파일
- `src/pages/Work/index.tsx` — KPI 5타일(전체 추가), 상태칩행 + `STATUS_CHIPS`/`statusCount`/`W_STATUS_TABS` import 제거, 목록을 `(chiefOnly || 진행중 || 완료)` 시 `CardGrid columns={2}` 아코디언 그리드(진행중만 defaultExpanded).
- `src/pages/Work/TaskCard.tsx` — 담당자 `ml: auto`(날짜와 우측 그룹화).
- `src/pages/Work/TaskAccordion.tsx` — `defaultExpanded` prop 추가, 본문을 `SubLine`으로 렌더(들여쓰기).
- `src/pages/Work/SubLine.tsx` (신규) — 글머리기호 행잉 인덴트 공용 컴포넌트.
- `src/pages/Work/TaskDetailDrawer.tsx` — 로컬 SubLine 제거 → 공용 `SubLine` import.

## 검증 결과
- `npm run type-check` 통과 / `npm run build` 통과.
- 라이브 dev(`/work`, 서버 재기동 후): KPI 5타일(진행중8·완료116·전체124·Check1·Remind13, 전체가 완료/Check 사이) / 상태칩행 없음 / 진행중 2열 펼침(1280px=496×2)·완료 2열 접힘(116) / Remind 타일 토글→압정 카드(담당자+날짜 우측, YYYY-MM-DD) / 글머리기호 분리(마커+본문) / 콘솔 에러 0.
- 스크린샷: `preview_screenshot` 환경 타임아웃 → DOM 검증 대체.

## 남은 개선 후보
- 2열 분기점(현재 sm 600px) 조정 / 완료·Check ‘모두 펼치기’ 토글.
- 보류·취소 필터 재노출 경로(필요 시) / WorkWrite ‘검토 필요’ 라벨 ‘Check’ 통일.
