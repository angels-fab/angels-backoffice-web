/**
 * 업무카드 셀이 **선택·드래그·더블클릭 판정에서 건너뛰어야 할 것**들 (2026-08-07).
 *
 * 카드가 드래그로 순서를 바꾸는 그리드 셀 안에 있어서, 셀은 카드 위의 클릭을 캡처 단계에서
 * 가로채 '카드 선택'으로 바꾼다. 카드 안에 버튼·링크만 있을 때는 그 둘만 빼면 충분했는데,
 * **카드 안에 메모(입력칸·공유 고르기·확인창)가 들어오면서** 빼야 할 것이 늘었다.
 *
 * 특히 두 가지가 눈에 안 띈다:
 *  · MUI Autocomplete 의 후보 목록과 Dialog 의 어두운 배경은 **DOM 상 카드 밖(Portal)** 이지만
 *    React 트리로는 카드 안이라, 셀의 캡처 핸들러가 그대로 먼저 받는다. 그래서 이름을 눌러도
 *    칩이 안 붙고 카드만 선택됐고, 확인창 배경을 눌러도 안 닫혔다(적대적 리뷰 실측).
 *    DOM 부모가 카드가 아니므로 카드에 붙인 표시(data-card-notes)로는 못 걸러 **팝업 뿌리 클래스**로 건다.
 *  · 입력칸(input·textarea)은 클릭 판정에서만 빠져 있었고 **드래그·더블클릭 판정에는 빠져 있지 않았다**.
 *    그래서 메모를 쓰다 3px만 끌어도 카드가 들려 초안이 날아가고, 단어를 더블클릭하면 수정 폼으로 튀었다.
 *
 * 세 판정(pointerdown·clickCapture·dblclick)이 같은 목록을 쓰게 여기 한 곳에 둔다 —
 * 하나만 빠뜨리는 것이 지금까지의 사고 원인이었다.
 */
export const CARD_SKIP =
  'button, a, input, textarea, [contenteditable], [data-card-notes], .MuiAutocomplete-popper, .MuiModal-root'

/** 이 지점의 조작을 카드 선택·드래그로 해석하면 안 되는가 */
export const skipCardGesture = (el: EventTarget | null) =>
  el instanceof HTMLElement || el instanceof SVGElement
    ? !!(el as Element).closest(CARD_SKIP)
    : false
