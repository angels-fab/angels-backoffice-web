import type { ReactNode } from 'react'

// ── 업무현황 ('센터 업무 현황' 시트 1행 = WorkItem) ──
export interface WorkItem {
  id: number
  num: string
  cat: string
  task: string
  dept: string
  mat: string
  start: string
  time: string
  loc: string
  mgr: string
  end: string
  /** M열: 관련 링크 (URL) */
  link: string
  /** J열 체크 → 진행중 업무 */
  share: boolean
  /** K열 체크 → Remind */
  remind: boolean
  /** L열 체크 → 센터장 Check */
  chief: boolean
}

// ── 장비현황 ──
export interface TlMonth {
  year: string
  month: string
}

/** '장비 총괄표' 시트 1행 = 장비 1대 */
export interface EqRawItem {
  num: string
  code: string
  name: string
  cat: string
  use: string
  type: string
  bid: string
  fund: string
  mgr: string
  status: string
  start: string
  assetNo: string
  nfec: string
  maker: string
  model: string
  price: number
  installDate: string
  installLoc: string
  state: string
  mgr2: string
  vendor: string
  contact: string
  note: string
  /** '장비타임라인' 시트의 반월 단위 단계 코드 (사/공/평/협/제/설) */
  timeline: string[]
}

/** 장비명 기준 그룹 (목록 표시 단위) */
export interface EqGroup {
  name: string
  cat: string
  use: string
  type: string
  mgr: string
  bid: string
  fund: string
  maker: string
  model: string
  state: string
  installLoc: string
  vendor: string
  contact: string
  note: string
  codes: string[]
  prices: number[]
  price: number
  count: number
  variants: EqRawItem[]
  hasVariant: boolean
  timeline: string[]
}

/** 상태별 집계 (대수 + 종 수) */
export interface EqCounts {
  total: number
  types: number
  units: Record<EqStateKey, number>
  typesBy: Record<EqStateKey, number>
}
export type EqStateKey = '도입예정' | '도입중' | '가동중' | '비가동'

// ── 캘린더 ──
export type CalCatId = 'all' | 'meeting' | 'edu' | 'recruit' | 'trip' | 'etc'

export interface CalCat {
  id: CalCatId
  label: string
  cls: string
  color: string
}

export interface CalEvent {
  date: string
  title: string
  cat: Exclude<CalCatId, 'all'>
  time: string
  loc: string
  /** 구글캘린더 이벤트 고유 ID — 수정/삭제 대상 지정용 */
  id: string
  /** 원본 시작 'yyyy-MM-ddTHH:mm' (KST) — 여러 날 일정도 원본 기준으로 편집 */
  start: string
  /** 원본 종료 'yyyy-MM-ddTHH:mm' (KST) */
  end: string
  allDay: boolean
  /** 반복 일정 여부 — 수정/삭제 시 '이 일정만/전체 시리즈' 선택 */
  recurring: boolean
}

// ── 공지사항 ('공지사항' 시트 1행 = Notice) ──
// 시트 열: A연번 B상단체크 C업무(분류) D부서 E부서담당자 F제목 G내용
//         H관련자료 I시작일자 J작성일자 K작성시간 L종료일자 M게시자 N해당자
export interface Notice {
  id: number
  /** A열 연번 — 정렬·딥링크(/notice/연번) 기준 */
  num: string
  /** B열 상단체크 — true면 게시판 최상단 고정 */
  pinned: boolean
  cat: string
  dept: string
  deptMgr: string
  title: string
  /** G열 내용 — 일반 텍스트 또는 관리자 작성 HTML */
  body: string
  /** H열 관련자료 — URL이면 첨부 링크 아이콘 표시 */
  ref: string
  /** 닫힌 줄 표시용 날짜 (작성일자 → 시작일자 순) */
  date: string
  reply: string
  start: string
  /** K열 작성시간 */
  ctime: string
  /** L열 종료일자 — 오늘보다 이전이면 만료(제목 회색) */
  end: string
  author: string
  target: string
  views: number
  isNew: boolean
}

// ── 바로가기 ──
export interface QuickLink {
  icon: ReactNode
  name: string
  host: string
  url: string
  /** 아이콘 배경색 (바로가기 페이지) */
  bg: string
}
