// Google Apps Script 웹앱 — 구글시트를 JSON 행배열로 반환
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxwvgPPyZDVTnWl6g7M_Y2vv1U-mrYitz0KUy9SBxfCtSWOzjX1w9oZp90b7don9Fmd/exec'

export const SHEET_NAME_WORK = '센터 업무 현황'
export const SHEET_NAME_EQ = '장비운영관리'
export const SHEET_NAME_SCHEDULE = '장비도입관리'
export const SHEET_NAME_NOTICE = '공지사항'

type SheetCell = string | number | null | undefined
export type SheetRow = SheetCell[]

interface SheetResponse {
  status: string
  message?: string
  data?: SheetRow[]
}

export async function fetchSheet(sheet: string): Promise<SheetRow[]> {
  const res = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheet)}`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = (await res.json()) as SheetResponse
  if (json.status !== 'ok') throw new Error(json.message || '오류')
  return json.data || []
}

/** 셀 → trim 문자열 */
export function cell(r: SheetRow, i: number): string {
  if (i < 0) return ''
  const v = r[i]
  return v === null || v === undefined ? '' : String(v).trim()
}

// ── 구글캘린더 일정 (?calendar=1) ──
export interface RawCalEvent {
  /** 구글캘린더 이벤트 고유 ID — 수정/삭제 대상 지정용 */
  id: string
  title: string
  /** 'yyyy-MM-ddTHH:mm' (KST) */
  start: string
  end: string
  allDay: boolean
  loc: string
  /** 반복 일정 여부 */
  recurring: boolean
}

export async function fetchCalendarEvents(): Promise<RawCalEvent[]> {
  const res = await fetch(`${SCRIPT_URL}?calendar=1`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = (await res.json()) as { status: string; message?: string; data?: RawCalEvent[] }
  if (json.status !== 'ok') throw new Error(json.message || '오류')
  return json.data || []
}

// ── 공지 새 글쓰기 (Apps Script doPost) ──
export interface AddNoticePayload {
  /** 게시자 이름 — '담당자' 시트 B열과 일치해야 함 */
  author: string
  /** 게시자 본인 비밀번호 — '담당자' 시트 C열과 대조 */
  key: string
  cat: string
  title: string
  body: string
  /** 상단고정 — true면 시트 B열 상단체크에 체크됨 */
  pinned?: boolean
  dept?: string
  deptMgr?: string
  target?: string
  end?: string
  ref?: string
}

/** 담당자 이름 목록 (해당자 선택 버튼용 — 비밀번호는 서버가 내보내지 않음) */
export async function fetchAuthors(): Promise<string[]> {
  const res = await fetch(`${SCRIPT_URL}?authors=1`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = (await res.json()) as { status: string; authors?: string[]; message?: string }
  if (json.status !== 'ok') throw new Error(json.message || '오류')
  return json.authors || []
}

export async function addNotice(p: AddNoticePayload): Promise<number> {
  // 주의: 헤더를 추가하면 CORS 프리플라이트가 발생해 실패함 — body만 보낼 것 (text/plain 단순 요청)
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'addNotice', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; num?: number }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 글쓰기를 지원하지 않습니다 (Apps Script 업데이트 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '저장 실패')
  return json.num || 0
}

// ── 캘린더 일정 추가/수정/삭제 (Apps Script doPost) ──
/** 수정/삭제 적용 범위 — 반복 일정에서 그 회차만(single) vs 전체 시리즈(series) */
export type CalScope = 'single' | 'series'

export interface CalEventInput {
  /** 게시자 이름 — '담당자' 시트와 일치해야 함 */
  author: string
  /** 게시자 본인 비밀번호 */
  key: string
  title: string
  loc?: string
  allDay: boolean
  /** allDay=false일 때: 'yyyy-MM-ddTHH:mm' (KST) */
  start?: string
  end?: string
  /** allDay=true일 때: 'yyyy-MM-dd' */
  startDate?: string
  /** 종일 일정의 마지막 날(포함). 비우면 하루짜리 */
  endDate?: string
}

// 인증·CORS 주의는 addNotice와 동일 (단순 요청, body만 전송)
async function postCal(payload: Record<string, unknown>): Promise<{ note?: string }> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; note?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 캘린더 편집을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
  return { note: json.note }
}

export function addCalEvent(p: CalEventInput): Promise<{ note?: string }> {
  return postCal({ action: 'addCalEvent', ...p })
}

export function updateCalEvent(p: CalEventInput & { id: string; scope: CalScope }): Promise<{ note?: string }> {
  return postCal({ action: 'updateCalEvent', ...p })
}

export function deleteCalEvent(p: { id: string; scope: CalScope; author: string; key: string }): Promise<{ note?: string }> {
  return postCal({ action: 'deleteCalEvent', ...p })
}
