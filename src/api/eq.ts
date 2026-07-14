import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'
import type { ScheduleInput, EquipmentUpdateInput, EqHistoryItem } from './sheets'
import type { EqRawItem, ScheduleItem } from '@/types'

// 사무실망 토큰갱신 스톨 대비 — 모든 write는 ensureSession + withTimeout (공지와 동일 안전장치)
const DB_TIMEOUT = 20_000

/**
 * 장비 도입·운영·이력 API — Supabase 전환(4단계). 계약은 sheets.ts와 동일.
 * 원시 시트 덤프 파싱(2단 헤더 병합·연번 필터)은 고정 스키마로 소멸 — 구조화 행을 그대로 반환.
 * 타임라인(반월 코드)은 로더가 buildTimelines로 재파생(드래그 재계산과 단일 경로).
 */

const STAGE_DB: [keyof SchedTableRow, string][] = [
  ['stage_pre', '사전규격'], ['stage_bid', '구매공고'], ['stage_eval', '기술평가'],
  ['stage_nego', '기술협상'], ['stage_make', '장비제작'], ['stage_install', '장비설치'],
]

interface SchedTableRow {
  seq: string; code: string; name: string; mgr: string; status: string; start: string
  stage_pre: string; stage_bid: string; stage_eval: string; stage_nego: string; stage_make: string; stage_install: string
  duration: string; cat: string; method: string; price: number
}

interface EqTableRow {
  num: string; code: string; name: string; cat: string; use_type: string; eq_type: string
  bid: string; fund: string; mgr: string; start: string; asset_no: string; nfec: string
  maker: string; model: string; price: number; install_date: string; install_loc: string
  state: string; mgr2: string; vendor: string; contact: string; note: string
}

const fail = (error: { message: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback)
}

/** 장비운영·도입관리 구조화 행 — timeline은 로더가 채움 */
export async function fetchEqData(): Promise<{
  eqRows: Omit<EqRawItem, 'timeline'>[]
  schedRows: Omit<ScheduleItem, 'timeline'>[]
}> {
  const [eq, sc] = await Promise.all([
    supabase.from('equipments').select('*').order('id', { ascending: true }),
    supabase.from('schedules').select('*').order('id', { ascending: true }),
  ])
  if (eq.error) fail(eq.error, '장비운영관리를 불러오지 못했습니다')
  if (sc.error) fail(sc.error, '장비도입관리를 불러오지 못했습니다')
  const eqRows = ((eq.data || []) as EqTableRow[]).map((r) => ({
    num: r.num, code: r.code, name: r.name, cat: r.cat, use: r.use_type, type: r.eq_type,
    bid: r.bid, fund: r.fund, mgr: r.mgr, status: r.state, start: r.start,
    assetNo: r.asset_no, nfec: r.nfec, maker: r.maker, model: r.model, price: Number(r.price) || 0,
    installDate: r.install_date, installLoc: r.install_loc, state: r.state, mgr2: r.mgr2,
    vendor: r.vendor, contact: r.contact, note: r.note,
  }))
  const schedRows = ((sc.data || []) as SchedTableRow[]).map((r) => ({
    seq: r.seq, code: r.code, name: r.name, mgr: r.mgr, status: r.status, start: r.start,
    stages: Object.fromEntries(STAGE_DB.map(([db, label]) => [label, r[db] as string])),
    duration: r.duration, cat: r.cat, method: r.method, price: Number(r.price) || 0,
  }))
  return { eqRows, schedRows }
}

/** 단계 소요기간 합계(개월) — 시트 '총소요기간(자동)' 수식 대체 */
const sumDuration = (stages?: Record<string, string>): string => {
  if (!stages) return ''
  const total = STAGE_DB.reduce((a, [, label]) => a + (Number(stages[label]) || 0), 0)
  return total ? String(total % 1 === 0 ? total : total) : ''
}

