# STEP 11 — 통합검색 (완료 보고)

> 작업일: 2026-06-14
> 8개 메뉴로 늘어난 포털에서 원하는 정보를 빠르게 찾도록 **통합검색**을 추가. 기존 Google Sheet 기반 아키텍처 유지(새 DB·검색엔진·인덱싱 없음).

---

## 무엇을 했나

우측 상단 헤더에 **검색 아이콘**을 추가하고, 클릭(또는 **Ctrl/⌘+K**)하면 **통합검색 Dialog**가 열립니다. 검색어를 입력하면 4개 데이터 소스를 **클라이언트 메모리에서** 한 번에 검색하고, 결과를 소스별로 그룹화해 보여줍니다. 결과를 클릭하면 해당 페이지로 이동하며, 가능한 경우 **상세 Drawer가 자동으로 열립니다.**

## 검색 대상 (4개 소스)

| 소스 | 검색 필드 | 상태 칩 | 이동 |
|------|-----------|---------|------|
| **공지사항** | 제목·작성자·분류·내용 | 분류색 | `/notice/:num` (기존 딥링크 → 상세 Drawer) |
| **업무현황** | 제목·담당자·분류·상태(진행중/지난/Remind/센터장) | 상태색 | `/work?focus=<id>` → TaskDetailDrawer |
| **장비도입관리** | 장비명·담당자·도입방법·진행단계 | 단계색 | `/equipment?focus=<장비명>` → EqProjectDrawer |
| **장비운영관리** | 장비명·분류·담당자·상태 | 상태색 | `/equipment-ops?focus=<장비명>` → EqDetailDrawer |

- 공지 **내용**은 HTML 태그를 제거한 텍스트로 검색.
- 업무 **상태**·장비도입 **진행단계**는 시트 원본이 아닌, 각 페이지와 동일한 파생 로직(`workMeta.classify`, `stageMeta.groupStage/phaseChip`)으로 계산해 검색·표시.

## 검색 동작

- 입력어를 **공백으로 분리**해 모든 토큰이 포함된 항목만 매칭(AND, 대소문자 무시).
- 결과 그룹별 상한 20건(초과 시 "외 N건" 안내 — 묵시적 잘림 없음).
- 데이터는 **MainLayout이 앱 진입 시 미리 로드**해 둔 Redux store를 그대로 읽음 → 별도 fetch·인덱싱 없음.
- 빈 검색어: 안내 + 4개 소스 칩. 결과 없음: 전용 **EmptyState**.
- **Enter** → 첫 결과로 이동. 항목 클릭/Enter/Space로 이동(키보드 접근성).

## 결과 클릭 → 페이지 이동 + Drawer 자동 오픈

- 공지: 기존 `/notice/:num` 라우트 딥링크 재사용.
- 나머지 3개 페이지: **`?focus=` 쿼리파라미터**를 추가. 페이지가 `useEffect`로 파라미터를 읽어 해당 항목의 Drawer를 열고, 처리 후 파라미터를 제거(`replace`)해 URL을 깨끗이 유지.
  - 키: 업무=`WorkItem.id`, 장비=`EqGroup.name`(둘 다 store와 동일·고유).

## 구현 파일

| 파일 | 내용 |
|------|------|
| `src/components/GlobalSearchDialog.tsx` (신규) | 통합검색 Dialog — 4소스 검색·그룹화·이동·EmptyState |
| `src/layouts/TopBar.tsx` | 검색 아이콘 버튼 + Ctrl/⌘+K 단축키 |
| `src/pages/Work/index.tsx` | `?focus=<id>` → 업무 상세 Drawer 자동 오픈 |
| `src/pages/EquipmentOps/index.tsx` | `?focus=<장비명>` → 장비 상세 Drawer 자동 오픈 |
| `src/pages/Equipment/index.tsx` | `?focus=<장비명>` → 도입 프로젝트 Drawer 자동 오픈 |

기존 디자인 시스템 컴포넌트(SearchBar·StatusChip·EmptyState) 재사용, 색은 StatusKind/테마 팔레트만 사용(하드코딩 없음).

## 검증

- `npm run type-check` 통과 ✅
- `npm run build` 통과 ✅
- 멀티에이전트 3-렌즈 리뷰(정확성·디자인일관성·엣지케이스, 24건 발견) → 적대적 검증(21건) 수행.
  - 검색 핵심 로직 관련 high 지적(focus decodeURIComponent·id 타입·라우트 불일치·race·다이얼로그 반응형 등)은 **전부 거짓양성으로 기각**(이미 처리됨/의도된 동작). `searchParams.get`은 자동 디코딩, `String(id)===focus` 매칭, `stripHTML` 본문 검색 적용 등 확인.
  - 진짜 문제 **2건 수정**(둘 다 *기존* 인터랙티브 행의 접근성 일관성, STEP11 신규 코드 아님):
    1. 장비도입관리 간트 행: `aria-label` + `focus-visible` 추가(다른 행 컨벤션과 일치).
    2. 업무현황 목록 행: `focus-visible` 추가.

## 비고
- 장비운영/도입은 동일 `eq.groups`를 두 관점(자산현황 / 도입 프로젝트)으로 검색하므로, 한 장비명이 두 그룹에 모두 나타날 수 있음(서로 다른 페이지·Drawer로 이동) — 명세의 4소스 모델과 일치.
- 향후 마감/지연 등 새 필드가 생기면 검색 필드에 추가만 하면 됨.
