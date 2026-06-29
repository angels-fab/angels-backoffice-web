# Bridge State

## Current Goal

- Keep Claude Code and Codex synchronized through repository files.
- Use this file as the compact shared memory for the current work stream.
- Enforce the agreed role split (기준: 루트 `AGENTS.md`): Claude Code implements and syncs git; **Codex = 사용자용 UX/UI/기능 자문위원**(요약·의미설명·선택지·추천). Codex는 사용자가 명시 요청하지 않는 한 Claude용 프롬프트를 작성하지 않음.

## Current Focus

- **A.브랜드 ANGELS PORTAL 개명 + B.포털개선요청 답글기능 + C.업무일정 UX 보완 구현·검증(2026-06-28)**:
  - **A**: 탭 제목·TopBar·package.json 브랜드를 `ANGELS PORTAL`로. TopBar는 합본 로고(ANGELS마크|FAB구축포털시스템)를 좌측 마크만 CSS 크롭(`.topbar-logo-wrap` 36px) + `ANGELS PORTAL` 텍스트. FAB 구축 로드맵/구축팀 등 **업무 명칭은 미변경**.
  - **B (답글)**: 신규 시트 `포털개선답글`(헤더: 답글ID·요청번호·작성일시·작성자·답글내용·수정일시·삭제여부). `Code.gs` 추가: `replyCtx_`(헤더탐지·시트없으면 생성)·`getReplies_`(doGet `action=getReplies`, 삭제 제외)·`createReply_/updateReply_/deleteReply_`(doPost, LockService, 관리자 인증, 본인작성만 수정/삭제, **소프트삭제** 삭제여부=TRUE). `api/sheets.ts` `fetchReplies/createReply/updateReply/deleteReply`. 신규 `replySlice`(loadReplies + 낙관적 add/patch/remove) store 등록, MainLayout 진입로드. Improve 페이지: 제목옆 파란 `답글 +N` 칩(점 없음·삭제 제외 집계), **단일오픈 아코디언**(openId), 펼침영역에 원문+`ReplyThread`(시간순 목록·작성자·YYYY-MM-DD HH:MM·수정됨·본인 인라인수정·삭제확인 Dialog·관리자 입력창). N+1 없이 1회 로드 그룹화. **백엔드 git 커밋만, clasp 배포는 사용자 승인 후**(미배포 시 프런트는 빈 답글·등록 시 에러로 graceful degrade).
  - **C**: 해당자칩 원형→**알약(이름)+뒤쪽 초승달 조각**(`ChipContent` PillStack, 첫칩 z-top, 깊게겹침). 단일=칸 우측끝·멀티데이=첫칸 우측끝(groupRef 측정). 호버 상세 **포인터 추적**(`.fc-team` onMouseMove, 호버 pointerEvents:none로 깜빡임 방지)·클릭 고정. 빈영역/멀티데이 구간 hit OK(FC eventMouseEnter/Click). 주간 2줄 해당자 **우측정렬**. 팀원탭 원형→**알약(이름 크게)**(`CalFilterBar` MemberPill).
  - 검증: type-check+build 통과. 라이브 dev: A 로고/탭=ANGELS PORTAL(FAB 누출 없음), C 알약칩·크레센트·멀티데이 첫칸·호버추적(left634→414)·클릭고정·주간2줄 우측·콘솔0, B 아코디언/입력창/빈상태 렌더·degrade OK. 적대적 리뷰 12에이전트(9건중 1확정=답글 낙관적추가 created 폴백, 수정). **잔여(사용자)**: ① Apps Script `clasp` 배포 승인(답글 동작) ② (선택)`포털개선답글` 시트 자동생성됨.
