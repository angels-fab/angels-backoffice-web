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
import { canJoin } from '@tiptap/pm/transform'
import { TextSelection } from '@tiptap/pm/state'
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
        handler: ({ state, range, match, commands }) => {
          const ch = circledNumber(parseInt(match[2], 10))
          if (!ch) return
          const $from = state.doc.resolve(range.from)
          const item = $from.node(-1)
          const inItem = item?.type.name === 'listItem'
          if (inItem && $from.index(-1) === 0) {
            // 글머리 줄에서 동그라미 숫자 = 한 줄에 글머리 두 개. 글머리를 떼고, 앞 항목에 딸린 줄로 만든다
            // (Shift+Enter로 만든 줄과 같은 자리 = 한 단계 들여쓰기)
            const tr = state.tr
            tr.delete(range.from, range.to)
            const posBefore = $from.before(-1) // 이 항목이 시작하는 자리 = 앞 항목과의 경계
            if (canJoin(tr.doc, posBefore)) {
              tr.join(posBefore) // 앞 항목과 합쳐 그 항목에 딸린 줄로
              tr.insertText(ch + ' ', tr.selection.from)
            } else {
              commands.liftListItem('listItem') // 앞 항목이 없으면(첫 항목) 목록 밖 줄로
              commands.insertContent(ch + ' ')
            }
            return
          }
          const parent = $from.node(-1)
          const prev = !inItem && $from.index(-1) > 0 ? parent.child($from.index(-1) - 1) : null
          const onlyTyped = $from.parent.textContent.length === range.to - range.from // 줄에 다른 글자가 없을 때만
          if (prev && onlyTyped && (prev.type.name === 'bulletList' || prev.type.name === 'orderedList')) {
            // 글머리를 지운 줄(= 목록 바로 뒤 문단)에서 동그라미 숫자 → 그 목록의 마지막 항목에 딸린 줄로 옮긴다.
            // 들여쓰기가 글머리 줄에서 쓴 경우와 같아진다(공백 2칸짜리 얕은 들여쓰기 방지)
            const tr = state.tr
            const pStart = $from.before()
            tr.delete(pStart, $from.after())
            tr.insert(pStart - 2, state.schema.nodes.paragraph.create(null, state.schema.text(ch + ' '))) // -2 = 앞 목록 마지막 항목 안
            tr.setSelection(TextSelection.create(tr.doc, pStart + 1))
            return
          }
          // 항목에 딸린 줄은 목록 구조가 이미 들여쓰므로 공백 없이, 그 외에는 관례대로 2칸
          const indent = inItem ? '' : (match[1] || '').length >= 2 ? match[1] : '  '
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
