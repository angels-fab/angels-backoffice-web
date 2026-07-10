import { useState } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import CheckIcon from '@mui/icons-material/Check'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS'
import FormatColorTextIcon from '@mui/icons-material/FormatColorText'
import BorderColorIcon from '@mui/icons-material/BorderColor'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatIndentIncreaseIcon from '@mui/icons-material/FormatIndentIncrease'
import FormatIndentDecreaseIcon from '@mui/icons-material/FormatIndentDecrease'
import FormatClearIcon from '@mui/icons-material/FormatClear'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { alpha } from '@mui/material/styles'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Mark, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import { COLOR_TOKENS, COLOR_LABEL, COLOR_VAR, type ColorToken } from '@/pages/Work/richContent'

/**
 * 업무·공지 공용 리치텍스트 — 마크(글자색·형광펜) + 목록 확장 + 공용 툴바.
 * 두 에디터(RichContentEditor·NoticeBodyEditor)가 동일 기능·동일 툴바를 공유한다.
 */

// ── 글자색 토큰(raw hex 아님) — <span data-color="red" class="wc-color">, CSS가 테마색 적용 ──
export const ColorTokenMark = Mark.create({
  name: 'colorToken',
  addAttributes() {
    return {
      token: {
        default: 'default',
        parseHTML: (el) => el.getAttribute('data-color') || 'default',
        renderHTML: (attrs) => (attrs.token && attrs.token !== 'default' ? { 'data-color': attrs.token } : {}),
      },
    }
  },
  parseHTML() { return [{ tag: 'span[data-color]' }] },
  renderHTML({ HTMLAttributes }) { return ['span', mergeAttributes({ class: 'wc-color' }, HTMLAttributes), 0] },
})

// ── 형광펜(하이라이트) — 단색, <mark class="wc-hl">, CSS가 테마 대응 배경 적용 ──
export const HighlightTokenMark = Mark.create({
  name: 'highlightToken',
  parseHTML() { return [{ tag: 'mark' }] },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes({ class: 'wc-hl' }, HTMLAttributes), 0] },
})

/** 목록 확장(글머리·번호·항목) — Tab/Shift-Tab 들여쓰기·자동 이어쓰기 포함(ListItem 기본 키맵) */
export const listExtensions = [BulletList, OrderedList, ListItem]

