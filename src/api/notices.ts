import { supabase } from './supabase'
import type { AddNoticePayload } from './sheets'
import { fmtDate } from '@/utils/date'
import { isNoticeNew } from '@/utils/newPost'
import type { Notice, NoticeFile } from '@/types'

/**
 * 공지사항 API — Supabase 전환(3단계). 시그니처·반환 계약은 sheets.ts와 동일.
 * author/key는 전환기 계약 유지를 위해 받되 미사용(인증 = 세션 + RLS).
 */

/** 첨부파일 저장 버킷(비공개) — 업로드=팀원(member)+, 열람=인증 사용자 서명URL. 마이그레이션 notice_attachments */
export const NOTICE_BUCKET = 'notice-files'
/** 파일당 최대 크기(10MB) — 버킷 file_size_limit과 일치. 초과 시 업로드 전 클라이언트 차단 */
export const NOTICE_FILE_MAX = 10 * 1024 * 1024
/** 업로드 1건 타임아웃(ms) — 스톨 시 무한 대기 방지(에러로 전환) */
const UPLOAD_TIMEOUT = 60_000

interface NoticesTableRow {
  num: number
  pinned: boolean
  cat: string; dept: string; dept_mgr: string
  title: string; body: string; ref: string
  posted_date: string; posted_time: string; start_date: string; end_date: string
  author: string; target: string
  attachments: NoticeFile[] | null
}

/** 공지 목록 — 연번 내림차순 + isNew 판정(기존 slice 파싱 로직과 동일 결과) */
export async function getNotices(): Promise<Notice[]> {
  const { data, error } = await supabase.from('notices').select('*').order('num', { ascending: false })
  if (error) throw new Error(error.message || '공지 목록을 불러오지 못했습니다')
  return ((data || []) as NoticesTableRow[]).map((r, idx): Notice => {
    const createdDate = fmtDate(r.posted_date)
    const startDate = fmtDate(r.start_date)
    const endDate = fmtDate(r.end_date)
    return {
      id: idx + 1,
      num: String(r.num),
      pinned: r.pinned,
      cat: r.cat || '공지',
      dept: r.dept,
      deptMgr: r.dept_mgr,
      title: r.title,
      body: r.body,
      ref: r.ref,
      date: createdDate || startDate,
      reply: '',
      start: startDate,
      ctime: r.posted_time,
      end: endDate,
      author: r.author,
      target: r.target,
      views: 0,
      isNew: isNoticeNew(createdDate || startDate, endDate),
      attachments: Array.isArray(r.attachments) ? r.attachments : [],
    }
  })
}

const todayKst = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
const nowTimeKst = () =>
  new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })

/** 공지 등록 → 새 연번(자동 채번). 게시일 미지정 시 오늘(KST), 작성시간 자동 */
export async function addNotice(p: AddNoticePayload): Promise<number> {
  if (!p.title.trim() || !p.body.trim()) throw new Error('제목과 내용을 입력해주세요')
  const { data, error } = await supabase
    .from('notices')
    .insert({
      pinned: !!p.pinned, cat: p.cat, dept: p.dept || '', dept_mgr: p.deptMgr || '',
      title: p.title, body: p.body, ref: p.ref || '',
      posted_date: p.date || todayKst(), posted_time: nowTimeKst(),
      end_date: p.end || '', author: p.author, target: p.target || '',
      attachments: p.attachments || [],
    })
    .select('num')
    .single()
  if (error) throw new Error(error.message || '저장 실패')
  return Number(data!.num)
}

/** 공지 수정 — 분류/제목/내용/고정은 항상, 부가 필드는 전달된 경우만, 게시일은 값 있을 때만. 게시자 불변 */
export async function updateNotice(p: AddNoticePayload & { num: string | number }): Promise<void> {
  const patch: Record<string, unknown> = { pinned: !!p.pinned, cat: p.cat, title: p.title, body: p.body }
  if (p.dept !== undefined) patch.dept = p.dept
  if (p.deptMgr !== undefined) patch.dept_mgr = p.deptMgr
  if (p.target !== undefined) patch.target = p.target
  if (p.end !== undefined) patch.end_date = p.end
  if (p.ref !== undefined) patch.ref = p.ref
  if (p.attachments !== undefined) patch.attachments = p.attachments
  if (p.date) patch.posted_date = p.date
  const { error } = await supabase.from('notices').update(patch).eq('num', Number(p.num))
  if (error) throw new Error(error.message || '수정 실패')
}

/** 공지 삭제(하드 — 기존 동작 유지) */
export async function deleteNotice(p: { num: string | number; author: string; key: string }): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('num', Number(p.num))
  if (error) throw new Error(error.message || '삭제 실패')
}

// ── 첨부파일 (Storage: notice-files 비공개 버킷) ──

/** 파일명에서 확장자 추출(점 포함, 없으면 빈 문자열) */
const fileExt = (name: string) => {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i).toLowerCase() : ''
}

/**
 * 첨부파일 1건 업로드 → 메타데이터 반환. 저장 키는 충돌 방지용 UUID(원본 파일명은 name에 보존).
 * 10MB 초과는 업로드 전에 차단, 60초 스톨 시 타임아웃. 업로드 권한은 RLS(is_member)가 최종 검증.
 */
export async function uploadNoticeFile(file: File): Promise<NoticeFile> {
  if (file.size > NOTICE_FILE_MAX) {
    throw new Error(`파일이 너무 큽니다(최대 10MB): ${file.name}`)
  }
  const path = `notice/${crypto.randomUUID()}${fileExt(file.name)}`
  const upload = supabase.storage
    .from(NOTICE_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`업로드 시간 초과: ${file.name}`)), UPLOAD_TIMEOUT),
  )
  const { error } = await Promise.race([upload, timeout])
  if (error) throw new Error(error.message || `업로드 실패: ${file.name}`)
  return { name: file.name, path, size: file.size, type: file.type || 'application/octet-stream' }
}

/** 첨부파일 원본 Blob 다운로드 — '모두 다운로드'(ZIP 묶기)용 */
export async function downloadNoticeBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(NOTICE_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message || '파일 다운로드 실패')
  return data
}

/** 첨부파일 다운로드용 서명 URL(1시간 유효) — 원본 파일명으로 저장되도록 download 지정 */
export async function noticeFileSignedUrl(path: string, downloadName?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(NOTICE_BUCKET)
    .createSignedUrl(path, 60 * 60, downloadName ? { download: downloadName } : {})
  if (error || !data?.signedUrl) throw new Error(error?.message || '파일 링크 생성 실패')
  return data.signedUrl
}

/** 첨부파일 삭제 — 정리(orphan 제거)용. 실패해도 상위 작업을 막지 않도록 best-effort */
export async function removeNoticeFiles(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean)
  if (list.length === 0) return
  const { error } = await supabase.storage.from(NOTICE_BUCKET).remove(list)
  if (error) throw new Error(error.message || '첨부파일 삭제 실패')
}
