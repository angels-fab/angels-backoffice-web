import { diffArrays, diffWords } from 'diff'

/**
 * 업무 본문 이력의 '무엇이 바뀌었나' 계산 — 화면(WorkHistoryList)이 쓰는 유일한 계산기.
 *
 * 라벨과 상세 목록을 **한 함수가 함께** 낸다. 따로 세면 "추가 2줄"이라 적어 놓고 상세에는
 * 3줄이 칠해지는 어긋남이 반드시 생긴다 — 라벨의 숫자는 아래 entries 를 센 것과 같아야 한다.
 *
 * 기록 규칙(트리거)과 **같은 잣대로 비교한다**: docs/db/work-history.sql 의 k_old/k_new.
 * 저장된 prev/next 는 원문이라 공백 차이가 그대로 들어 있는데, 트리거는 정규화한 뒤 비교해
 * '공백만 바뀐 저장'은 아예 기록하지 않았다. 화면이 원문으로 비교하면 기록에 없는 차이가 잡혀
 * "왜 이건 이력에 없지"가 된다. 화면에 **보여주는 것은 원문 줄**, 비교만 정규화 줄로 한다.
 */

/** 비교용 한 줄 열쇠 — 줄 앞 들여쓰기는 남기고(하위단계 위계) 그 뒤 가로 공백만 지운다 */
function lineKey(line: string): string {
  const indent = line.match(/^[ \t]*/)?.[0] ?? ''
  return indent + line.slice(indent.length).replace(/[ \t]+/g, '')
}

