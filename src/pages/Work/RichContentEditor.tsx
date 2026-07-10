import { useEffect, useMemo } from 'react'
import Box from '@mui/material/Box'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import Underline from '@tiptap/extension-underline'
import Strike from '@tiptap/extension-strike'
import History from '@tiptap/extension-history'
import Placeholder from '@tiptap/extension-placeholder'
import { serializeContentFmt, parseContentFmt, plainToDoc } from './richContent'
import { ColorTokenMark, HighlightTokenMark, listExtensions, RichToolbar } from '@/components/richText'

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

export default function RichContentEditor({
  valueJson, valuePlain, onChange, placeholder, disabled, ariaLabel,
}: RichContentEditorProps) {
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
      ...listExtensions,
      History,
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: { attributes: { class: 'wc-editor', 'aria-label': ariaLabel || '업무 내용', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: ed }) => emit(ed),
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [disabled, editor])

  return (
    <Box className="wc-field" sx={{ width: '100%' }}>
      {!disabled && <RichToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </Box>
  )
}
