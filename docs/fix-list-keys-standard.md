# 목록 키 동작을 워드·노션 표준으로 (2026-08-04)

사용자 신고: "bullet 글에서 엔터로 줄바꿈하면 자동 bullet 생성되는데, bullet 지우려고 backspace 누르면 위로 올라가버림. 이런 계층 글쓰기 표준규칙 같은 데 있나."

## 표준 규칙과 적용 전 상태

| 키 | 표준(워드·한글·구글 문서·노션) | 적용 전 |
|---|---|---|
| Enter | 같은 단계에 새 항목 | ✅ |
| Enter (빈 항목) | 목록에서 빠져나옴 | ✅ |
| Tab / Shift+Tab | 한 단계 들여쓰기 / 내어쓰기 | ✅ |
| **줄 맨 앞 Backspace** | 글머리만 없애고 한 단계 내어쓰기(1단계면 목록 해제) | ❌ 윗줄에 합쳐짐 |
| **Shift+Enter** | 같은 항목 안에서 줄바꿈 | ❌ 없음 |

`@tiptap/extension-list-keymap`(TipTap 공식)을 먼저 시험했으나 **Backspace에서 윗줄과 글자를 합쳐 버려**(`상위 항목① 하위 내용`) 표준과 달랐다. 패키지를 제거하고 규칙을 직접 넣었다.

## 수정 — `src/components/richText.tsx`

`listExtensions`에 `ListStandardKeys` 추가:

- `Backspace` — 커서만 있고(선택 없음) 줄 맨 앞이며, 그 줄이 **목록 항목의 첫 문단**일 때만 `liftListItem`. 그 외(항목에 딸린 후속 줄, 목록 밖 문단)는 기본 동작 유지.
- `Shift-Enter` — 목록 항목 안이면 `splitBlock`(같은 항목에 새 줄). 목록 밖에서는 기본 동작.

두 에디터(`RichContentEditor` 업무, `RichBodyEditor` 공지·개선요청·코멘트)가 `listExtensions`를 공유하므로 동시에 적용된다.

## 검증 — jsdom 헤드리스 실측

실제 `richText.tsx`의 `listExtensions`를 그대로 번들해 키를 눌러 본 결과(문서 구조 출력):

| 상황 | 결과 |
|---|---|
| 항목 맨 앞 Backspace | 목록에서 빠져 일반 문단으로 — 글자 안 합쳐짐 ✅ |
| 중첩 항목 맨 앞 Backspace | 한 단계 내어쓰기 ✅ |
| Enter로 생긴 빈 글머리에서 Backspace | 줄은 남고 글머리만 사라짐(커서 안 올라감) ✅ |
| 항목 끝에서 Shift+Enter | 같은 항목 안 새 줄 ✅ |
| 항목 끝에서 Enter | 새 항목 (회귀 없음) ✅ |
| 항목 안 후속 줄 맨 앞 Backspace | 윗줄과 합쳐짐 (기본 동작 유지) ✅ |
| 목록 밖 문단 맨 앞 Backspace | 윗줄과 합쳐짐 (기본 동작 유지) ✅ |

`npm run type-check` 통과.

## 글쓰기 방법 변화

`•` 항목에 딸린 `①②③` 줄을 쓸 때:

- **Shift+Enter**로 줄을 넘긴다 → 항목 안에 남아 카드에서 18px 들여쓰기([fix-work-card-indent.md](fix-work-card-indent.md)).
- Enter 후 Backspace로 글머리를 지우면 그 줄은 **목록 밖 일반 문단**이 되어 들여쓰기가 없다. 이때는 앞에 공백 2칸을 넣으면 같은 18px가 된다.

## 알려진 소소한 점

`ㅇ1 ` 입력 규칙(`RichContentEditor`의 `CircledNumRule`)은 `①` 앞에 공백 2칸을 함께 넣는다. 목록 항목 안에서 쓰면 목록 한 단계(18px) + 공백 2칸(18px) = 36px로 다른 줄(18px)보다 깊어진다. 목록 안에서는 공백을 넣지 않도록 조건 한 줄을 더하면 맞출 수 있다(미적용 — 사용자 판단 대기).
