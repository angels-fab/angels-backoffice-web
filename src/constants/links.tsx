import gistLogo from '@/assets/links/gist.png'
import angelsLogo from '@/assets/favicon.png'
import gaiaLogo from '@/assets/links/gaia.png'
import semiLogo from '@/assets/links/semi.png'
import eecsLogo from '@/assets/links/eecs.png'
import snuLogo from '@/assets/links/snu.jpg'
import unistLogo from '@/assets/links/unist.png'
import dgistLogo from '@/assets/links/dgist.png'
import moafabLogo from '@/assets/links/moafab.png'
import { solid } from '@/theme/tokens'
import type { QuickLink } from '@/types'

export interface QuickLinkGroup {
  title: string
  links: QuickLink[]
}

export const QUICK_LINK_GROUPS: QuickLinkGroup[] = [
  {
    title: '교내 GIST',
    links: [
      { logo: gistLogo, name: 'GIST', host: 'gist.ac.kr', url: 'https://www.gist.ac.kr/kr/main.html' },
      { logo: angelsLogo, name: 'ANGELS', host: 'angels.gist.ac.kr', url: 'https://angels.gist.ac.kr/angels/' },
      { logo: gaiaLogo, name: 'GAIA', host: 'gaia.gist.ac.kr', url: 'https://gaia.gist.ac.kr/' },
      { logo: semiLogo, wide: true, name: '반도체공학과', host: 'semi.gist.ac.kr', url: 'https://semi.gist.ac.kr/semi/' },
      { logo: eecsLogo, name: '전기전자컴퓨터공학부', host: 'eecs.gist.ac.kr', url: 'https://eecs.gist.ac.kr/' },
    ],
  },
  {
    title: '외부 기관',
    links: [
      { logo: snuLogo, name: '서울대 반도체공동연구소', host: 'isrc.snu.ac.kr', url: 'https://isrc.snu.ac.kr/' },
      { logo: unistLogo, wide: true, name: 'UNIST UCRF', host: 'ucrf.unist.ac.kr', url: 'https://ucrf.unist.ac.kr/' },
      { logo: dgistLogo, name: 'DGIST 차세대센서반도체연구소', host: 'dhub.dgist.ac.kr', url: 'https://dhub.dgist.ac.kr/center/main?id=ccrf' },
      { logo: moafabLogo, name: '모아팹', host: 'moafab.kr', url: 'https://www.moafab.kr/css' },
      // 로고 대신 글자를 넣는 타일 — 타일이 두 테마 모두 흰색(Links/index.tsx)이라 테마 공통 solid 를 쓴다.
      // 구 accent.red 는 채움용이라 흰 배경 위 글자로는 3.62:1 로 미달이었다(2026-08-02 대비 감사).
      { fallbackText: 'RED', fallbackColor: solid.red, name: 'RED', host: 'zeus.go.kr', url: 'https://www.zeus.go.kr/red/home' },
    ],
  },
]
