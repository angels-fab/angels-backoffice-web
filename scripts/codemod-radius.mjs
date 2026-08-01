#!/usr/bin/env node
/**
 * codemod-radius — borderRadius 리터럴을 토큰으로.
 *
 * 값이 바뀌지 않는 두 가지만 다룬다:
 *   '50%'          → radius.circle   (문자열 그대로. MUI 는 문자열에 shape 배수를 안 곱한다)
 *   '999px' / 999  → `${radius.pill}px`
 * 사다리에 없는 값(0·1·2·3·4·14·20·24 등)은 건드리지 않고 목록만 보고한다 — 판단이 필요하다.
 *
 * ★ 999(숫자)는 지금 MUI 가 shape.borderRadius(12)를 곱해 11988px 로 렌더된다.
 *   알약처럼 보이긴 하나 의도한 값이 아니므로 px 문자열로 고정한다.
 *
 * 사용: node scripts/codemod-radius.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const SCAN = ['src/pages', 'src/components', 'src/layouts']
const SKIP = ['src/theme/']
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

const files = walk(join(ROOT, 'src')).filter((p) => SCAN.some((s) => rel(p).startsWith(s)) && !SKIP.some((s) => rel(p).startsWith(s)))

let changed = 0
let circleHits = 0
let pillHits = 0
const offLadder = new Map()

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  let out = src
  let used = false

  // '50%' → radius.circle
  out = out.replace(/borderRadius:\s*'50%'/g, () => { circleHits++; used = true; return 'borderRadius: radius.circle' })
  // '999px' 또는 999 → `${radius.pill}px`
  out = out.replace(/borderRadius:\s*'999px'/g, () => { pillHits++; used = true; return 'borderRadius: `${radius.pill}px`' })
  out = out.replace(/borderRadius:\s*999\b(?!\s*px)/g, () => { pillHits++; used = true; return 'borderRadius: `${radius.pill}px`' })

  // 남은 리터럴 수집(보고용)
  for (const m of out.matchAll(/borderRadius:\s*'?([0-9][0-9a-z %]*)'?/g)) {
    const v = m[1].trim()
    offLadder.set(v, [...(offLadder.get(v) || []), rel(f)])
  }

  if (out === src) continue

  // radius import 보강 — 여러 줄 import 블록 한가운데 끼어들지 않게 '문장이 끝나는 줄'을 찾는다
  const importLines = out.split('\n').filter((l) => l.startsWith('import') || /^\}\s*from/.test(l)).join('\n')
  if (used && !/\bradius\b/.test(importLines)) {
    const m = out.match(/^import \{([^}]*)\} from '([^']*theme\/tokens)'$/m)
    if (m) {
      const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      if (!names.includes('radius')) names.push('radius')
      out = out.replace(m[0], `import { ${names.join(', ')} } from '${m[2]}'`)
    } else {
      const lines = out.split('\n')
      let last = -1, inBlock = false
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        if (inBlock) { if (/^\}\s*from\s*'[^']*'/.test(l)) { inBlock = false; last = i } ; continue }
        if (/^import\b/.test(l)) {
          if (/\bfrom\s*'[^']*'|^import\s*'[^']*'/.test(l)) last = i
          else inBlock = true
        }
      }
      lines.splice(last + 1, 0, `import { radius } from '@/theme/tokens'`)
      out = lines.join('\n')
    }
  }

  changed++
  if (!dry) writeFileSync(f, out)
}

console.log(`\n  ${dry ? '[미리보기] ' : ''}파일 ${changed}개 · 원형 ${circleHits}건 · 알약 ${pillHits}건 치환\n`)
if (offLadder.size) {
  console.log('  토큰에 없어 그대로 둔 값(판단 필요):')
  ;[...offLadder.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([v, fs]) => {
    const u = [...new Set(fs)]
    console.log(`    ${String(v).padStart(6)}  ${String(fs.length).padStart(2)}건  ${u.slice(0, 2).join(', ')}${u.length > 2 ? ` 외 ${u.length - 2}` : ''}`)
  })
  console.log('')
}
