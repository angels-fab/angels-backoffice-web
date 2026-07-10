import Box from '@mui/material/Box'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import { ColorTokenMark, HighlightTokenMark, listExtensions, RichToolbar } from '@/components/richText'

/**
 * 공지 본문 리치텍스트 에디터 — 업무 에디터와 동일한 공용 툴바·기능
 * (굵게·기울임·밑줄·취소선 + 글자색·형광펜 + 글머리/번호 목록·들여쓰기).
 * 출력은 HTML(editor.getHTML()). 저장·표시(noticeBodyHTML의 DOMPurify)와 그대로 호환.
 * NoticeCompose가 notice별로 key 리마운트하므로 초기값은 마운트 1회만 사용.
 */

// 초기 콘텐츠 — HTML이면 그대로, 평문이면 줄바꿈→문단(기존 평문 공지 호환)
const bodyToContent = (body: string): string => {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|u|s|a|h[1-6]|span|mark)\b/i.test(s)
  if (looksHTML) return s
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p></p>')).join('') || '<p></p>'
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export default function NoticeBodyEditor({ value, onChange, placeholder }: Props) {
  const editor: Editor | null = useEditor({
    extensions: [
      Document, Paragraph, Text,
      Bold, Italic, Underline, Strike, ColorTokenMark, HighlightTokenMark,
      ...listExtensions, History,
      Placeholder.configure({ placeholder: placeholder || '내용' }),
    ],
    content: bodyToContent(value),
    editorProps: { attributes: { class: 'notice-editor', role: 'textbox', 'aria-multiline': 'true', 'aria-label': '공지 내용' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
  })

  if (!editor) return null

  return (
    <Box sx={{ width: '100%' }}>
      <RichToolbar editor={editor} />
      <Box
        sx={{
          '& .ProseMirror': {
            minHeight: 88, outline: 'none', fontSize: 14, lineHeight: 1.7, color: 'text.primary',
            '& p': { m: 0, mb: 0.5 },
            '& ul, & ol': { pl: 3, m: 0, mb: 0.5 },
            '& ul': { listStyle: 'disc' },
            '& ol': { listStyle: 'decimal' },
            '& li': { mb: 0.25 },
            '& li p': { m: 0 },
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)',
            color: 'text.disabled',
            float: 'left',
            height: 0,
            pointerEvents: 'none',
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}
