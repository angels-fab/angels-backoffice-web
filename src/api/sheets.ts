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

/**
 * 관리자 모드 검증 — '담당자' 시트 사번+비밀번호를 **백엔드에서 대조**(열 위치는 헤더로 자동 인식).
 * 비밀번호는 절대 프런트로 내려오지 않음(공지 작성과 동일한 인증 경로).
 * @returns { valid, name } — 일치 시 valid=true, name=담당자 이름
 */
export async function verifyAdmin(empNo: string, password: string): Promise<{ valid: boolean; name: string }> {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'verifyAdmin', empNo, key: password }),
  })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; valid?: boolean; name?: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 관리자 검증을 지원하지 않습니다 (Apps Script 배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '검증 실패')
  return { valid: !!json.valid, name: json.name || '' }
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
  /** 게시일(작성일자) yyyy-MM-dd — 비우면 서버가 오늘로 기록 */
  date?: string
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

export interface UpdateNoticePayload extends AddNoticePayload {
  /** 수정 대상 공지 연번 */
  num: string | number
}

/** 공지 수정 — 연번 기준으로 시트 행 갱신(게시자는 원본 유지). CORS 주의는 addNotice와 동일. */
export async function updateNotice(p: UpdateNoticePayload): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateNotice', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 공지 수정을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '수정 실패')
}

/** 공지 삭제 — 연번 기준으로 시트 행 삭제. */
export async function deleteNotice(p: { num: string | number; author: string; key: string }): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteNotice', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 공지 삭제를 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '삭제 실패')
}

// ── 센터 업무 현황 CRUD (헤더명 기준, Apps Script) ──
/** getWorks가 반환하는 업무 1건 (헤더명→객체, 백엔드에서 변환) */
export interface WorkRow {
  num: string
  cat: string
  task: string
  dept: string
  mat: string
  start: string
  plan: string
  time: string
  loc: string
  mgr: string
  status: string
  end: string
  link: string
  remind: boolean
  chief: boolean
}

/** 업무 목록 읽기 — 백엔드가 헤더명으로 행을 객체로 변환해 반환 */
export async function getWorks(): Promise<WorkRow[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getWorks`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = (await res.json()) as { status: string; items?: WorkRow[]; message?: string }
  if (json.status !== 'ok') throw new Error(json.message || '오류')
  return json.items || []
}

export interface WorkInput {
  /** 게시자(관리자) 이름 — 인증용 */
  author: string
  /** 관리자 비밀번호 — 인증용 */
  key: string
  cat: string
  task: string
  dept?: string
  mat?: string
  start?: string
  plan?: string
  time?: string
  loc?: string
  mgr?: string
  status: string
  /** 완료일자 — 비우면 백엔드가 상태에 따라 자동 처리 */
  end?: string
  link?: string
  remind?: boolean
  chief?: boolean
}

async function postWork(payload: Record<string, unknown>): Promise<{ num?: number }> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; num?: number }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 업무 편집을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
  return { num: json.num }
}

/** 업무 신규 등록 → 새 번호 반환 */
export async function createWork(p: WorkInput): Promise<number> {
  const { num } = await postWork({ action: 'createWork', ...p })
  return num || 0
}
/** 업무 수정 (번호 기준) */
export async function updateWork(p: WorkInput & { num: string | number }): Promise<void> {
  await postWork({ action: 'updateWork', ...p })
}
/** 업무 삭제 (번호 기준) */
export async function deleteWork(p: { num: string | number; author: string; key: string }): Promise<void> {
  await postWork({ action: 'deleteWork', ...p })
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