// 툴바 버튼(선택 유지 위해 mousedown 기본동작 차단)
function TBtn({ active, disabled, title, onClick, children }: {
  active?: boolean; disabled?: boolean; title: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          aria-label={title}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          sx={(th) => ({
            p: 0.4, borderRadius: '7px',
            color: active ? th.palette.primary.main : 'text.secondary',
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

/**
 * 공용 서식 툴바 — 굵게·기울임·밑줄·취소선 | 글자색·형광펜 | 글머리·번호·들여쓰기·내어쓰기 | 서식제거.
 * editor가 null이면 렌더 안 함. 색상 메뉴 상태는 내부 관리.
 */
export function RichToolbar({ editor }: { editor: Editor | null }) {
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null)
  // MS Office식 — 마지막 사용 색 기억, 본버튼 클릭=바로 적용, ▾만 팔레트
  const [lastColor, setLastColor] = useState<ColorToken>('red')
  if (!editor) return null

  const curColor: ColorToken = (editor.isActive('colorToken') ? editor.getAttributes('colorToken').token : 'default') as ColorToken
  const canSink = editor.can().sinkListItem('listItem')
  const canLift = editor.can().liftListItem('listItem')

  const applyColor = (token: ColorToken) => {
    const chain = editor.chain().focus()
    if (token === 'default') chain.unsetMark('colorToken').run()
    else chain.setMark('colorToken', { token }).run()
    setLastColor(token)
    setColorAnchor(null)
  }

  return (
    <Box
      onMouseDown={(e) => e.preventDefault()}
      sx={(th) => ({
        display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap',
        mb: 0.5, px: 0.5, py: 0.25, borderRadius: '8px',
        border: '1px solid', borderColor: th.palette.divider,
        bgcolor: alpha(th.palette.text.primary, 0.04),
      })}
    >
      <TBtn title="굵게 (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <FormatBoldIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="기울임 (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <FormatItalicIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="밑줄 (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <FormatUnderlinedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="취소선" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <StrikethroughSIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Tooltip title={`글자색 적용 (${COLOR_LABEL[lastColor]})`}>
          <span>
            <IconButton
              size="small" aria-label={`글자색 적용 (${COLOR_LABEL[lastColor]})`} aria-pressed={curColor !== 'default'}
              onMouseDown={(e) => e.preventDefault()} onClick={() => applyColor(lastColor)}
              sx={(th) => ({
                p: 0.4, borderRadius: '7px 0 0 7px',
                color: curColor !== 'default' ? COLOR_VAR[curColor] : 'text.secondary',
                bgcolor: curColor !== 'default' ? alpha(th.palette.primary.main, 0.16) : 'transparent',
                '&:hover': { bgcolor: alpha(th.palette.primary.main, 0.1) },
              })}
            >
              <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                <FormatColorTextIcon sx={{ fontSize: 16, display: 'block' }} />
                <Box sx={{ width: 15, height: 3, borderRadius: '1px', mt: '1px', bgcolor: lastColor === 'default' ? 'text.disabled' : COLOR_VAR[lastColor] }} />
              </Box>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="글자색 선택">
          <span>
            <IconButton
              size="small" aria-label="글자색 선택" aria-haspopup="menu"
              onMouseDown={(e) => e.preventDefault()} onClick={(e) => setColorAnchor(e.currentTarget)}
              sx={(th) => ({ p: 0, borderRadius: '0 7px 7px 0', color: 'text.secondary', '&:hover': { bgcolor: alpha(th.palette.primary.main, 0.1) } })}
            >
              <ArrowDropDownIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <TBtn title="형광펜" active={editor.isActive('highlightToken')} onClick={() => editor.chain().focus().toggleMark('highlightToken').run()}>
        <BorderColorIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      <TBtn title="글머리 목록" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <FormatListBulletedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="번호 목록" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <FormatListNumberedIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="들여쓰기 (Tab)" disabled={!canSink} onClick={() => editor.chain().focus().sinkListItem('listItem').run()}>
        <FormatIndentIncreaseIcon sx={{ fontSize: 18 }} />
      </TBtn>
      <TBtn title="내어쓰기 (Shift+Tab)" disabled={!canLift} onClick={() => editor.chain().focus().liftListItem('listItem').run()}>
        <FormatIndentDecreaseIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />

      <TBtn title="서식 제거" onClick={() => editor.chain().focus().unsetAllMarks().run()}>
        <FormatClearIcon sx={{ fontSize: 18 }} />
      </TBtn>

      <Menu
        anchorEl={colorAnchor}
        open={Boolean(colorAnchor)}
        onClose={() => setColorAnchor(null)}
        slotProps={{ list: { dense: true, onMouseDown: (e: React.MouseEvent) => e.preventDefault() } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {COLOR_TOKENS.map((tk) => (
          <MenuItem key={tk} onClick={() => applyColor(tk)} sx={{ gap: 1, fontSize: 13, minHeight: 34 }}>
            <Box
              component="span"
              sx={(th) => ({
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                bgcolor: tk === 'default' ? 'transparent' : COLOR_VAR[tk],
                border: tk === 'default' ? `1.5px solid ${th.palette.text.secondary}` : 'none',
              })}
            />
            <Box component="span" sx={{ flex: 1 }}>{COLOR_LABEL[tk]}</Box>
            {curColor === tk && <CheckIcon sx={{ fontSize: 15, color: 'primary.main' }} />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

// 초기 콘텐츠 — HTML이면 그대로, 평문이면 줄바꿈→문단(기존 평문 데이터 호환)
const bodyToContent = (body: string): string => {
  const s = String(body || '')
  const looksHTML = /<\/?(p|br|div|ul|li|ol|strong|b|em|u|s|a|h[1-6]|span|mark)\b/i.test(s)
  if (looksHTML) return s
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return s.split(/\r?\n/).map((l) => (l.trim() ? `<p>${esc(l)}</p>` : '<p></p>')).join('') || '<p></p>'
}

export interface RichBodyEditorProps {
  /** 초기 본문(HTML 또는 평문). 마운트 1회만 사용 — 이후엔 에디터가 자체 관리 */
  value: string
  /** 변경 시 HTML 반환(비면 '') */
  onChange: (html: string) => void
  placeholder?: string
  ariaLabel?: string
  fontSize?: number
  minHeight?: number
  /** true면 인풋처럼 테두리 박스로 감쌈(개선요청·답글·코멘트), false면 맨몸(공지) */
  framed?: boolean
  /** Ctrl/Cmd+Enter 콜백(코멘트 저장 등) */
  onCtrlEnter?: () => void
}

/**
 * 공용 리치 본문 에디터(HTML in/out) — 공지·포털개선요청(게시글/답글)·데모 코멘트가 공유.
 * RichToolbar 항상 표시. 저장은 getHTML() → 표시는 utils/richBody의 RichBodyView.
 */
export function RichBodyEditor({ value, onChange, placeholder, ariaLabel, fontSize = 13, minHeight = 64, framed = false, onCtrlEnter }: RichBodyEditorProps) {
  const editor = useEditor({
    extensions: [
      Document, Paragraph, Text,
      Bold, Italic, Underline, Strike, ColorTokenMark, HighlightTokenMark,
      ...listExtensions, History,
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: bodyToContent(value),
    editorProps: { attributes: { class: 'rb-editor', role: 'textbox', 'aria-multiline': 'true', 'aria-label': ariaLabel || '내용' } },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? '' : ed.getHTML()),
  })

  if (!editor) return null

  return (
    <Box sx={{ width: '100%' }} onKeyDown={(e) => { if (onCtrlEnter && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onCtrlEnter() } }}>
      <RichToolbar editor={editor} />
      <Box
        sx={(th) => ({
          ...(framed && {
            bgcolor: alpha(th.palette.text.primary, 0.05),
            border: '1px solid', borderColor: th.palette.divider, borderRadius: '8px',
            px: 1, py: '6px',
            '&:focus-within': { borderColor: th.palette.accent?.green || th.palette.primary.main },
          }),
          '& .ProseMirror': {
            minHeight, outline: 'none', fontSize, lineHeight: 1.65, color: 'text.primary',
            wordBreak: 'break-word', overflowWrap: 'anywhere',
            '& p': { m: 0, mb: 0.25 },
            '& p:last-child': { mb: 0 },
            '& ul, & ol': { pl: '18px', m: 0, mb: 0.25 },
            '& ul': { listStyle: 'disc' },
            '& ol': { listStyle: 'decimal' },
            '& li': { m: '1px 0' },
            '& li p': { m: 0 },
          },
          '& .ProseMirror p.is-editor-empty:first-of-type::before': {
            content: 'attr(data-placeholder)', color: 'text.disabled', float: 'left', height: 0, pointerEvents: 'none',
          },
        })}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  )
}
