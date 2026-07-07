import type { CSSProperties } from 'react'
import pdfUrl from './filetypes/pdf.png'
import hwpUrl from './filetypes/hwp.png'
import zipUrl from './filetypes/zip.png'
import txtUrl from './filetypes/txt.png'
import imageUrl from './filetypes/image.png'

/**
 * 파일 유형 아이콘.
 * - pdf · hwp/hwpx · zip류 · txt류 · 이미지 = 사용자 제공 실제 아이콘(캡처, 배경 투명 처리) PNG.
 * - doc/docx · xls/xlsx/csv · ppt/pptx = vscode-icons(MIT) 실제 아트워크 인라인 SVG.
 * - 그 외 = 중립 파일 아이콘.
 * 새 유형 아이콘을 받으면 filetypes/에 PNG 추가 + 아래 매핑만 확장하면 됨.
 */

const DOC = ['doc', 'docx', 'rtf', 'odt']
const XLS = ['xls', 'xlsx', 'csv', 'numbers']
const PPT = ['ppt', 'pptx', 'key']
const IMG_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'tif', 'tiff']

// 확장자 → 내장 PNG
const PNG: Record<string, string> = {
  pdf: pdfUrl,
  hwp: hwpUrl, hwpx: hwpUrl,
  zip: zipUrl, '7z': zipUrl, rar: zipUrl, tar: zipUrl, gz: zipUrl,
  txt: txtUrl, log: txtUrl, md: txtUrl,
}

/** 유형별 정렬 우선순위(작을수록 먼저): pdf < hwp < docx < xlsx < pptx < txt < image < zip < 기타 */
export function fileTypeRank(type?: string, name?: string): number {
  const t = (type || '').toLowerCase()
  const i = (name || '').lastIndexOf('.')
  const ext = i > 0 ? (name || '').slice(i + 1).toLowerCase() : ''
  if (ext === 'pdf' || t === 'application/pdf') return 0
  if (ext === 'hwp' || ext === 'hwpx') return 1
  if (DOC.includes(ext) || t.includes('word')) return 2
  if (XLS.includes(ext) || t.includes('spreadsheet') || t === 'text/csv') return 3
  if (PPT.includes(ext) || t.includes('presentation')) return 4
  if (['txt', 'log', 'md'].includes(ext) || (t.startsWith('text/') && t !== 'text/csv')) return 5
  if (IMG_EXT.includes(ext) || t.startsWith('image/')) return 6
  if (['zip', '7z', 'rar', 'tar', 'gz'].includes(ext) || t.includes('zip') || t.includes('compressed')) return 7
  return 8
}