- **캘린더 해당자·상세·포털 새글 규칙 전면 개편 구현·검증 완료(2026-06-28)**: ① 월간 해당자 = 첫 칩 이름 + 나머지 초승달 포개기(첫번째 z-top), 단일=칸 우측끝·멀티데이=첫칸 우측끝(제목 길면 제목 뒤로, 측정기반 `ChipContent` reserve). ② 주간(timeGridWeek) 여러 시간칸 일정=2줄(아이콘·시간·제목 / 전체 해당자 이름, +N 없음). ③ 상세=원본 제목 그대로(`rawTitleNoTags`, 장소-목적 파싱 폐지) + 시간 + 전체 해당자. ④ 호버/클릭 상세를 MUI Tooltip→**마우스 위치 커스텀 팝오버**(`EventPopover`, 뷰포트 보정·빈영역 클릭·멀티데이 각 구간, z-index 10000). ⑤ 해당자 없으면 센터(`eventMembers`). ⑥ 새글 공용 유틸 `utils/newPost`(isNoticeNew/isWorkNew/isImproveNew) — 페이지 N과 사이드바 **동일 함수**. `isRecentNew` 창=등록일 포함 7일(diff 0~6). 공지=게시일7일+종료제외 / 업무=진행중+발의7일(완료·Remind 제외, Check 무관) + 진행중 카드에 N배지(`TaskAccordion`) / 개선=접수·검토중·보류+7일(완료·불가 제외). 업무일정 사이드/하단 배지 제거. ⑦ 사이드 배지 재설계: 새글=행 우측끝 빨강 숫자(볼드X·0숨김·99+) / 개선메모=메뉴명 우상단 노란 점(숫자 없음, 관리자 전용). **프런트 전용**, type-check+build 통과, 라이브 dev 적대적 리뷰(9건 중 1확정=팝오버 z-index, 수정) + 브라우저 검증(콘솔0). 잔여 정리: WeekBoard.tsx·ChipTooltip.tsx 데드코드(별도 정리).
- **사이드 배지 + 캘린더 한 줄 칩 개편 구현·검증 완료(2026-06-28)**: ① PC 사이드 메뉴 위첨자 배지를 아이폰 알림 스타일로 — 새글=빨강·개선메모=노랑 원형, 색+숫자만(N·아이콘 제거), 메뉴명 뒤 나란히, 15px, 0숨김/99+. 기존 행우측 회색 pill 제거(`SideNav.tsx`+`index.css` `.snav-labelwrap`/`.sup-badge`). ② 업무일정 월간 캘린더 칩을 **한 줄**로(`ChipContent.tsx` 재작성, `dense` 제거): 구분아이콘→시간→장소목적→해당자칩, 종일·멀티데이 포함. 해당자는 제목 바로 옆(5px), 우측 끝 안 밀림(title flex:0 1 auto). ③ 호버 상세 신규 `ChipTooltip.tsx`+`members.splitPlacePurpose()`: 칩은 "장소-목적" 그대로, 호버서만 목적=제목·장소=세부정보 분리(월간·주간 공통). **프런트 전용**, type-check 통과, 라이브 dev 검증(콘솔0). 상세: bridge `inbox/claude-to-codex.md`.
- **STEP27(새 업무 인라인폼 개편 + 완료 다이얼로그 Remind 체크박스) 구현·검증 완료**: 진행중 인라인 새업무 카드 입력 보조 개편 + 완료 확인 다이얼로그 Remind 토글. 신규 공용 위젯 `Work/inlineFields.tsx`(ComboField 드롭다운+자동완성 / DateField 한글라벨'발의일자·예정일'+showPicker / TimeRangeField 시작·종료 wheel picker→"HH:MM ~ HH:MM" / LinkButton 제목우측 외부링크 팝업 / AttachButton 준비중 자리만). 구분·담당자·부서·장소 옵션은 전체 업무 히스토리(items)에서 수집(index.tsx `fieldOptions`). 완료시 `updateWork({remind: 체크값})`. **프런트 전용(시트/백엔드 무변경)**, type-check+build 통과, 라이브 dev 검증(콘솔0). 상세: `docs/step27-newtask-form-revamp.md`. ⚠ 구분·담당자는 freeSolo(드롭다운+직접입력) — 엄격 드롭다운 원하면 추후 조정.
- **STEP26(업무 KPI 전체타일·목록 2열·들여쓰기) 커밋·자동배포 완료**: KPI에 '전체' 타일(완료/Check 사이) + 상태칩행 제거 · 진행중/완료/Check 목록 2열 아코디언(진행중 펼침/완료·Check 접힘, `CardGrid columns={2}` 반응형) · Remind 카드 담당자 우측(날짜와 그룹) · 글머리기호 행잉 인덴트(공용 `Work/SubLine.tsx`). 프런트 전용.
- **STEP25(업무현황 KPI/Remind 정리) 커밋·자동배포 완료**: KPI 보류·취소 타일 제거→진행중/완료/Check/Remind 4타일 · '검토'→'Check'(chief 칩 전부) · Remind는 KPI 타일 토글로 KPI 아래 펼침(하단 상시섹션 제거) · Remind 카드 압정아이콘+상태/구분/담당자/날짜(YYYY-MM-DD)·'발의' 삭제. 프런트 전용. (이하 STEP23·24·어휘개편도 모두 배포 완료 — 아래 '미커밋' 표기는 과거 스냅샷.)
- **STEP24(업무현황 회의 뷰)**: /work 개편 — 업무목록을 KPI 바로 아래로, 기본 진행중, 진행중=아코디언(모두 펼침·개별 접기, 신규 `Work/TaskAccordion.tsx`), RatioBar 제거, '긴급 업무'→'Remind', 담당자현황 숨김(`SHOW_MANAGER_STATUS=false`, 코드 보존), 검토필요→'검토'. 프런트 전용. type-check+build 통과, 라이브 검증 + 적대적 리뷰(9건 중 3확정: TaskCard 라벨·아코디언 장소중복 수정, urgent 변수명은 지시대로 미수정).
- **STEP23(상태 변경 사유 입력, 미커밋)**: 즉시저장 → 확인 Dialog(장비명·관리번호·전→후·사유 optional·trim) → `updateEquipment({state, reason})`, 운영이력에 사유 기록, 같은상태 no-op, 이력 표시 '작성자 · 사유'. 프런트 전용(**백엔드 변경/배포 없음** — reason은 STEP22부터 기록). type-check+build 통과, 라이브 dev에서 Dialog 흐름·no-op·취소 확인(콘솔0).
- **장비 상태 어휘 개편(사용자 직접 요청, 미커밋)**: 표시 라벨 매핑 폐지 → 시트값 그대로 표시. 정식 4값 `도입예정/도입중/운영중/비가동`(가동중→운영중, 설치중→도입중으로 통일). 4값 외(오타·빈값·레거시 '가동중')는 상태칩에 **'미분류'**(neutral). type-check+build 통과, 라이브 dev 검증(KPI 라벨 verbatim, E-Beam Lithography='미분류', 콘솔0). **⚠ 마이그레이션 필요**: 시트의 기존 '가동중' 등을 새 4값으로 고쳐야 함(안 고치면 미분류로 표시). 변경 파일: types/index.ts·eqMeta.ts·selectors.ts·EquipmentOps/index.tsx·EqDetailDrawer.tsx·Home/dash/(KpiOverview·EquipmentSection)·previews.tsx·EqSummaryInner.tsx·EqItem.tsx.
- STEP22 phase 1(장비 운영이력) implemented + reviewed + fixed + **DEPLOYED & LIVE & E2E-VERIFIED** (frontend `87a71c0`; backend clasp **@42**). Live E2E: a user-performed admin status change on **CL-001 (Spin Coater)** auto-created `장비운영이력` with 2 rows (도입예정→도입중→가동중); `?action=getEqHistory` returns them. Review-fix pass applied (menu compares raw state; explicit history error/loading).
- Backend `Code.gs`: append-only `장비운영이력` sheet (`appendEqHistory_`/`getEqHistory_`), and `updateEquipment_` appends one row only when state actually changes. Frontend: `fetchEqHistory` + read-only 운영 이력 drawer section.
- 3-lens adversarial review found 8, confirmed 3 (1 med stale-history race, 2 low: label fallback, dup repCode) — all fixed in `EqDetailDrawer.tsx` (unified guarded load via refreshTick; raw label for non-standard states; single repCode). 5 refuted.
- STEP21 status dropdown + anchorEl guard are now committed (`87a71c0`) and live.

