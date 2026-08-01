#!/usr/bin/env node
/**
 * codemod-typescale — sx 의 fontSize/fontWeight 숫자 리터럴을 토큰 참조로 바꾼다.
 *
 * 왜 스크립트인가: 300건이 50여 파일에 흩어져 있어 손으로 하면 오타·누락이 난다.
 * 값은 1:1 대응만 바꾼다(같은 숫자 → 같은 숫자를 가리키는 토큰) — 화면은 변하지 않는다.
 * 사다리에 없는 값(9.5·10·15·26·34…)은 건드리지 않고 목록만 보고한다(판단이 필요한 것들).
 *
 * 사용:
 *   node scripts/codemod-typescale.mjs --dry   # 무엇이 바뀌는지만 출력
 *   node scripts/codemod-typescale.mjs         # 실제 적용
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['src/pages', 'src/components', 'src/layouts']
// 토큰 정의 자체와 테마는 제외 — 여기서 숫자를 쓰는 건 정본이라 정상이다.
const SKIP = ['src/theme/', 'src/components/ds/tableStyle.ts']

/** typescale 의 size 값 → 토큰 경로 */
const SIZE = {
  11: 'typescale.caption.size',
  12: 'typescale.small.size',
  13: 'typescale.body.size',
  14: 'typescale.emphasis.size',
  16: 'typescale.cardTitle.size',
  18: 'typescale.sectionTitle.size',
  22: 'typescale.pageTitle.size',
  28: 'typescale.display.size',
}
/** 굵기 → weight 토큰 */
const WEIGHT = {
  400: 'weight.regular',
  500: 'weight.medium',
  600: 'weight.semibold',
  700: 'weight.bold',
  800: 'weight.heavy',
}

const dry = process.argv.includes('--dry')

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

const files = SCAN.flatMap((d) => walk(join(ROOT, d))).filter((p) => !SKIP.some((s) => rel(p).startsWith(s) || rel(p) === s))

let changedFiles = 0
let sizeHits = 0
let weightHits = 0
const offLadder = new Map() // 값 → [파일…]

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  let out = src
  let usedTypescale = false
  let usedWeight = false

  // fontSize: <숫자>  (뒤에 px 단위 문자열이 아닌 순수 숫자만)
  out = out.replace(/fontSize:\s*([0-9]+(?:\.[0-9]+)?)\b(?!\s*px)/g, (m, num) => {
    const tok = SIZE[Number(num)]
    if (!tok) {
      const k = String(num)
      offLadder.set(k, [...(offLadder.get(k) || []), rel(f)])
      return m
    }
    usedTypescale = true
    sizeHits++
    return `fontSize: ${tok}`
  })

  // fontWeight: <숫자>
  out = out.replace(/fontWeight:\s*([0-9]{3})\b/g, (m, num) => {
    const tok = WEIGHT[Number(num)]
    if (!tok) return m
    usedWeight = true
    weightHits++
    return `fontWeight: ${tok}`
  })

  if (out === src) continue

  // import 보강 — '@/theme/tokens' 또는 상대경로 import 가 이미 있으면 거기에 끼워 넣는다.
  const need = []
  if (usedTypescale && !/\btypescale\b/.test(src.split('\n').filter((l) => l.startsWith('import')).join('\n'))) need.push('typescale')
  if (usedWeight && !/\bweight\b/.test(src.split('\n').filter((l) => l.startsWith('import')).join('\n'))) need.push('weight')

  if (need.length) {
    const m = out.match(/^import \{([^}]*)\} from '([^']*theme\/tokens)'$/m)
    if (m) {
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      for (const n of need) if (!names.includes(n)) names.push(n)
      out = out.replace(m[0], `import { ${names.join(', ')} } from '${m[2]}'`)
    } else {
      // tokens import 자체가 없으면 마지막 import '문장'이 끝나는 줄 뒤에 새로 추가.
      // ★ 'import ' 로 시작하는 마지막 줄을 찾으면 안 된다 — 여러 줄 import 의 첫 줄(`import {`)이
      //   걸려서 그 블록 한가운데에 끼어든다(실제로 _LayoutSystem 이 그렇게 깨졌다).
      const lines = out.split('\n')
      let last = -1
      let inBlock = false
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (inBlock) {
          if (/^\}\s*from\s*'[^']*'/.test(l)) { inBlock = false; last = i }
          continue
        }
        if (/^import\b/.test(l)) {
          if (/\bfrom\s*'[^']*'|^import\s*'[^']*'/.test(l)) last = i // 한 줄로 끝나는 import
          else inBlock = true // `import {` 로 시작하는 여러 줄 import
        }
      }
      lines.splice(last + 1, 0, `import { ${need.join(', ')} } from '@/theme/tokens'`)
      out = lines.join('\n')
    }
  }

  changedFiles++
  if (!dry) writeFileSync(f, out)
}

console.log(`\n  ${dry ? '[미리보기] ' : ''}파일 ${changedFiles}개 · fontSize ${sizeHits}건 · fontWeight ${weightHits}건 치환\n`)

if (offLadder.size) {
  console.log('  사다리에 없어 그대로 둔 크기(판단 필요):')
  ;[...offLadder.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([v, fs]) => {
    const uniq = [...new Set(fs)]
    console.log(`    ${String(v).padStart(5)}px  ${String(fs.length).padStart(3)}건  ${uniq.slice(0, 3).join(', ')}${uniq.length > 3 ? ` 외 ${uniq.length - 3}` : ''}`)
  })
  console.log('')
}
