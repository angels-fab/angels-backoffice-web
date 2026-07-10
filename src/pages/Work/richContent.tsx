import type { CSSProperties, ReactNode } from 'react'
import type { WorkItem } from '@/types'

/**
 * 업무내용 서식(리치 텍스트) 공용 모듈.
 *
 * 저장 형식: '업무내용서식' 열에 **버전 포함 구조화 JSON 문자열**을 저장한다.
 *   { "version": 1, "doc": <ProseMirror doc> }
 * - doc = 본문(제목 제외)만. 허용 노드는 paragraph/text, 허용 mark는 bold/italic/underline/strike/colorToken 뿐.
 * - 파싱 실패·알 수 없는 버전·손상 데이터는 null → 호출부가 기존 '업무내용' 일반 텍스트로 대체 표시.
 * - 임의 HTML/script/style/event handler 등 실행 가능한 데이터는 저장·렌더링하지 않는다(허용 노드/mark만 통과).
 * - 과거 버전이 저장한 highlightToken(형광펜) mark는 더 이상 지원하지 않음 — sanitize에서 제거하고
 *   나머지 서식은 그대로 표시한다(하위호환).
 */

export const CONTENT_FMT_VERSION = 1

// ── 글자색 토큰(의미 기반) — raw hex 대신 토큰 저장, 화면에서 테마 팔레트로 변환 ──
export type ColorToken = 'default' | 'red' | 'amber' | 'green' | 'blue' | 'purple'
export const COLOR_TOKENS: ColorToken[] = ['default', 'red', 'amber', 'green', 'blue', 'purple']
const NAMED_COLORS = new Set<string>(['red', 'amber', 'green', 'blue', 'purple'])
/** 토큰 → 현재 테마 CSS 변수(다크/라이트 모두 index.css에서 대비 확보) */
export const COLOR_VAR: Record<Exclude<ColorToken, 'default'>, string> = {
  red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)', blue: 'var(--blue)', purple: 'var(--purple)',
}
export const COLOR_LABEL: Record<ColorToken, string> = {
  default: '기본', red: '빨강', amber: '주황', green: '초록', blue: '파랑', purple: '보라',
}

// ── 형광펜 토큰(다색) — <mark class="wc-hl" data-color="…">, CSS가 테마 배경 적용 ──
export type HlToken = 'yellow' | 'green' | 'blue' | 'pink'
export const HL_TOKENS: HlToken[] = ['yellow', 'green', 'blue', 'pink']
const HL_SET = new Set<string>(HL_TOKENS)
export const HL_VAR: Record<HlToken, string> = {
  yellow: 'var(--hl-yellow)', green: 'var(--hl-green)', blue: 'var(--hl-blue)', pink: 'var(--hl-pink)',
}
export const HL_LABEL: Record<HlToken, string> = { yellow: '노랑', green: '초록', blue: '파랑', pink: '분홍' }

// ── PM 문서(직렬화 대상)의 최소 타입 ──
interface PMMark { type: string; attrs?: { token?: string } }
interface PMText { type: 'text'; text: string; marks?: PMMark[] }
export interface PMParagraph { type: 'paragraph'; content?: PMText[] }
export interface PMList { type: 'bulletList' | 'orderedList'; content?: PMListItem[] }
export interface PMListItem { type: 'listItem'; content?: PMBlock[] }
export type PMBlock = PMParagraph | PMList
export interface PMDoc { type: 'doc'; content: PMBlock[] }

// ── 렌더용 구조 ──
export interface RunMarks { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; color?: ColorToken; highlight?: HlToken }
export interface Run { text: string; marks: RunMarks }
export interface BodyLine { marker: string | null; indentPx: number; runs: Run[]; plain: string }

// 글머리기호 파서(표시용) — SubLine과 동일 규칙
const MARKER_RE = /^([-–—•*▪◦·●○]|[①-⑳]|\d+[.)]|[가-힣][.)])\s*([\s\S]*)$/

// ── 직렬화/역직렬화 ──
/** editor.getJSON() 결과(doc) → 버전 포함 JSON 문자열 */
export function serializeContentFmt(doc: unknown): string {
  return JSON.stringify({ version: CONTENT_FMT_VERSION, doc })
}