/** 원문 줄 + 비교 열쇠 쌍. 빈 줄은 트리거가 접으므로 여기서도 뺀다 */
function toLines(text: string): { raw: string; key: string }[] {
  return (text || '')
    .replace(/\r/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .split('\n')
    .map((raw) => ({ raw, key: lineKey(raw) }))
    .filter((l) => l.key.trim() !== '')
}

/** 낱말 조각 — 한 줄 안에서 지워진 말/더해진 말을 제자리에 보여주기 위한 단위 */
export interface DiffPiece {
  text: string
  mark: 'same' | 'add' | 'del'
}

/**
 * 상세 한 항목.
 * - add/del = 줄이 통째로 생기거나 없어진 것 (pieces 는 줄 전체 한 조각)
 * - edit    = 같은 줄이 살아남아 그 안에서 고쳐진 것 (pieces 가 낱말 단위)
 */
export interface DiffEntry {
  /** indent = 글자는 그대로고 줄 앞 들여쓰기(하위단계)만 옮긴 줄 */
  kind: 'add' | 'del' | 'edit' | 'indent'
  /** 줄 앞 들여쓰기 칸 수(2칸 = 한 단계) — 화면에서 계층을 살리는 데 쓴다 */
  indent: number
  /** kind='indent' 일 때 옮기기 전 칸 수 — 안으로 들어갔는지 나왔는지 화살표 방향에 쓴다 */
  indentFrom?: number
  pieces: DiffPiece[]
}

export interface ContentDiff {
  /** '내용 추가' 처럼 무슨 일이 있었는지 — 사용자가 '내용 수정' 대신 요구한 구체적인 말 */
  label: string
  /** 라벨 뒤에 붙는 줄 수. 0이면 안 붙인다(항상 1이거나 전량이라 정보가 없는 경우) */
  count: number
  entries: DiffEntry[]
}

const indentOf = (line: string) => (line.match(/^[ \t]*/)?.[0].length ?? 0)

const wholeLine = (kind: 'add' | 'del', raw: string): DiffEntry => ({
  kind,
  indent: indentOf(raw),
  pieces: [{ text: raw.trim(), mark: kind === 'add' ? 'add' : 'del' }],
})

/**
 * 두 줄이 '같은 줄을 고친 것'인지 '아예 다른 줄'인지 — 겹치는 글자 비율로 가른다.
 * 0.4 는 임의값이 아니라 안전한 쪽으로 기운 값이다: 빗나가면 edit 대신 del+add 로 갈라져
 * A안(줄 통째 표시)으로 열화될 뿐, 엉뚱한 줄끼리 낱말이 뒤섞이는 그림은 안 나온다.
 */
const PAIR_MIN_SIMILARITY = 0.4

function pairLines(a: string, b: string): DiffEntry | null {
  // 글자는 같고 들여쓰기만 옮긴 줄 — diffWords 는 공백 차이를 무시해서 '바뀐 데가 없는 줄'로
  // 그려진다(라벨은 변경이라는데 화면엔 아무 표시가 없다). 그래서 먼저 갈라낸다.
  if (a.trim() === b.trim() && indentOf(a) !== indentOf(b)) {
    return {
      kind: 'indent',
      indent: indentOf(b),
      indentFrom: indentOf(a),
      pieces: [{ text: b.trim(), mark: 'same' }],
    }
  }
  const parts = diffWords(a, b)
  const same = parts.filter((p) => !p.added && !p.removed).reduce((n, p) => n + p.value.length, 0)
  const sim = (2 * same) / (a.length + b.length || 1)
  if (sim < PAIR_MIN_SIMILARITY) return null
  return {
    kind: 'edit',
    indent: indentOf(b),
    pieces: parts.map((p) => ({
      text: p.value,
      mark: p.added ? 'add' : p.removed ? 'del' : 'same',
    })),
  }
}

/** 붙어 있는 '지운 줄 묶음'과 '더한 줄 묶음'을 순번대로 짝지어 본다 */
function mergeBlock(removed: string[], added: string[]): DiffEntry[] {
  const out: DiffEntry[] = []
  const paired = Math.min(removed.length, added.length)
  for (let i = 0; i < paired; i++) {
    const edit = pairLines(removed[i], added[i])
    if (edit) out.push(edit)
    else out.push(wholeLine('del', removed[i]), wholeLine('add', added[i]))
  }
  for (let i = paired; i < removed.length; i++) out.push(wholeLine('del', removed[i]))
  for (let i = paired; i < added.length; i++) out.push(wholeLine('add', added[i]))
  return out
}

export function diffContent(prev: string, next: string): ContentDiff {
  const before = toLines(prev)
  const after = toLines(next)

  if (before.length === 0 && after.length > 0) {
    return { label: '내용 작성', count: 0, entries: after.map((l) => wholeLine('add', l.raw)) }
  }
  if (before.length > 0 && after.length === 0) {
    return { label: '내용 전체 삭제', count: 0, entries: before.map((l) => wholeLine('del', l.raw)) }
  }

  // 비교는 열쇠로, 표시는 원문으로 — diffArrays 가 열쇠 배열의 같은 자리를 알려 준다
  const parts = diffArrays(
    before.map((l) => l.key),
    after.map((l) => l.key),
  )

  const entries: DiffEntry[] = []
  let bi = 0
  let ai = 0
  let pending: string[] = [] // 아직 짝을 못 찾은 '지운 줄'
  let firstLineTouched = false

  const flush = (addedRaws: string[]) => {
    if (pending.length || addedRaws.length) entries.push(...mergeBlock(pending, addedRaws))
    pending = []
  }

  for (const part of parts) {
    const n = part.count ?? part.value.length
    if (part.removed) {
      if (bi === 0) firstLineTouched = true
      pending.push(...before.slice(bi, bi + n).map((l) => l.raw))
      bi += n
    } else if (part.added) {
      if (ai === 0) firstLineTouched = true
      flush(after.slice(ai, ai + n).map((l) => l.raw))
      ai += n
    } else {
      flush([])
      bi += n
      ai += n
    }
  }
  flush([])

  // 공백만 달랐던 저장은 트리거가 애초에 기록하지 않는다. 옛 행이 남아 있을 때의 방어.
  if (entries.length === 0) return { label: '변경 없음', count: 0, entries }

  const edits = entries.filter((e) => e.kind === 'edit').length
  const indents = entries.filter((e) => e.kind === 'indent').length
  if (indents === entries.length) return { label: '단계 변경', count: entries.length, entries }

  // 첫 줄은 카드에 뜨는 제목이라(index.tsx toForm: lines[0]) 따로 말해 주는 편이 알아보기 쉽다
  if (entries.length === 1 && edits === 1 && firstLineTouched) {
    return { label: '제목 변경', count: 0, entries }
  }

  // 라벨은 **줄이 아니라 조각**으로 정한다 — 한 줄 안에 이름 하나를 덧붙인 것도 '추가'이고
  // 괄호 한 글자를 지운 것도 '삭제'다. 사용자가 요구한 구분이 바로 이 층위다.
  const hasAdd = entries.some((e) => e.kind === 'add' || e.pieces.some((p) => p.mark === 'add'))
  const hasDel = entries.some((e) => e.kind === 'del' || e.pieces.some((p) => p.mark === 'del'))
  const count = entries.length
  if (hasAdd && !hasDel) return { label: '내용 추가', count, entries }
  if (hasDel && !hasAdd) return { label: '내용 삭제', count, entries }
  return { label: '내용 변경', count, entries }
}
