// 학술·교육 행사 데이터 (repo 저장 모델 — 가끔 게시).
// 새 행사: 이 배열에 한 항목 추가 + (있으면) 포스터를 public/events/ 에 넣고 poster 경로 지정.
// 포스터가 없으면 accent 그라데이션으로 카드가 채워짐.

// 팀원용 '예정 행사 등록 요청' 구글 폼 — 로그인 직원에게만 버튼 노출.
// 제출 → (폼 소유자에게 이메일 알림) → 담당자가 URL 보고 카드로 등록.
export const EVENT_REQUEST_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSd773EgoV0aRMfFuTYHnFXSqHmYgFEZY8qThJu0o7L9XoHVtA/viewform'

export type EventAccent = 'blue' | 'teal' | 'green' | 'purple' | 'amber' | 'red'

// 요약 한 줄: 헤더(label) + 내용(value), 또는 연사 목록(speakers).
export interface EventSummaryItem {
  /** 헤더명 (예: 사전등록·초록마감·Plenary). 없으면 일반 문장 */
  label?: string
  /** 내용 (날짜·설명 등) */
  value?: string
  /** 연사 목록 (Plenary/Keynote) — 이름 단위 줄바꿈 방지, 최대 2줄 표시 */
  speakers?: string[]
}

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
  /** 간략 내용(불릿) — 첫 항목은 개요(회차·규모) */
  summary?: EventSummaryItem[]
  /** 포스터 없을 때 카드 배경 그라데이션 */
  accent?: EventAccent
}

export const FAB_EVENTS: FabEvent[] = [
  {
    id: 'ispsa2026',
    title: 'ISPSA 2026 - 제22회 반도체 물리·응용 국제심포지엄',
    kind: '국제학회',
    start: '2026-06-28',
    end: '2026-07-02',
    venue: '제주 해비치 호텔 & 리조트',
    organizer: '한국물리학회(KPS)',
    link: 'https://ispsa.or.kr/',
    poster: 'events/ispsa2026.jpg',
    accent: 'blue',
    summary: [
      { label: '사전등록', value: '2026.06.05 ~ 06.19' },
      { label: '초록마감', value: '2026.04.03 (채택 통보 4.24)' },
      {
        label: 'Plenary',
        speakers: [
          'Henk Bolink',
          'Jing Kong',
          'John A. Rogers',
          'Feng Wang',
          'Amir Yacoby',
          'J. Joshua Yang',
        ],
      },
      { label: '공동주관', value: 'CHIPS(한양대)·성균관대·이화여대·군산대' },
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

/** 표시용 날짜 — 같은 연·월이면 끝은 일만, 같은 연 다른 월이면 끝은 월.일, 다른 연이면 전체 */
export function fmtEventDate(startISO: string, endISO?: string): string {
  const dot = (iso: string) => iso.replace(/-/g, '.')
  if (!endISO || endISO === startISO) return dot(startISO)
  const [sy, sm] = startISO.split('-')
  const [ey, em, ed] = endISO.split('-')
  if (sy === ey && sm === em) return `${dot(startISO)}-${ed}` // 2025.05.05-08
  if (sy === ey) return `${dot(startISO)} - ${em}.${ed}` // 2025.05.30 - 06.05
  return `${dot(startISO)} - ${dot(endISO)}`
}