export function FileTypeIcon({ type, name, size = 18 }: { type?: string; name?: string; size?: number }) {
  const t = (type || '').toLowerCase()
  const i = (name || '').lastIndexOf('.')
  const ext = i > 0 ? (name || '').slice(i + 1).toLowerCase() : ''
  const imgStyle: CSSProperties = { width: size, height: size, flex: 'none', display: 'inline-block', objectFit: 'contain', verticalAlign: 'middle' }
  const svgP = { width: size, height: size, viewBox: '0 0 32 32', style: { flex: 'none', display: 'block' } as CSSProperties, 'aria-hidden': true as const }

  // 이미지 파일
  if (t.startsWith('image/') || IMG_EXT.includes(ext)) return <img src={imageUrl} alt="" style={imgStyle} />

  // PNG(확장자/MIME)
  const png = PNG[ext]
    || (t === 'application/pdf' ? pdfUrl : t.includes('zip') || t.includes('compressed') ? zipUrl : t.startsWith('text/') && t !== 'text/csv' ? txtUrl : '')
  if (png) return <img src={png} alt="" style={imgStyle} />

  // Office = vscode-icons(MIT) 인라인 SVG
  if (t.includes('word') || DOC.includes(ext)) {
    return (
      <svg {...svgP}>
        <defs><linearGradient id="ft-word" x1="4.494" x2="13.832" y1="-1712.086" y2="-1695.914" gradientTransform="translate(0 1720)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#2368c4" /><stop offset=".5" stopColor="#1a5dbe" /><stop offset="1" stopColor="#1146ac" /></linearGradient></defs>
        <path fill="#41a5ee" d="M28.806 3H9.705a1.19 1.19 0 0 0-1.193 1.191V9.5l11.069 3.25L30 9.5V4.191A1.19 1.19 0 0 0 28.806 3" />
        <path fill="#2b7cd3" d="M30 9.5H8.512V16l11.069 1.95L30 16Z" />
        <path fill="#185abd" d="M8.512 16v6.5l10.418 1.3L30 22.5V16Z" />
        <path fill="#103f91" d="M9.705 29h19.1A1.19 1.19 0 0 0 30 27.809V22.5H8.512v5.309A1.19 1.19 0 0 0 9.705 29" />
        <path d="M16.434 8.2H8.512v16.25h7.922a1.2 1.2 0 0 0 1.194-1.191V9.391A1.2 1.2 0 0 0 16.434 8.2" opacity=".1" />
        <path d="M15.783 8.85H8.512V25.1h7.271a1.2 1.2 0 0 0 1.194-1.191V10.041a1.2 1.2 0 0 0-1.194-1.191" opacity=".2" />
        <path fill="url(#ft-word)" d="M3.194 8.85h11.938a1.193 1.193 0 0 1 1.194 1.191v11.918a1.193 1.193 0 0 1-1.194 1.191H3.194A1.19 1.19 0 0 1 2 21.959V10.041A1.19 1.19 0 0 1 3.194 8.85" />
        <path fill="#fff" d="M6.9 17.988q.035.276.046.481h.028q.015-.195.065-.47c.05-.275.062-.338.089-.465l1.255-5.407h1.624l1.3 5.326a8 8 0 0 1 .162 1h.022a8 8 0 0 1 .135-.975l1.039-5.358h1.477l-1.824 7.748h-1.727l-1.237-5.126q-.054-.222-.122-.578t-.084-.52h-.021q-.021.189-.084.561t-.1.552L7.78 19.871H6.024L4.19 12.127h1.5l1.131 5.418a5 5 0 0 1 .079.443" />
      </svg>
    )
  }
  if (t.includes('spreadsheet') || t === 'text/csv' || XLS.includes(ext)) {
    return (
      <svg {...svgP}>
        <defs><linearGradient id="ft-excel" x1="4.494" x2="13.832" y1="-2092.086" y2="-2075.914" gradientTransform="translate(0 2100)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#18884f" /><stop offset=".5" stopColor="#117e43" /><stop offset="1" stopColor="#0b6631" /></linearGradient></defs>
        <path fill="#185c37" d="M19.581 15.35L8.512 13.4v14.409A1.19 1.19 0 0 0 9.705 29h19.1A1.19 1.19 0 0 0 30 27.809V22.5Z" />
        <path fill="#21a366" d="M19.581 3H9.705a1.19 1.19 0 0 0-1.193 1.191V9.5L19.581 16l5.861 1.95L30 16V9.5Z" />
        <path fill="#107c41" d="M8.512 9.5h11.069V16H8.512Z" />
        <path d="M16.434 8.2H8.512v16.25h7.922a1.2 1.2 0 0 0 1.194-1.191V9.391A1.2 1.2 0 0 0 16.434 8.2" opacity=".1" />
        <path d="M15.783 8.85H8.512V25.1h7.271a1.2 1.2 0 0 0 1.194-1.191V10.041a1.2 1.2 0 0 0-1.194-1.191" opacity=".2" />
        <path fill="url(#ft-excel)" d="M3.194 8.85h11.938a1.193 1.193 0 0 1 1.194 1.191v11.918a1.193 1.193 0 0 1-1.194 1.191H3.194A1.19 1.19 0 0 1 2 21.959V10.041A1.19 1.19 0 0 1 3.194 8.85" />
        <path fill="#fff" d="m5.7 19.873l2.511-3.884l-2.3-3.862h1.847L9.013 14.6c.116.234.2.408.238.524h.017q.123-.281.26-.546l1.342-2.447h1.7l-2.359 3.84l2.419 3.905h-1.809l-1.45-2.711A2.4 2.4 0 0 1 9.2 16.8h-.024a1.7 1.7 0 0 1-.168.351l-1.493 2.722Z" />
        <path fill="#33c481" d="M28.806 3h-9.225v6.5H30V4.191A1.19 1.19 0 0 0 28.806 3" />
        <path fill="#107c41" d="M19.581 16H30v6.5H19.581Z" />
      </svg>
    )
  }
  if (t.includes('presentation') || PPT.includes(ext)) {
    return (
      <svg {...svgP}>
        <defs><linearGradient id="ft-ppt" x1="4.494" x2="13.832" y1="-1748.086" y2="-1731.914" gradientTransform="translate(0 1756)" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ca4c28" /><stop offset=".5" stopColor="#c5401e" /><stop offset="1" stopColor="#b62f14" /></linearGradient></defs>
        <path fill="#ed6c47" d="M18.93 17.3L16.977 3h-.146A12.9 12.9 0 0 0 3.953 15.854V16Z" />
        <path fill="#ff8f6b" d="M17.123 3h-.146v13l6.511 2.6L30 16v-.146A12.9 12.9 0 0 0 17.123 3" />
        <path fill="#d35230" d="M30 16v.143A12.905 12.905 0 0 1 17.12 29h-.287a12.907 12.907 0 0 1-12.88-12.857V16Z" />
        <path d="M16.977 10.04v13.871a1.2 1.2 0 0 1-.091.448a1.2 1.2 0 0 1-1.1.741H7.62q-.309-.314-.593-.65a10 10 0 0 1-.521-.65a12.74 12.74 0 0 1-2.553-7.657v-.286A12.7 12.7 0 0 1 6.05 8.85h9.735a1.2 1.2 0 0 1 1.192 1.19" opacity=".2" />
        <path fill="url(#ft-ppt)" d="M3.194 8.85h11.938a1.193 1.193 0 0 1 1.194 1.191v11.918a1.193 1.193 0 0 1-1.194 1.191H3.194A1.19 1.19 0 0 1 2 21.959V10.041A1.19 1.19 0 0 1 3.194 8.85" />
        <path fill="#fff" d="M9.293 12.028a3.3 3.3 0 0 1 2.174.636a2.27 2.27 0 0 1 .756 1.841a2.56 2.56 0 0 1-.373 1.376a2.5 2.5 0 0 1-1.059.935a3.6 3.6 0 0 1-1.591.334H7.687v2.8H6.141v-7.922ZM7.686 15.94h1.331a1.74 1.74 0 0 0 1.177-.351a1.3 1.3 0 0 0 .4-1.025q0-1.309-1.525-1.31H7.686z" />
      </svg>
    )
  }

  // 기본(미지원 유형) — 중립 파일 아이콘
  return (
    <svg {...svgP}>
      <path fill="#eceff1" stroke="#b0bec5" strokeWidth="1" d="M8 3h11l7 7v17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path fill="#cfd8dc" d="M19 3l7 7h-7z" />
      <path fill="#b0bec5" d="M10 16h12v1.6H10zm0 3.4h12V21H10zm0 3.4h8v1.6h-8z" />
    </svg>
  )
}
