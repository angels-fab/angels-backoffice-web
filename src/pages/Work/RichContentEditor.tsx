import { useEffect, useMemo, useState } from 'react'
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
import FormatClearIcon from '@mui/icons-material/FormatClear'
import { alpha } from '@mui/material/styles'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { Mark, Extension, InputRule, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import { circledNumber } from './workMeta'
import {
  serializeContentFmt, parseContentFmt, plainToDoc,
  COLOR_TOKENS, COLOR_LABEL, COLOR_VAR, type ColorToken,
  HIGHLIGHT_TOKENS, HIGHLIGHT_LABEL, HL_BG, type HighlightToken,
} from './richContent'

// ── 커스텀 mark: 글자색 토큰(raw hex 아님) — <span data-color="red"> 로 렌더, CSS가 테마색 적용 ──
const ColorTokenMark = Mark.create({
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

// ── 커스텀 mark: 하이라이트 토큰 — <mark data-hl="amber"> 로 렌더, CSS가 반투명 배경 적용 ──
const HighlightTokenMark = Mark.create({
  name: 'highlightToken',
  addAttributes() {
    return {
      token: {
        default: 'amber',
        parseHTML: (el) => el.getAttribute('data-hl') || 'amber',
        renderHTML: (attrs) => (attrs.token ? { 'data-hl': attrs.token } : {}),
      },
    }
  },
  parseHTML() { return [{ tag: 'mark[data-hl]' }] },
  renderHTML({ HTMLAttributes }) { return ['mark', mergeAttributes({ class: 'wc-hl' }, HTMLAttributes), 0] },
})

// ── 입력 규칙: 줄 시작 '- ' → '• ', 'ㅇN ' → 들여쓴 동그라미 숫자(기존 textarea 동작 재현) ──
const InlineMarkerRules = Extension.create({
  name: 'workMarkerRules',
  addInputRules() {
    return [
      new InputRule({
        find: /^([ \t]*)-\s$/,
        handler: ({ state, range, match }) => {
          state.tr.insertText((match[1] || '') + '• ', range.from, range.to)
        },
      }),
      new InputRule({
        find: /^([ \t]*)[ㅇᄋ](\d{1,2})\s$/,
        handler: ({ state, range, match }) => {
          const ch = circledNumber(parseInt(match[2], 10))
          if (!ch) return
          const indent = (match[1] || '').length >= 2 ? match[1] : '  '
          state.tr.insertText(indent + ch + ' ', range.from, range.to)
        },
      }),
    ]
  },
})

export interface RichContentEditorProps {
  /** 초기 서식 JSON(업무내용서식). 유효하면 이 문서로 복원 */
  valueJson: string
  /** 초기 일반 본문(• 글머리 포함). JSON 없거나 손상 시 이 텍스트를 서식 없는 문서로 변환 */
  valuePlain: string
  /** 변경 시 일반 텍스트 + 서식 JSON 동시 반환 */
  onChange: (p: { json: string; text: string }) => void
  placeholder?: string
  disabled?: boolean
  ariaLabel?: string
}

// 툴바 서식 버튼(선택 유지 위해 mousedown 기본동작 차단)
function MarkBtn({ active, disabled, title, onClick, children }: {
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
            color: active ? th.palette.accent.green : 'text.secondary',
            bgcolor: active ? alpha(th.palette.accent.green, 0.16) : 'transparent',
            '&:hover': { bgcolor: alpha(th.palette.accent.green, active ? 0.22 : 0.1) },
          })}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  )
}

