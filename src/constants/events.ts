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
  /** 팝업 하단 배경색(포스터 하단 가장자리색) — 가로 긴 포스터의 아래 여백을 매끄럽게 채움 */
  posterBg?: string
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
    posterBg: 'rgb(52,58,71)',
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
  {
    id: 'ktech-fab1-202607',
    title: '반도체공정실습 1 (7월)',
    kind: '교육',
    start: '2026-07-06',
    end: '2026-07-08',
    venue: '한국기술교육대학교 제2캠퍼스(서울)',
    organizer: '한국기술교육대학교',
    link: 'https://setec.koreatech.ac.kr/bbs/bbs/board.php?bo_table=gongji&wr_id=410',
    poster: 'events/ktech-fab-202607.jpg',
    posterBg: 'rgb(0,56,167)',
    accent: 'green',
    summary: [
      { label: '신청', value: '사전등록 필수' },
      { label: '수강료', value: '600,000원 + 숙박비 30,000원' },
      { label: '내용', value: '반도체 공정 기술·공정 실습, 진공기술, 반도체 장비 등' },
    ],
  },
  {
    id: 'ktech-fab2-202607',
    title: '반도체공정실습 2 (7월)',
    kind: '교육',
    start: '2026-07-09',
    venue: '한국기술교육대학교 제2캠퍼스(서울)',
    organizer: '한국기술교육대학교',
    link: 'https://setec.koreatech.ac.kr/bbs/bbs/board.php?bo_table=gongji&wr_id=410',
    poster: 'events/ktech-fab-202607.jpg',
    posterBg: 'rgb(0,56,167)',
    accent: 'green',
    summary: [
      { label: '신청', value: '사전등록 필수' },
      { label: '수강료', value: '250,000원' },
      { label: '내용', value: '반도체 공정 기술·공정 실습, 진공기술, 반도체 장비 등' },
    ],
  },
  {
    id: 'ises-summer2026',
    title: '2026 반도체공학회 하계종합학술대회',
    kind: '국내학회',
    start: '2026-07-14',
    end: '2026-07-17',
    venue: '아난티 앳 부산 코브',
    organizer: '반도체공학회',
    link: 'https://event.theise.org/conference/',
    poster: 'events/ises-summer2026.jpg',
    posterBg: 'rgb(16,27,63)',
    accent: 'blue',
    summary: [
      { label: '논문마감', value: '2026.06.08 (결과통보 6.15)' },
      { label: '사전등록', value: '~2026.06.29' },
      { label: 'Plenary', speakers: ['임성규', '최정연', '김태완'] },
      { label: '분야', value: '반도체 소재·소자·공정·패키징·MEMS, AI 반도체, 아날로그·센서·전력 등' },
    ],
  },
  {
    id: 'semi-advpkg2026',
    title: 'Advanced Packaging Summit 2026',
    kind: '컨퍼런스',
    start: '2026-07-15',
    venue: '수원컨벤션센터',
    organizer: 'SEMI',
    link: 'https://www.semi.org/en/connect/events/advanced-packaging-summit-2026',
    poster: 'events/semi-advpkg2026.jpg',
    posterBg: 'rgb(24,13,82)',
    accent: 'teal',
    summary: [
      { label: '주제', value: 'AI·HPC용 첨단 패키징, Heterogeneous Integration·Chiplet' },
      { label: '주제', value: '2.5D/3D 패키징·Hybrid Bonding, 차세대 패키징 공정 및 시장 동향' },
    ],
  },
  {
    id: 'asps2026',
    title: 'ASPS 2026 - 차세대 반도체 패키징 산업전',
    kind: '전시회',
    start: '2026-08-26',
    end: '2026-08-28',
    venue: '수원컨벤션센터',
    organizer: '경기도·수원시',
    link: 'https://www.semipkgshow.com/',
    poster: 'events/asps2026.jpg',
    posterBg: 'rgb(44,49,145)',
    accent: 'purple',
    summary: [
      { label: '관람', value: '2026.08.26~28' },
      { label: '전시', value: '반도체 패키징·테스트 장비, 소재·부품, EDA, 유리기판, 시스템반도체 등' },
      { label: '부대행사', value: '반도체 패키징 트렌드 포럼(SPTF)·I.S.I.G. Korea·바이어 상담회 등' },
    ],
  },
  {
    id: 'kpca2026',
    title: 'KPCA Show 2026 - 제23회 국제 반도체 기판 및 첨단 패키징 산업전',
    kind: '전시회',
    start: '2026-09-09',
    end: '2026-09-11',
    venue: '인천 송도컨벤시아',
    organizer: '한국PCB반도체패키징산업협회',
    link: 'https://www.kpcashow.com/kor/aboutus/about.asp',
    poster: 'events/kpca2026.jpg',
    posterBg: 'rgb(0,200,226)',
    accent: 'amber',
    summary: [
      { label: '관람', value: '2026.09.09~11 10:00~17:00' },
      { label: '입장', value: '참관 사전등록(무료)' },
      { label: '전시', value: '첨단 반도체 기판·패키징, 도금·표면처리, 신뢰성 검사장비, 자동차 전장 등' },
    ],
  },
  {
    id: 'sedex2026',
    title: 'SEDEX 2026 - 제28회 반도체대전',
    kind: '전시회',
    start: '2026-10-14',
    end: '2026-10-16',
    venue: '서울 코엑스',
    organizer: '한국반도체산업협회',
    link: 'https://www.sedex.org/public_html/index.asp',
    poster: 'events/sedex2026.jpg',
    posterBg: 'rgb(66,71,146)',
    accent: 'red',
    summary: [
      { label: '입장', value: '사전등록(~10/12) 무료 · 현장등록 20,000원' },
      { label: '전시', value: '메모리·시스템 반도체, 반도체 장비·부품·소재·설비·센서 등' },
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
