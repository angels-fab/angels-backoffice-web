// 학술·교육 행사 데이터 (repo 저장 모델 — 가끔 게시).
// 새 행사: 이 배열에 한 항목 추가 + (있으면) 포스터를 public/events/ 에 넣고 poster 경로 지정.
// 포스터가 없으면 accent 그라데이션으로 카드가 채워짐.

export type EventAccent = 'blue' | 'teal' | 'green' | 'purple' | 'amber' | 'red'

export interface FabEvent {
  id: string
  title: string
  /** 구분: 국제학회 · 심포지엄 · 교육세미나 · 채용 · 워크숍 등 */
  kind: string
  /** 시작일 (YYYY-MM-DD) */
  start: string
  /** 종료일 (YYYY-MM-DD) — 단일 일정이면 생략 */
  end?: string
  venue: string
  organizer?: string
  /** 행사 공식 사이트 */
  link: string
  /** 포스터 이미지 경로 (public 기준, 예: 'events/ispsa2026.jpg'). 없으면 그라데이션 */
  poster?: string
  /** 간략 내용(불릿) */
  summary?: string[]
  /** 포스터 없을 때 카드 배경 그라데이션 */
  accent?: EventAccent
}

export const FAB_EVENTS: FabEvent[] = [
  {
    id: 'ispsa2026',
    title: 'ISPSA 2026 — 22nd International Symposium on the Physics of Semiconductors and Applications',
    kind: '국제학회',
    start: '2026-06-28',
    end: '2026-07-02',
    venue: '제주 해비치 호텔 & 리조트',
    organizer: '단국대학교 · KASPA',
    link: 'https://ispsa.or.kr/',
    accent: 'blue',
    summary: [
      '반도체 물리·응용 분야 격년 국제 심포지엄(22회) · 전 세계 1,000명 이상 참가',
      '사전등록 2026.06.05~06.19 · 초록 마감 2026.04.03',
      'Plenary: Henk Bolink · Jing Kong · John A. Rogers · Feng Wang 등',
    ],
  },
]

export interface EventStatus {
  label: string
  tone: 'green' | 'amber' | 'gray'
}

/** 오늘 기준 D-day / 진행중 / 종료 */
export function eventStatus(startISO: string, endISO?: string): EventStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const s = new Date(`${startISO}T00:00:00`)
  const e = new Date(`${endISO ?? startISO}T00:00:00`)
  if (today.getTime() > e.getTime()) return { label: '종료', tone: 'gray' }
  if (today.getTime() >= s.getTime()) return { label: '진행중', tone: 'green' }
  const days = Math.ceil((s.getTime() - today.getTime()) / 86400000)
  return { label: `D-${days}`, tone: 'amber' }
}

/** 표시용 날짜 — 2026.06.28 / 2026.06.28–07.02 */
export function fmtEventDate(startISO: string, endISO?: string): string {
  const dot = (iso: string) => iso.replace(/-/g, '.')
  if (!endISO || endISO === startISO) return dot(startISO)
  const [sy, sm] = startISO.split('-')
  const [ey, em, ed] = endISO.split('-')
  if (sy === ey && sm === em) return `${dot(startISO)}–${ed}`
  return `${dot(startISO)} – ${dot(endISO)}`
}
