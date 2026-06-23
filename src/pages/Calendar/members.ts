import { accent } from '@/theme/tokens'

/**
 * 팀원(담당자) — 캘린더 데이터에는 사람 필드가 없어 일정 제목에서 추출한다.
 * 추출 규칙(사용자 정의):
 *  - 제목에 아래 팀원 이름이 들어 있으면 그 팀원의 일정.
 *  - 여러 명이 들어 있으면 그 팀원 모두에게 표시.
 *  - 아무 이름도 없으면 '센터' 레인에 모은다(공통/미지정).
 */
export interface TeamMember {
  id: string
  name: string
  role?: string
  /** 아바타·칩 색 */
  color: string
  /** 사진 아바타(있으면 글자 동그라미 대신 사진 사용) */
  photo?: string
}

export const MEMBERS: TeamMember[] = [
  { id: '센터', name: '센터', role: '공통', color: accent.teal },
  { id: '신현진', name: '신현진', color: accent.blue },
  { id: '박주봉', name: '박주봉', color: accent.purple },
  { id: '박세리', name: '박세리', color: accent.amber },
  { id: '조성범', name: '조성범', color: accent.green },
]

/**
 * 일정 칩 헤더에 표시할 멤버 사진 URL — 담당자 중 사진(photo) 보유 멤버가 있으면 그 사진.
 * (지금은 사진 보유자(조성범)에게 일정이 없어 칩에는 아바타가 안 뜸.
 *  나중에 박주봉 등 MEMBERS에 photo만 넣으면 그 사람 일정 칩에 자동 표시.)
 */
export function eventAvatar(memberIds: string[]): string | undefined {
  for (const id of memberIds) {
    const p = memberById(id).photo
    if (p) return p
  }
  return undefined
}

export const MEMBER_NAMES: string[] = MEMBERS.map((m) => m.name)
/** '센터'를 제외한 실제 이름들(센터는 fallback 전용) */
const NAMED: string[] = MEMBERS.filter((m) => m.id !== '센터').map((m) => m.name)

const byId = new Map(MEMBERS.map((m) => [m.id, m]))

export function memberById(id: string): TeamMember {
  return byId.get(id) || { id, name: id, color: '#888' }
}

/**
 * 일정 제목 → 해당 팀원 id 목록.
 * 제목 안의 알려진 이름(센터 제외) 모두 수집. '센터'가 명시돼 있으면 포함.
 * 하나도 없으면 ['센터'].
 */
export function membersForEvent(title: string): string[] {
  const t = title || ''
  const found = NAMED.filter((n) => t.includes(n))
  if (t.includes('센터')) found.push('센터')
  return found.length ? found : ['센터']
}

/** 아바타 이니셜 — 3자 이상이면 성 제외(신현진→현진), 2자는 그대로(센터). */
export function given(name: string): string {
  return name.length > 2 ? name.slice(1) : name
}

/**
 * 일정 내용(제목) — 앞 [업무구분] 제거 + '@참석자' 이후 제거.
 * 출장은 국내/국외(아이콘으로 표시)를 떼고 (출장지)의 괄호를 벗겨 표기.
 *  예) "[회의] 주간 업무 협의 @신현진" → "주간 업무 협의"
 *      "[출장] 국외(하와이)-MRS 2026 학회@신현진" → "하와이-MRS 2026 학회"
 */
export function eventContent(title: string, cat: string): string {
  let t = (title || '').replace(/^\s*\[[^\]]*\]\s*/, '') // [구분] 제거
  const at = t.indexOf('@')
  if (at >= 0) t = t.slice(0, at) // @참석자 이후 제거
  t = t.trim()
  if (cat === 'trip_dom' || cat === 'trip_intl') {
    t = t.replace(/^\s*(국내|국외|해외)\s*/, '') // 국내/국외는 아이콘으로 표시
    t = t.replace(/\(([^)]*)\)/g, '$1').trim() // (출장지) 괄호 벗김
  }
  return t || (title || '').trim()
}

/** 참석자 목록 — 제목의 '@' 뒤 쉼표 구분(예 "@신현진, 박주봉" → ['신현진','박주봉']). */
export function eventParticipants(title: string): string[] {
  const at = (title || '').indexOf('@')
  if (at < 0) return []
  return title
    .slice(at + 1)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
