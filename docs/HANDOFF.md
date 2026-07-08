# 인계 노트 (집 ↔ 사무실 이어가기)

> 갱신: 2026-07-09 (집) · 다음 작업: 데모결과 코멘트 테마 확정(5종 시험 배포 중 → 하나 고르면 고정) / 개선요청 검토중 잔여(#8 업무현황 탭 다중선택, #11 업무일정 UX 잔여) / STEP22 phase2 등
> 이 파일은 머신 간 동기화되지 않는 Claude 로컬 메모리를 대신해, 다른 PC에서 맥락을 빠르게 잡기 위한 요약입니다.

## 현재 상태
- **데모결과 탭 — DB화 + 경쟁사 매트릭스 비교 + 지표 거버넌스(프런트+DB, 2026-07-08)**: 장비도입 뷰전환 '데모결과'. **최종형=시안 B+(매트릭스)**. 장비종류별 묶음 → 제조사=**매트릭스 열**(대표사진 배너·회차칩으로 열 안에서 회차 전환·확대아이콘), 지표=**행**(값 비교, **우수값 초록**·지표열 sticky 고정·가로스크롤), 사진 클릭=**라이트박스**, **비교 메모**(팀원 작성/수정). **최대 3개사**라 모바일도 3열 OK. **지표 거버넌스**: 지표는 `demo_metric_defs`(장비종류별 표준·우수방향 higher/lower/none) 중앙관리, **변경=관리자만 + `demo_metric_def_history` 이력 자동기록**, 팀원은 값만. DB: 위 2표 + `demo_results`(행=회차, metrics jsonb) + `demo_memos` + 버킷 `demo-files`(15MB). RLS: 읽기=로그인, 데모/메모 쓰기=is_member, 지표정의=is_admin. API `src/api/demo.ts`(groupDemoResults/bestMakers/CRUD/업로드/서명URL/지표CRUD+이력), 공용 세션가드 `src/api/session.ts`(ensureSession). 샘플 9건(3장비·건식식각 3개사) 시드 — **확인 후 삭제 가능**. **로그인(claude/claude, 팀원) 실측 완료**(매트릭스·우수강조·열별 회차전환·콘솔0).
  - **지표 편집 팀원+ 개방 + 변경 이력 + 알림(2026-07-08)**: 지표정의 쓰기 RLS `is_admin→is_member`(팀원마다 담당 장비 달라서). `DemoMetricEditor.tsx` = 각 장비그룹 헤더 **"지표 편집"**(팀원, 추가/수정/비활성·라벨과 별개 안정 key) + **"변경 이력"**(누가·언제·before→after diff) 다이얼로그. 팀원이 지표 바꾸면 그 **장비그룹 박스에 "지표가 변경되었습니다 …" 알림**(클릭=이력, 시드 변경 제외). 실측: 추가→알림·이력 기록 확인 후 정리, 서버 재시작 클린 콘솔0.
  - **매트릭스 리팩터링 + 메신저형 비교채팅(2026-07-08)**: 장비명=표 1행1열(좌상단 코너셀), 제조사·모델·파일=대표사진 "위" 헤더 한 줄, 제조사 열 사이 구분선, 지표값 열너비 1·2·3개사 **118px 통일**(tableLayout fixed), 제조사별 **지표값 수정**=열 헤더 작은 연필→셀 인풋→저장(실수 방지 명시편집). 지표변경 **알림 배너 제거**(이력 버튼은 유지). **비교 메모→메신저 채팅**: DB `demo_chat`(makers text[]=대상 제조사 필수 태그, RLS 쓰기 is_member+본인uid·삭제 본인/admin, 구 demo_memos 제거), `DemoChat.tsx`=PC는 표 오른쪽 같은높이·모바일 표 아래 스택, **팀원 글 좌·내 글 우(파란말풍선)**, 대상 미선택 시 전송 불가, 스크롤. `api/demo` fetch/post/deleteDemoChat. 로그인 실측(우측배치·대상필수·좌우구분·콘솔0), 샘플 스레드 시드.
  - **채팅폭 축소 + 값 변경 조작방지(2026-07-08)**: 채팅창 flex→**고정 300px**(md+, 표476:채팅497이라 표가 눌리던 것 해소). **지표값 저장 시 로그인 팀원 비밀번호 재확인**(`verifyPassword`=격리 클라이언트 재인증, 세션 무영향·틀리면 거부). **값 변경 이력** `demo_value_history`(before→after·누가·언제) 자동 기록 + 각 장비그룹에 **"○○사 지표값이 변경되었습니다" 알림**(클릭=값 변경 이력 다이얼로그). 지표 '정의' 변경 알림은 계속 안 함. `DemoMetricEditor` ValueHistoryDialog. 로그인 실측(300px·비번 오답거부/정답저장·알림·이력 128→131) 확인·정리·콘솔0.
  - **비교 메모 = 표 아래 목록으로 전환(2026-07-08)**: 메신저형/좌우 말풍선/대상 라인 전부 폐기(가독성). **비교표 오른쪽 → 표 아래**, 폭은 지표헤더 열 제외하고 **장비사 열 너비만큼**(`pl=LABEL_W`로 정렬, 좌=첫 제조사·우=마지막 제조사). **"메모 추가"**로 입력→저장하면 메모창이 아래로 하나씩 쌓임. 대상 제조사 구분 제거(postDemoChat makers 빈배열). `DemoChat.tsx` 단순 목록으로 재작성. 로그인 실측 정렬·스택·콘솔0.
  - **캡처 피드백 일괄(2026-07-08)**: "비교 메모"→**코멘트**(지표열 자리 라벨 박스·목록 높이 연동, 작성자=담당자 필터 색상). 지표 단위 **[대괄호]**. 제조사·모델·파일=**대표사진 위 색깔 밴드**(상단 라운드·가운데). 코너셀=장비명만 중앙("경쟁 N개사" 삭제). **회차칩 옆 + 칩**=제조사 프리필 다음회차 등록(그룹 회차추가 버튼 제거). **변경 이력=지표'값' 이력**(정의 이력은 지표 편집 안으로). **데모결과 추가=뷰탭 행 우측**(포탈 슬롯 — 프래그먼트 루트, Box 자식이면 MUI propTypes 경고). **카드폭 3사 기준 고정**: colgroup 6등분+colSpan2(Chrome fixed 테이블 calc() 무시 우회) — 1곳 가운데·2곳 그룹 가운데·3곳 가득. **사진 = 대표 크게(좌)+소형 그리드(우)+N 더보기** → 업로드 사진 깨짐/카드 확산 해소. 로그인 실측 전 항목·클린 콘솔0.
  - **회차 삭제 + 파일명 수정(2026-07-08)**: 제조사 카드 연필 옆 **휴지통** = 선택 회차 삭제(비밀번호 재확인·사진/첨부 저장소 정리·이력에 "회차 삭제" 기록 after=null). **파일명**: 업로드 키 demo/<uuid>/<원본명>(영문 OK), 스토리지가 **한글 키 거부** → 폴백(uuid) + 밴드 파일아이콘 옆 **다운로드 아이콘**(blob+anchor, 한글 원본명 저장). 실측: 한글 업로드→휴지통 삭제(오답거부·정답삭제·객체정리)·A사4차 삭제·클린 콘솔0.
  - **입력 폼 완성(2026-07-08)**: `DemoResultForm.tsx` — 상단 "데모결과 추가"(팀원+)·그룹별 "회차 추가". 장비종류 선택→표준지표 자동표시(값만 입력), 제조사·모델·데모센터 자동완성, **회차 자동**(같은 장비+제조사+모델 다음값), **사진 드래그드롭+대표 지정**·파일 첨부→demo-files 업로드→addDemoResult. 로그인 실측(자동지표·회차4/1·저장 즉시 반영) 콘솔0. **→ 데모결과 기능 일단락**(사진 실업로드는 팀원 실사용 시 확인 권장).
  - **코멘트 = 제목 있는 메모카드 + 테마 5종 시험 배포(2026-07-09)**: 코멘트를 업무카드식 2단(**띠 헤더=제목·작성자칩·날짜 / 본문=내용**, 구분/부처 없음) 카드로 재구성. **테마 5종**(포스트잇·유선노트·크라프트·폴라로이드·네온)을 코멘트 우상단 **"카드 테마" 칩으로 전환**하며 비교하는 시험 배포 — **사용자가 하나 고르면 고정(임시 UI 제거) 예정**. 포스트잇/폴라로이드=담당자 색 파스텔(`color-mix`)+기울임, 유선노트=줄종이+빨간 여백선, 크라프트=갈색 포장지+박음질 점선, 네온=다크카드+담당자색 네온(다크 포탈과 동화). 종이 테마 손글씨 = **Gaegu 폰트**(index.html Google Fonts). DB `demo_chat.title` 컬럼 추가(제목 필수·내용 선택, 샘플 3건 제목 백필·실사용 1건은 무제목 유지=무제목 카드도 렌더 OK). `postDemoChat({equipment,title,body})`. 테마 선택은 `localStorage demoChat:theme`(그룹별 스위처는 독립 상태 — 두 테마 동시 비교 가능). 로그인 실측: 5테마 스타일 적용·Gaegu 로드·제목 저장→DB 확인·본인 삭제·콘솔0.
- **공지 저장 멈춤 버그 수정(프런트, 2026-07-08) — 2건**:
  - **(1차) 네트워크 스톨**: 첨부 있는 공지 수정→저장 시 스피너 무한 대기·성공메시지도 안 뜸. **원인(멀티에이전트 RCA)**: supabase-js는 모든 요청 직전 `getSession()`으로 토큰을 읽는데, 액세스 토큰 만료 임박(~90초)이면 내부에서 **타임아웃 없는** 토큰 갱신(POST /token)을 하고, 사무실망 프록시가 이 소켓을 붙잡으면 PATCH가 아예 안 나가고 멈춤(서버 로그에 PATCH 없음으로 확인). **navigator.locks 데드락 아님**(supabase-js 2.110 기본 lockless). **수정**: `src/api/notices.ts`에 `ensureSession()`(쓰기 전 `withTimeout(getSession)`) 추가 → add/update/delete/upload 앞에 호출. 저장/삭제 핸들러 상태해제를 `finally`로.
  - **(2차) React key 충돌**: 1차 수정 후 저장은 성공(스낵바 뜸)하나 "저장 중" 폼·스피너가 안 사라짐. **원인**: 편집 폼 `<NoticeCompose key={n.id}>`(위치기반 idx+1) vs 일반 행 `renderRow key={String(n.num)}` — 키 체계 불일치. 공지 N개(num 1~N)면 id=N+1-num이라 편집행 key가 항상 다른 행의 num과 충돌(#4편집→"9"↔#9행"9"). 중복 key로 React 재조정 깨져 stale prop(saving=true)으로 폼 잔존. **수정**: 편집 폼 key를 `String(n.num)`으로 통일(`src/pages/Notice/index.tsx`).
  - **미검증**: 로그인 후 실측 필요(오피스망 재현). **후속(선택)**: events/works/improve/eq/calendar 등 다른 write API도 같은 세션 스톨 취약 → ensureSession 전파(예방용, 급하지 않음). 작업카드 등록됨.
- **학술·교육·전시(/events) 참석자·행사신청 개편(프런트+DB) — 2026-07-08**: 종료행사 상세를 **비모달 우측 고정 패널**(X·Esc·바깥클릭·같은행 재선택으로 닫힘, 목록 계속 클릭해 연속 열람, 포스터 풀사이즈+상세)로 교체. 참석자 = **DB(event_attendees, RLS)** 하이브리드인데 조작을 **종료 목록**으로 이동: 헤더에 **참/불 안드로이드 스위치**(가장 우측, 켜짐=푸른톤 왼쪽'참석'·꺼짐=회색 오른쪽'불참', 로그인 팀원만) + **관리(관리자 전용, 스위치 우측 열)** = 팝오버로 이름 추가/삭제. 드로어는 참석자 읽기전용 표시. **행사 신청 포털**(구글폼 대체): 팀원+ '새 행사' 모달(포스터 드래그·드롭 이미지/PDF·좌상단 분류칩·URL·제목/날짜/장소/주관·**분류별 요약 프리셋 자동표시 max3, 값 적은 항목만 게시**) → `event_submissions(status=pending)` 저장 → 관리자 "신청 대기 N" 검토(SubmissionsAdmin). **실제 카드 게시는 여전히 클로드 수동 단계.** 마이그레이션 `event_attendees_and_submissions`+버킷 `event-submissions`. type-check·컴파일 오류0. **`/events`=RequireAuth라 팀원/관리자 로그인 실측 필요.** 상세 `docs/events-attendees-submit.md`.
- **공지사항 첨부파일(개선요청 #6, 프런트+백엔드) — 2차 반영(2026-07-08)**: Supabase Storage 비공개 버킷 `notice-files`(**10MB**·MIME무제한, RLS 읽기=authenticated·**쓰기=is_member**) + `notices.attachments jsonb`. **공지 작성/수정/삭제도 팀원(member)+로 개방**(RLS+Notice UI 게이팅 isAdmin→isMember). 작성/수정에 "파일 첨부"(**파일별 상태 업로드중/완료/실패·60초 타임아웃·저장 스피너** = 멈춤 수정), 상세에 첨부 목록 다운로드(서명URL) + **모두 다운로드(ZIP, jszip)**, 목록 제목 옆 **클립+개수** 표시. 확장자 대표 아이콘 강화(`attachmentUI.tsx`). type-check·런타임 오류0. **팀원/관리자 로그인 실경로는 배포 후 실측 필요.** 상세 `docs/notice-attachments.md`. (※ Codex bridge 문서 미사용 — 협업 안 함)
- **업무현황(/work) 완료·Remind 개편(프런트 전용)**: 완료 KPI 건수 다시 크게 채움(칩 fill+큰 숫자, 그리드 lg `4fr 3fr 4fr`로 완료칸 확대)·열기/닫기 쉐브론 좌(열기)/우(닫기)·완료 드로어 **비모달**(열려도 메인 클릭)·목록 12행(456px)·드로어 상단 구분/부서 필터. Remind 펼치면 **바로 1열 목록+상세**(그리드 단계 제거)·목록 행 간격 축소(30px)·상세에 수정/삭제/**진행중 되돌리기**(초록 Replay) 버튼(`handleRevert`=상태만 진행중). 다음: 업무일정(캘린더) 페이지 3건(우측정보→상단KPI·주간 9~18시·필터 전체버튼 제거).
- **업무현황(/work) KPI 4건 손질(프런트 전용)**: ① 새 업무 펼침 모션(NewTaskCard를 vertical `Collapse`로 감쌈). ② 완료 KPI "목록 열기"를 하단 바 → **카드 우측 세로(쉐브론+열기/닫기)**, 카드 클릭=드로어 토글. 좁은 완료 카드에 맞춰 칩 `compact`+건수 폰트 축소(컨트롤 잘림 방지). ③ Remind 하단 펼치기/접기 바 높이 36→**20px**. ④ 진행중 KPI를 flex column으로 만들어 **진행중 칩·Check 박스를 카드 하단까지 채움**(`SquareChip fill`, 116→128px). type-check·build 통과, 1280 라이브 검증(카드 3개 166px 균형·완료 컨트롤 19px 여백·콘솔0). 스크린샷 대신 snapshot/eval로 검증.
- **포털개선요청 — 보완 15(프런트 전용)**: 작성행 개선내용 입력칸이 구분선에 붙던 것 수정(2행 td `pt:0,pb:1.25 → py:0.75` 대칭 → 세로 가운데·구분선에서 띄움), 개선내용 높이 제목칸(32)과 맞춤(`minHeight:32, py:6px`), 저장·취소 아이콘 세로 가운데, 위치/유형 드롭다운 글자 `translateX(-4px)`(4px 왼쪽). type-check 통과. 상세 `docs/step28-improve-page.md` 보완15.
- **포털개선요청 — 보완 14(프런트 전용)**: 위치/유형 드롭다운 **글자 가운데 정렬**(justifyContent center+대칭 패딩), 개선내용칸 **세로 가운데**(`py:7px`로 중앙, 제목칸 32px와 맞춤), **새 요청 버튼 토글**(다시 누르면 작성칸 닫힘), **필터 탭 hover 시 상태색 채움+흰 글자**(transition .2s). type-check·목록 콘솔0. 상세 `docs/step28-improve-page.md` 보완14.
- **포털개선요청 — 보완 13(프런트 전용)**: 작성행 제목칸=개선위치/유형 드롭다운 **높이 32px 통일**, 개선내용칸 **세로 가운데 정렬**(td middle + alignItems center + minHeight 32), 긴급 체크박스 **24×24px**(! 15px), **새 요청 버튼 클릭 시 초록 채움·흰 글자로 transition(.2s) 스르륵 전환**(composing 연동). type-check·목록 콘솔0(작성행은 관리자 전용 실측 권장). 상세 `docs/step28-improve-page.md` 보완13.
- **포털개선요청 — 보완 12(프런트 전용)**: 완료·보류·불가 **글자 상태색/60% 흐림 강조 원복**(모든 상태 원래 색, 행 배경 틴트·펼친글 파랑은 유지). 정렬을 **번호 내림차순 우선**(→상태 보조)으로 변경(상태우선 정렬 폐지). **새 요청 버튼을 필터 탭 칩 스타일**로(기본 초록 글씨+옅은 배경, hover 진해짐, 클릭=초록 채움·흰 글씨). type-check·라이브 dev 검증(번호 7→1·콘솔0). 상세 `docs/step28-improve-page.md` 보완12.
- **포털개선요청(구 개선제안) — 보완 11 구현·배포(프런트 전용, @53 무변경)**: 페이지 제목·사이드 라벨 `개선제안→포털개선요청`, 버튼 `새 제안→새 요청`(헤더 우상단 outlined, 호버 시 `darken(green)` 채움). 정렬 상태 우선(접수→검토중→보류→완료→불가) → 제안일자 최신순(`statusRank`). 작성/수정 행: 긴급 체크박스 번호열·개선내용 멀티라인(제목~상태 colSpan6 박스)·저장(✓)/취소(✕) 아이콘 비고열. 목록: 상태색 행 틴트(전 상태) + **완료·보류·불가 글자 60% 흐림·상태색(시안 A)**, 펼친 글 진한/옅은 파랑·내용줄 클릭 접힘, 수정·삭제 아이콘 전용. `useNavBadges` 접수 집계 보정. **백엔드 @54**: 시트 탭을 `개선사항→포털개선요청`으로 리네임함에 따라 `improveCtx_`가 여러 후보 이름(포털개선요청·개선사항·개선제안)을 탐색하도록 보강 + 프런트 `fetchImprovements` 캐시 우회(`&_=Date.now()`). 라이브 dev 검증 완료(보드 정상 로딩·정렬·배지·콘솔0). 상세 `docs/step28-improve-page.md` 보완11.
- **STEP 28 개선제안 — 보완 10(보완 9 정정, 프런트 전용)**: ① `+ 새 제안`을 **표 내부 최상단(헤더 아래·최신글 위)** 행으로 이동(텍스트에 dashed 박스). ② 펼친 작성 입력을 **이전 열 정렬 인라인 2행 구조로 원복**(긴급=제목 startAdornment·DropField=위치/유형 열·개선내용+취소/저장 2행). ③ 신규/수정 공용 `renderCompose` — **수정은 글 자리 in-place(열 정렬 동일)**. 제목줄 배경 클릭 접기 유지. `ComposeCard` 폐기·c* 상태 복구. 백엔드 무변경(@53).
- **STEP 28 개선제안 페이지 — 보완 9(백엔드 @53)**: ① **새 제안 버튼을 헤더–목록 사이로 이동 + `+ 새 제안` dashed 박스**(클릭 시 작성 카드 `ComposeCard` 펼침). ② 작성 카드 **제목줄 배경 클릭 시 접힘**(+▲ 접기 버튼; 입력은 stopPropagation). ③ 글 아코디언 펼치면 **내용 우측(비고열쪽)에 수정/삭제 버튼**(담당자만) — 수정=in-place 편집 카드(프리필), 삭제=확인 팝업. 백엔드 `updateImprovement_` 내용필드 수정 지원(status 미전달 시 완료일자·사유 보존) + `deleteImprovement_` 신규(@53). 공용 `ComposeCard` 컴포넌트. 실제 저장/삭제는 담당자 로그인 필요.
- **STEP 28 개선제안 페이지 — 보완 8(백엔드 @52)**: ① **보류·불가 사유 저장/표시 버그 수정** — 시트 사유 헤더가 `사유 (보류/불가)`라 정확매칭 실패로 미저장/빈값이던 것을 `improveCtx_`에 '사유' 포함 폴백 추가로 해결. ② 정렬=번호 내림차순. ③ 0건 상태 탭 숨김. ④ Shift 다중선택 안내문. ⑤ **새 제안 = 표 안 인라인 작성행 그대로 유지(원복)** — "구현 가능한지?" 질문을 구현까지 진행했다 사용자 지시로 되돌림. 좌측펼침 애니메이션은 구현 가능하나 미적용(요청 시 재적용). 함정 기록은 `docs/step28-improve-page.md` 보완8 + 메모 참고.
- **STEP 28 개선제안 페이지 신설(소통 그룹) 완료** — '개선사항' 시트 연동(헤더 3행 자동탐지), 목록형 표·상태 필터탭·개선내용 아코디언·담당자 상태 드롭다운·비고 사유·긴급/관련자료 아이콘. 작성=로그인, 상태변경=담당자. **백엔드 clasp(현재 @52, URL 불변), 프런트 main 자동배포.** 상세 `docs/step28-improve-page.md`.
- **STEP 1~27 완료** (…25 KPI/Remind 토글·26 KPI 전체타일·목록 2열·들여쓰기·27 새 업무 인라인폼 개편[드롭다운/자동완성/날짜 한글라벨/시간 wheel/링크·첨부 아이콘] + 완료 다이얼로그 Remind 체크박스). **STEP27까지 `main` 커밋·자동배포 완료.** (운영 규칙: 작업 완료 시 자동 커밋·푸시 = 자동배포)
- **STEP27 메모**: 신규 `src/pages/Work/inlineFields.tsx`(ComboField·SelectField·DateField·TimeRangeField·LinkButton·AttachButton). 프런트 전용(시트 무변경, 백엔드 무변경). **구분=드롭다운 선택만**(`WORK_CAT_OPTIONS` 6개), **담당자=입력가능+담당자 시트 동적 명단**(`fetchAuthors` `?authors=1`, 헤더 자동 인식·새 담당자 자동 반영, 실패 시 `WORK_MGR_OPTIONS` 폴백). 첨부는 UI만(백엔드 미구현). 시간=`"HH:MM ~ HH:MM"`(휠 감도↓·'취소' 버튼). 업무내용 글머리: 화면 '•' / 시트 '-'(입력 '- '→'• ' 실시간 + **Enter 자동 글머리**, 저장 시 '- ' 복원). **업무카드 수정=in-place 인라인 편집(팝업 없음, `NewTaskCard initial` 공용)** — 상세 Drawer 수정만 모달 유지.
- **운영 메모**: Codex 협업(.agents/bridge) 일시 중단 — 현재 브릿지 파일 갱신 보류(사용자 지시). 작업 완료 시 자동배포 + docs 기록은 유지.
- **⚠ 시트 마이그레이션 잔여**: 상태 어휘 개편으로 시트의 기존 '가동중' 등은 '운영중' 등 4값으로 정리해야 '미분류' 표시가 사라짐(드롭다운 권장). 백엔드 무변경(@42).
- **상태 어휘 개편(미커밋)**: 표시 라벨 매핑 폐지 → 시트값 그대로. 정식 4값 `도입예정/도입중/운영중/비가동`(가동중→운영중·설치중→도입중), 그 외는 칩에 '미분류'. **⚠ 시트 기존 '가동중' 등은 새 값으로 마이그레이션 필요**(드롭다운 권장).
- 배포: 프런트는 `main` push → GitHub Actions 자동배포(angels-fab.github.io). 백엔드(Apps Script) **@42** (clasp, URL 불변 · STEP22에서 운영이력 append + getEqHistory 조회 추가). **STEP22 프런트·백엔드 모두 라이브 반영 완료 · CL-001로 라이브 E2E(상태변경→이력 기록) 검증됨**.
- 빌드 상태: `npm run type-check`·`npm run build` 통과.
- **운영 규칙: 작업 완료 시 자동으로 커밋·푸시(자동배포)하고, 작업 내역을 `docs/`에 MD로 기록한다.**

## 단계 요약 (상세는 각 docs/stepN-*.md)
- STEP 1~3 디자인 시스템/테마/레이아웃 · 4~5 홈 대시보드/캘린더 · 6 업무현황 Command Center · 7 장비운영관리 · 8 장비도입관리(타임라인) · 9 공지 허브 · 10 Guest/Admin(사번+비번) · 11 통합검색.
- STEP 12 공지 CRUD — `docs/step12-notice-crud.md`
- STEP 13 센터 업무현황 CRUD + 시트 스키마(상태/발의일자/예정일/검토필요) + onEdit 트리거 — `docs/step13-work-crud.md`
- STEP 14 장비도입관리 CRUD(도입관리 시트 1:1) — `docs/step14-schedule-crud.md`
- **STEP 15 장비도입관리 타임라인 전체 이동(드래그) — `docs/step15-timeline-move.md`**
- **STEP 16 타임라인 단계 리사이즈(오른쪽 핸들) — `docs/step16-timeline-resize.md`**
- **STEP 16.5 타임라인 그리드 너비 정규화(고정 px 단일 상수 MONTH_WIDTH/HALF_MONTH_WIDTH) — `docs/step16.5-grid-normalize.md`**
- **STEP 17 자동 재계산(총소요기간·도입예정월·KPI·파이프라인) — 기존 timeline 반응형 파생으로 충족(신규 코드 없음), `docs/step17-auto-recalc.md`**
- **STEP 18A 드래그 중 실시간 프리뷰 툴팁(이동/리사이즈, 표시 전용) — `docs/step18a-drag-tooltip.md`**
- **STEP 18B 드래그 후 확인 모달 → 적용 시 자동 저장(updateSchedule 재사용), "변경됨 N건" 저장바 제거 — `docs/step18b-confirm-save.md`**
- **STEP 18C Undo/Redo(Ctrl+Z·Ctrl+Shift+Z·헤더 버튼, 저장된 작업까지·시트 동기화, 50건) — `docs/step18c-undo-redo.md`**
- **STEP 19 장비운영관리 상세 Drawer 고도화(5섹션·빈값 미등록·폭520, 조회 전용) — `docs/step19-eqops-drawer.md`**
- **STEP 20 장비운영관리 수정(Update만, 관리자·확인모달·updateEquipment, 백엔드@40) — `docs/step20-eqops-update.md`**
- **STEP 21 장비운영관리 상태 변경(관리자·칩 클릭 → 드롭다운 선택 즉시 변경·사유 숨김(시트 열 부재)·updateEquipment 재사용, 백엔드@41) — `docs/step21-eqops-state.md`**
- **STEP 22 장비 운영이력 phase1(별도 append-only `장비운영이력` 시트·상태 변경 시 자동 1건 기록·드로어 읽기전용 "운영 이력" 섹션·`getEqHistory` 조회, 백엔드@42, 라이브 반영) — `docs/step22-eqops-history-plan.md`**
- **STEP 23 상태 변경 사유 입력(즉시저장 → 확인 Dialog: 장비명·관리번호·전/후·사유 optional·trim → updateEquipment(state,reason), 운영이력에 사유 기록, 같은상태 no-op, 표시 '작성자 · 사유'). 프런트 전용, 백엔드 변경/배포 없음 — `docs/step23-eqops-state-reason.md`**
- **STEP 24 업무현황(/work) 회의 뷰(업무목록을 KPI 바로 아래로·기본 진행중·진행중 아코디언 모두 펼침/개별 접기·RatioBar 제거·'긴급 업무'→'Remind'·담당자현황 숨김(SHOW_MANAGER_STATUS)·검토필요→'검토'). 신규 `Work/TaskAccordion.tsx`, 프런트 전용 — `docs/step24-work-meeting-view.md`**
- **STEP 25 업무 KPI/Remind 정리(KPI 보류·취소 타일 제거→진행중/완료/Check/Remind 4타일·'검토'→'Check'·Remind는 KPI 타일 토글로 KPI 아래 펼침·Remind 카드 압정아이콘+상태/구분/담당자/날짜(YYYY-MM-DD)·'발의' 삭제). 프런트 전용 — `docs/step25-work-kpi-remind.md`**
- **STEP 26 업무 KPI 전체타일(완료/Check 사이)·상태칩행 제거·목록 진행중/완료/Check 2열 아코디언(진행중 펼침/완료·Check 접힘)·Remind 카드 담당자 우측(날짜와 그룹)·글머리기호 행잉 인덴트(공용 `Work/SubLine.tsx`). 프런트 전용 — `docs/step26-work-2col-remind-card.md`**
- **STEP 27 새 업무 인라인폼 개편(구분·담당자·부서·장소 드롭다운/자동완성=ComboField, 발의일자·예정일 한글라벨 date=DateField, 시간 시작·종료 wheel picker=TimeRangeField, 제목 우측 관련링크 팝업=LinkButton·첨부 자리=AttachButton) + 완료 다이얼로그 Remind 체크박스. 신규 `src/pages/Work/inlineFields.tsx`. 프런트 전용 — `docs/step27-newtask-form-revamp.md`**
- 아키텍처: `docs/ARCHITECTURE.md`, `docs/equipment-page-architecture.md`(도입관리), `docs/equipment-ops-architecture.md`(운영관리)

## 핵심 규칙 (작업 시 유지)
- 시트 매핑은 **헤더명 기반**(열 위치 비의존). 쓰기는 **관리자 인증 필수**(author=로그인이름/key=비번, 비번 재입력 없음).
- 타임라인 재파생은 `src/pages/Equipment/timeline.ts`의 `buildTimelines` **단일 창구**(STEP16 리사이즈도 재사용).
- CRUD 패턴 통일: 백엔드 Code.gs create/update/delete + LockService, 프런트 모달(body 포털) + 삭제 확인 Dialog + Snackbar + 성공 후 재fetch.
- MUI v9 → `Stack` 금지(Box flex). 색은 `tokens.ts`/StatusKind만(하드코딩 금지). 디자인/레이아웃 임의 변경 금지.
- 백엔드 배포: `npm run deploy:backend`(clasp push+redeploy). 프런트 배포 = `git push`(자동).

## 남은 사용자 확인/할 일
- [x] 시트 onEdit 트리거 설치 — 완료(집에서 1회 설치, 클라우드에 보존 · PC 무관).
- [x] 인앱 CRUD 확인 — 완료.

## 다음 작업 (예정 — 택1)
- 장비운영관리 고도화 · 근무현황(Google Calendar 기반 조회 전용) · 권한관리 · NAS 연동 · UI 스프린트.
- (보류) 바로가기(/links) 디자인 시스템 이관.
- (확정) **일정(캘린더) CRUD는 구현하지 않음** — Google Calendar를 원본으로 유지, 포털은 조회 전용.
