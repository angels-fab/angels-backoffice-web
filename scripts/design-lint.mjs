#!/usr/bin/env node
/**
 * design-lint — 디자인시스템 드리프트 탐지 (외부 의존성 없음).
 *
 * 새 메뉴/페이지가 손코딩으로 일관성을 깨는 걸 막는 "강제 장치".
 * 규칙 정본: docs/design-system.md 의 금지 목록.
 *
 * 탐지 항목(페이지·컴포넌트 한정, src/components/ds 와 index.css 미러링은 제외):
 *   - hex    : sx/style 에 hex 색 직접 (#RRGGBB) — 토큰/theme.palette 경유해야 함
 *   - font   : sx 에 fontSize 숫자 직접 — 타이포 사다리(variant/typescale) 사용
 *   - weight : sx 에 fontWeight 3자리 숫자 직접 — variant 굵기 위계 사용
 *   - radius : borderRadius 숫자/px 직접, 또는 bare `radius.X`(sx에서 ×shape.borderRadius=12배 부풀림 함정) — 안전형 `${radius.X}px`만 허용
 *   - shadow : boxShadow 문자열 리터럴 — shadow 3단 토큰만 허용
 *   - z      : zIndex 2자리 이상 리터럴 — theme.zIndex/토큰 참조 (0~9 로컬 스태킹 허용)
 *   - class  : className= 사용 — 새 화면은 index.css 클래스에 의존하지 않음
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

const CHECKS = [
  { key: 'hex', re: /['"`]#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/g },
  // 숫자 리터럴만 위반 — 토큰 경유(fontSize: iconSize.body 등)는 합법
  { key: 'font', re: /fontSize\s*:\s*['"`{]?\s*[\d.]/g },
  { key: 'weight', re: /fontWeight\s*:\s*['"`]?\d{3}/g },
  // 리터럴 숫자/px + bare `radius.X`(sx에서 12배 함정) 둘 다 위반. 안전형 `${radius.X}px`는 통과.
  { key: 'radius', re: /borderRadius\s*:\s*(?:['"`]?\d|radius\.)/g },
  { key: 'shadow', re: /boxShadow\s*:\s*['"`]/g },
  { key: 'z', re: /zIndex\s*:\s*['"`]?\d{2,}/g },
  { key: 'class', re: /className\s*=/g },
]

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
const totals = Object.fromEntries(CHECKS.map((c) => [c.key, 0]))

for (const f of files) {
  let src
  try {
    src = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  const counts = {}
  let score = 0
  for (const c of CHECKS) {
    const n = (src.match(c.re) || []).length
    counts[c.key] = n
    totals[c.key] += n
    score += n
  }
  if (score > 0) rows.push({ file: rel(f), ...counts, score })
}

rows.sort((a, b) => b.score - a.score)

const pad = (s, n) => String(s).padEnd(n)
const num = (s, n) => String(s).padStart(n)
const KEYS = CHECKS.map((c) => c.key)

console.log('\n  design-lint — 디자인시스템 드리프트 리포트')
console.log('  규칙: docs/design-system.md · docs/design-system-decisions.md\n')
if (rows.length === 0) {
  console.log('  ✅ 위반 없음.\n')
} else {
  console.log('  ' + pad('파일', 46) + KEYS.map((k) => num(k, 7)).join('') + num('합', 6))
  console.log('  ' + '-'.repeat(46 + KEYS.length * 7 + 6))
  for (const r of rows) {
    console.log('  ' + pad(r.file, 46) + KEYS.map((k) => num(r[k] || 0, 7)).join('') + num(r.score, 6))
  }
  console.log('  ' + '-'.repeat(46 + KEYS.length * 7 + 6))
  const grand = KEYS.reduce((s, k) => s + totals[k], 0)
  console.log('  ' + pad(`합계 (${rows.length}개 파일)`, 46) + KEYS.map((k) => num(totals[k], 7)).join('') + num(grand, 6))
}
console.log('\n  hex=색 font=fontSize weight=fontWeight radius=borderRadius shadow=boxShadow z=zIndex class=레거시CSS')
console.log('  신규 메뉴는 전부 0이어야 합니다. 기존 페이지는 P3 정렬로 감소 → P4에서 strict 전환.\n')

const violated = KEYS.some((k) => totals[k] > 0)
if ((strict || explicit.length) && violated) {
  console.error('  ✗ 위반이 발견되어 실패로 종료합니다.\n')
  process.exit(1)
}
