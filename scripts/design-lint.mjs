#!/usr/bin/env node
/**
 * design-lint — 디자인시스템 드리프트 탐지 (외부 의존성 없음).
 *
 * 새 메뉴/페이지가 손코딩으로 일관성을 깨는 걸 막는 "강제 장치".
 * 규칙 정본: docs/design-system.md 의 금지 목록.
 *
 * 탐지 항목(페이지·컴포넌트 한정, src/components/ds 와 index.css 미러링은 제외):
 *   - hardcoded-hex     : sx/style 에 hex 색 직접 (#RRGGBB) — 토큰/theme.palette 경유해야 함
 *   - hardcoded-font    : sx 에 fontSize 숫자 직접 — 타이포 위계(variant) 사용해야 함
 *   - legacy-classname  : className= 사용 — 새 화면은 index.css 클래스에 의존하지 않음
 *
 * 사용:
 *   node scripts/design-lint.mjs                # 전체 베이스라인 리포트(어드바이저리, exit 0)
 *   node scripts/design-lint.mjs --strict       # 위반 있으면 exit 1
 *   node scripts/design-lint.mjs src/pages/X.tsx  # 특정 파일만(신규 메뉴 게이트 → 위반시 exit 1)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src/pages', 'src/components', 'src/layouts']
// ds 컴포넌트는 토큰을 정의/캡슐화하는 곳이라 제외. index.css 는 레거시 미러라 별도.
const EXCLUDE = ['src/components/ds']

const HEX = /['"`]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/g
const FONT = /fontSize\s*:/g
const CLASSNAME = /className\s*=/g

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const explicit = args.filter((a) => !a.startsWith('--'))

function walk(dir) {
  const out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(tsx|ts)$/.test(name)) out.push(p)
  }
  return out
}

function rel(p) {
  return relative(ROOT, p).split(sep).join('/')
}

let files
if (explicit.length) {
  files = explicit.map((p) => join(ROOT, p))
} else {
  files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))
}
// ds/ 는 디자인시스템 자체(정본 값 캡슐화)라 항상 예외 — 명시 경로에도 적용
files = files.filter((p) => !EXCLUDE.some((e) => rel(p).startsWith(e)))

const rows = []
let totHex = 0
let totFont = 0
let totCls = 0

for (const f of files) {
  let src
  try {
    src = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  const hex = (src.match(HEX) || []).length
  const font = (src.match(FONT) || []).length
  const cls = (src.match(CLASSNAME) || []).length
  const score = hex + font + cls
  totHex += hex
  totFont += font
  totCls += cls
  if (score > 0) rows.push({ file: rel(f), hex, font, cls, score })
}

rows.sort((a, b) => b.score - a.score)

const pad = (s, n) => String(s).padEnd(n)
const num = (s, n) => String(s).padStart(n)

console.log('\n  design-lint — 디자인시스템 드리프트 리포트')
console.log('  규칙: docs/design-system.md (금지 목록)\n')
if (rows.length === 0) {
  console.log('  ✅ 위반 없음.\n')
} else {
  console.log('  ' + pad('파일', 52) + num('hex', 5) + num('font', 6) + num('class', 7) + num('합', 5))
  console.log('  ' + '-'.repeat(75))
  for (const r of rows) {
    console.log('  ' + pad(r.file, 52) + num(r.hex, 5) + num(r.font, 6) + num(r.cls, 7) + num(r.score, 5))
  }
  console.log('  ' + '-'.repeat(75))
  console.log(
    '  ' + pad(`합계 (${rows.length}개 파일)`, 52) + num(totHex, 5) + num(totFont, 6) + num(totCls, 7) + num(totHex + totFont + totCls, 5),
  )
}
console.log('\n  hex=하드코딩 색  font=하드코딩 fontSize  class=className(레거시 CSS)')
console.log('  신규 메뉴는 이 세 값이 0이어야 합니다. 기존 페이지는 이관하며 점진 감소.\n')

const violated = totHex + totFont + totCls > 0
if ((strict || explicit.length) && violated) {
  console.error('  ✗ 위반이 발견되어 실패로 종료합니다.\n')
  process.exit(1)
}
