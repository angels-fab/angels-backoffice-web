# 업무 카드 — 목록 항목 안 후속 문단 들여쓰기 복구 (2026-08-04)

사용자 신고: "업무현황 카드에 버그가 생겼다. bullet, 동그라미숫자 계층간 들여쓰기가 없어졌다."

## 증상 (실측)

`docToBodyLines`를 실제 DB 데이터(Supabase `works.content_fmt`)로 그대로 실행해 줄별 `indentPx`를 측정.

| 업무 | 저장 형태 | 상위 `•` | 하위 `①` (수정 전) |
|---|---|---|---|
| 149 | 목록 항목 안 후속 문단, 앞 공백 0칸 | 0px | **0px** — 상위와 완전히 같은 자리 |
| 152 | 목록 항목 안 후속 문단, 앞 공백 1칸 | 0px | **0px** (공백 1칸은 단계 스냅에서 0) |
| 153 | 목록 밖 최상위 문단, 앞 공백 2칸 | 0px | 18px (정상) |

상위 `•` 줄의 **본문**은 약 15px에서 시작하므로, 0px인 하위 `①`이 부모 본문보다 왼쪽에 찍혀 계층이 사라져 보였다.

## 원인

`flattenBlocks`가 `listItem`의 **후속 문단**(항목 제목 아래 딸린 ①②③ 줄)에 마커 줄과 **같은** `depth * LIST_INDENT_PX`를 줬다. 1단계 목록이면 둘 다 0px.

에디터는 같은 문단을 `.wc-editor ul{padding-left:18px}`로 18px에 그리므로 **작성 화면 18px ↔ 카드 0px** 불일치. 앞 공백 → 단계 스냅(`lineMeta`)은 이미 반영돼 있어 목록 밖 문단(153)은 정상이었고, **목록 안 후속 문단만** 남아 있던 구멍이다.

렌더 로직 회귀는 아니다(목록 도입 2026-07-10 이후 무변경). 8/3~8/4 편집으로 상위 줄이 진짜 `bulletList`가 되면서 부모 본문만 오른쪽으로 밀려 격차가 드러났다.

## 수정 — `src/pages/Work/richContent.tsx` 한 줄

```diff
-          out.push(paragraphToBodyLine(c, depth * LIST_INDENT_PX, markerUsed ? undefined : marker))
+          out.push(paragraphToBodyLine(c, (depth + (markerUsed ? 1 : 0)) * LIST_INDENT_PX, markerUsed ? undefined : marker))
```

마커 줄(항목 첫 문단)은 값이 그대로, 후속 문단만 한 단계(18px) 더. 중첩 목록(`depth + 1`)도 무변경.

## 검증

- `npm run type-check` 통과.
- 실제 DB 문서로 재실측: 149·152·153·구버전 평문(135) 모두 상위 `•` 0px / 하위 `①` **18px**로 정렬. 중첩 목록(Tab) 18px·평문 1칸 들여쓴 줄(123) 0px은 수정 전과 동일(회귀 없음).

## 남은 항목 (범위 밖)

- 입력 쪽: `RichContentEditor`의 `CircledNumRule`이 넣는 공백과 목록 구조가 이중으로 계층을 표현한다. ① 줄을 앞 listItem의 후속 문단으로 넣도록 정리하면 공백 의존이 사라진다.
- 149·150처럼 앞 공백 0칸으로 저장된 데이터는 이제 목록 구조에만 의존한다 — 목록 밖으로 빠져나간 ① 문단(153 유형)은 에디터에서 여전히 납작하게 보인다.
