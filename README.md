# ANGELS FAB 구축 관리 대시보드 (angels-backoffice-web)

GIST ANGELS FAB(반도체 팹) 구축 프로젝트의 사내 관리 대시보드입니다.
React 18 + TypeScript + Vite로 작성되었고, 데이터는 Google Apps Script API(구글 시트)에서 가져옵니다.

> **Claude Code 사용자에게:** 이 저장소에는 [CLAUDE.md](CLAUDE.md)가 있습니다. 프로젝트 구조, 작업 이력, **반드시 지켜야 할 디자인 규칙**(이모지 아이콘 금지·MUI 아이콘만 사용, 카드 왼쪽 컬러 보더 금지 등)이 정리되어 있으니 코드를 수정하기 전에 먼저 읽으세요. 아래 환경설정도 Claude에게 "README 보고 환경설정 해줘"라고 시키면 됩니다.

---

## 1. 환경설정 (Windows, 처음부터)

Node.js와 git이 없는 새 Windows PC 기준 전체 과정입니다. **PowerShell을 열고** 순서대로 실행하세요.

### 1-1. Node.js LTS 설치 (npm 포함)

```powershell
winget install OpenJS.NodeJS.LTS
```

- `winget`이 없는 구버전 Windows라면 https://nodejs.org 에서 **LTS** 버전 인스톨러(.msi)를 받아 기본 옵션으로 설치하세요.
- 설치 후 **PowerShell 창을 닫고 새로 열어야** PATH가 적용됩니다.

설치 확인 (버전이 출력되면 성공):

```powershell
node --version   # v20 이상이면 OK (Vite 6은 Node 18+ 필요)
npm --version
```

### 1-2. Git 설치

```powershell
winget install Git.Git
```

(역시 설치 후 PowerShell 새로 열기. 또는 https://git-scm.com/download/win 에서 인스톨러로 설치)

### 1-3. 저장소 클론 & 의존성 설치

```powershell
git clone https://github.com/niip00ng/angels-backoffice-web.git
cd angels-backoffice-web
npm install
```

### 1-4. 개발 서버 실행

```powershell
npm run dev
```

브라우저에서 **http://localhost:3600** 접속. (포트는 [vite.config.ts](vite.config.ts)에 3600으로 고정되어 있음)

---

## 2. 명령어 모음

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (localhost:3600, HMR 지원) |
| `npm run build` | 프로덕션 빌드 → `dist/` 생성 |
| `npm run preview` | 빌드 결과물 로컬 미리보기 |
| `npm run type-check` | TypeScript 타입 체크 (**코드 수정 후 항상 실행할 것**) |

---

## 3. 프로젝트 구조 (요약)

```
src/
├── layouts/      # TopBar(로고), SideNav(PC 좌측 사이드바), BottomNav(모바일 하단 탭바), MainLayout
├── pages/        # Home(대시보드), Notice(공지), Calendar(일정), Work(업무), Equipment(장비), Links(바로가기)
├── components/   # 공용 컴포넌트 (EqSummaryInner, TitleLoad 등)
├── constants/    # 하드코딩 데이터 (공지, 캘린더, 로드맵, 바로가기 — 아이콘 포함이라 .tsx)
├── store/        # Redux Toolkit (work/eq 슬라이스, 셀렉터)
├── api/          # Google Apps Script API 호출 (sheets.ts)
├── utils/        # 날짜, 색상, 업무구분 유틸
└── index.css     # 전체 스타일 (단일 CSS 파일, CSS 변수 기반 다크 테마)
```

- 라우팅: `react-router-dom` **HashRouter** (`/#/work` 형태 — 정적 호스팅에서 404 안 남)
- 아이콘: `@mui/icons-material` 개별 import (`import XIcon from '@mui/icons-material/X'`)
- 반응형: 768px 분기. `.d-only` 클래스 = PC 전용
- 데이터: 업무현황·장비현황은 구글 시트 API에서 로드, 공지·캘린더·로드맵은 `src/constants/` 하드코딩

원본(전환 전) 단일 HTML 버전은 [reference/index.html](reference/index.html), 그 분석 문서는 [ANALYSIS.md](ANALYSIS.md) 참고.

---

## 4. 자주 겪는 문제 (Windows)

| 증상 | 해결 |
|---|---|
| `node` / `npm` / `git`을 찾을 수 없음 | 설치 후 PowerShell을 새로 열었는지 확인. 그래도 안 되면 재부팅 |
| `npm.ps1 cannot be loaded... execution policy` 오류 | PowerShell에서 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 실행 후 다시 시도 |
| `npm install` 중 네트워크 오류 | 사내망/VPN 프록시 문제일 수 있음. 일반 네트워크에서 재시도 |
| 포트 3600 이미 사용 중 | 다른 dev 서버가 떠있는지 확인 후 종료, 또는 `vite.config.ts`의 port 변경 |
| 화면은 뜨는데 업무/장비 데이터가 "불러오는 중" | 구글 Apps Script API 응답 대기 중 — 몇 초 걸림. 계속 안 뜨면 네트워크에서 `script.google.com` 차단 여부 확인 |

---

## 5. 푸시 권한

이 저장소는 `niip00ng` 소유이고, `angels-fab` 계정이 Write 권한 협업자로 등록되어 있습니다.
푸시가 403으로 거부되면 GitHub 로그인 계정을 확인하세요 (`git config user.name`이 아니라 **자격증명 계정**이 기준).
