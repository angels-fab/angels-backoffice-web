import { supabase } from './supabase'
import type { AddNoticePayload } from './sheets'
import { fmtDate } from '@/utils/date'
import { isNoticeNew } from '@/utils/newPost'
import type { Notice } from '@/types'

/**
 * 공지사항 API — Supabase 전환(3단계). 시그니처·반환 계약은 sheets.ts와 동일.
 * author/key는 전환기 계약 유지를 위해 받되 미사용(인증 = 세션 + RLS).
 */

interface NoticesTableRow {
  num: number
  pinned: boolean
  cat: string; dept: string; dept_mgr: string
  title: string; body: string; ref: string
  posted_date: string; posted_time: string; start_date: string; end_date: string
  author: string; target: string
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
  if (p.date) patch.posted_date = p.date
  const { error } = await supabase.from('notices').update(patch).eq('num', Number(p.num))
  if (error) throw new Error(error.message || '수정 실패')
}

/** 공지 삭제(하드 — 기존 동작 유지) */
export async function deleteNotice(p: { num: string | number; author: string; key: string }): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('num', Number(p.num))
  if (error) throw new Error(error.message || '삭제 실패')
}
