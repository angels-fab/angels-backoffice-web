import { useMemo } from 'react'
import WavingHandIcon from '@mui/icons-material/WavingHand'
import { accent, iconSize } from '@/theme/tokens'
import { useRole } from '@/auth/role'
import { todaySeoul } from '@/utils/date'
import greetIllust from '@/assets/greet-illust.png'

const GREET_SETS = [
  ['고요한 새벽입니다', '별 깊은 새벽이에요', '잔잔한 새벽입니다'], // 0~5시
  ['햇살 좋은 아침입니다', '산뜻한 아침이에요', '눈부신 아침입니다'], // 6~11시
  ['나른한 오후입니다', '볕 좋은 오후예요', '평온한 오후입니다'], // 12~17시
  ['포근한 저녁입니다', '노을 지는 저녁이에요', '잔잔한 저녁입니다'], // 18~23시
]

export default function Greeting() {
  const { loggedIn, user } = useRole()
  // 로그인 주체별 인사말 — 로그인 사용자(일반·관리자)는 이름, 게스트는 팀 인사말
  const sub = loggedIn && user ? `${user}님, 안녕하세요` : '안녕하세요, FAB 구축팀입니다'
  const { main, date } = useMemo(() => {
    const now = new Date()
    let h = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }).format(now),
      10,
    )
    if (isNaN(h)) h = 12
    const garr = GREET_SETS[h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3]
    const wd = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'long' }).format(now)
    return {
      main: garr[Math.floor(Math.random() * garr.length)],
      date: todaySeoul().replace(/-/g, '.') + ' ' + wd,
    }
  }, [])

  return (
    <div className="home-greeting">
      <div className="greet-text">
        <div className="greet-sub">
          {sub}{' '}
          <WavingHandIcon htmlColor={accent.amber} sx={{ fontSize: iconSize.body, verticalAlign: 'text-bottom' }} />
        </div>
        <div className="greet-main">{main}</div>
        <div className="greet-date">{date}</div>
      </div>
      <img className="greet-illust" src={greetIllust} alt="" />
    </div>
  )
}
