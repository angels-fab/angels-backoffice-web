import { supabase } from './supabase'
import type { NoticeFile } from '@/types'

/**
 * 자료실 API (개선요청 86, 1안) — 웹사이트·유용한 정보 링크 모음 + 첨부(2026-08-15 추가).
 * 쓰기 규칙(ensureSession + withTimeout)은 notices.ts 와 동일 — 오피스망 토큰 갱신 스톨 대비.
 */

/** 첨부 저장 버킷(비공개) — 업로드=member+, 열람=인증 사용자. 마이그레이션 resources_attachments_bucket */
export const RESOURCE_BUCKET = 'resource-files'
/** 파일당 최대 크기(50MB) — 버킷 file_size_limit과 일치. 초과 시 업로드 전 클라이언트 차단 */
export const RESOURCE_FILE_MAX = 50 * 1024 * 1024
/** 업로드 1건 타임아웃 — 50MB가 느린 망에서도 끝나게 notice(10MB/30s)의 크기 비례 + 여유 */
const UPLOAD_TIMEOUT = 180_000
const DB_TIMEOUT = 20_000

/** 첨부 1건 메타(name·path·size·type) — 공지 첨부와 같은 모양이라 타입 재사용 */
export type ResourceFile = NoticeFile

async function withTimeout<T>(work: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 응답이 지연됩니다 — 네트워크를 확인하고 다시 시도해주세요.`)), ms)
  })
  try {
    return await Promise.race([Promise.resolve(work), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function ensureSession(): Promise<void> {
  const { error } = await withTimeout(supabase.auth.getSession(), DB_TIMEOUT, '세션 확인')
  if (error) throw new Error(error.message || '세션 확인에 실패했습니다 — 다시 시도해주세요.')
}

export const RESOURCE_CATS = ['업무', '교육', '참고', '기타']

export interface ResourceItem {
  num: number
  cat: string
  title: string
  /** 주소(선택) — 없으면 링크 없는 정보 메모 카드 */
  url: string
  note: string
  author: string
  /** 등록일 yyyy-MM-dd (KST) */
  date: string
  attachments: ResourceFile[]
}

interface ResourcesTableRow {
  num: number
  cat: string
  title: string
  url: string
  note: string
  author: string
  created_at: string
  attachments: ResourceFile[] | null
}

/** 자료 목록 — 최신 등록순 */
export async function getResources(): Promise<ResourceItem[]> {
  const { data, error } = await withTimeout(
    supabase.from('resources').select('*').order('num', { ascending: false }),
    DB_TIMEOUT, '자료 목록 불러오기',
  )
  if (error) throw new Error(error.message || '자료 목록을 불러오지 못했습니다')
  return ((data || []) as ResourcesTableRow[]).map((r) => ({
    num: r.num, cat: r.cat, title: r.title, url: r.url, note: r.note, author: r.author,
    date: new Date(r.created_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }),
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
  }))
}

export interface ResourcePayload {
  cat: string
  title: string
  url: string
  note: string
  attachments: ResourceFile[]
  author?: string
}

export async function addResource(p: ResourcePayload): Promise<void> {
  if (!p.title.trim()) throw new Error('제목을 입력해주세요')
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('resources').insert({
      cat: p.cat, title: p.title.trim(), url: p.url.trim(), note: p.note.trim(), author: p.author || '',
      attachments: p.attachments,
    }),
    DB_TIMEOUT, '자료 등록',
  )
  if (error) throw new Error(error.message || '저장 실패')
}

/** 수정 — 작성자(author)는 등록 때 값 유지(불변) */
export async function updateResource(num: number, p: Omit<ResourcePayload, 'author'>): Promise<void> {
  if (!p.title.trim()) throw new Error('제목을 입력해주세요')
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('resources').update({ cat: p.cat, title: p.title.trim(), url: p.url.trim(), note: p.note.trim(), attachments: p.attachments }).eq('num', num),
    DB_TIMEOUT, '자료 수정',
  )
  if (error) throw new Error(error.message || '수정 실패')
}

export async function deleteResource(num: number): Promise<void> {
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('resources').delete().eq('num', num),
    DB_TIMEOUT, '자료 삭제',
  )
  if (error) throw new Error(error.message || '삭제 실패')
}

// ── 첨부 저장소 — notices.ts 와 같은 규칙(업로드 즉시/orphan 정리는 폼이 담당) ──

const fileExt = (name: string) => {
  const m = name.match(/\.[A-Za-z0-9]{1,8}$/)
  return m ? m[0].toLowerCase() : ''
}

export async function uploadResourceFile(file: File): Promise<ResourceFile> {
  if (file.size > RESOURCE_FILE_MAX) {
    throw new Error(`파일이 너무 큽니다(최대 50MB): ${file.name}`)
  }
  await ensureSession()
  const path = `resource/${crypto.randomUUID()}${fileExt(file.name)}`
  const { error } = await withTimeout(
    supabase.storage
      .from(RESOURCE_BUCKET)
      .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }),
    UPLOAD_TIMEOUT, `업로드(${file.name})`,
  )
  if (error) throw new Error(error.message || `업로드 실패: ${file.name}`)
  return { name: file.name, path, size: file.size, type: file.type || 'application/octet-stream' }
}

/** 첨부 원본 Blob — 앵커 download 로 한글 파일명 그대로 저장(서명URL 인코딩 깨짐 회피, 공지와 동일) */
export async function downloadResourceBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(RESOURCE_BUCKET).download(path)
  if (error || !data) throw new Error(error?.message || '파일 다운로드 실패')
  return data
}

/** 첨부 삭제 — orphan 정리용 best-effort */
export async function removeResourceFiles(paths: string[]): Promise<void> {
  const list = paths.filter(Boolean)
  if (list.length === 0) return
  const { error } = await supabase.storage.from(RESOURCE_BUCKET).remove(list)
  if (error) throw new Error(error.message || '첨부파일 삭제 실패')
}
