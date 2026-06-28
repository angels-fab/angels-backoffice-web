import type { ReactNode } from 'react'

// ── 업무현황 ('센터 업무 현황' 시트 1행 = WorkItem) ──
// 시트 열(헤더 기준 자동 인식): 번호 구분 업무 관련부서 관련자료 발의일자 예정일
//   시간 장소 담당자 상태 완료일자 Remind 센터장검토 링크
export interface WorkItem {
  id: number
  num: string
  cat: string
  task: string
  dept: string
  mat: string
  /** 발의일자 */
  start: string
  /** 예정일 — 회의 등 업무일정 날짜 */
  plan: string
  time: string
  loc: string
  mgr: string
  /** 상태 — 시트 '상태' 열 (진행중 / 보류 / 완료, 빈값=미정) */
  status: string
  /** 완료일자 */
  end: string
  /** 관련 링크 (URL) */
  link: string
  /** Remind 체크 */
  remind: boolean
  /** 검토 필요 체크 (구 센터장 검토) */
  chief: boolean
}

/** 개선제안 ('개선사항' 시트) */
export interface ImprovementItem {
  id: number
  num: string
  /** 긴급 여부 */
  urgent: boolean
  /** 유형(분류) */
  type: string
  /** 개선위치 */
  loc: string
  title: string
  /** 요청내용(본문) — 시트 헤더 '요청내용'(기존 '개선내용' 호환) */
  content: string
  author: string
  /** 담당자 — 상태 변경 권한자 */
  mgr: string
  /** 제안일자 */
  date: string
  /** 관련자료 링크(URL) */
  link: string
  /** 상태 — 접수중/검토중/개선완료/반려/보류 */
  status: string
  /** 완료일자 (개선완료 시) */
  end: string
  /** 사유 — 반려·보류 공용 */
  reason: string
  /** 메모표시 — 체크 시 해당 개선위치 페이지에 공유 작업 메모로 노출 */
  memo: boolean
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
  /** 아래 4개는 대표(첫 개체) 기준 — 같은 그룹의 개체별로 다를 수 있음 */
  assetNo: string
  nfec: string
  installDate: string
  mgr2: string
  codes: string[]
  prices: number[]
  price: number
  count: number
  variants: EqRawItem[]
  hasVariant: boolean
  timeline: string[]
}

/** '장비도입관리' 시트 1행 = 도입 프로젝트 1건 (CRUD 표시 단위, 헤더명 기반) */
export interface ScheduleItem {
  /** 연번(자동) */
  seq: string
  /** 관리번호 — 행 식별 키 */
  code: string
  name: string
  mgr: string
  /** 진행상태 */
  status: string
  /** 시작년월 yyyy-MM-dd */
  start: string
  /** 단계별 소요기간(개월) — 키: 사전규격/구매공고/기술평가/기술협상/장비제작/장비설치 */
  stages: Record<string, string>
  /** 총 소요기간(자동) */
  duration: string
  /** 구분 */
  cat: string
  /** 도입방법 */
  method: string
  /** 도입금액 */
  price: number
  /** 반월 단위 단계 코드 (간트) */
  timeline: string[]
}

/** 상태별 집계 (대수 + 종 수) */
export interface EqCounts {
  total: number
  types: number
  units: Record<EqStateKey, number>
  typesBy: Record<EqStateKey, number>
}
export type EqStateKey = '도입예정' | '도입중' | '운영중' | '비가동' | '미분류'

// ── 캘린더 ──
export type CalCatId = 'all' | 'meeting' | 'work' | 'edu' | 'recruit' | 'trip_dom' | 'trip_intl' | 'etc'

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
