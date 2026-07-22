import { supabase } from './supabase'
import { ensureSession, withTimeout } from './session'

// 사무실망 토큰갱신 스톨 대비 — 모든 write는 ensureSession + withTimeout (다른 API와 동일 안전장치)
const DB_TIMEOUT = 20_000

/** 저장 상태 4종 — 임박·지연은 저장하지 않고 화면에서 분기 대비 자동 파생 */
export type MilestoneStatus = '예정' | '진행중' | '완료' | '보류'
export const MILESTONE_STATUSES: MilestoneStatus[] = ['예정', '진행중', '완료', '보류']

export interface MilestoneRow {
  id: number
  /** 대분류(9종, 엑셀 원문) */
  category: string
  /** 소분류(업무 제목) */
  title: string
  /** 세부 실행내용 */
  content: string
  /** 착수 원문("즉시", "계약 시" 등) */
  startLabel: string
  /** 완료목표 원문("착공 전", "개소 전" 등) */
  endLabel: string
  /** 정규화 착수 분기 '2026Q3' */
  startQ: string
  /** 정규화 완료목표 분기 */
  endQ: string
  /** 원문이 정확한 분기가 아니어서 추정 매핑된 항목(지연 자동판정 제외) */
  fuzzy: boolean
  deliverable: string
  coop: string
  owner: string
  status: MilestoneStatus
  completedAt: string | null
  sort: number
  updatedBy: string
  updatedAt: string
}

interface MilestoneTableRow {
  id: number
  category: string; title: string; content: string
  start_label: string; end_label: string; start_q: string; end_q: string
  fuzzy: boolean; deliverable: string; coop: string; owner: string
  status: string; completed_at: string | null; sort: number
  updated_by: string; updated_at: string
}

const fail = (error: { message: string } | null, fallback: string): never => {
  throw new Error(error?.message || fallback)
}

export async function fetchMilestones(): Promise<MilestoneRow[]> {
  const { data, error } = await supabase.from('milestones').select('*').order('sort', { ascending: true })
  if (error) fail(error, '마일스톤 목록을 불러오지 못했습니다')
  return ((data || []) as MilestoneTableRow[]).map((r) => ({
    id: r.id,
    category: r.category, title: r.title, content: r.content,
    startLabel: r.start_label, endLabel: r.end_label, startQ: r.start_q, endQ: r.end_q,
    fuzzy: r.fuzzy, deliverable: r.deliverable, coop: r.coop, owner: r.owner,
    status: r.status as MilestoneStatus, completedAt: r.completed_at, sort: r.sort,
    updatedBy: r.updated_by, updatedAt: r.updated_at,
  }))
}

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

/** 상태·담당자 부분갱신(관리자 전용 — RLS). 완료 전환 시 completed_at 자동 스탬프. */
export async function updateMilestone(p: {
  id: number
  status?: MilestoneStatus
  owner?: string
  updatedBy: string
}): Promise<{ completedAt: string | null }> {
  const payload: Record<string, unknown> = { updated_by: p.updatedBy, updated_at: new Date().toISOString() }
  let completedAt: string | null = null
  if (p.status !== undefined) {
    payload.status = p.status
    completedAt = p.status === '완료' ? todayKst() : null
    payload.completed_at = completedAt
  }
  if (p.owner !== undefined) payload.owner = p.owner
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('milestones').update(payload).eq('id', p.id),
    DB_TIMEOUT, '마일스톤 갱신',
  )
  if (error) fail(error, '변경에 실패했습니다')
  return { completedAt }
}
