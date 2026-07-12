# 디자인시스템 확정 결정 (2026-07-12)

> 전수 감사 2회(에이전트 12·코드 조회 394회, 23개 항목 판정: 확정1/암묵2/미정3/충돌17) 후 사용자가 항목별 확정.
> 감사 상세·판정표: https://claude.ai/code/artifact/c41169fd-041e-47cf-9386-f38fa7006acd
> **대전제(사용자 선언): "환골탈태 감수" — 화면 무변화보다 옳은 최종 구조 우선.** 단, 색·룩 등 취향이 걸린 시각 변경은 시안/라이브 비교로 승인 후 적용.

## 확정 결정

| # | 결정 | 확정 내용 |
|---|------|-----------|
| D1 | 개정 기조 | **정규화 스케일로 전면 정렬** — 새 정본 스케일(간격 4px 그리드 / 타이포 11~24px 정수 단계 / radius 5단)을 확정하고 전 화면 값을 스냅. 현재의 조밀한 밀도감은 유지, 잡값(12.5/11.5px 글자·7/11/13px 행 padding·radius 20종)만 정규화. **타이포 표에는 제목 3단(페이지 제목·섹션 제목·카드 제목) 슬롯을 반드시 포함**(예시 시안: 페이지 22/800 · 섹션 18/700 · 카드 16/700 — 제목만 다시 제각각 커지는 일 차단, ChatGPT 피드백 반영). 구체 스케일 값은 P1에서 실측 분포 기반으로 설계·확정 |
| D2 | 반응형 | **2계층 공식화** — 셸(사이드바↔하단탭)=768 / 콘텐츠 열수=600·900. 구현은 문자열 산재가 아니라 **MUI theme.breakpoints에 정식 주입**. 검증된 모바일 변환 4패턴(표→카드스택·타일→가로스와이프·그리드→캐러셀·뷰 전환)을 공식 변환표로. 터치 타겟 최소 44px 채택(미달 6계열 보강) |
| D3 | 상태 의미색 | **완료(2026-07-12, 쟁점 포함 전부 승인·적용)** — 배정: **진행중=그린 · 완료=파랑 · 예정=회색 · 임박(D-N)=앰버 · 보류=앰버 · 지연/불가=레드**. 쟁점 결정: ① Work **Remind=퍼플 이동**(보류 앰버와 겹침 해소 — 압정·카드워시·KPI타일·카드톤 전부 퍼플, 아이콘 유지) ② **Events D-#=임박 의미로 앰버 유지**(Events 무변화). 적용·실측: 로드맵 완료↔진행중 맞교환(크롬 그린화 포함)·Work(완료 info·카드톤 blue·보류 amber·KPI 스트립 경계혼합 재계산)·EqOps 도입예정 neutral·Equipment 설치완료 info. Improve·Calendar·Notice 무변화(기존 일치) |
| D4 | 폼 입력 | **단일 컴포넌트 + 2 variant** — ds에 FormField·SelectField·DateField·TimeField 신설(구현 1개, variant modal\|inline). 손코딩 InputBase 전부 교체, 날짜 4방식→1·Select 4방식→1·포커스 3갈래→1 |
| D5 | 토큰 외 색 | **완료(2026-07-12)** — ① 도메인 토큰 승격 완료(P1-2) ② **A/B 승인 결과 = B(accent 통합)**: Events 분류칩 학술=accent.blue·교육=green·전시=purple, 사이트 버튼=accent.blue (P1-3 적용·실측) |
| D6 | 콘텐츠 폭 | **1400(wide)/1200(detail) 확정 + 전부 정리** — Links를 PageContainer로 이관(유일 미이관), 죽은 CSS(1180·1320·main 36px)·구문서 표기 삭제, 강제 PC 뷰포트 1280→1400 검토 |
| D7 | 내비 배지 | **대기 중 개편안 실행 = 표준** — 아이폰식 위첨자 배지(빨강 새글+노랑 메모, 14~16px, `.agents/bridge/outbox/next-claude-prompt.md`)를 ds `NavBadge` 공용 컴포넌트로 구현해 3변형 통합. 색은 토큰(accent.red/amber)만 |
| 카드 | 카드 표준 | **최종 확정(사용자, 2026-07-13, 실험실 채택)** — 기본 카드 = **16px 패딩 + 1px 보더** / 긴 설명 카드만 24 허용 / 목록 카드 = padding 0 / **hover(클릭 카드만) = 배경 elevated 전환 + 보더 강조(primary 65%)** — 기존 떠오름(translateY -2px)+그림자 폐지, 정적 카드는 hover 무반응. 특례 3종(로드맵·행사 포스터·업무 톤배경 카드)은 도메인 카드로 인정(권장안 기본 채택 — 이의 시 변경), 그 외 전부 AppCard 수렴 |
| 범위 | 실행 범위 | **전면 재건** — 최종 목표: index.css 레거시 0 · 전 페이지 ds 컴포넌트 조립 · 하드코딩 0(design-lint strict). 토큰→컴포넌트→페이지(worst-first) 순, 각 단계 라이브 검증·배포 |

## B 패키지 (권장안 일괄 채택 확정)

