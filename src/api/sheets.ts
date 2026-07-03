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
  // cache-buster — 재시도 시 중간 캐시(브라우저·리다이렉트 경유)의 오래된 실패 응답 재사용 방지
  const res = await fetch(`${SCRIPT_URL}?calendar=1&cb=${Date.now()}`)
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
  /** 포털정렬순서 — 진행중 카드 수동 정렬값(빈값 가능) */
  order: string
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

/** 진행중 카드 수동 정렬순서 저장 — '포털정렬순서' 열만 갱신(행 이동 없음). 최종 순서를 한 번에 전송. */
export interface WorkOrderEntry { num: string; order: number }
export async function updateWorkOrder(p: { author: string; key: string; orders: WorkOrderEntry[] }): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateWorkOrder', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 순서 저장을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
}

/**
 * 업무 상태 배치 변경(드래그 상태변경/Undo·Redo 공용) — 한 번의 요청으로 여러 업무의
 * 상태·Remind·Check를 원자적으로 갱신. 백엔드는 전체 검증 후 쓰기, 실패 시 복구.
 */
export interface WorkStatusChange {
  num: string | number
  /** 목표 상태: 진행중 | 보류 | 완료 */
  status: string
  remind: boolean
  chief: boolean
  /** 완료 상태 유지 시 기존 완료일자 보존용. 미지정('' 포함 undefined)이면 백엔드 자동 규칙(완료=오늘/그 외=비움) */
  end?: string
  /** 충돌 확인용 — 요청 시점에 클라이언트가 알고 있던 시트 상태(다르면 전체 실패) */
  prevStatus?: string
}
export async function updateWorkStatuses(p: { author: string; key: string; changes: WorkStatusChange[] }): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateWorkStatuses', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 상태 배치 변경을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '상태 변경 실패')
}

/** 페이지 종료 직전 마지막 순서를 best-effort로 전송(sendBeacon). UA가 큐잉을 수락하면 true. */
export function beaconWorkOrder(p: { author: string; key: string; orders: WorkOrderEntry[] }): boolean {
  try {
    if (!p.orders.length || typeof navigator === 'undefined' || !navigator.sendBeacon) return false
    return navigator.sendBeacon(SCRIPT_URL, JSON.stringify({ action: 'updateWorkOrder', ...p }))
  } catch {
    return false
  }
}

// ── 장비도입관리 CRUD (헤더명 기준) ──
export interface ScheduleInput {
  author: string
  key: string
  /** 관리번호 (행 식별 키) */
  code: string
  name: string
  mgr?: string
  status?: string
  /** 시작년월 yyyy-MM-dd */
  start?: string
  /** 단계 소요기간(개월) — 키: 사전규격/구매공고/기술평가/기술협상/장비제작/장비설치 */
  stages?: Record<string, string>
  cat?: string
  method?: string
  /** 도입금액 */
  price?: string | number
}

/** 장비 도입 신규 등록 → 관리번호 반환 */
export async function createSchedule(p: ScheduleInput): Promise<string> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'createSchedule', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; code?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 장비 도입 편집을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '저장 실패')
  return json.code || ''
}

/** 장비 도입 수정 — 원본 관리번호(origCode)로 행을 찾아 갱신 */
export async function updateSchedule(p: ScheduleInput & { origCode: string }): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateSchedule', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 장비 도입 수정을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '수정 실패')
}

/** 장비 도입 삭제 (관리번호 기준) */
export async function deleteSchedule(p: { code: string; author: string; key: string }): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'deleteSchedule', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 장비 도입 삭제를 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '삭제 실패')
}

// ── 장비운영관리 수정 (Update만, 헤더명 기준 · 관리번호로 행 식별) ──
export interface EquipmentUpdateInput {
  author: string
  key: string
  /** 관리번호 — 행 식별 키(대표 1대) */
  code: string
  mgr?: string
  maker?: string
  model?: string
  assetNo?: string
  nfec?: string
  installLoc?: string
  installDate?: string
  vendor?: string
  mgr2?: string
  contact?: string
  note?: string
  /** 상태 변경 — '도입예정'|'도입중'|'운영중'|'비가동' (시트 값 그대로) */
  state?: string
  /** 상태 변경 사유(선택) — '변경사유' 등 열이 있을 때만 저장 */
  reason?: string
}

/** 장비운영관리 행 수정 (관리번호 기준). 추가/삭제는 미지원. CORS 주의는 addNotice와 동일. */
export async function updateEquipment(p: EquipmentUpdateInput): Promise<void> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'updateEquipment', ...p }) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 장비 수정을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '수정 실패')
}

