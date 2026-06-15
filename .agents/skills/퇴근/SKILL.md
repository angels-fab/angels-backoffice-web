---
name: 퇴근
description: 작업 마무리 루틴. 변경사항을 타입체크 후 commit하고 push하면 GitHub Actions가 자동 배포한다. 다른 PC에서 이어받을 수 있게 동기화하고 오늘 한 일을 요약한다. "퇴근", "마무리", "오늘 여기까지", "저장하고 올려줘" 류의 요청에 사용.
---

# 퇴근 — 작업 마무리 & 동기화

사용자가 일을 마칠 때, 오늘 한 작업을 GitHub에 안전히 올려 다른 곳(집↔사무실)에서 이어받을 수 있게 한다.
push하면 GitHub Actions가 빌드·배포까지 자동으로 하므로, 사이트 반영도 함께 일어난다.
출력은 항상 `가독성` 형식(🔧 회색=실행한 작업 / 💡 파란줄=쉬운 의미 / ✋ 노란=사용자 할 일)을 따른다.

## 순서

1. **변경사항 확인** — `git status` + `git diff --stat`로 무엇이 바뀌었는지 사용자에게 보여준다.
   - 변경이 없으면 commit/push를 생략하고 "올릴 변경 없음"을 알린다.
2. **타입 체크** — `npm run type-check`. 실패하면 사용자에게 알리고, 그래도 올릴지 확인받는다.
3. **commit** — 의미 있는 메시지로 commit. 메시지는 작업 내용에서 도출하되, 애매하면 사용자에게 확인. (author = angels-fab / bliverus@gmail.com)
4. **push** — `git push origin main`. → main에 올라가면 GitHub Actions가 자동으로 빌드 후 `angels-fab.github.io`에 배포.
5. **마무리 요약** — 오늘 commit 목록, 배포 진행(1~2분 후 https://angels-fab.github.io/ 반영), 남은 미완 작업(있으면)을 가독성 형식으로 보고.

## 주의

- 자동배포가 잘 돌았는지 확인하려면 `angels-fab.github.io` 저장소에 `github-actions[bot]` 커밋이 새로 생겼는지 보면 된다.
- 민감정보(비밀번호·토큰)가 변경 diff에 섞이지 않았는지 commit 전에 점검한다.
