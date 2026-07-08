import { supabase } from './supabase'

/**
 * 행사 참석자(event_attendees) + 행사 제출/요청(event_submissions) API.
 * 행사 자체는 아직 상수(FAB_EVENTS)에 있고, 참석자만 행사 id로 DB에서 실시간 집계한다.
 */

export const EVENT_SUB_BUCKET = 'event-submissions'
const SUB_FILE_MAX = 20 * 1024 * 1024

// ── 참석자 ──
export interface AttendeeRow { id: number; eventId: string; name: string; memberUid: string | null }
interface AttTable { id: number; event_id: string; name: string; member_uid: string | null }

const attFail = (e: { message?: string } | null, msg: string): never => { throw new Error(e?.message || msg) }

export async function fetchAttendees(): Promise<AttendeeRow[]> {
  const { data, error } = await supabase.from('event_attendees').select('id, event_id, name, member_uid').order('id', { ascending: true })
  if (error) attFail(error, '참석자를 불러오지 못했습니다')
  return ((data || []) as AttTable[]).map((r) => ({ id: r.id, eventId: r.event_id, name: r.name, memberUid: r.member_uid }))
}

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** 참석자 추가 — self=true면 본인(로그인 팀원) 참석(memberUid=본인), false면 관리자 수기추가(memberUid=null) */
export async function addAttendee(p: { eventId: string; name: string; self: boolean }): Promise<AttendeeRow> {
  const memberUid = p.self ? await currentUid() : null
  const { data, error } = await supabase
    .from('event_attendees')
    .insert({ event_id: p.eventId, name: p.name.trim(), member_uid: memberUid })
    .select('id, event_id, name, member_uid')
    .single()
  if (error) attFail(error, '참석자 추가에 실패했습니다')
  const r = data as AttTable
  return { id: r.id, eventId: r.event_id, name: r.name, memberUid: r.member_uid }
}

export async function removeAttendee(id: number): Promise<void> {
  const { error } = await supabase.from('event_attendees').delete().eq('id', id)
  if (error) attFail(error, '참석자 삭제에 실패했습니다')
}

// ── 행사 제출/요청 ──
export interface EventSummaryInput { label: string; value: string }
export interface EventSubmissionInput {
  category: string; title: string; start: string; end: string; venue: string
  organizer: string; link: string; poster: string; summary: EventSummaryInput[]
}

/** 제출 포스터 업로드(이미지·PDF) → 저장 경로 반환 */
export async function uploadSubmissionPoster(file: File): Promise<string> {
  if (file.size > SUB_FILE_MAX) throw new Error('파일이 너무 큽니다(최대 20MB).')
  const i = file.name.lastIndexOf('.')
  const ext = i > 0 ? file.name.slice(i).toLowerCase() : ''
  const path = `sub/${crypto.randomUUID()}${ext}`
  const { error } = await supabase.storage
    .from(EVENT_SUB_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw new Error(error.message || '포스터 업로드에 실패했습니다')
  return path
}

/** 제출 포스터 미리보기용 서명 URL(1시간) */
export async function submissionPosterUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(EVENT_SUB_BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error(error?.message || '포스터 링크 실패')
  return data.signedUrl
}

export async function submitEvent(p: EventSubmissionInput & { submitter: string }): Promise<void> {
  const { error } = await supabase.from('event_submissions').insert({
    category: p.category, title: p.title.trim(), start_date: p.start, end_date: p.end, venue: p.venue.trim(),
    organizer: p.organizer.trim(), link: p.link.trim(), poster: p.poster,
    summary: p.summary.filter((s) => s.value.trim()), submitter: p.submitter, status: 'pending',
  })
  if (error) throw new Error(error.message || '행사 신청에 실패했습니다')
}

export interface EventSubmissionRow extends EventSubmissionInput { id: number; status: string; submitter: string; note: string; createdAt: string }
interface SubTable {
  id: number; category: string; title: string; start_date: string; end_date: string; venue: string
  organizer: string; link: string; poster: string; summary: EventSummaryInput[] | null; status: string; submitter: string; note: string; created_at: string
}

export async function fetchSubmissions(): Promise<EventSubmissionRow[]> {
  const { data, error } = await supabase.from('event_submissions').select('*').order('id', { ascending: false })
  if (error) throw new Error(error.message || '신청 목록을 불러오지 못했습니다')
  return ((data || []) as SubTable[]).map((r) => ({
    id: r.id, category: r.category, title: r.title, start: r.start_date, end: r.end_date, venue: r.venue,
    organizer: r.organizer, link: r.link, poster: r.poster, summary: Array.isArray(r.summary) ? r.summary : [],
    status: r.status, submitter: r.submitter, note: r.note, createdAt: r.created_at,
  }))
}

export async function updateSubmissionStatus(id: number, status: string, note?: string): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (note !== undefined) patch.note = note
  const { error } = await supabase.from('event_submissions').update(patch).eq('id', id)
  if (error) throw new Error(error.message || '상태 변경에 실패했습니다')
}