// ── STEP22 장비 운영이력 (읽기 전용, append-only '장비운영이력' 시트) ──
export interface EqHistoryItem {
  /** 기록 일시 'yyyy-MM-dd HH:mm' (KST) */
  when: string
  /** 관리번호 */
  code: string
  /** 장비명 */
  name: string
  /** 이전 상태 */
  prev: string
  /** 변경 상태 */
  next: string
  /** 사유(없으면 빈 문자열) */
  reason: string
  /** 작성자(변경 수행 관리자) */
  author: string
  /** 작업유형 — 현재는 '상태변경' */
  type: string
  /** 비고 */
  note: string
}

/** 장비 운영이력 조회 — 관리번호로 필터(최신 먼저). 이력 시트가 없으면 빈 배열. 인증 불필요(조회 전용). */
export async function fetchEqHistory(code: string): Promise<EqHistoryItem[]> {
  const res = await fetch(`${SCRIPT_URL}?action=getEqHistory&code=${encodeURIComponent(code)}`)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const json = (await res.json()) as { status: string; items?: EqHistoryItem[]; message?: string }
  if (json.status !== 'ok') throw new Error(json.message || '오류')
  return json.items || []
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

// ── 개선제안 ('개선사항' 시트) ──
export interface ImprovementRow {
  num: string
  urgent: boolean
  type: string
  loc: string
  title: string
  content: string
  author: string
  mgr: string
  date: string
  link: string
  status: string
  end: string
  reason: string
  /** 메모표시 — 해당 개선위치 페이지에 작업 메모로 노출 */
  memo: boolean
}

// 일시적 네트워크 오류('Failed to fetch') 대비 재시도 — 멱등 요청(조회·상태변경)에만 사용
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 600): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

export interface ImprovementsData {
  items: ImprovementRow[]
  /** 구글시트 '개선위치' 열 데이터 확인(드롭다운) 목록 */
  locOptions: string[]
  /** 구글시트 '유형' 열 데이터 확인(드롭다운) 목록 */
  typeOptions: string[]
}

/** 개선제안 목록 + 위치/유형 드롭다운 목록 조회 (인증 불필요, 네트워크 재시도) */
export async function fetchImprovements(): Promise<ImprovementsData> {
  return withRetry(async () => {
    // Apps Script GET 응답이 캐시되어 옛 데이터/에러가 남는 것을 막기 위한 캐시 우회 파라미터
    const res = await fetch(`${SCRIPT_URL}?action=getImprovements&_=${Date.now()}`)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = (await res.json()) as { status: string; items?: ImprovementRow[]; locOptions?: string[]; typeOptions?: string[]; message?: string }
    if (json.status !== 'ok') throw new Error(json.message || '불러오기 실패')
    return { items: json.items || [], locOptions: json.locOptions || [], typeOptions: json.typeOptions || [] }
  })
}

async function postImprove(payload: Record<string, unknown>): Promise<{ num?: number }> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; num?: number }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 개선제안을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
  return { num: json.num }
}

export interface ImprovementInput {
  author: string
  key: string
  urgent?: boolean
  type?: string
  loc?: string
  title: string
  content?: string
  mgr?: string
  date?: string
  link?: string
}

/** 개선제안 등록 (로그인 사용자) → 새 번호 */
export async function createImprovement(p: ImprovementInput): Promise<number> {
  const { num } = await postImprove({ action: 'createImprovement', ...p })
  return num || 0
}

/**
 * 개선제안 변경 (담당자만).
 * - 상태 변경: status(+reason) 전달 → 완료=완료일자 자동, 불가/보류=사유
 * - 내용 수정: title/content/type/loc/link/urgent 전달 → 해당 필드만 갱신(status 미전달 시 완료일자·사유 보존)
 */
export async function updateImprovement(p: {
  author: string
  key: string
  num: string | number
  status?: string
  reason?: string
  end?: string
  urgent?: boolean
  type?: string
  loc?: string
  title?: string
  content?: string
  link?: string
  /** 메모표시 토글(작업 메모 띄우기/해제) */
  memo?: boolean
}): Promise<void> {
  // 변경은 멱등(같은 값 재설정 무해)이라 네트워크 오류 시 재시도
  await withRetry(() => postImprove({ action: 'updateImprovement', ...p }))
}

/** 개선제안 삭제 (담당자만) — 번호 기준. 중복 삭제 방지 위해 단일 시도. */
export async function deleteImprovement(p: { author: string; key: string; num: string | number }): Promise<void> {
  await postImprove({ action: 'deleteImprovement', ...p })
}

