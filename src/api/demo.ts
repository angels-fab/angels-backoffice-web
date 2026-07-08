import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'

/**
 * 데모결과(장비사 데모센터 테스트 결과) API.
 * - demo_metric_defs: 장비종류별 표준 지표 정의(비교 기준). 변경=관리자만 + 이력 기록.
 * - demo_results: 회차 1건 = 1행. metrics = { metric_key: 값(텍스트) }.
 * - demo_memos: 장비종류별 비교 메모(팀원 작성).
 * 사진/파일은 비공개 버킷 demo-files(서명 URL로 열람).
 */

export const DEMO_BUCKET = 'demo-files'
const DB_TIMEOUT = 20_000
const UPLOAD_TIMEOUT = 30_000
const FILE_MAX = 15 * 1024 * 1024

const fail = (e: { message?: string } | null, msg: string): never => { throw new Error(e?.message || msg) }

// ── 타입 ──
export type MetricDirection = 'higher' | 'lower' | 'none'
export interface DemoMetricDef {
  id: number; equipment: string; key: string; label: string; unit: string
  direction: MetricDirection; sort: number; active: boolean
}
export interface DemoPhotoRef { name: string; path?: string }
export interface DemoFileRef { name: string; path?: string; type?: string }
export interface DemoRoundRow {
  id: number; equipment: string; maker: string; model: string; round: number
  date: string; place: string; conditions: string
  metrics: Record<string, string>; photos: DemoPhotoRef[]; files: DemoFileRef[]; cover: number
}
export interface DemoMemo { equipment: string; body: string; updatedBy: string; updatedAt: string }
export interface MetricDefHistory {
  id: number; equipment: string; metricKey: string; action: string
  before: Record<string, unknown> | null; after: Record<string, unknown> | null
  changedBy: string; changedAt: string
}

// ── 매핑 ──
interface DefRow { id: number; equipment: string; metric_key: string; label: string; unit: string; direction: MetricDirection; sort: number; active: boolean }
interface ResRow { id: number; equipment: string; maker: string; model: string; round: number; visit_date: string | null; place: string; conditions: string; metrics: Record<string, string> | null; photos: DemoPhotoRef[] | null; files: DemoFileRef[] | null; cover: number }
interface MemoRow { equipment: string; body: string; updated_by: string | null; updated_at: string }

const toDef = (r: DefRow): DemoMetricDef => ({ id: r.id, equipment: r.equipment, key: r.metric_key, label: r.label, unit: r.unit, direction: r.direction, sort: r.sort, active: r.active })
const toRound = (r: ResRow): DemoRoundRow => ({
  id: r.id, equipment: r.equipment, maker: r.maker, model: r.model, round: r.round,
  date: r.visit_date || '', place: r.place, conditions: r.conditions,
  metrics: r.metrics || {}, photos: Array.isArray(r.photos) ? r.photos : [], files: Array.isArray(r.files) ? r.files : [], cover: r.cover || 0,
})

// ── 조회 ──
export async function fetchMetricDefs(): Promise<DemoMetricDef[]> {
  const { data, error } = await withTimeout(supabase.from('demo_metric_defs').select('*').order('equipment').order('sort'), DB_TIMEOUT, '지표 정의 불러오기')
  if (error) fail(error, '지표 정의를 불러오지 못했습니다')
  return ((data || []) as DefRow[]).map(toDef)
}
export async function fetchDemoResults(): Promise<DemoRoundRow[]> {
  const { data, error } = await withTimeout(supabase.from('demo_results').select('*').order('equipment').order('maker').order('round'), DB_TIMEOUT, '데모결과 불러오기')
  if (error) fail(error, '데모결과를 불러오지 못했습니다')
  return ((data || []) as ResRow[]).map(toRound)
}
export async function fetchDemoMemos(): Promise<DemoMemo[]> {
  const { data, error } = await withTimeout(supabase.from('demo_memos').select('*'), DB_TIMEOUT, '메모 불러오기')
  if (error) fail(error, '메모를 불러오지 못했습니다')
  return ((data || []) as MemoRow[]).map((m) => ({ equipment: m.equipment, body: m.body, updatedBy: m.updated_by || '', updatedAt: m.updated_at }))
}
export async function fetchMetricDefHistory(equipment: string): Promise<MetricDefHistory[]> {
  const { data, error } = await withTimeout(supabase.from('demo_metric_def_history').select('*').eq('equipment', equipment).order('changed_at', { ascending: false }), DB_TIMEOUT, '지표 변경 이력 불러오기')
  if (error) fail(error, '지표 변경 이력을 불러오지 못했습니다')
  return ((data || []) as { id: number; equipment: string; metric_key: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; changed_by: string | null; changed_at: string }[])
    .map((h) => ({ id: h.id, equipment: h.equipment, metricKey: h.metric_key, action: h.action, before: h.before, after: h.after, changedBy: h.changed_by || '', changedAt: h.changed_at }))
}