1. **모션 토큰** — fast .12s / base .15s / slow .2s + 스프링 곡선 1종(현 3중 정의 통합) + prefers-reduced-motion 원칙
2. **그림자 3단계** — sm(hover)/md(팝오버)/lg(모달·드래그), 현 최빈값 승격, 리터럴 ~35종 수렴
3. **z-index** — theme.zIndex 참조 원칙, 매직 리터럴 6곳 교체, CSS 셸 저층은 이관 전까지 이원 체계 기록
4. **focus-visible 단일화** — 테마 focusRing 정본 + 커스텀용 focusRingSx 믹스인, hex 아웃라인 3곳 수정
5. **반경 스케일** — chip 8 / control 10 / card 12 / modal 16 / pill / circle, sx 숫자 배수 함정 금지(px 문자열 또는 토큰)
6. **Dialog 규격** — Confirm형/Form형 2계열(ds ConfirmDialog·FormDialog), paper 배경 1값, window.confirm 3곳 대체. **ConfirmDialog는 destructive 모드 내장 — 삭제·되돌릴 수 없는 작업의 확인 버튼은 컴포넌트가 error(빨강)를 강제**(저장·확인=파랑 / 위험=빨강 원칙 고정, ChatGPT 피드백 반영)
7. **피드백 세트** — ds LoadingState·전역 useSnack(Provider)·ErrorBanner, 로딩 4계열·스낵바 10벌 수렴, '불러오는 중…' 표기 통일
8. **아이콘 크기 4단** — 13(캡션)/16(본문)/18(액션)/20(헤더), 중간값(17·19 등) 스냅
9. **버튼 용법** — 주=contained(primary) / 위험=contained(error) / 보조=outlined / 취소=text+text.secondary, '저장' success 혼용 정리. 삭제류 확인 버튼은 ConfirmDialog destructive 모드가 자동 적용(개별 구현 금지)
10. **데이터표** — ds DataTable **최종 확정(사용자, 2026-07-13, 실험실 채택)**: **가로선만 · 지브라 없음 · 헤더 배경 채움(background.elevated, sticky 가림막 겸용)** · 헤더 12px/600 · 셀 12px · hover · 모바일 가로스크롤. **정렬 = 헤더는 항상 열 본문 정렬을 따름**: 긴 본문 텍스트=좌측 / 짧은 값(번호·위치·상태·담당·날짜·첨부)=중앙 / **금액·수량(예산 등)=우측+모노스페이스**. 날짜=중앙+monospace+text.disabled, 첨부=AttachFile 클립 16px. P3에서 Improve·Notice 이관
11. **죽은 코드·문서 정정** — 사문 CSS(배지 5종·모바일 5종·1180 계열)·TitleLoad·lightTheme(다크 전용 확정에 따라 정리), CLAUDE.md 스테일 4건, design-system.md 내부 상충 2건, 포스터 비율 표기
12. **design-lint 확장** — borderRadius·boxShadow·zIndex 리터럴·fontWeight 검사 추가, 최종 단계에서 strict 전환

## 실행 로드맵

- **P1 토큰 재건**: 정규화 스케일 설계(실측 분포 기반) → tokens.ts v2 · theme.ts v2(breakpoints 주입·MuiDialog 오버라이드·defaultProps) · design-system.md v2 · design-lint 확장. ⚠ 승인 포인트 2개(D3 상태색 배정표, D5 색 통합 시안) 포함
- **P2 컴포넌트 재건**: ds 신설 — FormField 패밀리·ConfirmDialog/FormDialog·LoadingState·useSnack·ErrorBanner·DataTable·NavBadge(D7 개편 동시)·focusRingSx. 쇼케이스 갱신
- **P3 페이지 정렬**(worst-first, 세션당 1페이지·라이브 확인·배포): 각 페이지 이관 = ① 스타일 값 정규화(색·글자·radius·shadow·z→토큰/사다리) ② 구조 정돈(팝업·로딩·스낵·폼→ds 부품) ③ **손코딩 카드 표면 → AppCard 전환**(카드 표준을 실제 화면에 적용 — 사용자 확정 2026-07-13, 단 드래그·사진 등 얽힌 특수 표면은 신중/후속) ④ index.css 해당 블록 제거. ※ P3-1 데모 계열은 ①②만 완료, ③(카드 AppCard화)는 데모의 드래그·사진 얽힘으로 후속 이월(잔여 항목).
- **P4 마감**: index.css 레거시 0 확인 · design-lint strict 전환 · 문서 최종 정정 · 죽은 코드 일괄 삭제

## 판정 근거 (요약)

- 1차 감사(13항목) 결과: 테마만 확정(다크 전용), 나머지 12개 충돌 — 문서·토큰·실코드 삼자 불일치가 기본 상태였음
- 2차 감사(10항목): 오버레이·피드백·내비·접근성·반경 충돌 / 그림자·z-index·모바일변환 미정 / 모션·기타 암묵
- 대표 실측: hex 직접 191건/38파일 · fontSize 하드코딩 521건 · '완료' 상태색 3종 · Dialog 29개 4방식 · 그림자 리터럴 ~35종 · 새글 배지 3변형
