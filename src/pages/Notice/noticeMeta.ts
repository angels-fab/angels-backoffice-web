import DOMPurify from 'dompurify'
import type { StatusKind } from '@/components/ds'

/** 공지 분류 → StatusKind (디자인 시스템 색 통일). 미정의 분류는 neutral. */
const NOTICE_CAT_STATUS: Record<string, StatusKind> = {
  긴급: 'error',
  안전: 'error',
  보안: 'purple',
  시설: 'success',
  공지: 'info',
  일반: 'neutral',
  회의: 'purple',
  교육: 'teal',
  행사: 'success',
  점검: 'warning',
}
export const noticeCatStatus = (cat: string): StatusKind => NOTICE_CAT_STATUS[cat] ?? 'neutral'

// target="_blank" 링크는 살균 후에도 rel="noopener noreferrer" 강제(탭나빙 방지)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/** 본문 → 안전 HTML. HTML이면 살균, 아니면 줄바꿈→<p>·URL 자동 링크. */
export function noticeBodyHTML(body: string): string {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|img|a|h[1-6])\b/i.test(s)
  if (looksHTML) return DOMPurify.sanitize(s, { ADD_ATTR: ['target'] })
  let t = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  t = t.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
  return t
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p>${line}</p>` : ''))
    .join('')
}