export default function RichContentEditor({
  valueJson, valuePlain, onChange, placeholder, disabled, ariaLabel,
}: RichContentEditorProps) {
  const [focused, setFocused] = useState(false)
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null)
  const [hlAnchor, setHlAnchor] = useState<HTMLElement | null>(null)

  const initialContent = useMemo(() => {
    const doc = parseContentFmt(valueJson)
    return doc ? { type: 'doc', content: doc.content } : plainToDoc(valuePlain)
    // 초기값만 사용(마운트 1회) — 이후엔 에디터가 자체 관리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emit = (ed: Editor) => {
    let json = ''
    try { json = serializeContentFmt(ed.getJSON()) } catch { json = '' }
    onChange({ json, text: ed.getText({ blockSeparator: '\n' }) })
  }

  const editor = useEditor({
    extensions: [
      Document, Paragraph, Text,
      Bold, Italic, Underline, Strike, ColorTokenMark, HighlightTokenMark,
      History,
      Placeholder.configure({ placeholder: placeholder || '' }),
      InlineMarkerRules,
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: { attributes: { class: 'wc-editor', 'aria-label': ariaLabel || '업무 내용', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: ed }) => emit(ed),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [disabled, editor])

  const active = !disabled && (focused || Boolean(colorAnchor) || Boolean(hlAnchor))
  const curColor: ColorToken = (editor?.isActive('colorToken') ? editor.getAttributes('colorToken').token : 'default') as ColorToken
  const curHl: HighlightToken = (editor?.isActive('highlightToken') ? editor.getAttributes('highlightToken').token : 'none') as HighlightToken

  const applyColor = (token: ColorToken) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (token === 'default') chain.unsetMark('colorToken').run()
    else chain.setMark('colorToken', { token }).run()
    setColorAnchor(null)
  }

  const applyHighlight = (token: HighlightToken) => {
    if (!editor) return
    const chain = editor.chain().focus()
    if (token === 'none') chain.unsetMark('highlightToken').run()
    else chain.setMark('highlightToken', { token }).run()
    setHlAnchor(null)
  }

  return (
    <Box className="wc-field" sx={{ width: '100%' }}>
      {active && (
        <Box
          onMouseDown={(e) => e.preventDefault()}
          sx={(th) => ({
            display: 'flex', alignItems: 'center', gap: 0.25, flexWrap: 'wrap',
            mb: 0.5, px: 0.5, py: 0.25, borderRadius: '8px',
            border: '1px solid', borderColor: th.palette.divider,
            bgcolor: alpha(th.palette.text.primary, 0.04),
          })}
        >
          <MarkBtn title="굵게 (Ctrl+B)" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <FormatBoldIcon sx={{ fontSize: 18 }} />
          </MarkBtn>
          <MarkBtn title="기울임 (Ctrl+I)" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <FormatItalicIcon sx={{ fontSize: 18 }} />
          </MarkBtn>
          <MarkBtn title="밑줄 (Ctrl+U)" active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <FormatUnderlinedIcon sx={{ fontSize: 18 }} />
          </MarkBtn>
          <MarkBtn title="취소선" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
            <StrikethroughSIcon sx={{ fontSize: 18 }} />
          </MarkBtn>
          <Divider orientation="vertical" flexItem sx={{ my: 0.25 }} />
          <Tooltip title="형광펜">
            <span>
              <IconButton
                size="small"
                aria-label="형광펜"
                aria-pressed={curHl !== 'none'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => setHlAnchor(e.currentTarget)}
                sx={(th) => ({
                  p: 0.4, borderRadius: '7px', color: 'text.secondary',
                  bgcolor: curHl !== 'none' ? HL_BG[curHl] : 'transparent',
                  '&:hover': { bgcolor: curHl !== 'none' ? HL_BG[curHl] : alpha(th.palette.accent.green, 0.1) },
                })}
              >
                <BorderColorIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="글자색">
            <span>
              <IconButton
                size="small"
                aria-label="글자색"
                aria-pressed={curColor !== 'default'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => setColorAnchor(e.currentTarget)}
                sx={(th) => ({
                  p: 0.4, borderRadius: '7px',
                  color: curColor !== 'default' ? COLOR_VAR[curColor] : 'text.secondary',
                  bgcolor: curColor !== 'default' ? alpha(th.palette.accent.green, 0.16) : 'transparent',
                  '&:hover': { bgcolor: alpha(th.palette.accent.green, 0.1) },
                })}
              >
                <FormatColorTextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <MarkBtn title="서식 제거" onClick={() => editor?.chain().focus().unsetAllMarks().run()}>
            <FormatClearIcon sx={{ fontSize: 18 }} />
          </MarkBtn>
        </Box>
      )}

      <EditorContent editor={editor} />

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
            {curColor === tk && <CheckIcon sx={{ fontSize: 15, color: 'accent.green' }} />}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={hlAnchor}
        open={Boolean(hlAnchor)}
        onClose={() => setHlAnchor(null)}
        slotProps={{ list: { dense: true, onMouseDown: (e: React.MouseEvent) => e.preventDefault() } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {HIGHLIGHT_TOKENS.map((tk) => (
          <MenuItem key={tk} onClick={() => applyHighlight(tk)} sx={{ gap: 1, fontSize: 13, minHeight: 34 }}>
            <Box
              component="span"
              sx={(th) => ({
                width: 14, height: 14, borderRadius: '4px', flexShrink: 0,
                bgcolor: tk === 'none' ? 'transparent' : HL_BG[tk],
                border: tk === 'none' ? `1.5px solid ${th.palette.text.secondary}` : `1px solid ${alpha(th.palette.text.primary, 0.15)}`,
              })}
            />
            <Box component="span" sx={{ flex: 1 }}>{HIGHLIGHT_LABEL[tk]}</Box>
            {curHl === tk && <CheckIcon sx={{ fontSize: 15, color: 'accent.green' }} />}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
