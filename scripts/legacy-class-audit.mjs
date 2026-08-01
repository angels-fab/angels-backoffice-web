#!/usr/bin/env node
/**
 * legacy-class-audit — 남은 레거시 CSS className을 "이관 난이도"로 분류한다.
 *
 * design-lint 의 class 항목은 건수만 세는데, 실제로 손대려면 건수보다
 * **성격**이 중요하다. 같은 1건이어도 아래 셋은 전혀 다른 작업이다:
 *   순수장식  — sx 로 그냥 옮기면 끝
 *   JS참조    — querySelector/closest/matches 가 이 클래스를 찾는다. 지우면 기능이 죽는다
 *   전역선택자 — :hover 안의 자손 선택자, 애니메이션 keyframes, 남의 라이브러리(fc-*) 대상
 *
 * 사용: node scripts/legacy-class-audit.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['src/pages', 'src/components', 'src/layouts']

function walk(dir) {
  const out = []
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const name of entries) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}
const rel = (p) => relative(ROOT, p).split(sep).join('/')

const files = walk(join(ROOT, 'src'))
const tsx = files.filter((p) => SCAN.some((s) => rel(p).startsWith(s)))

const css = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
// 모든 소스(JS 참조 탐지용) — css 파일 제외
const allSrc = files.map((p) => ({ f: rel(p), s: readFileSync(p, 'utf8') }))

/** className= 안의 클래스 토큰만 뽑는다(템플릿 리터럴·조건식 포함) */
const classesIn = (src) => {
  const found = new Set()
  for (const m of src.matchAll(/className=(?:"([^"]*)"|'([^']*)'|\{([^}]*(?:\{[^}]*\}[^}]*)*)\})/g)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? ''
    for (const t of raw.match(/[a-z][a-z0-9-]*[a-z0-9]/g) || []) {
      // JSX 식별자·연산자 걸러내기: CSS에 실제로 정의됐거나 하이픈이 있는 것만
      if (t.includes('-') || new RegExp(`\\.${t}[\\s,:.{>+~\\[]`).test(css)) found.add(t)
    }
  }
  return found
}

/**
 * sx 안의 자손 선택자가 이 클래스를 겨냥하는가 — `'&:hover .att-dl': {...}` 꼴.
 * 이건 레거시가 아니라 현대적인 sx 패턴이다(부모 sx가 자식을 제어). index.css 와 무관.
 */
const sxHook = (cls) => {
  const pat = new RegExp(`['"\`][^'"\`]*\\.${cls}\\b[^'"\`]*['"\`]\\s*:`)
  return allSrc.filter(({ s }) => pat.test(s)).map(({ f }) => f)
}

/** 이 클래스를 JS가 문자열로 찾는가 (querySelector/closest/matches/classList 등) */
const jsRefs = (cls) => {
  const hits = []
  const pat = new RegExp(`(querySelector\\w*|closest|matches|classList\\.\\w+|getElementsBy\\w+)\\([^)]*['"\`][^'"\`]*\\b${cls}\\b`)
  for (const { f, s } of allSrc) if (pat.test(s)) hits.push(f)
  return hits
}

/** CSS 규칙에서 이 클래스가 "자손/조합 선택자"의 일부인가 (단독 .x{} 만이면 옮기기 쉬움) */
const cssShape = (cls) => {
  const rules = [...css.matchAll(new RegExp(`^([^{}\\n]*\\.${cls}\\b[^{}\\n]*)\\{`, 'gm'))].map((m) => m[1].trim())
  if (!rules.length) return { rules: [], solo: false, combinator: false, keyframe: false }
  const solo = rules.some((r) => r === `.${cls}`)
  const combinator = rules.some((r) => /[ >+~]/.test(r.replace(new RegExp(`^\\.${cls}`), '').trim()) || r.split(',').some((p) => p.trim() !== `.${cls}` && p.includes(`.${cls}`) && /[ >+~]/.test(p.trim())))
  return { rules, solo, combinator }
}

const rows = []
for (const p of tsx) {
  const src = readFileSync(p, 'utf8')
  for (const c of classesIn(src)) rows.push({ file: rel(p), cls: c })
}

const byClass = new Map()
for (const r of rows) byClass.set(r.cls, [...(byClass.get(r.cls) || []), r.file])

const buckets = { sx: [], js: [], external: [], combinator: [], plain: [], undefined_: [] }
for (const [cls, fs] of byClass) {
  const js = jsRefs(cls)
  const sx = sxHook(cls)
  const shape = cssShape(cls)
  const entry = { cls, files: [...new Set(fs)], n: fs.length, rules: shape.rules }
  // sx 후크가 우선 — index.css 규칙이 없는데 sx 가 겨냥하면 그건 이미 현대식이다
  if (sx.length && !shape.rules.length) { entry.js = sx; buckets.sx.push(entry) }
  else if (js.length) { entry.js = js; buckets.js.push(entry) }
  else if (/^(fc|MuiDataGrid)-/.test(cls)) buckets.external.push(entry)
  else if (!shape.rules.length) buckets.undefined_.push(entry)
  else if (shape.combinator) buckets.combinator.push(entry)
  else buckets.plain.push(entry)
}

const show = (title, list, note) => {
  const total = list.reduce((a, b) => a + b.n, 0)
  console.log(`\n  ${title} — 클래스 ${list.length}종 / ${total}건`)
  if (note) console.log(`    ${note}`)
  list.sort((a, b) => b.n - a.n).forEach((e) => {
    const f = [...new Set(e.files)]
    console.log(`      ${e.cls.padEnd(22)} ${String(e.n).padStart(2)}건  ${f[0].replace('src/', '')}${f.length > 1 ? ` 외 ${f.length - 1}` : ''}`)
    if (e.js) console.log(`        └ JS 참조: ${e.js.map((x) => x.replace('src/', '')).join(', ')}`)
  })
}

show('⓪ sx 자손 선택자의 표적 — 레거시 아님, 유지', buckets.sx, "'&:hover .att-dl' 처럼 부모 sx 가 자식을 겨냥한다. index.css 와 무관")
show('① JS가 찾는 클래스 — 삭제 금지', buckets.js, 'sx로 옮기려면 data-* 속성으로 먼저 갈아타야 한다')
show('② 외부 라이브러리 대상', buckets.external, 'FullCalendar 등 남의 DOM을 겨냥한 것. 유지')
show('③ 조합/자손 선택자에 얽힘', buckets.combinator, '부모-자식 규칙이라 한쪽만 옮기면 깨진다. 짝으로 옮길 것')
show('④ 단독 규칙 — sx 이관 쉬움', buckets.plain)
show('⑤ CSS에 정의 없음 — 죽은 className', buckets.undefined_, 'JSX에만 있고 index.css에 규칙이 없다. 지우면 끝')

const t = (l) => l.reduce((a, b) => a + b.n, 0)
const real = t(buckets.combinator) + t(buckets.plain) + t(buckets.undefined_)
console.log(`\n  합계 ${real + t(buckets.sx) + t(buckets.js) + t(buckets.external)}건 ` +
  `— 유지 ${t(buckets.sx) + t(buckets.external)}(sx후크 ${t(buckets.sx)} · 외부 ${t(buckets.external)}) · ` +
  `선행작업 필요 ${t(buckets.js)}(JS참조) · **실제 이관 대상 ${real}**(조합 ${t(buckets.combinator)} · 단독 ${t(buckets.plain)} · 죽음 ${t(buckets.undefined_)})\n`)
