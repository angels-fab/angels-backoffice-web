import type { CSSProperties } from 'react'
import pdfUrl from './filetypes/pdf.png'
import docxUrl from './filetypes/docx.png'
import xlsxUrl from './filetypes/xlsx.png'
import pptxUrl from './filetypes/pptx.png'
import hwpUrl from './filetypes/hwp.png'
import zipUrl from './filetypes/zip.png'

/**
 * 파일 유형 아이콘 — 사용자가 제공한 실제 파일 아이콘(캡처, 배경 투명 처리)을 내장 PNG로 표시.
 * 제공된 유형: pdf · doc/docx · xls/xlsx/csv · ppt/pptx · hwp/hwpx · zip류.
 * 미제공 유형(이미지·txt 등)은 아래 인라인 SVG로 대체(추후 아이콘 주면 매핑 추가).
 */

const PNG: Record<string, string> = {
  pdf: pdfUrl,
  doc: docxUrl, docx: docxUrl, rtf: docxUrl, odt: docxUrl,
  xls: xlsxUrl, xlsx: xlsxUrl, csv: xlsxUrl,
  ppt: pptxUrl, pptx: pptxUrl,
  hwp: hwpUrl, hwpx: hwpUrl,
  zip: zipUrl, '7z': zipUrl, rar: zipUrl, tar: zipUrl, gz: zipUrl,
}
const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff']

/** MIME → PNG(확장자 없거나 애매할 때 보강) */
function pngByMime(t: string): string {
  if (t === 'application/pdf') return pdfUrl
  if (t.includes('word')) return docxUrl
  if (t.includes('spreadsheet') || t === 'text/csv') return xlsxUrl
  if (t.includes('presentation')) return pptxUrl
  if (t.includes('zip') || t.includes('compressed')) return zipUrl
  return ''
}

export function FileTypeIcon({ type, name, size = 18 }: { type?: string; name?: string; size?: number }) {
  const t = (type || '').toLowerCase()
  const i = (name || '').lastIndexOf('.')
  const ext = i > 0 ? (name || '').slice(i + 1).toLowerCase() : ''

  const png = PNG[ext] || pngByMime(t)
  if (png) {
    const box: CSSProperties = { width: size, height: size, flex: 'none', display: 'inline-block', objectFit: 'contain', verticalAlign: 'middle' }
    return <img src={png} alt="" style={box} />
  }

  const svgP = { width: size, height: size, viewBox: '0 0 32 32', style: { flex: 'none', display: 'block' } as CSSProperties, 'aria-hidden': true as const }
  if (t.startsWith('image/') || IMG_EXT.includes(ext)) {
    return (
      <svg {...svgP}>
        <path fill="#2dcc9f" d="M30 5.851v20.298H2V5.851z" />
        <path fill="#fff" d="M24.232 8.541a2.2 2.2 0 1 0 1.127.623a2.2 2.2 0 0 0-1.127-.623M18.111 20.1q-2.724-3.788-5.45-7.575L4.579 23.766h10.9q1.316-1.832 2.634-3.663M22.057 16q-2.793 3.882-5.584 7.765h11.169Q24.851 19.882 22.057 16" />
      </svg>
    )
  }
  // 기본(txt 등 미지원) — 중립 파일 아이콘
  return (
    <svg {...svgP}>
      <path fill="#eceff1" stroke="#b0bec5" strokeWidth="1" d="M8 3h11l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path fill="#cfd8dc" d="M19 3l7 7h-7z" />
      <path fill="#b0bec5" d="M10 16h12v1.6H10zm0 3.4h12V21H10zm0 3.4h8v1.6h-8z" />
    </svg>
  )
}
