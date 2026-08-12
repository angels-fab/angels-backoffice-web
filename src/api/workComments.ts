import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'

const DB_TIMEOUT = 20_000

/**
 * 업무카드 코멘트 (개선요청 68, A안) — 업무 1건에 딸린 시간순 글타래.
 *
 * 열람 범위는 **서버(RLS)가 정한다**: 팀원 이상 + 비공개 업무는 그 업무를 볼 수 있는 사람만.
 * 그래서 클라이언트는 조건 없이 전부 받아 업무번호로 나눠 쓴다(붙임쪽지 답글과 같은 방식).
 * 건수를 모든 카드에 표시해야 해서 어차피 전량이 필요하다 — 카드마다 따로 부르면 요청이 수백 건이 된다.
 */
export interface WorkComment {
  id: number
  /** works.num */
  num: string
  author: string
  content: string
  created: string
  /** 내가 쓴 것인가 — 지우기 버튼 표시용. 판정은 계정 id(이름은 바뀔 수 있다) */
  mine: boolean
  /** 대댓글의 부모 코멘트 id — null 이면 최상위. 깊이 제한 없음(답글의 답글 가능, 2026-08-13) */
  parentId: number | null
  /** 소프트 삭제 — 답글이 달려 행만 남긴 코멘트. 화면은 "삭제된 코멘트입니다"를 그린다 */
  deleted: boolean
}

interface Row { id: number; num: number; author: string; content: string; created_at: string; author_uid: string; parent_id: number | null; deleted: boolean }

const SELECT = 'id, num, author, content, created_at, author_uid, parent_id, deleted'

const toComment = (r: Row, uid: string | null): WorkComment => ({
  id: Number(r.id),
  num: String(r.num),
  author: r.author,
  content: r.content,
  created: r.created_at,
  mine: !!uid && r.author_uid === uid,
  parentId: r.parent_id === null ? null : Number(r.parent_id),
  deleted: !!r.deleted,
})

/** 볼 수 있는 업무의 코멘트 전부 — 오래된 순(글타래는 위에서 아래로 읽는다) */
export async function fetchWorkComments(): Promise<WorkComment[]> {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess.session?.user.id ?? null
  const { data, error } = await supabase
    .from('work_comments')
    .select(SELECT)
    .order('id', { ascending: true })
  if (error) throw new Error(error.message || '코멘트를 불러오지 못했습니다')
  return ((data || []) as Row[]).map((r) => toComment(r, uid))
}

/** 코멘트 등록 — author·author_uid 는 DB 기본값(my_name()·auth.uid())이 채운다. parentId 를 주면 대댓글 */
export async function createWorkComment(p: { num: string | number; content: string; parentId?: number | null }): Promise<WorkComment> {
  const body = p.content.trim()
  if (!body) throw new Error('내용을 입력해주세요')
  await ensureSession()
  const { data: sess } = await supabase.auth.getSession()
  const { data, error } = await withTimeout(
    supabase.from('work_comments').insert({ num: Number(p.num), content: body, parent_id: p.parentId ?? null }).select(SELECT).single(),
    DB_TIMEOUT, '코멘트 등록',
  )
  if (error) throw new Error(error.message || '코멘트 등록에 실패했습니다')
  return toComment(data as Row, sess.session?.user.id ?? null)
}

/**
 * 코멘트 소프트 삭제 — 답글이 달린 코멘트용. 행은 남기고 **내용을 DB 에서도 비운다**
 * (화면에서만 가리면 지운 사람 입장에서 지워진 게 아니다). 쓴 사람만(RLS update own).
 */
export async function softDeleteWorkComment(id: number): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('work_comments').update({ deleted: true, content: '' }).eq('id', id).select('id'),
    DB_TIMEOUT, '코멘트 삭제',
  )
  if (error) throw new Error(error.message || '코멘트 삭제에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 쓴 코멘트만 지울 수 있습니다.')
}

/**
 * 코멘트 삭제(행째) — 답글이 없는 코멘트용.
 * RLS 가 행을 거르면 오류가 아니라 '0건 성공'이 오므로 지운 행 수로 확인한다(pageNotes 와 같은 관습).
 */
export async function deleteWorkComment(id: number): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('work_comments').delete().eq('id', id).select('id'),
    DB_TIMEOUT, '코멘트 삭제',
  )
  if (error) throw new Error(error.message || '코멘트 삭제에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 쓴 코멘트만 지울 수 있습니다.')
}