## Last Known Verification

- 2026-06-28: ANGELS PORTAL 개명 + 답글기능 + 일정 UX. `npm run type-check`+`npm run build` 통과. 라이브 dev(admin): A=탭/브랜드 'ANGELS PORTAL'·로고 크롭(FAB 누출 없음). C=알약 해당자칩·2인 크레센트(현진+조각)·멀티데이 첫칸 우측끝(여수/부산)·호버 상세 포인터추적+pointerEvents none·클릭 고정(이동 안함)·빈영역 hit(여수 우측 빈칸 호버 OK)·주간 tall 2줄 우측정렬·팀원 알약탭·콘솔0. B=Improve 아코디언 단일오픈·입력창/빈상태 렌더(백엔드 미배포라 답글 0·등록 시 graceful 에러). 적대적 리뷰 12에이전트(9→1확정: 답글 created 폴백 수정). **답글 동작은 clasp 배포 후**(사용자 승인 대기). 프런트는 커밋·자동배포 진행.
- 2026-06-28: 캘린더 해당자·상세·새글 규칙 개편. `npm run type-check`+`npm run build` 통과. 라이브 dev(admin) 검증: 월간 단일=칸 우측끝(trailingGap 0)·멀티데이 첫칸 우측끝(여수 2칸 left187/cell204·부산 3칸·긴제목 강제시 left336>204 말줄임X)·첫칩 이름+초승달·센터 fallback / 주간 tall 일정 2줄(height359 column, 세리·성범) / 호버=마우스 근처 표시·leave 닫힘·클릭=빈영역서도 고정·뷰포트 내·원본제목 "동탄(ZEISS)-FIB 데모테스트"·"국내(한양대)-..." 그대로 / 사이드 공지[빨강1]·업무일정[노란점·숫자없음]·개선[빨강1] / 공지 종료건 N제외·개선 페이지N=사이드(검토중1)·업무 새업무0(진행중6 모두 발의7일초과, page=side 일치). 콘솔 에러0. 적대적 리뷰 12에이전트(9findings→1확정: 팝오버 z-index 1350<FC더보기팝오버 9999 → 10000으로 수정). **커밋·자동배포 진행.**
- 2026-06-28: 사이드 배지 + 캘린더 한 줄 칩 개편. `npm run type-check` 통과. 라이브 dev(1280px, admin) 검증: 사이드 공지[2빨강]·업무일정[6빨강][1노랑]·업무현황[6빨강](계산값 #E05B54/#D6A23E·h15px); 캘린더 전 칩 한 줄(20~25px)·멀티데이 3건 해당자 옆(측정 titleToLast=5px)·호버 Tooltip 목적/장소 분리. 콘솔 에러 0. 프런트 전용. **커밋·자동배포 진행.**
- 2026-06-15: Claude reported `npm run type-check` and `npm run build` passed for STEP21.
- 2026-06-16: Codex ran `npm.cmd run type-check`; passed.
- 2026-06-16: Claude ran browser/admin verification in dev; dropdown and guest gating OK.
- 2026-06-16: Claude added `anchorEl` guard to status `Menu`; type-check passed.
- 2026-06-16: Codex re-ran `npm.cmd run type-check`; passed.
- 2026-06-16: Claude implemented STEP22 phase 1 + review fixes; `npm.cmd run type-check` + `npm.cmd run build` passed; fresh dev server runtime had 0 console errors, drawer shows 6 sections incl. read-only 운영 이력 (empty handled gracefully while backend undeployed), admin gating intact.
- 2026-06-16: **DEPLOYED** — frontend GitHub Actions "Build and Deploy" success for `87a71c0`; backend `clasp redeploy @42`; live GET `?action=getEqHistory` returned `{status:ok, items:[]}`. Remaining: live admin status-change → history-record end-to-end check (needs a designated safe test equipment).
- 2026-06-16: Codex reviewed STEP22 phase 1 again and ran `npm.cmd run type-check` (passed). Follow-ups: raw non-standard state menu comparison, explicit history fetch error/loading state, and bridge/docs live-E2E verification inconsistency.
- 2026-06-16: **Live E2E CONFIRMED** — user performed an admin status change on CL-001 (Spin Coater) on the live site; `장비운영이력` auto-created with 2 rows (도입예정→도입중→가동중, 작성자 조성범, 01:35 KST); `?action=getEqHistory` returns them. (Side effect: CL-001 live state is now '가동중' — revert via UI if unintended.) Review-fix pass (raw-state menu compare + histError/loading) applied; `npm.cmd run type-check` passed.
- 2026-06-16: 장비 상태 어휘 개편(라벨매핑 폐지·운영중/도입중 verbatim·미분류 폴백) 구현. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev 검증(운영중/도입중 KPI 라벨, E-Beam Lithography 카드='미분류' 칩, 콘솔0). **미커밋** — 배포 전 시트 기존 '가동중' 값 마이그레이션 권장.
- 2026-06-16: STEP23(상태변경 사유 확인 Dialog) 구현. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev(@42): 상태 선택→확인 Dialog(장비명·관리번호·전→후·사유), 같은상태 no-op, 취소 정상, 콘솔0. 실 저장 성공경로는 라이브 데이터 변경이라 미수행(타입체크+STEP22 경로 재사용으로 갈음). **미커밋**.
- 2026-06-16: STEP24(업무현황 회의뷰) 구현 + 적대적 리뷰 수정. `npm.cmd run type-check` + `npm.cmd run build` 통과; 라이브 dev(/work): 업무목록 KPI 바로 아래·기본 진행중·아코디언7 모두 펼침·개별 접기(7→6)·전체탭→컴팩트행·Remind 워딩·담당자현황 숨김·'검토' 단축·장소 중복 해소(maxLoc=1)·콘솔0. **미커밋**.
- 2026-06-16: STEP23·24·상태 어휘 개편 **커밋·자동배포 완료**(f8bfee3). 이후 STEP25(KPI 보류/취소 제거·Check·Remind 토글·카드 재구성) 구현 + type-check/build 통과 + 라이브 dev 검증(서버 재기동 후 콘솔0, KPI 4타일·Remind 토글·압정카드·YYYY-MM-DD) → **커밋·자동배포 완료**. 운영 규칙=자동배포.
- 2026-06-16: STEP26(KPI '전체' 타일·상태칩행 제거·목록 2열 아코디언·SubLine 들여쓰기 공용화) 구현 + type-check/build 통과 + 라이브 dev(서버 재기동, 1280px) 검증(KPI 5타일 전체가 완료/Check 사이·진행중 2열 펼침/완료 2열 접힘·Remind 담당자 우측·글머리기호 분리·콘솔0) → **커밋·자동배포 완료**.

## Decisions

- Use `.agents/bridge` as the shared handoff area.
- Use role-specific inbox files to avoid overwriting each other's notes.
- Use `lock.md` before source edits when both agents may be active.
- For this repository, run type check with `npm.cmd run type-check` on Windows.
- Claude Code is responsible for development implementation and git push/pull.
- **Codex = 비개발자 사용자를 위한 UX/UI/기능 자문위원**(루트 `AGENTS.md` 기준): Claude 보고 요약·업무적 의미 설명·시각 예시/선택지·추천 제공. **사용자가 명시 요청하지 않는 한 Claude용 개발 프롬프트는 작성하지 않음**(이전 '다음 프롬프트 작성' 규칙은 폐지).
- Codex should avoid source edits, git sync, and screenshot capture unless the user explicitly overrides the role split.
- Immediate status apply is acceptable for now; do not add a confirm modal unless user feedback says it feels risky.
- Unknown non-empty equipment states may continue falling back to `비가동`, matching the existing count logic.
- STEP22 phase 1 uses a separate append-only sheet named `장비운영이력`.
- STEP22 phase 1 history columns: `일시`, `관리번호`, `장비명`, `이전상태`, `변경상태`, `사유`, `작성자`, `작업유형`, `비고`.

## Warnings

- Do not run destructive git commands unless the user explicitly asks.
- Do not let both agents edit the same file at the same time.
- Do not store credentials in bridge files.
- Do not have Codex and Claude Code implement changes concurrently.
- Do not mutate live equipment status unless there is a safe test record or explicit user approval.
- Do not deploy Apps Script until the user explicitly approves backend deployment.

## Next Handoff

- Codex(자문위원): STEP23·24·25·26 + 상태 어휘 개편 **모두 커밋·자동배포 완료**. 사용자에게 현황을 쉽게 요약하고, 다음 후보(STEP22 phase2 / 담당자현황 재노출 / 보류·취소 필터 재노출 / 완료·Check '모두 펼치기' / 발표모드 등)를 **선택지·장단점·추천**으로 제시. (Claude용 프롬프트는 사용자가 명시 요청할 때만 작성.) **운영 규칙**: 작업 완료 시 자동 커밋·푸시(자동배포). **잔여(사용자)**: 시트 '가동중'→'운영중' 마이그레이션. 백엔드 무변경(@42).
