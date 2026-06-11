import SchoolIcon from '@mui/icons-material/School'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PublicIcon from '@mui/icons-material/Public'
import MemoryIcon from '@mui/icons-material/Memory'
import FactoryIcon from '@mui/icons-material/Factory'
import BoltIcon from '@mui/icons-material/Bolt'
import TableChartIcon from '@mui/icons-material/TableChart'
import type { QuickLink } from '@/types'

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1lnS34m1cQ2mY6W6cBi7kOjDNtNaXtDSg3VRqgFWmUjU/edit?gid=1931372051#gid=1931372051'

export const QUICK_LINKS: QuickLink[] = [
  { icon: <SchoolIcon fontSize="inherit" htmlColor="#58a6ff" />, name: 'GIST', host: 'gist.ac.kr', url: 'https://www.gist.ac.kr/kr/main.html', bg: 'rgba(88,166,255,.15)' },
  { icon: <AutoAwesomeIcon fontSize="inherit" htmlColor="#bc8cff" />, name: 'ANGELS', host: 'angels.gist.ac.kr', url: 'https://angels.gist.ac.kr/angels/', bg: 'rgba(188,140,255,.15)' },
  { icon: <PublicIcon fontSize="inherit" htmlColor="#3fb950" />, name: 'GAIA', host: 'gaia.gist.ac.kr', url: 'https://gaia.gist.ac.kr/', bg: 'rgba(63,185,80,.15)' },
  { icon: <MemoryIcon fontSize="inherit" htmlColor="#f0b429" />, name: '반도체공학과', host: 'semi.gist.ac.kr', url: 'https://semi.gist.ac.kr/semi/', bg: 'rgba(240,180,41,.15)' },
  { icon: <FactoryIcon fontSize="inherit" htmlColor="#39d0d8" />, name: '모아팹', host: 'moafab.kr', url: 'https://www.moafab.kr/css', bg: 'rgba(57,208,216,.15)' },
  { icon: <BoltIcon fontSize="inherit" htmlColor="#f85149" />, name: 'RED', host: 'zeus.go.kr', url: 'https://www.zeus.go.kr/red/home', bg: 'rgba(248,81,73,.15)' },
  { icon: <TableChartIcon fontSize="inherit" htmlColor="#3fb950" />, name: '팹센터 구축총괄시트', host: 'docs.google.com', url: SHEET_URL, bg: 'rgba(63,185,80,.15)' },
]