/** 도입일정 등록 — 연번 자동 채번(RPC), 관리번호 반환 */
export async function createSchedule(p: ScheduleInput): Promise<string> {
  const payload: Record<string, unknown> = {
    code: p.code || '', name: p.name || '', mgr: p.mgr || '', status: p.status || '',
    start: p.start || '', cat: p.cat || '', method: p.method || '', price: p.price ?? '',
    duration: sumDuration(p.stages),
  }
  for (const [, label] of STAGE_DB) payload[label] = p.stages?.[label] || ''
  await ensureSession()
  const { data, error } = await withTimeout(supabase.rpc('sched_create', { p: payload }), DB_TIMEOUT, '도입일정 등록')
  if (error) fail(error, '등록에 실패했습니다')
  return String(data || p.code || '')
}

/** 도입일정 수정 — origCode(원본 관리번호)로 행을 찾아 전체 갱신(관리번호 변경 지원) */
export async function updateSchedule(p: ScheduleInput & { origCode: string }): Promise<void> {
  const patch: Record<string, unknown> = {
    code: p.code || '', name: p.name || '', mgr: p.mgr || '', status: p.status || '',
    start: p.start || '', cat: p.cat || '', method: p.method || '',
    price: p.price != null && p.price !== '' ? Number(String(p.price).replace(/,/g, '')) : 0,
    duration: sumDuration(p.stages),
  }
  const dbStage: Record<string, string> = {
    사전규격: 'stage_pre', 구매공고: 'stage_bid', 기술평가: 'stage_eval',
    기술협상: 'stage_nego', 장비제작: 'stage_make', 장비설치: 'stage_install',
  }
  for (const [label, col] of Object.entries(dbStage)) patch[col] = p.stages?.[label] || ''
  await ensureSession()
  const { error } = await withTimeout(supabase.from('schedules').update(patch).eq('code', p.origCode || p.code), DB_TIMEOUT, '도입일정 수정')
  if (error) fail(error, '수정에 실패했습니다')
  // 관리번호(code)가 바뀌면 짝 운영관리 행의 code도 함께 이동해 짝을 유지(도입↔운영 연결 보존)
  if (p.code && p.origCode && p.code !== p.origCode) {
    const { error: eqErr } = await withTimeout(supabase.from('equipments').update({ code: p.code }).eq('code', p.origCode), DB_TIMEOUT, '도입일정 수정')
    if (eqErr) fail(eqErr, '수정에 실패했습니다')
  }
}

/** 도입일정 삭제 — 짝 운영관리 행도 함께 삭제(RPC 원자 처리). */
export async function deleteSchedule(p: { code: string; author: string; key: string }): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(supabase.rpc('sched_delete', { p_code: p.code }), DB_TIMEOUT, '도입일정 삭제')
  if (error) fail(error, '삭제에 실패했습니다')
}

/** 장비운영 부분수정 — 상태 변경 시 운영이력 자동 기록(RPC 원자 처리) */
export async function updateEquipment(p: EquipmentUpdateInput): Promise<void> {
  const payload: Record<string, unknown> = { code: p.code }
  for (const k of ['mgr', 'maker', 'model', 'assetNo', 'nfec', 'installLoc', 'installDate', 'vendor', 'mgr2', 'contact', 'note', 'state', 'reason'] as const) {
    if (p[k] !== undefined) payload[k] = p[k]
  }
  await ensureSession()
  const { error } = await withTimeout(supabase.rpc('eq_update', { p: payload }), DB_TIMEOUT, '장비 저장')
  if (error) fail(error, '저장에 실패했습니다')
}

/** 장비 운영이력 — 최신 먼저, 최대 100건(기존 계약 유지) */
export async function fetchEqHistory(code: string): Promise<EqHistoryItem[]> {
  const { data, error } = await supabase
    .from('equipment_history')
    .select('*')
    .eq('code', code)
    .order('id', { ascending: false })
    .limit(100)
  if (error) fail(error, '운영이력을 불러오지 못했습니다')
  return ((data || []) as { at: string; code: string; name: string; prev: string; next: string; reason: string; author: string; work_type: string; note: string }[])
    .map((r) => ({ when: r.at, code: r.code, name: r.name, prev: r.prev, next: r.next, reason: r.reason, author: r.author, type: r.work_type, note: r.note }))
}
