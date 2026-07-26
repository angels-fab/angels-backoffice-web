import type { StatusKind } from '@/components/ds'
import type { WorkItem } from '@/types'
import { normCat } from '@/utils/workCat'
import { domain } from '@/theme/tokens'

// ── 카드 상태 계층 대표색 — KPI 스트립과 동일 계열(밝은 변형) ──────────────────
// r g b 트리플릿. rgb(R G B / a) 알파 사다리로 카드 기본→호버→선택 강도를 표현
// (시안 docs/mockups/work-status-color-effects.html). 카드 배경·테두리·선택 효과 전용 —
// 카드 내부 구분/담당자/부서/Check 칩(메타정보 계층)은 이 색을 상속하지 않는다.
// 정본은 tokens.domain.workTone. D3 배정: green=진행중·blue=완료·amber=보류·purple=Remind
export type CardTone = 'green' | 'blue' | 'gray' | 'amber' | 'purple'
export const TONE_RGB: Record<CardTone, string> = domain.workTone

/**
 * 카드 톤 색은 **CSS 변수**로 해석한다 — 정본은 index.css의 `--tone-{green|blue|amber|purple|gray}`
 * (다크=workTone 파스텔 / 라이트=채도 높은 원색)와 알파 배율 `--tone-k`(다크 1 / 라이트 2.4).
 *
 * JS로 테마를 읽어 색 문자열을 구워 넘기지 않는 이유: 보드 카드(144장)는 memo돼 있어 테마 전환 때
 * 리렌더되지 않고, 구워둔 색이 이전 테마 값으로 남았다(실측 — 라이트인데 다크 파스텔 유지).
 * CSS 변수는 <html data-theme>가 바뀌면 리렌더 없이 전부 따라오고, 전환 커밋 비용도 함께 줄어든다.
 *
 * 라이트 배율이 필요한 이유: workTone은 다크 배경용 파스텔이라, 알파 .055로 흰 배경에 얹으면
 * #F7FCF9 = 사실상 흰색이 된다("색에 힘이 없다").
 */
export const toneVar = (tone: CardTone): string => `var(--tone-${tone})`

/**
 * `--card-tone`을 세팅한 요소(및 자손)에서 쓰는 톤 색. `a`는 **다크 기준** 알파 —
 * 라이트는 `--tone-k`가 곱해진다(알파는 CSS가 0~1로 자동 clamp).
 */
export const toneCss = (a: number): string => `rgb(var(--card-tone) / calc(${a} * var(--tone-k)))`

/**
 * 카드 **본문** 채움 — 상태별 최종 알파를 테마 변수로 직접 받는다(`--tone-k` 배율 미적용).
 *
 * 본문은 카드 면적의 84%라 머리띠와 같은 배율로 칠하면 라이트에서 화면의 29%가 한 가지 색으로
 * 덮여 "초록 덩어리"가 된다(실측). 색을 약하게 만드는 대신 **색이 차지하는 면적을 줄이는** 쪽으로,
 * 본문만 라이트에서 .133 → .05로 낮춘다. 다크는 원래 옅어서(.055) 그대로.
 * 머리띠·테두리·링은 toneCss를 그대로 써서 상태가 여전히 한눈에 읽히게 남긴다.
 */
/** 카드 평상시 테두리 — 본문과 같은 이유로 배율을 빼고 테마별 최종 알파를 직접 준다 */
export const toneBorderCss = 'rgb(var(--card-tone) / var(--tone-border))'

/** 선택 2px 링 / 호버 1px 링 — 배율 미적용(라이트에서 테두리와 붙어 두꺼워 보이던 원인) */
export const toneBorderHoverCss = 'rgb(var(--card-tone) / var(--tone-border-hover))'
export const toneBorderSelCss = 'rgb(var(--card-tone) / var(--tone-border-sel))'
export const toneRingCss = 'rgb(var(--card-tone) / var(--tone-ring))'
export const toneRingHoverCss = 'rgb(var(--card-tone) / var(--tone-ring-hover))'

export const toneBody = {
  base: 'rgb(var(--card-tone) / var(--tone-body))',
  hover: 'rgb(var(--card-tone) / var(--tone-body-hover))',
  selected: 'rgb(var(--card-tone) / var(--tone-body-sel))',
} as const

// 업무구분 → 칩 색(캡처 기준): 설계적정성=초록·예산=빨강·인사=노랑·행정=파랑·장비=회색·교육세미나=보라
const CAT_KIND: { key: string; kind: StatusKind }[] = [
  { key: '설계적정성', kind: 'success' },
  { key: '예산', kind: 'error' },
  { key: '인사', kind: 'warning' },
  { key: '행정', kind: 'info' },
  { key: '장비', kind: 'neutral' },
  { key: '교육세미나', kind: 'purple' },
]
/** 업무구분 라벨 → StatusChip 색(kind). 매칭 없으면 neutral. */
export function catKind(cat?: string): StatusKind {
  const n = normCat(cat || '')
  const m = CAT_KIND.find((c) => n.startsWith(normCat(c.key)))
  return m ? m.kind : 'neutral'
}

