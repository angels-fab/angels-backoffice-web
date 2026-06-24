import SchoolIcon from '@mui/icons-material/School'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PublicIcon from '@mui/icons-material/Public'
import MemoryIcon from '@mui/icons-material/Memory'
import FactoryIcon from '@mui/icons-material/Factory'
import BoltIcon from '@mui/icons-material/Bolt'
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard'
import ScienceIcon from '@mui/icons-material/Science'
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing'
import SensorsIcon from '@mui/icons-material/Sensors'
import type { QuickLink } from '@/types'

export const QUICK_LINKS: QuickLink[] = [
  { icon: <SchoolIcon fontSize="inherit" htmlColor="#58a6ff" />, name: 'GIST', host: 'gist.ac.kr', url: 'https://www.gist.ac.kr/kr/main.html', bg: 'rgba(88,166,255,.15)' },
  { icon: <AutoAwesomeIcon fontSize="inherit" htmlColor="#bc8cff" />, name: 'ANGELS', host: 'angels.gist.ac.kr', url: 'https://angels.gist.ac.kr/angels/', bg: 'rgba(188,140,255,.15)' },
  { icon: <PublicIcon fontSize="inherit" htmlColor="#3fb950" />, name: 'GAIA', host: 'gaia.gist.ac.kr', url: 'https://gaia.gist.ac.kr/', bg: 'rgba(63,185,80,.15)' },
  { icon: <MemoryIcon fontSize="inherit" htmlColor="#f0b429" />, name: '반도체공학과', host: 'semi.gist.ac.kr', url: 'https://semi.gist.ac.kr/semi/', bg: 'rgba(240,180,41,.15)' },
  { icon: <DeveloperBoardIcon fontSize="inherit" htmlColor="#4dabf7" />, name: '전기전자컴퓨터공학부', host: 'eecs.gist.ac.kr', url: 'https://eecs.gist.ac.kr/', bg: 'rgba(77,171,247,.15)' },
  { icon: <ScienceIcon fontSize="inherit" htmlColor="#5c7cfa" />, name: '서울대 반도체공동연구소', host: 'isrc.snu.ac.kr', url: 'https://isrc.snu.ac.kr/', bg: 'rgba(92,124,250,.15)' },
  { icon: <PrecisionManufacturingIcon fontSize="inherit" htmlColor="#ff922b" />, name: 'UNIST UCRF', host: 'ucrf.unist.ac.kr', url: 'https://ucrf.unist.ac.kr/', bg: 'rgba(255,146,43,.15)' },
  { icon: <SensorsIcon fontSize="inherit" htmlColor="#f06595" />, name: 'DGIST 차세대센서반도체연구소', host: 'dhub.dgist.ac.kr', url: 'https://dhub.dgist.ac.kr/center/main?id=ccrf', bg: 'rgba(240,101,149,.15)' },
  { icon: <FactoryIcon fontSize="inherit" htmlColor="#39d0d8" />, name: '모아팹', host: 'moafab.kr', url: 'https://www.moafab.kr/css', bg: 'rgba(57,208,216,.15)' },
  { icon: <BoltIcon fontSize="inherit" htmlColor="#f85149" />, name: 'RED', host: 'zeus.go.kr', url: 'https://www.zeus.go.kr/red/home', bg: 'rgba(248,81,73,.15)' },
]
