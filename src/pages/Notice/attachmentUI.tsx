import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined'
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import type { SvgIconComponent } from '@mui/icons-material'
import type { SxProps, Theme } from '@mui/material/styles'

/** 바이트 → 읽기 쉬운 크기(KB·MB). 1KB 미만은 B 표기 */
export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** 파일명 → 대문자 확장자 라벨(예: 'PDF', 'XLSX'). 없으면 빈 문자열 */
export function fileExtLabel(name: string): string {
  const i = (name || '').lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase() : ''
}

const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff']
const PDF = ['pdf']
const XLS = ['xls', 'xlsx', 'csv', 'numbers']
const PPT = ['ppt', 'pptx', 'key']
const DOC = ['doc', 'docx', 'rtf', 'odt']
const HWP = ['hwp', 'hwpx']
const ZIP = ['zip', '7z', 'rar', 'tar', 'gz']
const TXT = ['txt', 'md', 'log', 'json', 'xml']

type IconTone = { Icon: SvgIconComponent; tone: (th: Theme) => string }

/** MIME/확장자 → 대표 아이콘 + 유형별 색상. 이모지 금지, 유형이 한눈에 구분되도록 색까지 매핑 */
function iconTone(type?: string, name?: string): IconTone {
  const t = (type || '').toLowerCase()
  const i = (name || '').lastIndexOf('.')
  const ext = i > 0 ? (name || '').slice(i + 1).toLowerCase() : ''
  if (t.startsWith('image/') || IMG.includes(ext)) return { Icon: ImageOutlinedIcon, tone: (th) => th.palette.accent.blue }
  if (t === 'application/pdf' || PDF.includes(ext)) return { Icon: PictureAsPdfOutlinedIcon, tone: (th) => th.palette.accent.red }
  if (t.includes('spreadsheet') || t === 'text/csv' || XLS.includes(ext)) return { Icon: TableChartOutlinedIcon, tone: (th) => th.palette.accent.green }
  if (t.includes('presentation') || PPT.includes(ext)) return { Icon: SlideshowOutlinedIcon, tone: (th) => th.palette.accent.amber }
  if (t.includes('word') || DOC.includes(ext)) return { Icon: ArticleOutlinedIcon, tone: (th) => th.palette.accent.blue }
  if (HWP.includes(ext)) return { Icon: DescriptionOutlinedIcon, tone: (th) => th.palette.accent.teal }
  if (t.includes('zip') || t.includes('compressed') || ZIP.includes(ext)) return { Icon: FolderZipOutlinedIcon, tone: (th) => th.palette.accent.amber }
  if (t.startsWith('text/') || TXT.includes(ext)) return { Icon: TextSnippetOutlinedIcon, tone: (th) => th.palette.accent.purple }
  return { Icon: InsertDriveFileOutlinedIcon, tone: (th) => th.palette.text.secondary }
}

/**
 * 첨부 아이콘 — 유형별 모양+색상을 기본 적용. sx로 크기(fontSize) 등만 넘기면 색은 유형색이 유지된다.
 * (색을 강제하려면 sx에 color를 주면 됨 — 뒤에 오므로 우선.)
 */
export function AttachmentIcon({ type, name, sx }: { type?: string; name?: string; sx?: SxProps<Theme> }) {
  const { Icon, tone } = iconTone(type, name)
  const extra = Array.isArray(sx) ? sx : [sx]
  return <Icon sx={[(th) => ({ color: tone(th) }), ...extra] as SxProps<Theme>} />
}
