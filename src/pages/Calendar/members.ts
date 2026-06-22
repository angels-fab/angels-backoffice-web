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
}

export const MEMBERS: TeamMember[] = [
  { id: '센터', name: '센터', role: '공통', color: accent.teal },
  { id: '신현진', name: '신현진', color: accent.blue },
  { id: '박주봉', name: '박주봉', color: accent.purple },
  { id: '박세리', name: '박세리', color: accent.amber },
  { id: '조성범', name: '조성범', color: accent.green },
]

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
 * 칩/요약 표시용 제목 정리 — 팀원 이름·구분기호(@,-,/,·,쉼표) 제거.
 * (담당 팀원은 별도 라벨/행으로 표시하므로 칩 본문에서 중복 제거)
 * 원본 제목이 통째로 이름뿐이면 원본을 그대로 둔다.
 */
export function cleanTitle(title: string): string {
  let t = title || ''
  for (const n of MEMBER_NAMES) {
    t = t.replace(new RegExp('[@/\\-·,]?\\s*' + n, 'g'), ' ')
  }
  t = t
    .replace(/[@/]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-·,]+|[\s\-·,]+$/g, '')
    .trim()
  return t || (title || '').trim()
}
