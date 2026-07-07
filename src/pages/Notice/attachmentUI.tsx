import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import SlideshowOutlinedIcon from '@mui/icons-material/SlideshowOutlined'
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import TextSnippetOutlinedIcon from '@mui/icons-material/TextSnippetOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
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

/** MIME/확장자 기반 첨부 아이콘 — 확장자를 대표하는 아이콘으로 매핑(이모지 금지, MUI 아이콘) */
export function AttachmentIcon({ type, name, sx }: { type?: string; name?: string; sx?: SxProps<Theme> }) {
  const t = (type || '').toLowerCase()
  const i = (name || '').lastIndexOf('.')
  const ext = i > 0 ? (name || '').slice(i + 1).toLowerCase() : ''
  if (t.startsWith('image/') || IMG.includes(ext)) return <ImageOutlinedIcon sx={sx} />
  if (t === 'application/pdf' || PDF.includes(ext)) return <PictureAsPdfOutlinedIcon sx={sx} />
  if (t.includes('spreadsheet') || t === 'text/csv' || XLS.includes(ext)) return <TableChartOutlinedIcon sx={sx} />
  if (t.includes('presentation') || PPT.includes(ext)) return <SlideshowOutlinedIcon sx={sx} />
  if (t.includes('word') || DOC.includes(ext)) return <ArticleOutlinedIcon sx={sx} />
  if (HWP.includes(ext)) return <DescriptionOutlinedIcon sx={sx} />
  if (t.includes('zip') || t.includes('compressed') || ZIP.includes(ext)) return <FolderZipOutlinedIcon sx={sx} />
  if (t.startsWith('text/') || TXT.includes(ext)) return <TextSnippetOutlinedIcon sx={sx} />
  return <InsertDriveFileOutlinedIcon sx={sx} />
}