// ── 그룹/비교 헬퍼(순수함수) ──
export interface DemoMakerGroup { key: string; maker: string; model: string; rounds: DemoRoundRow[] } // rounds 오름차순
export interface DemoEquipGroup { equipment: string; defs: DemoMetricDef[]; makers: DemoMakerGroup[] }

/** 결과를 장비종류→제조사(모델)로 묶는다. 각 제조사의 rounds는 회차 오름차순(마지막=최신). */
export function groupDemoResults(rows: DemoRoundRow[], defs: DemoMetricDef[]): DemoEquipGroup[] {
  const byEquip = new Map<string, Map<string, DemoRoundRow[]>>()
  for (const r of rows) {
    const mk = byEquip.get(r.equipment) ?? new Map<string, DemoRoundRow[]>()
    const mkey = `${r.maker}|${r.model}`
    ;(mk.get(mkey) ?? mk.set(mkey, []).get(mkey)!).push(r)
    byEquip.set(r.equipment, mk)
  }
  const activeDefs = (eq: string) => defs.filter((d) => d.equipment === eq && d.active).sort((a, b) => a.sort - b.sort)
  const groups: DemoEquipGroup[] = []
  for (const [equipment, mk] of byEquip) {
    const makers: DemoMakerGroup[] = []
    for (const [mkey, rs] of mk) {
      const sorted = [...rs].sort((a, b) => a.round - b.round)
      const [maker, model] = mkey.split('|')
      makers.push({ key: mkey, maker, model, rounds: sorted })
    }
    makers.sort((a, b) => a.maker.localeCompare(b.maker))
    groups.push({ equipment, defs: activeDefs(equipment), makers })
  }
  groups.sort((a, b) => a.equipment.localeCompare(b.equipment))
  return groups
}

/** 값 문자열에서 첫 숫자 추출(비교용). 예: '±1.2%'→1.2, '<0.1ppb'→0.1, '3ea'→3. 없으면 null */
export function parseMetricNum(v: string | undefined): number | null {
  if (!v) return null
  const m = v.match(/-?\d+(\.\d+)?/)
  return m ? Number(m[0]) : null
}

/**
 * 지표별 '가장 우수' 제조사 판정. makerValues = 제조사별 그 지표 값(최신 회차 기준).
 * direction none이거나 비교 불가(숫자 아님/1개 이하)면 우수 없음. 반환 = 우수인 makerKey 집합.
 */
export function bestMakers(def: DemoMetricDef, makerValues: { key: string; value: string | undefined }[]): Set<string> {
  const out = new Set<string>()
  if (def.direction === 'none') return out
  const nums = makerValues.map((mv) => ({ key: mv.key, n: parseMetricNum(mv.value) })).filter((x) => x.n !== null) as { key: string; n: number }[]
  if (nums.length < 2) return out
  const best = def.direction === 'higher' ? Math.max(...nums.map((x) => x.n)) : Math.min(...nums.map((x) => x.n))
  for (const x of nums) if (x.n === best) out.add(x.key)
  return out
}

// ── 파일(사진·문서) ──
const ext = (name: string) => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i).toLowerCase() : '' }

/** 사진/파일 1건 업로드 → 메타 반환(원본명 보존, 저장키=UUID) */
export async function uploadDemoFile(file: File): Promise<{ name: string; path: string; type: string }> {
  if (file.size > FILE_MAX) throw new Error(`파일이 너무 큽니다(최대 15MB): ${file.name}`)
  await ensureSession()
  const path = `demo/${crypto.randomUUID()}${ext(file.name)}`
  const { error } = await withTimeout(
    supabase.storage.from(DEMO_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }),
    UPLOAD_TIMEOUT, `업로드(${file.name})`,
  )
  if (error) throw new Error(error.message || `업로드 실패: ${file.name}`)
  return { name: file.name, path, type: file.type || 'application/octet-stream' }
}
/** 열람용 서명 URL(1시간) — 사진 라이트박스·파일 새 탭 열기용 */
export async function demoFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DEMO_BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error(error?.message || '파일 링크 실패')
  return data.signedUrl
}
export async function removeDemoFiles(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean)
  if (!list.length) return
  await supabase.storage.from(DEMO_BUCKET).remove(list)
}