// ── 포털개선요청 답글 ('포털개선답글' 시트, 소프트 삭제) ──
export interface ReplyRow {
  /** 답글ID */
  id: string
  /** 요청번호 — 원본 개선요청 num과 연결 */
  reqNum: string
  /** 작성일시 'yyyy-MM-dd HH:mm:ss' (KST) */
  created: string
  author: string
  content: string
  /** 수정일시 — 수정 시에만 값 있음 */
  edited: string
}

/** 답글 전체 조회(삭제 제외) — 한 번에 로드 후 요청번호별 그룹화는 프런트. 인증 불필요, 네트워크 재시도. */
export async function fetchReplies(): Promise<ReplyRow[]> {
  return withRetry(async () => {
    const res = await fetch(`${SCRIPT_URL}?action=getReplies&_=${Date.now()}`)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const json = (await res.json()) as { status: string; items?: ReplyRow[]; message?: string }
    if (json.status !== 'ok') throw new Error(json.message || '답글 불러오기 실패')
    return json.items || []
  })
}

async function postReply(payload: Record<string, unknown>): Promise<{ id?: number | string; created?: string; edited?: string }> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; id?: number | string; created?: string; edited?: string }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 답글을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
  return { id: json.id, created: json.created, edited: json.edited }
}

/** 답글 등록 (관리자) → { id, created } */
export async function createReply(p: { author: string; key: string; reqNum: string | number; content: string }): Promise<{ id: string; created: string }> {
  const { id, created } = await postReply({ action: 'createReply', ...p })
  return { id: String(id ?? ''), created: created || '' }
}

/** 답글 수정 (본인 작성만) → { edited } */
export async function updateReply(p: { author: string; key: string; id: string | number; content: string }): Promise<{ edited: string }> {
  const { edited } = await postReply({ action: 'updateReply', ...p })
  return { edited: edited || '' }
}

/** 답글 삭제처리(소프트, 본인 작성만) — 행 삭제 X, 삭제여부=TRUE */
export async function deleteReply(p: { author: string; key: string; id: string | number }): Promise<void> {
  await postReply({ action: 'deleteReply', ...p })
}

// ── 포털개선요청 임시저장 ('포털개선요청_임시저장' 시트) + 일괄등록 ──
export interface DraftRow {
  /** 임시저장ID */
  id: string
  urgent: boolean
  title: string
  /** 관련자료 링크 */
  link: string
  /** 개선위치 */
  loc: string
  content: string
  /** 최종저장일시 'yyyy-MM-dd HH:mm:ss' (KST) */
  savedAt: string
}
/** 임시저장 저장용 카드(id는 신규 카드면 생략) */
export interface DraftInput {
  id?: string
  urgent: boolean
  title: string
  link: string
  loc: string
  content: string
}

async function postDraft(payload: Record<string, unknown>): Promise<{ items?: DraftRow[]; nums?: number[]; deleted?: number }> {
  const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  let json: { status: string; message?: string; items?: DraftRow[]; nums?: number[]; deleted?: number }
  try {
    json = (await res.json()) as typeof json
  } catch {
    throw new Error('서버가 아직 임시저장을 지원하지 않습니다 (Apps Script 재배포 필요)')
  }
  if (json.status !== 'ok') throw new Error(json.message || '처리 실패')
  return { items: json.items, nums: json.nums, deleted: json.deleted }
}

/** 임시저장 조회(본인 것만) — 인증 필수. 멱등 읽기라 네트워크 재시도. */
export async function fetchDrafts(p: { author: string; key: string }): Promise<DraftRow[]> {
  const { items } = await withRetry(() => postDraft({ action: 'getDrafts', ...p }))
  return items || []
}

/** 임시저장 저장(수동, 본인 것 전체 대치) → 저장된 목록(부여된 ID 포함) */
export async function saveDrafts(p: { author: string; key: string; drafts: DraftInput[] }): Promise<DraftRow[]> {
  const { items } = await postDraft({ action: 'saveDrafts', ...p })
  return items || []
}

/** 임시저장 삭제 — ids 전달 시 해당만, 없으면 본인 전체(일괄등록 후 정리). */
export async function deleteDrafts(p: { author: string; key: string; ids?: string[] }): Promise<void> {
  await postDraft({ action: 'deleteDrafts', ...p })
}

/** 여러 개선요청 일괄등록(각 카드=독립 게시글) → 부여된 번호 목록. 중복등록 방지 위해 단일 시도. */
export async function createImprovements(p: {
  author: string
  key: string
  items: Array<{ urgent: boolean; loc: string; title: string; content: string; link: string }>
}): Promise<number[]> {
  const { nums } = await postDraft({ action: 'createImprovements', ...p })
  return nums || []
}
