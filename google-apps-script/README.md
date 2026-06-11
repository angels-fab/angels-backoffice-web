# 구글시트 API (Apps Script) 배포 가이드

대시보드가 구글시트를 읽고(공지·업무·장비), 공지사항 새 글을 쓸 때 사용하는
중계 서버 코드입니다. `Code.gs`가 전체 소스이며, 수정 후에는 아래 절차로
**새 버전 배포**를 해야 실제 반영됩니다.

## 최초 적용 / 코드 갱신 절차 (약 3분)

1. [script.google.com](https://script.google.com) 접속 → 기존 프로젝트 열기
   (또는 팹센터 구축총괄시트에서 `확장 프로그램 → Apps Script`)
2. 편집기의 기존 코드를 전부 지우고 `Code.gs` 내용을 통째로 붙여넣기
3. **`WRITE_KEY` 값을 팀만 아는 비밀번호로 변경** (저장소에 올리지 말 것!)
4. 우상단 `배포 → 배포 관리 → (연필 아이콘) 수정 → 버전: 새 버전 → 배포`
   - 실행 권한: **나**, 액세스 권한: **모든 사용자** (기존과 동일)
   - ⚠️ "새 배포"가 아니라 **기존 배포의 새 버전**으로 해야 URL이 그대로 유지됨
5. 끝 — 사이트에서 새 글쓰기 테스트

## 동작 방식

- 읽기: `GET {URL}?sheet=시트이름` → `{status:'ok', sheet, data:[[...]]}`
- 쓰기: `POST {URL}` body=JSON `{action:'addNotice', key:'비밀번호', title, body, cat, dept, deptMgr, author, target, end, ref}`
  - 비밀번호(key)가 `WRITE_KEY`와 다르면 거부
  - '공지사항' 시트의 헤더 행을 찾아 **열 이름으로** 값을 채워 새 행 추가
    (열 순서가 바뀌어도 안전), 연번은 기존 최댓값+1, 시작일자는 오늘(KST)
- CORS: 브라우저에서 Content-Type 헤더 없이 POST(text/plain 단순 요청)하므로
  프리플라이트 없이 동작 — 클라이언트(src/api/sheets.ts)에서 헤더를 추가하지 말 것