// ── 데모결과 쓰기(팀원+) ──
export interface DemoResultInput {
  equipment: string; maker: string; model: string; round: number
  date: string; place: string; conditions: string
  metrics: Record<string, string>; photos: DemoPhotoRef[]; files: DemoFileRef[]; cover: number
}
export async function addDemoResult(p: DemoResultInput & { author: string }): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(supabase.from('demo_results').insert({
    equipment: p.equipment, maker: p.maker, model: p.model, round: p.round,
    visit_date: p.date || null, place: p.place, conditions: p.conditions,
    metrics: p.metrics, photos: p.photos, files: p.files, cover: p.cover,
    created_by: p.author, updated_by: p.author,
  }), DB_TIMEOUT, '데모결과 저장')
  if (error) throw new Error(error.message || '데모결과 저장에 실패했습니다')
}
export async function updateDemoResult(id: number, p: Partial<DemoResultInput> & { author: string }): Promise<void> {
  await ensureSession()
  const patch: Record<string, unknown> = { updated_by: p.author, updated_at: new Date().toISOString() }
  if (p.equipment !== undefined) patch.equipment = p.equipment
  if (p.maker !== undefined) patch.maker = p.maker
  if (p.model !== undefined) patch.model = p.model
  if (p.round !== undefined) patch.round = p.round
  if (p.date !== undefined) patch.visit_date = p.date || null
  if (p.place !== undefined) patch.place = p.place
  if (p.conditions !== undefined) patch.conditions = p.conditions
  if (p.metrics !== undefined) patch.metrics = p.metrics
  if (p.photos !== undefined) patch.photos = p.photos
  if (p.files !== undefined) patch.files = p.files
  if (p.cover !== undefined) patch.cover = p.cover
  const { error } = await withTimeout(supabase.from('demo_results').update(patch).eq('id', id), DB_TIMEOUT, '데모결과 수정')
  if (error) throw new Error(error.message || '데모결과 수정에 실패했습니다')
}
export async function deleteDemoResult(id: number): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(supabase.from('demo_results').delete().eq('id', id), DB_TIMEOUT, '데모결과 삭제')
  if (error) throw new Error(error.message || '데모결과 삭제에 실패했습니다')
}

// ── 비교 메모(팀원+) ──
export async function saveDemoMemo(equipment: string, body: string, author: string): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('demo_memos').upsert({ equipment, body, updated_by: author, updated_at: new Date().toISOString() }, { onConflict: 'equipment' }),
    DB_TIMEOUT, '메모 저장',
  )
  if (error) throw new Error(error.message || '메모 저장에 실패했습니다')
}

// ── 지표 정의(관리자만) + 이력 ──
const defSnapshot = (d: { label: string; unit: string; direction: string; sort: number; active: boolean }) =>
  ({ label: d.label, unit: d.unit, direction: d.direction, sort: d.sort, active: d.active })

export interface MetricDefInput { equipment: string; key: string; label: string; unit: string; direction: MetricDirection; sort: number }

/** 지표 신설 + 이력('create') 기록 */
export async function createMetricDef(p: MetricDefInput, admin: string): Promise<void> {
  await ensureSession()
  const row = { equipment: p.equipment, metric_key: p.key, label: p.label, unit: p.unit, direction: p.direction, sort: p.sort, active: true, created_by: admin, updated_by: admin }
  const { error } = await withTimeout(supabase.from('demo_metric_defs').insert(row), DB_TIMEOUT, '지표 신설')
  if (error) throw new Error(error.message || '지표 신설에 실패했습니다')
  await supabase.from('demo_metric_def_history').insert({ equipment: p.equipment, metric_key: p.key, action: 'create', after: defSnapshot({ ...p, active: true }), changed_by: admin })
}

/** 지표 수정 + 이력('update', before→after) 기록 */
export async function updateMetricDef(id: number, patch: Partial<MetricDefInput>, admin: string): Promise<void> {
  await ensureSession()
  const { data: cur, error: e1 } = await withTimeout(supabase.from('demo_metric_defs').select('*').eq('id', id).single(), DB_TIMEOUT, '지표 조회')
  if (e1 || !cur) throw new Error(e1?.message || '지표를 찾지 못했습니다')
  const c = cur as DefRow
  const next = { label: patch.label ?? c.label, unit: patch.unit ?? c.unit, direction: (patch.direction ?? c.direction) as MetricDirection, sort: patch.sort ?? c.sort }
  const { error } = await withTimeout(supabase.from('demo_metric_defs').update({ ...next, updated_by: admin, updated_at: new Date().toISOString() }).eq('id', id), DB_TIMEOUT, '지표 수정')
  if (error) throw new Error(error.message || '지표 수정에 실패했습니다')
  await supabase.from('demo_metric_def_history').insert({
    equipment: c.equipment, metric_key: c.metric_key, action: 'update',
    before: defSnapshot(c), after: defSnapshot({ ...next, active: c.active }), changed_by: admin,
  })
}

/** 지표 활성/비활성 전환 + 이력 기록 */
export async function setMetricDefActive(id: number, active: boolean, admin: string): Promise<void> {
  await ensureSession()
  const { data: cur, error: e1 } = await withTimeout(supabase.from('demo_metric_defs').select('*').eq('id', id).single(), DB_TIMEOUT, '지표 조회')
  if (e1 || !cur) throw new Error(e1?.message || '지표를 찾지 못했습니다')
  const c = cur as DefRow
  const { error } = await withTimeout(supabase.from('demo_metric_defs').update({ active, updated_by: admin, updated_at: new Date().toISOString() }).eq('id', id), DB_TIMEOUT, '지표 상태 변경')
  if (error) throw new Error(error.message || '지표 상태 변경에 실패했습니다')
  await supabase.from('demo_metric_def_history').insert({
    equipment: c.equipment, metric_key: c.metric_key, action: active ? 'reactivate' : 'deactivate',
    before: defSnapshot(c), after: defSnapshot({ ...c, active }), changed_by: admin,
  })
}
