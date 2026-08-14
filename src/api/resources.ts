import { supabase } from './supabase'

/**
 * 자료실 API (개선요청 86, 1안) — 웹사이트·유용한 정보 링크 모음.
 * 중요 업무문서는 NAS 담당(사용자 방침 2026-08-14)이라 파일 업로드 없음 — 링크·메모 중심.
 * 쓰기 규칙(ensureSession + withTimeout)은 notices.ts 와 동일 — 오피스망 토큰 갱신 스톨 대비.
 */

const DB_TIMEOUT = 20_000

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
}

interface ResourcesTableRow {
  num: number
  cat: string
  title: string
  url: string
  note: string
  author: string
  created_at: string
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
  }))
}

export interface ResourcePayload {
  cat: string
  title: string
  url: string
  note: string
  author?: string
}

export async function addResource(p: ResourcePayload): Promise<void> {
  if (!p.title.trim()) throw new Error('제목을 입력해주세요')
  await ensureSession()
  const { error } = await withTimeout(
    supabase.from('resources').insert({
      cat: p.cat, title: p.title.trim(), url: p.url.trim(), note: p.note.trim(), author: p.author || '',
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
    supabase.from('resources').update({ cat: p.cat, title: p.title.trim(), url: p.url.trim(), note: p.note.trim() }).eq('num', num),
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