/** 일반 텍스트(줄바꿈=문단) → PM doc (서식 없는 정상 문서) */
export function plainToDoc(text: string): PMDoc {
  const lines = String(text ?? '').split(/\r?\n/)
  const content: PMParagraph[] = lines.map((line) =>
    line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
  )
  if (!content.length) content.push({ type: 'paragraph' })
  return { type: 'doc', content }
}

function sanitizeMarks(marks: unknown): PMMark[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const out: PMMark[] = []
  for (const m of marks) {
    if (!m || typeof m !== 'object') continue
    const type = (m as PMMark).type
    if (type === 'bold' || type === 'italic' || type === 'underline' || type === 'strike') {
      out.push({ type })
    } else if (type === 'highlightToken') {
      const token = String((m as PMMark).attrs?.token || '')
      out.push({ type: 'highlightToken', attrs: { token: HL_SET.has(token) ? token : 'yellow' } })
    } else if (type === 'colorToken') {
      const token = String((m as PMMark).attrs?.token || '')
      if (NAMED_COLORS.has(token)) out.push({ type: 'colorToken', attrs: { token } })
    }
    // 그 외 미지원 mark는 버린다 — 텍스트·나머지 서식은 유지
  }
  return out.length ? out : undefined
}

/** 문단 정제 — text 노드 + 허용 mark만 남긴다 */
function sanitizeParagraph(p: unknown): PMParagraph {
  const kids = (p as PMParagraph)?.content
  if (!Array.isArray(kids)) return { type: 'paragraph' }
  const texts: PMText[] = []
  for (const t of kids) {
    if (!t || (t as PMText).type !== 'text' || typeof (t as PMText).text !== 'string') continue
    if (!(t as PMText).text.length) continue
    texts.push({ type: 'text', text: (t as PMText).text, marks: sanitizeMarks((t as PMText).marks) })
  }
  return texts.length ? { type: 'paragraph', content: texts } : { type: 'paragraph' }
}

