import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import type { SxProps, Theme } from '@mui/material/styles'

/** 바이트 → 읽기 쉬운 크기(KB·MB). 1KB 미만은 B 표기 */
export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** MIME/확장자 기반 첨부 아이콘 — 이모지 금지, MUI 아이콘 매핑 */
export function AttachmentIcon({ type, name, sx }: { type?: string; name?: string; sx?: SxProps<Theme> }) {
  const t = (type || '').toLowerCase()
  const ext = (name || '').toLowerCase().slice((name || '').lastIndexOf('.'))
  if (t.startsWith('image/')) return <ImageOutlinedIcon sx={sx} />
  if (t === 'application/pdf' || ext === '.pdf') return <PictureAsPdfOutlinedIcon sx={sx} />
  if (t.includes('spreadsheet') || t === 'text/csv' || ['.xls', '.xlsx', '.csv'].includes(ext)) return <TableChartOutlinedIcon sx={sx} />
  if (t.includes('zip') || t.includes('compressed') || ['.zip', '.7z', '.rar'].includes(ext)) return <FolderZipOutlinedIcon sx={sx} />
  if (t.includes('word') || t.startsWith('text/') || ['.doc', '.docx', '.hwp', '.hwpx', '.txt', '.ppt', '.pptx'].includes(ext)) return <DescriptionOutlinedIcon sx={sx} />
  return <InsertDriveFileOutlinedIcon sx={sx} />
}
