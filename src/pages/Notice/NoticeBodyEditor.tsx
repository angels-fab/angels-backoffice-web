import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import { alpha } from '@mui/material/styles'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'

/**
 * 공지 본문 리치텍스트 에디터 — 굵게·기울임·밑줄·취소선 + 글머리/번호 목록.
 * 출력은 HTML(editor.getHTML()). 저장·표시(noticeBodyHTML의 DOMPurify)와 그대로 호환.
 * NoticeCompose가 notice별로 key 리마운트하므로 초기값은 마운트 1회만 사용.
 */

// 초기 콘텐츠 — HTML이면 그대로, 평문이면 줄바꿈→문단(기존 평문 공지 호환)
const bodyToContent = (body: string): string => {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|u|s|a|h[1-6])\b/i.test(s)
  if (looksHTML) return s
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p></p>')).join('') || '<p></p>'
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

// 툴바 버튼 — 선택 유지 위해 mousedown 기본동작 차단
function TBtn({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          aria-label={title}
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          sx={(th) => ({
            p: 0.4, borderRadius: '7px',
            color: active ? 'primary.main' : 'text.secondary',
            bgcolor: active ? alpha(th.palette.primary.main, 0.16) : 'transparent',
            '&:hover': { bgcolor: alpha(th.palette.primary.main, active ? 0.22 : 0.1) },
          })}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function NoticeBodyEditor({ value, onChange, placeholder }: Props) {
  const editor: Editor | null = useEditor({
    extensions: [
      Document, Paragraph, Text, Bold, Italic, Underline, Strike,
      BulletList, OrderedList, ListItem, History,
      Placeholder.configure({ placeholder: placeholder || '내용' }),
    ],
    content: bodyToContent(value),
    editorProps: { attributes: { class: 'notice-editor', role: 'textbox', 'aria-multiline': 'true', 'aria-label': '공지 내용' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
  })

  if (!editor) return null
  const is = (n: string) => editor.isActive(n)

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', gap: 0.25, mb: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        <TBtn title="굵게" active={is('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FormatBoldIcon sx={{ fontSize: 18 }} /></TBtn>
        <TBtn title="기울임" active={is('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FormatItalicIcon sx={{ fontSize: 18 }} /></TBtn>
        <TBtn title="밑줄" active={is('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FormatUnderlinedIcon sx={{ fontSize: 18 }} /></TBtn>
        <TBtn title="취소선" active={is('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><StrikethroughSIcon sx={{ fontSize: 18 }} /></TBtn>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.25 }} />
        <TBtn title="글머리 목록" active={is('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FormatListBulletedIcon sx={{ fontSize: 18 }} /></TBtn>
        <TBtn title="번호 목록" active={is('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FormatListNumberedIcon sx={{ fontSize: 18 }} /></TBtn>
      </Box>
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
