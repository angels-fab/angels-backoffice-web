import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { isWorkNew, isImproveNew } from '@/utils/newPost'
import { putSetting } from '@/store/slices/userSettingsSlice'

/**
 * 네비게이션 배지 = "내가 안 본 새 글" 수 (사이드바·하단 탭바 공용, 개인화 Stage 2).
 * - 새 글 모집단은 utils/newPost 공용 함수(7일 규칙) — 페이지 내부 '새 글 N'과 같은 기준.
 * - 여기서 개인 seen 목록(user_settings `seen.*` = 내가 마지막 확인한 시점의 새 글 num들)을
 *   빼서 '안 본 것'만 센다. seen 미저장(비로그인·첫 사용)은 기존 7일 전체 카운트 폴백.
 * - 읽음 처리는 각 페이지가 useMarkSeen으로 수행(진입 시 현재 새 글 num 전부 저장).
 * ※ 게시일이 일 단위(YYYY-MM-DD)뿐이라 시각 비교로는 같은 날 뒤에 올라온 글을 놓침 →
 *   num 집합 저장 방식 채택(7일 만료로 목록도 자동 정리). 공지 id는 idx 기반이라 num이 안정키.
 * ※ 업무일정(calendar)은 새 글 개념을 쓰지 않으므로 배지 없음.
 */

type SeenMenu = 'notice' | 'work' | 'improve'
const seenKey = (m: SeenMenu) => `seen.${m}`

/** seen 목록에 없는 새 글 수. seen이 배열이 아니면(미저장) 전체 폴백. */
function unseenCount(newNums: string[], seen: unknown): number {
  if (!Array.isArray(seen)) return newNums.length
  const set = new Set(seen.map(String))
  return newNums.filter((n) => !set.has(n)).length
}

export function useNavBadges() {
  const workReady = useAppSelector(s => s.work.ready)
  const workItems = useAppSelector(s => s.work.items)
  const noticeItems = useAppSelector(s => s.notice.items)
  const improveItems = useAppSelector(s => s.improve.items)
  const settings = useAppSelector(s => s.userSettings.settings)

  const noticeNums = noticeItems.filter(n => n.isNew).map(n => String(n.num))
  const workNums = workReady ? workItems.filter(isWorkNew).map(t => String(t.num)) : []
  const improveNums = improveItems.filter(isImproveNew).map(i => String(i.num))

  return {
    notice: unseenCount(noticeNums, settings[seenKey('notice')]),
    work: unseenCount(workNums, settings[seenKey('work')]),
    improve: unseenCount(improveNums, settings[seenKey('improve')]),
  }
}

/**
 * 페이지 진입 시 읽음 처리 — 현재 '새 글' num 전체를 seen으로 교체 저장(만료분 자동 정리).
 * 페이지가 열려 있는 동안 새 글이 유입돼도 계속 읽음 처리(목록을 보고 있는 중이므로).
 * 저장 게이트: 데이터 ready + 설정 로드 '성공'(loadedOk) + 로그인 — 로드 실패/이전 자동 저장이
 * 서버 설정을 빈 값으로 덮어쓰는 사고 방지. 값이 같으면 저장 생략.
 */
export function useMarkSeen(menu: SeenMenu, newNums: string[], ready: boolean) {
  const dispatch = useAppDispatch()
  const loadedOk = useAppSelector(s => s.userSettings.loadedOk)
  const userName = useAppSelector(s => s.userSettings.userName)
  const cur = useAppSelector(s => s.userSettings.settings[seenKey(menu)])
  const numsSig = [...newNums].sort().join('|')
  useEffect(() => {
    if (!ready || !loadedOk || !userName) return
    if (!Array.isArray(cur) && newNums.length === 0) return // 저장할 것도, 정리할 것도 없음
    const curSig = Array.isArray(cur) ? cur.map(String).sort().join('|') : null
    if (curSig === numsSig) return
    dispatch(putSetting({ key: seenKey(menu), value: numsSig ? numsSig.split('|') : [] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, loadedOk, userName, numsSig, menu, dispatch])
}
