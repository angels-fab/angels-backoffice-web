import type { CalCat, CalEvent } from '@/types'

export const CAL_CATS: CalCat[] = [
  { id: 'all', label: '전체', cls: 'f-all', color: '#F0B429' },
  { id: 'meeting', label: '회의/미팅', cls: 'f-meeting', color: '#58A6FF' },
  { id: 'edu', label: '교육/세미나', cls: 'f-edu', color: '#3FB950' },
  { id: 'recruit', label: '채용', cls: 'f-recruit', color: '#BC8CFF' },
  { id: 'trip', label: '출장', cls: 'f-trip', color: '#F0B429' },
  { id: 'etc', label: '기타', cls: 'f-etc', color: '#39D0D8' },
]

export const CAL_CAT_MAP: Record<string, CalCat> = Object.fromEntries(
  CAL_CATS.map(c => [c.id, c]),
)

export const CAL_EVENTS: CalEvent[] = [
  { date: '2026-06-03', title: '[교육] GIST 반도체 세미나', cat: 'edu', time: '10:00', loc: 'GIST 오룡관' },
  { date: '2026-06-05', title: '[회의] FAB 장비 도입 주간 회의', cat: 'meeting', time: '14:00', loc: '본관 3층 대회의실' },
  { date: '2026-06-08', title: '[채용] 신입 연구원 채용 면접', cat: 'recruit', time: '10:00-17:00', loc: '인사팀 회의실' },
  { date: '2026-06-10', title: '[회의] 기술평가 위원회', cat: 'meeting', time: '14:00', loc: '본관 3층 대회의실' },
  { date: '2026-06-11', title: '[출장] 광주광역시 보조금 현장 실사', cat: 'trip', time: '09:00', loc: '광주광역시청' },
  { date: '2026-06-12', title: '[회의] 외자 통관 대응 회의', cat: 'meeting', time: '10:00', loc: '회의실 B-201' },
  { date: '2026-06-12', title: '[교육] FIB 장비 세미나', cat: 'edu', time: '14:00', loc: '세미나실' },
  { date: '2026-06-16', title: '[교육] 안전교육 1차', cat: 'edu', time: '10:00', loc: '교육장 1호' },
  { date: '2026-06-17', title: '[교육] 안전교육 2차', cat: 'edu', time: '14:00', loc: '교육장 1호' },
  { date: '2026-06-18', title: '[회의] 장비 도입 현황 보고', cat: 'meeting', time: '15:00', loc: '본관 2층 소회의실' },
  { date: '2026-06-19', title: '[출장] 서울 출장 (협력사 미팅)', cat: 'trip', time: '종일', loc: '서울' },
  { date: '2026-06-20', title: '[출장] 서울 출장 (협력사 미팅)', cat: 'trip', time: '종일', loc: '서울' },
  { date: '2026-06-23', title: '[회의] ANGELS 운영위원회', cat: 'meeting', time: '10:00', loc: '본관 대강당' },
  { date: '2026-06-24', title: '[채용] 연구원 경력직 채용 공고 마감', cat: 'recruit', time: '18:00', loc: '-' },
  { date: '2026-06-25', title: '[회의] 하반기 계획 수립 회의', cat: 'meeting', time: '13:00', loc: '본관 3층 대회의실' },
  { date: '2026-06-26', title: '[출장] 일본 출장 (장비 FAT)', cat: 'trip', time: '종일', loc: '일본 도쿄' },
  { date: '2026-06-27', title: '[출장] 일본 출장 (장비 FAT)', cat: 'trip', time: '종일', loc: '일본 도쿄' },
  { date: '2026-06-30', title: '[기타] 6월 결산 보고', cat: 'etc', time: '16:00', loc: '재무팀' },
  { date: '2026-07-02', title: '[회의] FAB 장비 도입 주간 회의', cat: 'meeting', time: '14:00', loc: '본관 3층 대회의실' },
  { date: '2026-07-07', title: '[교육] 반도체 공정 교육', cat: 'edu', time: '09:00-18:00', loc: 'GIST 교육센터' },
]
