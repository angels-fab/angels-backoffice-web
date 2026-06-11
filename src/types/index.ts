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
  /** L열: 관련 링크 (URL) */
  link: string
  /** J열 공유여부 '1' → 진행중 업무 */
  share: boolean
  /** K열 Remind '1' → 지난 업무 최상단 고정 */
  remind: boolean
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
}

// ── 공지사항 ──
export type NoticeCat = '긴급' | '공지' | '일반' | '행사'

export interface Notice {
  id: number
  cat: NoticeCat
  title: string
  author: string
  date: string
  views: number
  isNew: boolean
  body: ReactNode
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
