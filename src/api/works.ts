import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, currentAccessToken } from './supabase'
import type { WorkRow, WorkInput, WorkOrderEntry, WorkStatusChange } from './sheets'

/**
 * 업무현황 API — Supabase 전환(2단계). 시그니처·반환 계약은 기존 sheets.ts와 동일해서
 * 소비처(workSlice·Work 페이지)는 import 경로만 바꾸면 된다.
 * author/key 파라미터는 전환기 계약 유지를 위해 받되 사용하지 않음(인증 = Supabase 세션 + RLS).
 */

interface WorksTableRow {
  num: number
  cat: string; task: string; dept: string; mat: string
  start: string; plan: string; plan_time: string; loc: string; mgr: string
  status: string; end_date: string; link: string
  remind: boolean; chief: boolean
  sort_order: number | null
  content_fmt: string
  deleted_at: string
}

const toWorkRow = (r: WorksTableRow): WorkRow => ({
  num: String(r.num),
  cat: r.cat, task: r.task, dept: r.dept, mat: r.mat,
  start: r.start, plan: r.plan, time: r.plan_time, loc: r.loc, mgr: r.mgr,
  status: r.status, end: r.end_date, link: r.link,
  remind: r.remind, chief: r.chief,
  order: r.sort_order == null ? '' : String(r.sort_order),
  contentFmt: r.content_fmt,
  deletedAt: r.deleted_at,
})

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

/** 상태에 따른 완료일자/Check 자동 규칙(기존 Code.gs workEndAuto_와 동일) */
const applyStatusRules = (p: { status: string; end?: string; chief?: boolean }) => ({
  end_date: p.status === '완료' ? (p.end || todayKst()) : '',
  chief: p.status === '완료' ? false : !!p.chief,
})

const fail = (error: { message: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback)
}

/** 업무 목록 읽기 — 삭제 포함 전체(휴지통 분리는 workSlice) */
export async function getWorks(): Promise<WorkRow[]> {
  const { data, error } = await supabase.from('works').select('*').order('num', { ascending: true })
  if (error) fail(error, '업무 목록을 불러오지 못했습니다')
  return ((data || []) as WorksTableRow[]).map(toWorkRow)
}

/** 업무 신규 등록 → 새 번호 반환(자동 채번) */
export async function createWork(p: WorkInput): Promise<number> {
  const rules = applyStatusRules(p)
  const { data, error } = await supabase
    .from('works')
    .insert({
      cat: p.cat, task: p.task, dept: p.dept || '', mat: p.mat || '',
      start: p.start || '', plan: p.plan || '', plan_time: p.time || '', loc: p.loc || '',
      mgr: p.mgr || '', status: p.status || '진행중', end_date: rules.end_date,
      link: p.link || '', remind: !!p.remind, chief: rules.chief,
      content_fmt: p.contentFmt ?? '',
    })
    .select('num')
    .single()
  if (error) fail(error, '업무 등록에 실패했습니다')
  return Number(data!.num)
}

/** 업무 수정 — contentFmt는 명시적으로 전달될 때만 갱신(undefined=기존 보존, ''=서식 제거) */
export async function updateWork(p: WorkInput & { num: string | number }): Promise<void> {
  const patch: Record<string, unknown> = {
    cat: p.cat, task: p.task, dept: p.dept || '', mat: p.mat || '',
    start: p.start || '', plan: p.plan || '', plan_time: p.time || '', loc: p.loc || '',
    mgr: p.mgr || '', status: p.status, link: p.link || '', remind: !!p.remind,
    updated_at: new Date().toISOString(),
    ...applyStatusRules({ status: p.status, end: p.end, chief: p.chief }),
  }
  // 완료가 아닌 상태에서 end 미전달이면 기존 완료일자 유지(기존 백엔드 동작) — 완료 전환만 자동 채움
  if (p.status !== '완료' && p.end === undefined) delete patch.end_date
  if (p.contentFmt !== undefined) patch.content_fmt = p.contentFmt
  const { error } = await supabase.from('works').update(patch).eq('num', Number(p.num))
  if (error) fail(error, '업무 수정에 실패했습니다')
}

/** 소프트 삭제 — 삭제일시(KST) 기록. 이미 삭제된 행은 건드리지 않음 */
export async function deleteWork(p: { nums: (string | number)[]; author: string; key: string }): Promise<{ deletedAt: string }> {
  const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 16)
  const { error } = await supabase
    .from('works')
    .update({ deleted_at: stamp, updated_at: new Date().toISOString() })
    .in('num', p.nums.map(Number))
    .eq('deleted_at', '')
  if (error) fail(error, '삭제 기록에 실패했습니다')
  return { deletedAt: stamp }
}

/** 휴지통 복원 — 진행중은 수동정렬 맨 아래(RPC가 새 정렬값 맵 반환) */
export async function restoreWorks(p: { nums: (string | number)[]; author: string; key: string }): Promise<{ orders: Record<string, number> }> {
  const { data, error } = await supabase.rpc('work_restore', { nums: p.nums.map(Number) })
  if (error) fail(error, '복원에 실패했습니다')
  return { orders: (data || {}) as Record<string, number> }
}

/** 진행중 수동 정렬순서 배치 저장 — 변경분만 갱신(RPC) */
export async function updateWorkOrder(p: { author: string; key: string; orders: WorkOrderEntry[] }): Promise<void> {
  const { error } = await supabase.rpc('work_update_orders', { orders: p.orders })
  if (error) fail(error, '순서 저장에 실패했습니다')
}

/** 상태 배치 변경 — RPC 트랜잭션(전검증·prevStatus 낙관잠금·자동규칙·원자성) */
export async function updateWorkStatuses(p: { author: string; key: string; changes: WorkStatusChange[] }): Promise<void> {
  const { error } = await supabase.rpc('work_update_statuses', { changes: p.changes })
  if (error) fail(error, '상태 변경에 실패했습니다')
}

/**
 * 페이지 종료 직전 마지막 순서 best-effort 전송 — sendBeacon은 인증 헤더를 못 실어
 * keepalive fetch로 RPC 직행(브라우저가 페이지 종료 후에도 전송 유지).
 */
export function beaconWorkOrder(p: { author: string; key: string; orders: WorkOrderEntry[] }): boolean {
  try {
    if (!p.orders.length || !currentAccessToken) return false
    void fetch(`${SUPABASE_URL}/rest/v1/rpc/work_update_orders`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${currentAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orders: p.orders }),
    })
    return true
  } catch {
    return false
  }
}

/** 담당자 이름 목록(작성 폼 오토컴플리트) — profiles 기반. 게스트(RLS 차단)는 빈 배열 */
export async function fetchAuthors(): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('name').order('name')
  return (data || []).map((r: { name: string }) => r.name)
}
