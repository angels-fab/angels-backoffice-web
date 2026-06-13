# STEP 2 — ThemeProvider / Design Token 재정비 (완료 보고)

> 작업일: 2026-06-13
> 범위: **테마·토큰만** 개선. 페이지 레이아웃·구조·기능 변경 없음.

---

## 작업 원칙

- ThemeProvider와 Design Token만 개선 (페이지 수정 금지)
- 색 하드코딩 금지 — 정본은 `src/theme/tokens.ts`
- 참고: Linear · Vercel · Notion Dark · MUI Dashboard
- 기존 페이지는 MUI를 쓰지 않으므로, 실제 배경을 `#000` 계열 → `#0F1117`로 바꾸기 위해
  `src/index.css :root`의 CSS 변수(=토큰)를 **같은 값으로 미러링** (레이아웃 불변, 색값만)

---

## 1) 변경된 Theme 구조

| 파일 | 내용 |
|------|------|
| `src/theme/tokens.ts` | 토큰 정본 — Background/Surface/Card/Hover/Border/Divider/Text 3단계, 채도 낮춘 상태색, Radius, hoverShadow |
| `src/theme/theme.ts` | 팔레트 wiring, 컴포넌트별 Radius, 통일 Focus Ring, Typography(h1~caption), 컴포넌트 기본 스타일 |
| `src/index.css :root` | 레거시 페이지용 CSS 변수를 동일 값으로 미러링 (정본 tokens.ts) |
| `src/components/ds/AppCard.tsx` | hover를 약한 그림자 규칙(`hoverShadow`)으로 조정 |

theme.ts에서 기본 스타일을 통일한 MUI 컴포넌트:
`MuiPaper · MuiCard · MuiButton · MuiIconButton · MuiChip · MuiOutlinedInput · MuiDrawer · MuiTooltip · MuiDivider`

---

## 2) Design Token 목록 (Before → After)

### 표면 / 텍스트

| 토큰 | Before | After |
|------|--------|-------|
| Background | `#0A0A0C` | **`#0F1117`** |
| Surface (헤더/사이드바) | `rgba(10,10,12)` | **`#131722`** |
| Card | `#141417` | **`#161B22`** |
| Hover Surface | `#1C1C21` | **`#1D2635`** |
| Border | `rgba(255,255,255,.09)` | **`#293244`** |
| Divider | `rgba(255,255,255,.055)` | **`#232C3A`** |
| Primary Text | `#EDEDEF` | **`#FFFFFF`** |
| Secondary Text | `#9A9DA3` | **`#AAB4C3`** |
| Muted Text | `#63666E` | **`#7D8899`** |

### 상태 색상 (채도 낮춘 SaaS 톤)

| 토큰 | Before | After | 비고 |
|------|--------|-------|------|
| Success | `#3FB950` | **`#4DA167`** | 채도 낮춤 |
| Warning | `#F0B429` | **`#D6A23E`** | 네온 옐로 제거, 골드 톤 |
| Error | `#F85149` | **`#E05B54`** | 부드러운 레드 |
| Info / Primary | `#58A6FF` | **`#5491DA`** | 차분한 블루 |
| Purple | `#BC8CFF` | **`#A98AE0`** | 보조 강조 |
| Teal | `#39D0D8` | **`#46B7BE`** | 보조 강조 |

### Radius / Hover / Focus

| 규칙 | 값 |
|------|----|
| Radius — Card | `12px` |
| Radius — Button | `10px` |
| Radius — Chip | `8px` |
| Radius — Input | `10px` |
| Hover (인터랙티브 카드) | `translateY(-2px)` + 약한 그림자 `0 2px 10px rgba(0,0,0,.22)` (glow 금지) |
| Focus Ring (버튼·입력·검색·칩 공통) | `0 0 0 3px rgba(84,145,218,.4)` — ThemeProvider가 관리 |

### Typography

`h1 1.75rem/700 · h2 1.375rem/700 · h3 1.125rem/600 · h4 1rem/600 · subtitle1/2 · body1 0.875rem · body2 0.8125rem · caption 0.6875rem`
폰트 `IBM Plex Sans KR`. 페이지별 font-size 하드코딩 금지.

---

## 3) Before / After 차이 (요약)

- 순흑(`#0A0A0C`) → 푸른 기 도는 SaaS 다크(`#0F1117`). 배경·카드 표면 위계가 또렷해짐
- 테두리: 투명 흰선 → 솔리드 슬레이트(`#293244`)로 안정적
- 상태색: 네온기 제거 → 차분한 SaaS 톤
- 헤더/하단바: 검은 막대 → Surface 톤 + 블러로 자연스럽게
- Radius/Focus/Hover를 ThemeProvider에서 일괄 관리 → 컴포넌트 간 일관성 확보

---

## 4) 검증 & 확인

- `npm run type-check` 통과 ✅
- `npm run build` 성공 ✅
- 확인 URL (dev 서버 3600):
  - 기존 페이지 새 팔레트: `http://localhost:3600/`
  - 테마 컴포넌트(Radius/Focus/Hover): `http://localhost:3600/#/design-system`

---

## 다음 단계 (승인 후)

페이지를 우선순위대로 디자인 시스템 컴포넌트로 점진 이관하며, 이관된 페이지의 `index.css` 의존부를 제거한다.
순서: 홈 → 업무현황 → 업무일정 → 장비운영관리 → 장비도입관리 → 공지사항 → 바로가기.
