import DOMPurify from 'dompurify'
import Box from '@mui/material/Box'
import type { SxProps, Theme } from '@mui/material/styles'

/**
 * 리치텍스트 본문(HTML) 공용 살균·표시 — 공지·포털개선요청(게시글/답글)·데모 코멘트가 공유.
 * 저장 = editor.getHTML() 그대로, 표시 = richBodyHTML(DOMPurify) → RichBodyView.
 * 기존 평문 데이터는 줄바꿈→<p> + URL 자동 링크로 호환.
 */

// target="_blank" 링크는 살균 후에도 rel="noopener noreferrer" 강제(탭나빙 방지)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** 본문 → 안전 HTML. HTML이면 살균, 아니면 줄바꿈→<p>·URL 자동 링크. */
export function richBodyHTML(body: string): string {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|u|s|span|mark|img|a|h[1-6])\b/i.test(s)
  if (looksHTML) return DOMPurify.sanitize(s, { ADD_ATTR: ['target'] })
  let t = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  t = t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  return t
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
    .join('')
}

const viewSx = {
  wordBreak: 'break-word',
  '& p': { m: 0, mb: 0.25 },
  '& p:last-child': { mb: 0 },
  '& ul, & ol': { m: 0, mb: 0.25, pl: '18px' },
  '& ul': { listStyle: 'disc' },
  '& ol': { listStyle: 'decimal' },
  '& li': { m: '1px 0' },
  '& li p': { m: 0 },
} as const

/** 살균된 리치 본문 표시 — 글자색(.wc-color)·형광펜(.wc-hl)은 전역 CSS 적용 */
export function RichBodyView({ html, sx }: { html: string; sx?: SxProps<Theme> }) {
  return <Box sx={[viewSx, ...(Array.isArray(sx) ? sx : [sx])] as SxProps<Theme>} dangerouslySetInnerHTML={{ __html: richBodyHTML(html) }} />
}
