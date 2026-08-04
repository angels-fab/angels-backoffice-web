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
import { Extension, InputRule } from '@tiptap/core'
import { circledNumber } from './workMeta'
import { serializeContentFmt, parseContentFmt, plainToDoc } from './richContent'
import { ColorTokenMark, HighlightTokenMark, listExtensions, RichToolbar } from '@/components/richText'
import { radius } from '@/theme/tokens'

// 입력 규칙: 'ㅇN ' → 들여쓴 동그라미 숫자(①…) — 업무 글쓰기 관례('- '는 BulletList 기본 규칙이 진짜 목록으로 처리)
// 글머리 항목 안에서는 앞 공백을 넣지 않는다 — 목록 구조가 이미 한 단계 들여쓰므로 겹치면 두 배로 밀린다
const CircledNumRule = Extension.create({
  name: 'workCircledNum',
  addInputRules() {
    return [
      new InputRule({
        find: /^([ \t]*)[ㅇᄋ](\d{1,2})\s$/,
        handler: ({ state, range, match }) => {
          const ch = circledNumber(parseInt(match[2], 10))
          if (!ch) return
          const $from = state.doc.resolve(range.from)
          let inList = false
          for (let d = $from.depth; d > 0; d -= 1) if ($from.node(d).type.name === 'listItem') { inList = true; break }
          const indent = inList ? '' : (match[1] || '').length >= 2 ? match[1] : '  '
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
      // Highlight를 Color보다 먼저 = 형광펜 mark가 바깥, 글자색이 안쪽 → 형광펜 위에서도 글자색 유지
      Bold, Italic, Underline, Strike, HighlightTokenMark, ColorTokenMark,
      ...listExtensions,
      History,
      Placeholder.configure({ placeholder: placeholder || '' }),
      CircledNumRule,
    ],
    content: initialContent,
    editable: !disabled,
    editorProps: { attributes: { class: 'wc-editor', 'aria-label': ariaLabel || '업무 내용', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: ed }) => emit(ed),
  })

  useEffect(() => { editor?.setEditable(!disabled) }, [disabled, editor])

  return (
    // TipTap 본문 프레임 — 툴바+본문을 함께 감싼다(서식툴 작성란 내부 규칙). 구 .wc-field
    <Box
      sx={(t) => ({
        width: '100%',
        background: 'var(--field-bg)',
        border: '1px solid var(--border)',
        borderRadius: `${radius.chip}px`,
        padding: '6px 8px',
        '&:focus-within': { borderColor: t.palette.accent.green },
      })}
    >
      {!disabled && <RichToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </Box>
  )
}
