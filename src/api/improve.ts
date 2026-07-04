import { supabase } from './supabase'
import type { ImprovementRow, ImprovementsData, ImprovementInput, ReplyRow, DraftRow, DraftInput } from './sheets'

/**
 * 포털개선요청·답글·임시저장 API — Supabase 전환(3단계). 계약은 sheets.ts와 동일.
 * 본인 검증(답글 수정·삭제, 담당자만 삭제)과 자동규칙(상태·메모표시)은 전부 서버(RPC)가 수행.
 * author/key 파라미터는 전환기 계약 유지용(미사용 — 서버가 세션에서 이름을 얻음).
 */

interface ImproveTableRow {
  num: number
  urgent: boolean; type: string; loc: string; title: string; content: string
  author: string; mgr: string; proposed_date: string; link: string
  status: string; end_date: string; reason: string; memo: boolean
}

const rpcFail = (error: { message: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback)
}

/** 유형 옵션 — UI에서 미사용(백엔드 보존 값), 시트 데이터확인 스냅샷 */
const TYPE_OPTIONS = ['기능', 'UI', 'UX', '콘텐츠', '오탈자', '기타']

export async function fetchImprovements(): Promise<ImprovementsData> {
  const [imp, locs] = await Promise.all([
    supabase.from('improvements').select('*').order('num', { ascending: true }),
    supabase.from('improve_locations').select('name').order('sort', { ascending: true }),
  ])
  if (imp.error) rpcFail(imp.error, '개선요청 목록을 불러오지 못했습니다')
  const items: ImprovementRow[] = ((imp.data || []) as ImproveTableRow[]).map((r) => ({
    num: String(r.num),
    urgent: r.urgent, type: r.type, loc: r.loc, title: r.title, content: r.content,
    author: r.author, mgr: r.mgr, date: r.proposed_date, link: r.link,
    status: r.status, end: r.end_date, reason: r.reason, memo: r.memo,
  }))
  return {
    items,
    locOptions: ((locs.data || []) as { name: string }[]).map((l) => l.name),
    typeOptions: TYPE_OPTIONS,
  }
}

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

/** 개선요청 단건 등록 → 새 번호 */
export async function createImprovement(p: ImprovementInput): Promise<number> {
  if (!p.title.trim()) throw new Error('제목을 입력해주세요')
  const { data, error } = await supabase
    .from('improvements')
    .insert({
      urgent: !!p.urgent, type: p.type || '', loc: p.loc || '', title: p.title.trim(),
      content: p.content || '', author: p.author, mgr: p.mgr || '',
      proposed_date: p.date || todayKst(), link: p.link || '', status: '접수', memo: false,
    })
    .select('num')
    .single()
  if (error) rpcFail(error, '등록에 실패했습니다')
  return Number(data!.num)
}

/** 개선요청 수정 — 부분갱신 + 상태·메모표시 자동규칙(서버 RPC) */
export async function updateImprovement(p: {
  author: string; key: string; num: string | number
  status?: string; reason?: string; end?: string
  urgent?: boolean; type?: string; loc?: string; title?: string; content?: string; link?: string
  memo?: boolean
}): Promise<void> {
  const payload: Record<string, unknown> = { num: Number(p.num) }
  for (const k of ['status', 'reason', 'end', 'urgent', 'type', 'loc', 'title', 'content', 'link', 'memo'] as const) {
    if (p[k] !== undefined) payload[k] = p[k]
  }
  const { error } = await supabase.rpc('improve_update', { p: payload })
  if (error) rpcFail(error, '수정에 실패했습니다')
}

/** 개선요청 삭제 — 담당자만(서버가 세션 이름으로 검증) */
export async function deleteImprovement(p: { author: string; key: string; num: string | number }): Promise<void> {
  const { error } = await supabase.rpc('improve_delete', { p_num: Number(p.num) })
  if (error) rpcFail(error, '삭제에 실패했습니다')
}

/** 임시저장 일괄등록 — 각 카드 = 독립 게시글(mgr=작성자), 부여된 번호 배열 반환 */
export async function createImprovements(p: {
  author: string; key: string
  items: { urgent: boolean; loc: string; title: string; content: string; link: string }[]
}): Promise<number[]> {
  const { data, error } = await supabase.rpc('improve_create_batch', { items: p.items })
  if (error) rpcFail(error, '일괄등록에 실패했습니다')
  return ((data || []) as number[]).map(Number)
}

// ── 답글 ──

interface ReplyTableRow { id: number; req_num: number; created: string; author: string; content: string; edited: string }

export async function fetchReplies(): Promise<ReplyRow[]> {
  const { data, error } = await supabase
    .from('improvement_replies')
    .select('id, req_num, created, author, content, edited')
    .eq('deleted', false)
    .order('id', { ascending: true })
  if (error) rpcFail(error, '답글을 불러오지 못했습니다')
  return ((data || []) as ReplyTableRow[]).map((r) => ({
    id: String(r.id), reqNum: String(r.req_num), created: r.created,
    author: r.author, content: r.content, edited: r.edited,
  }))
}

export async function createReply(p: { author: string; key: string; reqNum: string | number; content: string }): Promise<{ id: string; created: string }> {
  const { data, error } = await supabase.rpc('reply_create', { p_req: Number(p.reqNum), p_content: p.content })
  if (error) rpcFail(error, '답글 등록에 실패했습니다')
  const res = data as { id: string; created: string }
  return { id: String(res.id), created: res.created }
}

export async function updateReply(p: { author: string; key: string; id: string | number; content: string }): Promise<{ edited: string }> {
  const { data, error } = await supabase.rpc('reply_update', { p_id: Number(p.id), p_content: p.content })
  if (error) rpcFail(error, '답글 수정에 실패했습니다')
  return { edited: String(data || '') }
}

export async function deleteReply(p: { author: string; key: string; id: string | number }): Promise<void> {
  const { error } = await supabase.rpc('reply_delete', { p_id: Number(p.id) })
  if (error) rpcFail(error, '답글 삭제에 실패했습니다')
}

// ── 임시저장 (본인 것만 — RLS author_uid) ──

interface DraftTableRow { id: number; urgent: boolean; title: string; link: string; loc: string; content: string; saved_at: string }

export async function fetchDrafts(_p: { author: string; key: string }): Promise<DraftRow[]> {
  const { data, error } = await supabase.from('improvement_drafts').select('*').order('id', { ascending: true })
  if (error) rpcFail(error, '임시저장을 불러오지 못했습니다')
  return ((data || []) as DraftTableRow[]).map((d) => ({
    id: String(d.id), urgent: d.urgent, title: d.title, link: d.link, loc: d.loc, content: d.content, savedAt: d.saved_at,
  }))
}

/** 본인 임시저장 전체 대치 — 저장할 카드 0건이면 기존 유지(유실 방지, 서버 가드) */
export async function saveDrafts(p: { author: string; key: string; drafts: DraftInput[] }): Promise<DraftRow[]> {
  const { data, error } = await supabase.rpc('drafts_save', { p_drafts: p.drafts })
  if (error) rpcFail(error, '임시저장에 실패했습니다')
  return (data || []) as DraftRow[]
}

export async function deleteDrafts(p: { author: string; key: string; ids?: (string | number)[] }): Promise<void> {
  let q = supabase.from('improvement_drafts').delete()
  if (p.ids && p.ids.length > 0) q = q.in('id', p.ids.map(Number))
  else q = q.gte('id', 0)
  const { error } = await q
  if (error) rpcFail(error, '임시저장 삭제에 실패했습니다')
}
