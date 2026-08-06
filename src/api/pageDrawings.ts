import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'
import type { MemoStroke } from './improve'

// 사무실망 토큰갱신 스톨 대비 — 모든 write는 ensureSession + withTimeout (다른 API와 동일 안전장치)
const DB_TIMEOUT = 20_000

/**
 * 화면 그림 — **개선요청(쪽지)과 완전히 독립한 데이터**(2026-08-06 사용자 지시).
 *
 * 종전에는 그림이 improvements 행의 jsonb 칸에 얹혀 있어서, 그림 한 장을 남기려면 게시판 글과
 * 압정이 반드시 함께 생겼다("그림만 그리고 싶을 때도 있다"). 이제 그림은 자기 행을 갖고,
 * 압정 대신 **그림 자체가 손잡이**다 — 마우스를 올리면 빛나고 누르면 고치기·지우기가 뜬다.
 *
 * 획 형식(MemoStroke)과 좌표 기준은 종전 그대로라 그리기 판(MemoDraw)은 손대지 않았다.
 * 매칭은 개선위치(loc) 퍼지 매핑이 아니라 **pathname 완전 일치** — 그림은 '그 화면 그 지점'을
 * 가리키는 것이라 위치 이름으로 뭉뚱그리면 엉뚱한 화면에 뜬다.
 */
export interface PageDrawing {
  id: number
  path: string
  author: string
  strokes: MemoStroke[]
  /**
   * 이 그림에 붙은 요청메모 번호(improvements.num). 있으면 그림도 개선요청의 일부라
   * **포털 관리자도 본다** — 일반메모만 붙은 그림은 작성자와 공유받은 사람만 본다(사용자 지시 2026-08-06).
   */
  reqNum: number | null
}

interface Row { id: number; path: string; author: string; strokes: unknown; req_num: number | null }

export async function fetchPageDrawings(): Promise<PageDrawing[]> {
  const { data, error } = await supabase
    .from('page_drawings')
    .select('id, path, author, strokes, req_num')
    .order('id', { ascending: true })
  if (error) throw new Error(error.message || '화면 그림을 불러오지 못했습니다')
  return ((data || []) as Row[]).map((r) => ({
    id: Number(r.id),
    path: r.path,
    author: r.author,
    strokes: Array.isArray(r.strokes) ? (r.strokes as MemoStroke[]) : [],
    reqNum: r.req_num === null ? null : Number(r.req_num),
  }))
}

/**
 * 그림에 요청메모를 이어 붙인다 — 그림이 개선요청의 일부가 되어 포털 관리자에게도 보인다.
 * 그림의 수정 권한자(주인 또는 관리자)만 걸 수 있다(RLS) — 남의 그림을 임의로 개선요청에
 * 엮어 노출시키는 길을 막기 위해 링크를 그림 쪽에 뒀다.
 */
export async function linkDrawingToRequest(p: { id: number; reqNum: number }): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_drawings').update({ req_num: p.reqNum, updated_at: new Date().toISOString() }).eq('id', p.id).select('id'),
    DB_TIMEOUT, '그림-요청 연결',
  )
  if (error) throw new Error(error.message || '그림을 요청에 연결하지 못했습니다')
  if (!data || data.length === 0) throw new Error('내가 그린 그림만 요청에 연결할 수 있습니다.')
}

/** 새 그림 — author·author_uid 는 DB 기본값(my_name()·auth.uid())이 채운다 */
export async function createPageDrawing(p: { path: string; strokes: MemoStroke[] }): Promise<number> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_drawings').insert({ path: p.path, strokes: p.strokes }).select('id').single(),
    DB_TIMEOUT, '화면 그림 저장',
  )
  if (error) throw new Error(error.message || '그림 저장에 실패했습니다')
  return Number(data!.id)
}

/**
 * ⚠ 쓰기 결과를 **행 수로 확인한다**(.select()).
 *
 * RLS 의 USING 이 행을 걸러 0건이 되는 경우 PostgREST 는 오류가 아니라 성공(204)을 준다.
 * error 만 보면 남의 그림을 고치거나 지우려 했을 때 아무 일도 안 일어났는데 '지웠습니다'가 뜬다
 * (적대적 리뷰 확인). 0건이면 권한 없음으로 보고 분명히 알린다.
 */
export async function updatePageDrawing(p: { id: number; strokes: MemoStroke[] }): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_drawings').update({ strokes: p.strokes, updated_at: new Date().toISOString() }).eq('id', p.id).select('id'),
    DB_TIMEOUT, '화면 그림 수정',
  )
  if (error) throw new Error(error.message || '그림 수정에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 그린 그림만 고칠 수 있습니다.')
}

export async function deletePageDrawing(id: number): Promise<void> {
  await ensureSession()
  const { data, error } = await withTimeout(
    supabase.from('page_drawings').delete().eq('id', id).select('id'),
    DB_TIMEOUT, '화면 그림 삭제',
  )
  if (error) throw new Error(error.message || '그림 삭제에 실패했습니다')
  if (!data || data.length === 0) throw new Error('내가 그린 그림만 지울 수 있습니다.')
}
