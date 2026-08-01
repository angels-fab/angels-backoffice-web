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
 *   node scripts/design-lint.mjs --ratchet      # 래칫: 기준선보다 '늘어나면' exit 1 (커밋 훅용)
 *   node scripts/design-lint.mjs --accept       # 현재 상태를 새 기준선으로 기록
 *
 * 래칫을 쓰는 이유: 지금 위반이 600건대라 --strict 를 켜면 어떤 커밋도 통과하지 못한다.
 * 대신 "더 나빠지지만 않으면 통과"로 두면, 새 코드는 깨끗하게 강제되고 기존은 점진적으로 줄어든다.
 * 파일 단위로도 비교한다 — A파일 5건 고치고 B파일 5건 늘리는 걸 총합만 보면 놓치기 때문.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs'
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
  // ★ radius.circle 만 예외 — 값이 '50%' **문자열**이라 MUI 의 shape.borderRadius(12) 곱셈을
  //   타지 않는다(숫자만 곱해진다). 원형은 px 로 쓸 수도 없어 이 형태가 유일한 정답이다.
  { key: 'radius', re: /borderRadius\s*:\s*(?:['"`]?\d|radius\.(?!circle\b))/g },
  { key: 'shadow', re: /boxShadow\s*:\s*['"`]/g },
  { key: 'z', re: /zIndex\s*:\s*['"`]?\d{2,}/g },
  { key: 'class', re: /className\s*=/g },
]

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const ratchet = args.includes('--ratchet')
const accept = args.includes('--accept')
const explicit = args.filter((a) => !a.startsWith('--'))
const BASELINE = join(ROOT, 'scripts', 'design-lint-baseline.json')

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
  // 세기 전에 두 가지를 걷어낸다 — 안 그러면 "빚"이 아닌 것까지 빚으로 잡힌다.
  //   ① 주석 — 설명문에 적힌 hex 는 화면에 안 나온다("구 #7D8899 는 …" 같은 이력 서술)
  //   ② design-lint-ok 가 달린 줄 — 토큰화가 **틀린** 자리(벤더 브랜드색, 사진 위 전용 색 등).
  //      반드시 같은 줄에 이유를 적을 것. 이유 없는 면제는 그냥 빚을 숨기는 것이다.
  // ★ 면제 표시를 먼저 걸러야 한다 — 주석을 먼저 지우면 같은 줄의 design-lint-ok 가 함께
  //   사라져서 그 줄의 hex 가 도로 잡힌다.
  const scanned = src
    .split('\n')
    .filter((l) => !l.includes('design-lint-ok'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

  const counts = {}
  let score = 0
  for (const c of CHECKS) {
    const n = (scanned.match(c.re) || []).length
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

// 래칫/기록 모드는 커밋 훅에서 매번 도는 곳이라 68줄 표를 찍지 않는다(요약만).
const quiet = ratchet || accept
if (!quiet) {
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
}

const violated = KEYS.some((k) => totals[k] > 0)

// ── 래칫 ── 기준선 대비 '증가'만 막는다. 같거나 줄면 통과.
if (ratchet || accept) {
  const grand = KEYS.reduce((s, k) => s + totals[k], 0)
  const current = { total: grand, totals: { ...totals }, files: Object.fromEntries(rows.map((r) => [r.file, r.score])) }

  if (accept) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
    console.log(`  ✓ 기준선 기록: 합계 ${grand}건 (${rows.length}개 파일)\n`)
    process.exit(0)
  }

  if (!existsSync(BASELINE)) {
    console.error('  ✗ 기준선 파일이 없습니다. 먼저 `npm run design-lint:accept` 를 실행하세요.\n')
    process.exit(1)
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'))

  // 파일 단위 증가 — 새 파일에 위반이 있으면 그것도 증가로 본다(신규 코드는 깨끗해야 함)
  const worse = []
  for (const [file, score] of Object.entries(current.files)) {
    const was = base.files?.[file] ?? 0
    if (score > was) worse.push({ file, was, now: score })
  }
  const better = Object.entries(base.files || {}).reduce((n, [file, was]) => {
    const now = current.files[file] ?? 0
    return n + (now < was ? was - now : 0)
  }, 0)

  console.log(`  래칫: 기준선 ${base.total}건 → 현재 ${grand}건`)
  if (worse.length) {
    console.error('\n  ✗ 아래 파일에서 위반이 늘었습니다. 토큰(theme.palette / typescale / radius / shadow)을 쓰세요.')
    for (const w of worse) console.error(`      ${w.file}  ${w.was} → ${w.now}`)
    console.error('\n  의도한 증가라면 `npm run design-lint:accept` 로 기준선을 갱신하세요.\n')
    process.exit(1)
  }
  console.log(`  ✓ 증가 없음${better ? ` (${better}건 감소)` : ''}. 통과.\n`)
  if (grand < base.total) console.log('  (줄었습니다 — `npm run design-lint:accept` 로 기준선을 낮춰 두면 되돌아가는 걸 막습니다.)\n')
  process.exit(0)
}

if ((strict || explicit.length) && violated) {
  console.error('  ✗ 위반이 발견되어 실패로 종료합니다.\n')
  process.exit(1)
}