/** 블록 정제 — paragraph / bulletList / orderedList(→listItem→블록)만 허용, 나머지는 버림 */
function sanitizeBlock(node: unknown): PMBlock | null {
  const type = (node as { type?: unknown })?.type
  if (type === 'paragraph') return sanitizeParagraph(node)
  if (type === 'bulletList' || type === 'orderedList') {
    const items: PMListItem[] = []
    const kids = (node as PMList).content
    if (Array.isArray(kids)) {
      for (const it of kids) {
        if (!it || (it as PMListItem).type !== 'listItem') continue
        const inner: PMBlock[] = []
        const ikids = (it as PMListItem).content
        if (Array.isArray(ikids)) for (const c of ikids) { const b = sanitizeBlock(c); if (b) inner.push(b) }
        items.push({ type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph' }] })
      }
    }
    return items.length ? { type, content: items } : null
  }
  return null // heading/table/image 등 미지원 노드는 버림(방어적 정제)
}

/**
 * '업무내용서식' 문자열 → 정제된 PM doc. 실패/미지원 버전/손상/빈 문서 시 null(=서식 없음 → 평문 fallback).
 * 허용 노드(문단·목록)/mark(굵게·기울임·밑줄·취소선·글자색·형광펜)만 남긴다(방어적 정제).
 */
export function parseContentFmt(raw: unknown): PMDoc | null {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as { version?: unknown; doc?: unknown }
  if (obj.version !== CONTENT_FMT_VERSION) return null
  const doc = obj.doc as { type?: unknown; content?: unknown } | undefined
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return null
  const content: PMBlock[] = []
  for (const b of doc.content) { const sb = sanitizeBlock(b); if (sb) content.push(sb) }
  return content.length ? { type: 'doc', content } : null
}

function marksOf(marks?: PMMark[]): RunMarks {
  const out: RunMarks = {}
  for (const m of marks || []) {
    if (m.type === 'bold') out.bold = true
    else if (m.type === 'italic') out.italic = true
    else if (m.type === 'underline') out.underline = true
    else if (m.type === 'strike') out.strike = true
    else if (m.type === 'highlightToken') {
      const tok = String(m.attrs?.token || '')
      out.highlight = (HL_SET.has(tok) ? tok : 'yellow') as HlToken
    } else if (m.type === 'colorToken') {
      const tok = String(m.attrs?.token || '')
      if (NAMED_COLORS.has(tok)) out.color = tok as ColorToken
    }
  }
  return out
}

function runsOf(p: PMParagraph): Run[] {
  return (p.content || [])
    .filter((t) => t.type === 'text' && t.text)
    .map((t) => ({ text: t.text, marks: marksOf(t.marks) }))
}

// runs에서 앞 n글자 제거(들여쓰기·글머리 분리용), mark 유지
function sliceRunsFrom(runs: Run[], n: number): Run[] {
  if (n <= 0) return runs
  const out: Run[] = []
  let skip = n
  for (const r of runs) {
    if (skip <= 0) { out.push(r); continue }
    if (r.text.length <= skip) { skip -= r.text.length; continue }
    out.push({ text: r.text.slice(skip), marks: r.marks })
    skip = 0
  }
  return out
}

function lineMeta(text: string): { indentPx: number; leadLen: number } {
  const lead = text.match(/^[ \t]*/)?.[0] || ''
  return { indentPx: lead.replace(/\t/g, '    ').length * 4, leadLen: lead.length }
}

/** 일반 텍스트 한 줄 → BodyLine(글머리·들여쓰기 분리, 서식 없음) */
export function plainLineToBodyLine(line: string): BodyLine {
  const { indentPx, leadLen } = lineMeta(line)
  const rest = line.slice(leadLen)
  const m = rest.match(MARKER_RE)
  if (m) return { marker: m[1], indentPx, runs: m[2] ? [{ text: m[2], marks: {} }] : [], plain: line }
  return { marker: null, indentPx, runs: rest ? [{ text: rest, marks: {} }] : [], plain: line }
}

// 목록 한 단계 들여쓰기(px) — 텍스트 글머리(선행 공백)와 시각적으로 어울리게
const LIST_INDENT_PX = 18

/** 문단 → BodyLine. forcedMarker(목록 항목)면 마커는 목록에서 부여하고 본문은 그대로 유지 */
function paragraphToBodyLine(p: PMParagraph, baseIndentPx: number, forcedMarker?: string): BodyLine {
  const runs = runsOf(p)
  const plain = runs.map((r) => r.text).join('')
  if (forcedMarker !== undefined) {
    return { marker: forcedMarker, indentPx: baseIndentPx, runs, plain }
  }
  // 목록 밖 문단: 기존과 동일하게 선행 공백=들여쓰기, 선두 글머리문자 분리(구버전 텍스트 글머리 호환)
  const { indentPx, leadLen } = lineMeta(plain)
  const rest = plain.slice(leadLen)
  const m = rest.match(MARKER_RE)
  if (m) {
    const consumed = leadLen + (rest.length - m[2].length)
    return { marker: m[1], indentPx: baseIndentPx + indentPx, runs: sliceRunsFrom(runs, consumed), plain }
  }
  return { marker: null, indentPx: baseIndentPx + indentPx, runs: sliceRunsFrom(runs, leadLen), plain }
}

/** 블록 목록 → BodyLine[] (목록은 마커·깊이 들여쓰기로 평탄화, 중첩 재귀) */
function flattenBlocks(blocks: PMBlock[], depth: number, out: BodyLine[]): void {
  for (const b of blocks) {
    if (b.type === 'paragraph') { out.push(paragraphToBodyLine(b, depth * LIST_INDENT_PX)); continue }
    const ordered = b.type === 'orderedList'
    let n = 0
    for (const item of b.content || []) {
      n += 1
      const marker = ordered ? `${n}.` : '•'
      let markerUsed = false
      for (const c of item.content || []) {
        if (c.type === 'paragraph') {
          // 1단계 목록 = 들여쓰기 0(기존 텍스트 글머리 '• '와 동일 위치), 단계당 +18px
          out.push(paragraphToBodyLine(c, depth * LIST_INDENT_PX, markerUsed ? undefined : marker))
          markerUsed = true
        } else {
          flattenBlocks([c], depth + 1, out)
        }
      }
      if (!markerUsed) out.push({ marker, indentPx: depth * LIST_INDENT_PX, runs: [], plain: '' })
    }
  }
}

/** PM doc(본문) → BodyLine[] (문단=줄, 목록=마커·들여쓰기로 평탄화 + mark 유지) */
export function docToBodyLines(doc: PMDoc): BodyLine[] {
  const out: BodyLine[] = []
  flattenBlocks(doc.content, 0, out)
  return out
}

/**
 * 업무 본문 표시용 라인 목록. '업무내용서식'이 유효하면 서식 적용, 아니면 '업무내용' 일반 텍스트로 대체.
 * 시간/장소(있으면)는 기존과 동일하게 마지막 줄에 dash로 덧붙인다.
 */
export function workBodyLines(t: WorkItem): BodyLine[] {
  const doc = parseContentFmt(t.contentFmt)
  let lines: BodyLine[]
  if (doc) {
    lines = docToBodyLines(doc).filter((l) => l.plain.trim())
  } else {
    lines = String(t.task || '')
      .split(/\r?\n/)
      .slice(1)
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim())
      .map(plainLineToBodyLine)
  }
  if (t.time || t.loc) {
    const parts: string[] = []
    if (t.time) parts.push('시간: ' + t.time)
    if (t.loc) parts.push('장소: ' + t.loc)
    lines.push(plainLineToBodyLine('- ' + parts.join(' | ')))
  }
  return lines
}

/** 블록에 서식(mark) 또는 목록 구조가 하나라도 있는지 — 저장 여부 판정용(목록도 '서식'으로 취급) */
function blocksHaveFormatting(blocks: PMBlock[]): boolean {
  for (const b of blocks) {
    if (b.type !== 'paragraph') return true // 목록 = 서식
    if ((b.content || []).some((t) => (t.marks || []).length > 0)) return true
  }
  return false
}

/** contentFmt 안에 실제 서식(mark)·목록이 하나라도 있는지 */
export function docHasMarks(raw: unknown): boolean {
  const doc = parseContentFmt(raw)
  if (!doc) return false
  return blocksHaveFormatting(doc.content)
}

/** 블록 → 시그니처(구조 + mark). 문단/목록 중첩 반영 */
function sigBlocks(blocks: PMBlock[]): unknown[] {
  return blocks.map((b) => {
    if (b.type === 'paragraph') return { p: (b.content || []).map((t) => ({ t: t.text, m: marksOf(t.marks) })) }
    return { [b.type]: (b.content || []).map((it) => sigBlocks(it.content || [])) }
  })
}

/**
 * 서식 변경 판정용 시그니처. 서식(mark)·목록이 전혀 없으면 '' (= '서식 없음'과 동일 취급) →
 * 일반 텍스트에서 에디터가 문서를 실체화해도 '서식 추가'로 오판하지 않음.
 */
export function fmtSignature(raw: unknown): string {
  const doc = parseContentFmt(raw)
  if (!doc) return ''
  if (!blocksHaveFormatting(doc.content)) return ''
  return JSON.stringify(sigBlocks(doc.content))
}

// ── 렌더 ──
export function runStyle(m: RunMarks): CSSProperties {
  const s: CSSProperties = {}
  if (m.bold) s.fontWeight = 700
  if (m.italic) s.fontStyle = 'italic'
  const deco: string[] = []
  if (m.underline) deco.push('underline')
  if (m.strike) deco.push('line-through')
  if (deco.length) s.textDecoration = deco.join(' ')
  if (m.color && m.color !== 'default') s.color = COLOR_VAR[m.color]
  if (m.highlight) { s.backgroundColor = HL_VAR[m.highlight]; s.borderRadius = '3px'; s.padding = '0 1px' }
  return s
}

/** 서식 적용된 텍스트 런들을 span으로 렌더(dangerouslySetInnerHTML 미사용) */
export function RunSpans({ runs }: { runs: Run[] }): ReactNode {
  return (
    <>
      {runs.map((r, i) => {
        const st = runStyle(r.marks)
        return Object.keys(st).length ? (
          <span key={i} style={st}>{r.text}</span>
        ) : (
          <span key={i}>{r.text}</span>
        )
      })}
    </>
  )
}