// 관련부서 칩은 무채색(StatusChip status="neutral") — 구 deptKind는 부서명 **해시**로 색을 뽑았는데,
// 임의값이라 "청록 = 기획팀"을 학습할 수가 없어 색이 정보를 전혀 나르지 못했다(사용자 결정으로 제거).
// 업무카드에서 색을 갖는 축은 상태(카드 톤)와 구분칩 둘뿐이다.

/**
 * 업무 상태 — 시트 '상태' 열 기준(진행중/완료/보류/취소). 빈값/기타는 '미정'.
 * Remind·검토 필요는 직교 플래그(상태와 겹칠 수 있음).
 */
export type WStatus = 'inProgress' | 'done' | 'hold' | 'cancelled' | 'etc'

// 색은 전역 배정표(tokens.statusMeaning) 준수: 진행중=그린·완료=파랑·보류=앰버·취소=레드
export const W_STATUS: Record<WStatus, { label: string; status: StatusKind }> = {
  inProgress: { label: '진행중', status: 'success' },
  done: { label: '완료', status: 'info' },
  hold: { label: '보류', status: 'warning' },
  cancelled: { label: '취소', status: 'error' },
  etc: { label: '미정', status: 'neutral' },
}

/** 상태 필터에 노출할 정식 상태 (미정 제외) */
export const W_STATUS_TABS: WStatus[] = ['inProgress', 'done', 'hold', 'cancelled']

export function classify(t: WorkItem): WStatus {
  const s = (t.status || '').trim()
  if (s === '진행중') return 'inProgress'
  if (s === '완료') return 'done'
  if (s === '보류') return 'hold'
  if (s === '취소') return 'cancelled'
  return 'etc'
}

/** 등록/수정 폼의 상태 선택지 */
export const WORK_STATUS_OPTIONS = ['진행중', '완료', '보류', '취소']

/** 업무구분 드롭다운 — 시트 '구분' 열 드롭다운 기준(입력 불가, 선택만) */
export const WORK_CAT_OPTIONS = ['장비', '인사', '예산', '행정', '교육세미나', '설계적정성']

/** 담당자 기본 자동완성 보기 — 직접 입력도 가능(freeSolo) */
export const WORK_MGR_OPTIONS = ['센터', '신현진', '박주봉', '박세리', '조성범']

// 업무 내용 글머리기호: 줄 시작 'dash + 공백' ↔ 'bullet + 공백' (시트엔 dash로 저장, 화면엔 bullet 표시)
const DASH_BULLET_RE = /(^|\n)([ \t]*)-(?=[ \t])/g
const BULLET_DASH_RE = /(^|\n)([ \t]*)•(?=[ \t])/g
/** 입력 중 '- ' → '• ' 실시간 변환 (길이 보존 → 커서 위치 유지) */
export function dashToBullet(text: string): string {
  return text.replace(DASH_BULLET_RE, '$1$2•')
}
/** 저장 시 '• ' → '- ' 되돌림 (시트는 dash 관례 유지) */
export function bulletToDash(text: string): string {
  return text.replace(BULLET_DASH_RE, '$1$2-')
}
/** 표시용 글머리 정규화 — dash 계열(- – — * ·)은 bullet(•)로, 그 외(번호·기호)는 그대로 */
export function displayBullet(mark: string): string {
  return /^[-–—*·]$/.test(mark) ? '•' : mark
}

/** 1~20 → 동그라미 숫자(①~⑳). 범위 밖이면 null */
export function circledNumber(n: number): string | null {
  return n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : null
}

/** 업무 내용 첫 줄 = 제목 */
export function taskTitle(t: WorkItem): string {
  return String(t.task || '').split(/\r?\n/)[0] || '(제목 없음)'
}

/** 제목 이후 줄들 + 시간/장소(있으면) — 상세 본문용 */
export function taskSubs(t: WorkItem): string[] {
  const subs = String(t.task || '')
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim())
  if (t.time || t.loc) {
    const parts: string[] = []
    if (t.time) parts.push('시간: ' + t.time)
    if (t.loc) parts.push('장소: ' + t.loc)
    subs.push('- ' + parts.join(' | '))
  }
  return subs
}

/** 관련 링크 URL(있으면) */
export function taskLink(t: WorkItem): string | null {
  const m = String(t.link || '').match(/https?:\/\/[^\s]+/)
  return m ? m[0] : null
}

// 담당자별 채움 칩 색 — 단일 출처 managerColor(tokens)에 위임(Work·Calendar 동일색 보장).
export { managerColor as mgrColor } from '@/theme/tokens'
