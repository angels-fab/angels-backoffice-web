import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'

// 사무실망 토큰갱신 스톨 대비 — 모든 write는 ensureSession + withTimeout (다른 API와 동일 안전장치)
const DB_TIMEOUT = 20_000

/**
 * 일반메모 — **개선요청과 무관한 개인 메모**(2026-08-06 사용자 지시로 메모 정체성을 둘로 나눔).
 *
 * 종전 메모는 전부 포털개선요청이었다. 구성원 모두가 쓰는 도구가 되면서 갈래가 둘이 됐다:
 *  · 요청메모 = improvements — 상태(접수·완료…)·요청번호·게시판 연동이 있고, 작성자와 포털 관리자가 본다.
 *  · 일반메모 = 이 테이블 — 상태도 번호도 **연동되는 게시판도 없다**. **작성자만** 보고,
 *    지목한 사람에게만 따로 공유한다(포털 관리자도 예외가 아니다).
 *
 * 그림(page_drawings)에 붙이면 drawingId 로 이어 둔다. 그러면 그 그림도 공유 대상에게 함께 보인다
 * — 그림 읽기 정책이 이 메모의 shared 를 타고 열린다(docs/db/page-notes.sql).
 */
export interface PageNote {
  id: number
  path: string
  author: string
  content: string
  /** 공유 대상 이름(profiles.name). 비어 있으면 작성자만 본다 */
  shared: string[]
  /** 딸린 그림 id — 없으면 null */
  drawingId: number | null
  /**
   * 박아 넣을 대상 — 지금은 업무카드만(`work:{num}`). 있으면 **화면에 떠 있지 않고 그 카드 안에** 그려진다.
   * 카드의 자식이라 순서가 바뀌든 걸러지든 저절로 따라간다 — 좌표도 감시 장치도 필요 없다.
   */
  target: string | null
  /**
   * 작성자가 놓은 자리 — 떠 있는 쪽지만 쓴다.
   * 공유받은 사람은 자기 좌표가 없으므로 이 값을 첫 자리로 삼는다(없으면 그림 옆 → 기본 슬롯).
   */
  x: number | null
  y: number | null
}

interface Row {
  id: number; path: string; author: string; content: string; shared: unknown
  drawing_id: number | null; target: string | null; x: number | null; y: number | null
}

const SELECT = 'id, path, author, content, shared, drawing_id, target, x, y'

const toNote = (r: Row): PageNote => ({
  id: Number(r.id),
  path: r.path,
  author: r.author,
  content: r.content || '',
  shared: Array.isArray(r.shared) ? (r.shared as string[]) : [],
  drawingId: r.drawing_id === null ? null : Number(r.drawing_id),
  target: r.target,
  x: r.x === null ? null : Number(r.x),
  y: r.y === null ? null : Number(r.y),
})

/** 업무카드 대상 키 — 대상 종류를 늘릴 때 여기만 늘린다 */
export const workTarget = (num: string | number) => `work:${num}`

/** RLS 가 이미 '내 것 + 공유받은 것'으로 걸러 주므로 조건 없이 받는다 */
export async function fetchPageNotes(): Promise<PageNote[]> {
  const { data, error } = await supabase
    .from('page_notes')
    .select(SELECT)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message || '메모를 불러오지 못했습니다')
  return ((data || []) as Row[]).map(toNote)
}

/** 새 일반메모 — author·author_uid 는 DB 기본값(my_name()·auth.uid())이 채운다 */
export async function createPageNote(p: {
  path: string
  content: string
  shared?: string[]
  drawingId?: number | null
  /** 업무카드 안에 박아 넣을 때 — workTarget(num). 주면 좌표는 안 쓴다 */
  target?: string | null
  /** 떠 있는 쪽지의 작성자 자리 — 공유받은 사람의 첫 자리가 된다 */
  x?: number | null
  y?: number | null
}): Promise<PageNote> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase
      .from('page_notes')
      .insert({
        path: p.path, content: p.content, shared: p.shared || [], drawing_id: p.drawingId ?? null,
        target: p.target ?? null, x: p.x ?? null, y: p.y ?? null,
      })
      .select(SELECT)
      .single(),
    DB_TIMEOUT, '메모 저장',
  )
  if (error) throw new Error(error.message || '메모 저장에 실패했습니다')
  return toNote(data as Row)
}

/** 부분 수정 — 안 보낸 항목은 그대로 둔다 */
/** 쓰기 결과를 행 수로 확인 — RLS 가 행을 거르면 오류가 아니라 '0건 성공'이 온다(pageDrawings 주석 참조) */
export async function updatePageNote(p: {
  id: number; content?: string; shared?: string[]
  /** 작성자가 자리를 옮겼을 때만 — 공유받은 사람이 옮긴 것은 자기 개인 설정에만 남는다 */
  x?: number; y?: number
}): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (p.content !== undefined) patch.content = p.content
  if (p.shared !== undefined) patch.shared = p.shared
  if (p.x !== undefined) patch.x = Math.round(p.x)
  if (p.y !== undefined) patch.y = Math.round(p.y)
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_notes').update(patch).eq('id', p.id).select('id'),
    DB_TIMEOUT, '메모 수정',
  )
  if (error) throw new Error(error.message || '메모 수정에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 쓴 메모만 고칠 수 있습니다.')
}

/**
 * 일반메모 답글 — **작성자와 공유받은 사람이 주고받는다**(사용자 지시 2026-08-06).
 *
 * 요청메모의 답글(improvement_replies)은 요청번호에 묶여 있어 그대로 쓸 수 없다.
 * 열람·작성 범위는 메모와 같다(RLS 가 메모를 볼 수 있는 사람만 통과시킨다).
 */
export interface PageNoteReply {
  id: number
  noteId: number
  author: string
  content: string
  created: string
}

interface ReplyRow { id: number; note_id: number; author: string; content: string; created_at: string }

/** 볼 수 있는 메모의 답글 전부 — RLS 가 범위를 정한다 */
export async function fetchPageNoteReplies(): Promise<PageNoteReply[]> {
  const { data, error } = await supabase
    .from('page_note_replies')
    .select('id, note_id, author, content, created_at')
    .order('id', { ascending: true })
  if (error) throw new Error(error.message || '답글을 불러오지 못했습니다')
  return ((data || []) as ReplyRow[]).map((r) => ({
    id: Number(r.id), noteId: Number(r.note_id), author: r.author, content: r.content, created: r.created_at,
  }))
}

export async function createPageNoteReply(p: { noteId: number; content: string }): Promise<PageNoteReply> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_note_replies').insert({ note_id: p.noteId, content: p.content }).select('id, note_id, author, content, created_at').single(),
    DB_TIMEOUT, '답글 등록',
  )
  if (error) throw new Error(error.message || '답글 등록에 실패했습니다')
  const r = data as ReplyRow
  return { id: Number(r.id), noteId: Number(r.note_id), author: r.author, content: r.content, created: r.created_at }
}

export async function deletePageNoteReply(id: number): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_note_replies').delete().eq('id', id).select('id'),
    DB_TIMEOUT, '답글 삭제',
  )
  if (error) throw new Error(error.message || '답글 삭제에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 쓴 답글만 지울 수 있습니다.')
}

export async function deletePageNote(id: number): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_notes').delete().eq('id', id).select('id'),
    DB_TIMEOUT, '메모 삭제',
  )
  if (error) throw new Error(error.message || '메모 삭제에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 쓴 메모만 지울 수 있습니다.')
}
