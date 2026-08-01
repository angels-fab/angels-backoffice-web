/**
 * 대비 감사 — **그려진 화면**을 재서 읽기 힘든 글자를 찾는다.
 *
 * 왜 필요한가: design-lint 는 "토큰을 쓰는가"를 센다. 그래서 `bgcolor: 'primary.main'` 처럼
 * 규칙을 지켰는데 **자리가 틀린** 경우를 못 잡는다(2026-08-02 실제 사고: 다크에서 밴드 위
 * 흰 글자가 1.88:1). 그 값은 반투명 겹침의 합성 결과라 코드만 봐서는 계산이 안 된다.
 * 이 스크립트는 실제 렌더 결과를 재므로 CSS·MUI 기본값·테마 재정의·알파 합성이 전부 반영된다.
 *
 * 쓰는 법 — 브라우저 콘솔에 이 파일 내용을 붙여넣고 실행. 두 테마 각각에서 돌릴 것.
 *   ※ 테마를 토글한 **직후에는 재지 말 것** — View Transitions 스냅샷 때문에 옛 색이 잡힌다.
 *     테마를 바꾼 뒤 새로고침하고 나서 실행한다.
 *
 * 기준(WCAG 1.4.3): 본문 4.5:1 · 큰 글자(24px+ 또는 18.66px+ 굵게) 3:1.
 */
;(() => {
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (s) => {
    const n = (s.match(/[\d.]+/g) || []).map(Number)
    return { r: n[0] || 0, g: n[1] || 0, b: n[2] || 0, a: n.length > 3 ? n[3] : 1 }
  }
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  })
  const ratio = (a, b) => {
    const l1 = lum(a.r, a.g, a.b), l2 = lum(b.r, b.g, b.b)
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
    return (hi + 0.05) / (lo + 0.05)
  }
  /** 요소 자신부터 위로 올라가며 불투명해질 때까지 배경을 합성한다 */
  const effBg = (el) => {
    const chain = []
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c.a > 0) chain.push(c)
      if (c.a === 1) break
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg)
    return bg
  }

  /**
   * 자동 판정이 불가능한 자리 — 건너뛴다.
   *
   * ★ 이 걸러내기가 없으면 도구를 못 믿는다. 처음 돌렸을 때 라이트 43건 중 29건이
   *   행사 포스터 위 흰 글자였다(1.08:1로 잡혔지만 실제로는 사진 위라 멀쩡하다).
   *   사진은 형제 absolute 요소나 background-image 라서 배경 합성으로는 안 잡힌다.
   *
   *   ① 조상에 background-image 가 있음 — 사진·그라데이션 위
   *   ② 겹쳐진 형제 이미지 위에 떠 있음 — 포스터 카드의 캡션·스크림
   *   ③ 비활성 컨트롤 — WCAG 1.4.3 이 명시적으로 예외로 둔다
   */
  const undecidable = (el) => {
    if (el.closest('[disabled], .Mui-disabled, [aria-disabled="true"]')) return '비활성'
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.backgroundImage !== 'none') return '이미지·그라데이션 배경'
      // 같은 스택 안에 절대배치 이미지가 깔려 있으면 그 위일 수 있다
      if (e.parentElement && [...e.parentElement.children].some((s) => {
        if (s === e) return false
        const c = getComputedStyle(s)
        return (s.tagName === 'IMG' || c.backgroundImage !== 'none') && c.position === 'absolute'
      })) return '겹쳐진 이미지 위'
      // ★ 불투명 배경을 만나면 거기서 멈춘다 — 그 위(사진 카드 등)는 이 글자에 안 닿는다.
      //   이 중단이 없으면 포스터 카드 **안**의 불투명 칩까지 "이미지 위"로 빠져나가
      //   진짜 미달(예: 흰 글자 on accent.purple 2.84:1)을 놓친다.
      if (parse(cs.backgroundColor).a === 1) break
    }
    return null
  }
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

  const rows = []
  const skipped = {}
  for (const el of document.querySelectorAll('*')) {
    // 글자를 직접 가진 잎 노드만
    if (el.children.length > 0) continue
    const txt = (el.textContent || '').trim()
    if (!txt) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
    const rect = el.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) continue
    const why = undecidable(el)
    if (why) { skipped[why] = (skipped[why] || 0) + 1; continue }

    const bg = effBg(el)
    const fg = over(parse(cs.color), bg) // 글자색도 반투명일 수 있다
    const r = ratio(fg, bg)

    // 큰 글자 완화 — 24px 이상, 또는 18.66px 이상이면서 굵게(700+)
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
    if (r >= need) continue

    rows.push({ txt: txt.slice(0, 18), size: cs.fontSize, weight: cs.fontWeight, fg: hex(fg), bg: hex(bg), r: +r.toFixed(2), need })
  }

  // 같은 (글자색, 배경색, 크기) 조합은 한 줄로 묶는다 — 같은 원인이면 한 번만 고치면 된다
  const groups = new Map()
  for (const x of rows) {
    const k = `${x.fg}|${x.bg}|${x.size}|${x.need}`
    const g = groups.get(k) || { ...x, n: 0, 예: [] }
    g.n++
    if (g.예.length < 3) g.예.push(x.txt)
    groups.set(k, g)
  }
  const out = [...groups.values()].sort((a, b) => a.r - b.r)

  return {
    테마: document.documentElement.getAttribute('data-theme'),
    경로: location.hash,
    미달건수: rows.length,
    미달종류: out.length,
    // 자동 판정 불가로 건너뛴 것 — **눈으로 봐야 한다**. 0 이 아니면 그 화면은 사람이 확인할 것
    건너뜀: skipped,
    목록: out.map((g) => ({
      대비: `${g.r} / ${g.need}`,
      글자: g.fg,
      배경: g.bg,
      크기: `${g.size} ${g.weight}`,
      건수: g.n,
      예: g.예.join(' · '),
    })),
  }
})()
